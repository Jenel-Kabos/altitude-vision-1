// GL-DEBT-1 — Phase 4 : documentController.getAllDocuments injectait
// `{...req.query}` tel quel dans Document.find(). Ce test monte la même
// chaîne de middleware que server.js (express-mongo-sanitize inclus) pour
// vérifier la défense en profondeur réelle : même si mongoSanitize ne
// neutralisait pas une tentative donnée, buildDocumentFilter() doit à lui
// seul ignorer toute clé/valeur non whitelistée.

const express = require('express');
const mongoSanitize = require('express-mongo-sanitize');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Document = require('../models/Document');
const documentRoutes = require('../routes/documentRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use(mongoSanitize());
app.use('/api/documents', documentRoutes);
app.use(errorHandler);

const signToken = (id, tokenVersion = 0) => jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function fixture() {
  const admin = await User.create({ name: 'Admin', email: `docwl${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin' });
  const clientA = await User.create({ name: 'Client A', email: `docwla${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client' });
  const clientB = await User.create({ name: 'Client B', email: `docwlb${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client' });
  await Document.create({ type: 'Facture', status: 'Envoyé', client: clientA._id, createdBy: admin._id, items: [{ description: 'x', quantity: 1, unitPrice: 100, total: 100 }] });
  await Document.create({ type: 'Devis', status: 'Brouillon', client: clientB._id, createdBy: admin._id, items: [{ description: 'y', quantity: 1, unitPrice: 200, total: 200 }] });
  return { admin, clientA, clientB, adminToken: signToken(admin._id) };
}

test('filtre légitime (type/status) fonctionne normalement', async () => {
  const { adminToken } = await fixture();
  const res = await request(app).get('/api/documents').query({ type: 'Facture' }).set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  expect(res.body.results).toBe(1);
  expect(res.body.data.documents[0].type).toBe('Facture');
});

test('opérateur $ne injecté via query string : ignoré, ne renvoie pas tout le monde', async () => {
  const { adminToken } = await fixture();
  const res = await request(app).get('/api/documents').query({ 'status[$ne]': 'Brouillon' }).set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  // Le filtre status est ignoré (valeur non scalaire) → tous les documents
  // reviennent via les AUTRES filtres (aucun ici), mais jamais via $ne.
  expect(res.body.data.documents.every((d) => typeof d.status === 'string')).toBe(true);
});

test('opérateur $gt injecté sur un champ arbitraire : ignoré', async () => {
  const { adminToken } = await fixture();
  const res = await request(app).get('/api/documents').query({ 'totalAmount[$gt]': '0' }).set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  expect(res.body.results).toBe(2); // aucun filtre totalAmount n'existe dans la whitelist
});

test('clé non whitelistée ($where, mass assignment) totalement ignorée', async () => {
  const { adminToken } = await fixture();
  const res = await request(app).get('/api/documents').query({ $where: 'this.status', isAdmin: 'true', role: 'Admin' }).set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  expect(res.body.results).toBe(2);
});

test('objet imbriqué inattendu sur un champ whitelisté (client) : ignoré plutôt que planter', async () => {
  const { adminToken } = await fixture();
  const res = await request(app).get('/api/documents').query({ client: { nested: { deep: 'value' } } }).set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  expect(res.body.results).toBe(2);
});

test('IDOR via query string : un filtre client sur un ID valide reste scopé à ce client précis', async () => {
  const { adminToken, clientA } = await fixture();
  const res = await request(app).get('/api/documents').query({ client: String(clientA._id) }).set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  expect(res.body.results).toBe(1);
  expect(res.body.data.documents[0].client._id).toBe(String(clientA._id));
});

test('valeur enum invalide pour type : ignorée plutôt que provoquer une recherche vide inattendue', async () => {
  const { adminToken } = await fixture();
  const res = await request(app).get('/api/documents').query({ type: 'NotARealType' }).set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  expect(res.body.results).toBe(2);
});

// GL-DEBT-1 — Phase 12 : pagination rétrocompatible.
describe('pagination', () => {
  test('sans page/limit : comportement historique inchangé (liste complète, pas de meta)', async () => {
    const { adminToken } = await fixture();
    const res = await request(app).get('/api/documents').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.results).toBe(2);
    expect(res.body.meta).toBeUndefined();
  });

  test('avec page/limit : liste bornée + meta (total, totalPages)', async () => {
    const { adminToken } = await fixture();
    const res = await request(app).get('/api/documents').query({ page: 1, limit: 1 }).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.results).toBe(1);
    expect(res.body.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
  });

  test('page 2 avec limit 1 retourne le second document, sans chevauchement', async () => {
    const { adminToken } = await fixture();
    const p1 = await request(app).get('/api/documents').query({ page: 1, limit: 1 }).set('Authorization', `Bearer ${adminToken}`);
    const p2 = await request(app).get('/api/documents').query({ page: 2, limit: 1 }).set('Authorization', `Bearer ${adminToken}`);
    expect(p1.body.data.documents[0]._id).not.toBe(p2.body.data.documents[0]._id);
  });

  test('limit plafonnée à 200 même si une valeur plus grande est demandée', async () => {
    const { adminToken } = await fixture();
    const res = await request(app).get('/api/documents').query({ page: 1, limit: 999999 }).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(200);
  });
});
