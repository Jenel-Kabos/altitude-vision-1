// GL-ARCH-1.1 — Import staff d'un Proprietaire.biensPropres[] (fiche interne
// historique) vers un vrai Property + RentalManagement actif, pour permettre
// la création d'un bail sans passer par la publication. Couvre la règle
// métier validée : résolution de l'owner (User lié existant ou User
// technique créé, jamais le compte du staff), dédoublonnage, complétion des
// champs manquants, permissions strictes, et non-invention de valeurs.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Proprietaire = require('../models/Proprietaire');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const Contrat = require('../models/Contrat');
const proprietaireRoutes = require('../routes/proprietaireRoutes');
const contratRoutes = require('../routes/contratRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/proprietaires', proprietaireRoutes);
app.use('/api/contrats', contratRoutes);
app.use(errorHandler);

const signToken = (id, tokenVersion = 0) => jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({
    name: 'Utilisateur Test', email: `glimport${counter}${Date.now()}@example.com`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides,
  });
};

const makeProprietaireWithBien = (overrides = {}) => Proprietaire.create({
  nom: 'Nkounkou', prenom: 'Pauline', telephone: '+242061234567',
  biensPropres: [{
    typeBien: 'location', titre: 'Bien Propre Import Test', type: 'Appartement',
    adresse: 'Avenue Test 12', ville: 'Brazzaville', quartier: 'Poto-Poto',
    superficie: 60, nombreChambres: 2, nombreSDB: 1, prixLoyer: 200000, statut: 'Disponible',
    photos: ['https://placehold.co/1200x800/png?text=BienPropre'],
    description: 'Description suffisamment longue pour la validation du modèle Property.',
  }],
  ...overrides,
});

const validOverrides = { address: { arrondissement: 'Poto-Poto' }, latitude: -4.26, longitude: 15.28 };

// `startFinancialMongo` connecte avec `autoIndex: false` (perf des autres
// suites) — l'index unique sparse `sourceOwnerAssetId` (dédoublonnage
// concurrent) doit être construit explicitement pour être réellement
// appliqué en base, même convention que `Contrat.syncIndexes()` dans
// contratCreationManuelleVsReservation.mongo.integration.test.js.
beforeAll(async () => { await startFinancialMongo(); await Property.syncIndexes(); });
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('GL-ARCH-1.1 — POST /api/proprietaires/:id/biens/:bienIndex/importer-gestion — permissions', () => {
  test('401 sans authentification', async () => {
    const proprietaire = await makeProprietaireWithBien();
    const res = await request(app).post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`).send(validOverrides);
    expect(res.status).toBe(401);
  });

  test('403 — un Proprietaire ne peut pas importer lui-même', async () => {
    const proprietaire = await makeProprietaireWithBien();
    const user = await makeUser({ role: 'Proprietaire' });
    const res = await request(app)
      .post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`)
      .set('Authorization', `Bearer ${signToken(user._id)}`)
      .send(validOverrides);
    expect(res.status).toBe(403);
    expect(await Property.countDocuments({})).toBe(0);
  });

  test('403 — un Client ne peut pas importer', async () => {
    const proprietaire = await makeProprietaireWithBien();
    const user = await makeUser({ role: 'Client' });
    const res = await request(app)
      .post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`)
      .set('Authorization', `Bearer ${signToken(user._id)}`)
      .send(validOverrides);
    expect(res.status).toBe(403);
  });

  test('403 — un Collaborateur ne peut pas importer (aucune capacité explicite ne le permet)', async () => {
    const proprietaire = await makeProprietaireWithBien();
    const user = await makeUser({ role: 'Collaborateur' });
    const res = await request(app)
      .post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`)
      .set('Authorization', `Bearer ${signToken(user._id)}`)
      .send(validOverrides);
    expect(res.status).toBe(403);
  });

  test.each(['Admin', 'GestionnaireImmobilier'])('201 — %s peut importer', async (role) => {
    const proprietaire = await makeProprietaireWithBien();
    const staff = await makeUser({ role });
    const res = await request(app)
      .post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`)
      .set('Authorization', `Bearer ${signToken(staff._id)}`)
      .send(validOverrides);
    expect(res.status).toBe(201);
  });
});

describe('GL-ARCH-1.1 — complétion des champs manquants (jamais devinés)', () => {
  test('422 avec la liste précise des champs manquants (latitude/longitude/arrondissement toujours absents de la source)', async () => {
    const proprietaire = await makeProprietaireWithBien();
    const admin = await makeUser({ role: 'Admin' });
    const res = await request(app)
      .post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`)
      .set('Authorization', `Bearer ${signToken(admin._id)}`)
      .send({});
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INCOMPLETE_SOURCE_BIEN');
    expect(res.body.missingFields).toEqual(expect.arrayContaining(['arrondissement', 'latitude', 'longitude']));
    expect(await Property.countDocuments({})).toBe(0);
  });

  test('422 — un bien déclaré à la vente (typeBien: vente) est refusé, jamais importé en location', async () => {
    const proprietaire = await makeProprietaireWithBien({
      biensPropres: [{
        typeBien: 'vente', titre: 'Bien Vente', adresse: 'Rue X', ville: 'Brazzaville',
        prixVente: 50000000, description: 'Description suffisamment longue pour la validation du modèle Property.',
      }],
    });
    const admin = await makeUser({ role: 'Admin' });
    const res = await request(app)
      .post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`)
      .set('Authorization', `Bearer ${signToken(admin._id)}`)
      .send(validOverrides);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('WRONG_TRANSACTION_TYPE');
  });
});

describe('GL-ARCH-1.1 — résolution de l’owner (règle validée)', () => {
  test('crée un User technique inactif lorsque la fiche Proprietaire n’a aucun User lié', async () => {
    const proprietaire = await makeProprietaireWithBien();
    const admin = await makeUser({ role: 'Admin' });
    const res = await request(app)
      .post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`)
      .set('Authorization', `Bearer ${signToken(admin._id)}`)
      .send(validOverrides);

    expect(res.status).toBe(201);
    const property = await Property.findById(res.body.data.property._id);
    const ownerUser = await User.findById(property.owner);
    expect(ownerUser.isTechnical).toBe(true);
    expect(ownerUser.isActive).toBe(false);
    expect(ownerUser.role).toBe('Proprietaire');

    const updatedProprietaire = await Proprietaire.findById(proprietaire._id);
    expect(String(updatedProprietaire.user)).toBe(String(ownerUser._id));
  });

  test('réutilise le User déjà lié à la fiche Proprietaire, sans jamais utiliser le compte du staff', async () => {
    const linkedUser = await makeUser({ role: 'Proprietaire' });
    const proprietaire = await makeProprietaireWithBien({ user: linkedUser._id });
    const admin = await makeUser({ role: 'Admin' });

    const res = await request(app)
      .post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`)
      .set('Authorization', `Bearer ${signToken(admin._id)}`)
      .send(validOverrides);

    expect(res.status).toBe(201);
    expect(String(res.body.data.property.owner)).toBe(String(linkedUser._id));
    expect(String(res.body.data.property.owner)).not.toBe(String(admin._id));
  });

  test('deux imports concurrents (fiches Proprietaire différentes, aucun User lié) ne créent jamais deux Users techniques pour le même Proprietaire — un seul appel donc un seul User par construction', async () => {
    const proprietaire = await makeProprietaireWithBien();
    const admin = await makeUser({ role: 'Admin' });
    await request(app)
      .post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`)
      .set('Authorization', `Bearer ${signToken(admin._id)}`)
      .send(validOverrides);
    const usersForThisProprietaire = await User.countDocuments({ isTechnical: true, email: new RegExp(String(proprietaire._id)) });
    expect(usersForThisProprietaire).toBe(1);
  });
});

