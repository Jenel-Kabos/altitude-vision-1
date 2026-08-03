// DOC-EVO-1 — recherche globale intelligente : retrouve automatiquement les
// dossiers/documents liés à un propriétaire, locataire, bien, contrat,
// facture ou numéro — pure lecture sur les modèles existants.
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Proprietaire = require('../models/Proprietaire');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');
const Document = require('../models/Document');
const FinancialDocument = require('../models/FinancialDocument');
const dossierRoutes = require('../routes/dossierRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();

const app = express();
app.use(express.json());
app.use('/api/dossiers', dossierRoutes);
app.use(errorHandler);

const signToken = (userId) => jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Test User', email: `dsearch${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('401 sans authentification', async () => {
  const res = await request(app).get('/api/dossiers/search').query({ q: 'test' });
  expect(res.status).toBe(401);
});

test('403 — un Client ne peut pas utiliser la recherche globale', async () => {
  const client = await makeUser({ role: 'Client' });
  const res = await request(app).get('/api/dossiers/search').query({ q: 'test' }).set('Authorization', `Bearer ${signToken(client._id)}`);
  expect(res.status).toBe(403);
});

test('recherche vide/trop courte : liste vide, jamais une erreur', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const res = await request(app).get('/api/dossiers/search').query({ q: 'a' }).set('Authorization', `Bearer ${signToken(admin._id)}`);
  expect(res.status).toBe(200);
  expect(res.body.data.results).toEqual([]);
});

test('retrouve le dossier de bail par nom de locataire, propriétaire ou bien', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const owner = await makeUser({ role: 'Proprietaire' });
  const property = await Property.create({
    title: 'Villa Recherche Unique', description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Loué', owner: owner._id,
  });
  const proprietaire = await Proprietaire.create({ nom: 'Nkounkou', prenom: 'AliceRecherche', telephone: '+242060000020' });
  const locataire = await Locataire.create({ nom: 'MokeRechercheUnique', prenom: 'Paul', telephone: '+242060000021' });
  const contrat = await Contrat.create({ type: 'location', bien: property._id, proprietaire: proprietaire._id, locataire: locataire._id, statut: 'actif', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000 });

  const byTenant = await request(app).get('/api/dossiers/search').query({ q: 'MokeRechercheUnique' }).set('Authorization', `Bearer ${signToken(admin._id)}`);
  expect(byTenant.body.data.results.some((r) => r.domain === 'gestion_locative' && r.entityId === String(contrat._id))).toBe(true);

  const byOwner = await request(app).get('/api/dossiers/search').query({ q: 'AliceRecherche' }).set('Authorization', `Bearer ${signToken(admin._id)}`);
  expect(byOwner.body.data.results.some((r) => r.entityId === String(contrat._id))).toBe(true);

  const byProperty = await request(app).get('/api/dossiers/search').query({ q: 'Villa Recherche Unique' }).set('Authorization', `Bearer ${signToken(admin._id)}`);
  expect(byProperty.body.data.results.some((r) => r.entityId === String(contrat._id))).toBe(true);
});

test('retrouve un Document par numéro exact', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const doc = await Document.create({ type: 'Facture', status: 'Envoyé', refNom: 'Client Recherche Doc', notes: 'note' });
  const res = await request(app).get('/api/dossiers/search').query({ q: String(doc.docNumber) }).set('Authorization', `Bearer ${signToken(admin._id)}`);
  expect(res.body.data.results.some((r) => r.documentId === String(doc._id))).toBe(true);
});

test('recherche vide/trop courte : un seul chiffre reste autorisé (référence exacte)', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const doc = await Document.create({ type: 'Facture', status: 'Envoyé', refNom: 'Client X' });
  const res = await request(app).get('/api/dossiers/search').query({ q: '1' }).set('Authorization', `Bearer ${signToken(admin._id)}`);
  expect(res.status).toBe(200);
  expect(res.body.data.results.some((r) => r.documentId === String(doc._id))).toBe(true);
});

test('retrouve une facture hôtelière par numéro et renvoie un lien vers le dossier hôtellerie', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const subjectId = id();
  await FinancialDocument.create({
    domain: 'hotel', establishmentType: 'Hotel', establishmentId: id(), documentType: 'invoice', status: 'issued', currency: 'XAF',
    subjectType: 'HotelReservation', subjectId, documentNumber: 'INV-SEARCH-001',
    totalMinor: 100000, businessOperationKey: `search-test-${subjectId}`, createdBy: admin._id,
  });
  const res = await request(app).get('/api/dossiers/search').query({ q: 'INV-SEARCH-001' }).set('Authorization', `Bearer ${signToken(admin._id)}`);
  const hit = res.body.data.results.find((r) => r.label.includes('INV-SEARCH-001'));
  expect(hit).toMatchObject({ kind: 'dossier', domain: 'hotellerie', entityId: String(subjectId) });
});
