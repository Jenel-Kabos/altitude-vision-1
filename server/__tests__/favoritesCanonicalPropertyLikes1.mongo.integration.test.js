// HOTFIX-FAVORITES-CANONICAL-PROPERTY-LIKES-1
// Property.likes[] est la source canonique du cœur immobilier (mobile + web,
// DetailAnnonceScreen.jsx / PropertyDetailPage.jsx). GET /likes/my-favorites
// doit désormais refléter cette source, en plus (union, sans perte) des
// documents Like legacy déjà écrits par PropertyCard.jsx (LikeButton
// targetType="Property" → POST /api/likes → collection Like) — un second
// chemin d'écriture réel et actif découvert pendant ce mandat, distinct du
// cœur de la fiche détail. Voir server/docs/AUDIT_MOBILE_FAVORITES_LIKE_SYNC1_REPORT.md
// et server/docs/HOTFIX_FAVORITES_CANONICAL_PROPERTY_LIKES1_REPORT.md.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Like = require('../models/Like');
const likeRoutes = require('../routes/likeRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/likes', likeRoutes);
app.use(errorHandler);

const signToken = (userId, tokenVersion = 0) => jwt.sign({ id: userId, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Test User', email: `favlikes${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

const makeProperty = async (overrides = {}) => {
  const owner = await makeUser({ role: 'Proprietaire' });
  return Property.create({
    title: 'Villa GL-FAV-1', description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Disponible', owner: owner._id,
    ...overrides,
  });
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('un bien aimé via la source canonique Property.likes[] (le cœur réel) apparaît dans Mes favoris, SANS document Like créé', async () => {
  const user = await makeUser();
  const property = await makeProperty();

  // Simule exactement l'effet de POST /properties/:id/like (propertyController.toggleLike) :
  // $addToSet sur Property.likes — jamais d'écriture dans la collection Like.
  await Property.findByIdAndUpdate(property._id, { $addToSet: { likes: user._id } });

  expect(await Like.countDocuments({ targetType: 'Property' })).toBe(0);

  const res = await request(app)
    .get('/api/likes/my-favorites?type=Property')
    .set('Authorization', `Bearer ${signToken(user._id)}`);

  expect(res.status).toBe(200);
  const ids = res.body.data.favorites.properties.map((p) => String(p._id));
  expect(ids).toContain(String(property._id));

  // Le fix ne doit jamais créer de document Like en lisant les favoris.
  expect(await Like.countDocuments({ targetType: 'Property' })).toBe(0);
});

test('un autre utilisateur (qui n\'a pas aimé le bien) ne le voit pas dans ses favoris — isolation stricte', async () => {
  const userA = await makeUser();
  const userB = await makeUser();
  const property = await makeProperty();
  await Property.findByIdAndUpdate(property._id, { $addToSet: { likes: userA._id } });

  const res = await request(app)
    .get('/api/likes/my-favorites?type=Property')
    .set('Authorization', `Bearer ${signToken(userB._id)}`);

  expect(res.status).toBe(200);
  const ids = res.body.data.favorites.properties.map((p) => String(p._id));
  expect(ids).not.toContain(String(property._id));
});

test('unlike via le mécanisme canonique ($pull sur Property.likes[]) retire le bien de Mes favoris', async () => {
  const user = await makeUser();
  const property = await makeProperty();
  await Property.findByIdAndUpdate(property._id, { $addToSet: { likes: user._id } });

  const before = await request(app)
    .get('/api/likes/my-favorites?type=Property')
    .set('Authorization', `Bearer ${signToken(user._id)}`);
  expect(before.body.data.favorites.properties.map((p) => String(p._id))).toContain(String(property._id));

  // Simule POST /properties/:id/like en deuxième appel (toggle → unlike) : $pull.
  await Property.findByIdAndUpdate(property._id, { $pull: { likes: user._id } });

  const after = await request(app)
    .get('/api/likes/my-favorites?type=Property')
    .set('Authorization', `Bearer ${signToken(user._id)}`);
  expect(after.status).toBe(200);
  expect(after.body.data.favorites.properties.map((p) => String(p._id))).not.toContain(String(property._id));
});

test('plusieurs favoris canoniques sont tous retournés, sans doublon', async () => {
  const user = await makeUser();
  const p1 = await makeProperty({ title: 'Villa 1' });
  const p2 = await makeProperty({ title: 'Villa 2' });
  await Property.findByIdAndUpdate(p1._id, { $addToSet: { likes: user._id } });
  await Property.findByIdAndUpdate(p2._id, { $addToSet: { likes: user._id } });

  const res = await request(app)
    .get('/api/likes/my-favorites?type=Property')
    .set('Authorization', `Bearer ${signToken(user._id)}`);

  const ids = res.body.data.favorites.properties.map((p) => String(p._id));
  expect(ids.sort()).toEqual([String(p1._id), String(p2._id)].sort());
  expect(new Set(ids).size).toBe(ids.length);
});

test('un bien "hébergement" (cas réel VILLA MEUBLEE) aimé via le mécanisme canonique apparaît bien dans Mes favoris', async () => {
  const user = await makeUser();
  const property = await makeProperty({
    title: 'VILLA MEUBLEE AU PLATEAU DE 15 ANS',
    status: 'hebergement',
    accommodationType: 'villa_meublee',
  });
  await Property.findByIdAndUpdate(property._id, { $addToSet: { likes: user._id } });

  const res = await request(app)
    .get('/api/likes/my-favorites?type=Property')
    .set('Authorization', `Bearer ${signToken(user._id)}`);

  const ids = res.body.data.favorites.properties.map((p) => String(p._id));
  expect(ids).toContain(String(property._id));
});

test('un bien non validé/non disponible reste visible dans Mes favoris (comportement préexistant préservé, aucun nouveau filtre inventé)', async () => {
  const user = await makeUser();
  const property = await makeProperty({ statusAdmin: 'En attente', availability: 'Loué' });
  await Property.findByIdAndUpdate(property._id, { $addToSet: { likes: user._id } });

  const res = await request(app)
    .get('/api/likes/my-favorites?type=Property')
    .set('Authorization', `Bearer ${signToken(user._id)}`);

  const ids = res.body.data.favorites.properties.map((p) => String(p._id));
  expect(ids).toContain(String(property._id));
});

test('UNION legacy : un document Like existant (écrit via PropertyCard.jsx, sans entrée dans Property.likes[]) reste visible — aucune perte de donnée', async () => {
  const user = await makeUser();
  const property = await makeProperty();

  // Simule l'effet de LikeButton (PropertyCard.jsx) → POST /api/likes → collection Like,
  // sans jamais toucher Property.likes[] (chemin d'écriture réel et distinct, découvert
  // pendant l'audit AUDIT-MOBILE-FAVORITES-LIKE-SYNC-1).
  await Like.create({ user: user._id, targetType: 'Property', targetId: property._id });

  const propFresh = await Property.findById(property._id).select('likes').lean();
  expect(propFresh.likes).toHaveLength(0);

  const res = await request(app)
    .get('/api/likes/my-favorites?type=Property')
    .set('Authorization', `Bearer ${signToken(user._id)}`);

  const ids = res.body.data.favorites.properties.map((p) => String(p._id));
  expect(ids).toContain(String(property._id));
});

test('UNION sans doublon : un bien présent à la fois dans Property.likes[] ET dans un document Like legacy n\'apparaît qu\'une seule fois', async () => {
  const user = await makeUser();
  const property = await makeProperty();
  await Property.findByIdAndUpdate(property._id, { $addToSet: { likes: user._id } });
  await Like.create({ user: user._id, targetType: 'Property', targetId: property._id });

  const res = await request(app)
    .get('/api/likes/my-favorites?type=Property')
    .set('Authorization', `Bearer ${signToken(user._id)}`);

  const ids = res.body.data.favorites.properties.map((p) => String(p._id));
  expect(ids.filter((id) => id === String(property._id))).toHaveLength(1);
});

test('401 sans authentification', async () => {
  const res = await request(app).get('/api/likes/my-favorites?type=Property');
  expect(res.status).toBe(401);
});