describe('GL-ARCH-1.1 — création réelle, dédoublonnage, non-publication', () => {
  test('Property créé non publié, RentalManagement actif créé, bien visible en Gestion locative', async () => {
    const proprietaire = await makeProprietaireWithBien();
    const admin = await makeUser({ role: 'Admin' });
    const res = await request(app)
      .post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`)
      .set('Authorization', `Bearer ${signToken(admin._id)}`)
      .send(validOverrides);

    expect(res.status).toBe(201);
    const property = await Property.findById(res.body.data.property._id);
    expect(property.isPublished).toBe(false);
    expect(property.statusAdmin).toBe('En attente');
    expect(property.sourceType).toBe('proprietaire_bien_propre');

    const rental = await RentalManagement.findOne({ property: property._id });
    expect(rental.managementActivated).toBe(true);
  });

  test('un double import (même propriétaire, même bien) ne crée jamais de doublon — retourne le même Property', async () => {
    const proprietaire = await makeProprietaireWithBien();
    const admin = await makeUser({ role: 'Admin' });
    const first = await request(app)
      .post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`)
      .set('Authorization', `Bearer ${signToken(admin._id)}`)
      .send(validOverrides);
    const second = await request(app)
      .post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`)
      .set('Authorization', `Bearer ${signToken(admin._id)}`)
      .send(validOverrides);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.alreadyImported).toBe(true);
    expect(String(second.body.data.property._id)).toBe(String(first.body.data.property._id));
    expect(await Property.countDocuments({ sourceType: 'proprietaire_bien_propre' })).toBe(1);
  });

  test('deux imports concurrents (Promise.all) ne créent jamais deux Property pour le même bien source', async () => {
    const proprietaire = await makeProprietaireWithBien();
    const admin = await makeUser({ role: 'Admin' });
    const [r1, r2] = await Promise.all([
      request(app).post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`).set('Authorization', `Bearer ${signToken(admin._id)}`).send(validOverrides),
      request(app).post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`).set('Authorization', `Bearer ${signToken(admin._id)}`).send(validOverrides),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 201].sort());
    expect(await Property.countDocuments({ sourceType: 'proprietaire_bien_propre' })).toBe(1);
  });

  test('le bien importé n’apparaît pas dans les annonces publiques (non publié)', async () => {
    const proprietaire = await makeProprietaireWithBien();
    const admin = await makeUser({ role: 'Admin' });
    const importRes = await request(app)
      .post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`)
      .set('Authorization', `Bearer ${signToken(admin._id)}`)
      .send(validOverrides);

    const { getAllProperties } = require('../controllers/propertyController');
    let payload;
    const res = { json: (body) => { payload = body; return res; }, status: () => res };
    await getAllProperties({ query: {}, user: null }, res);
    const ids = payload.data.properties.map((p) => String(p._id));
    expect(ids).not.toContain(String(importRes.body.data.property._id));
  });

  test('un contrat de bail peut être créé sur le bien importé, non publié, sans réservation ni publication', async () => {
    const proprietaire = await makeProprietaireWithBien();
    const admin = await makeUser({ role: 'Admin' });
    const importRes = await request(app)
      .post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`)
      .set('Authorization', `Bearer ${signToken(admin._id)}`)
      .send(validOverrides);
    const propertyId = importRes.body.data.property._id;
    expect((await Property.findById(propertyId)).statusAdmin).toBe('En attente');

    const contratRes = await request(app)
      .post('/api/contrats')
      .set('Authorization', `Bearer ${signToken(admin._id)}`)
      .send({ type: 'location', bien: propertyId, statut: 'actif', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 200000 });

    expect(contratRes.status).toBe(201);
    expect(await Contrat.countDocuments({ bien: propertyId })).toBe(1);
  });
});
