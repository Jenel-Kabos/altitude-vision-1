// GL-DEBT-1 — Phase 3 : GET /api/rental-documents/:documentId/download.
// Un petit serveur HTTP local sert un faux PDF pour exercer le vrai chemin
// de streaming (http.get réel, pas mocké) sans dépendre du réseau externe.

const http = require('http');
jest.mock('../services/storage/secureStorageService', () => ({
  ...jest.requireActual('../services/storage/secureStorageService'),
  readPrivateAsset: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 authenticated private content')),
}));
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');
const rentalDocumentRoutes = require('../routes/rentalDocumentRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const platformTenantService = require('../services/platformTenant/platformTenantService');
const organizationService = require('../services/organizationService');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/rental-documents', rentalDocumentRoutes);
app.use(errorHandler);

const signToken = (id, tokenVersion = 0) => jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let fakeCdn;
let fakeCdnUrl;
beforeAll(async () => {
  await startFinancialMongo();
  fakeCdn = http.createServer((req, res) => {
    if (req.url === '/missing.pdf') { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', 'application/pdf');
    res.end('%PDF-1.4 fake bail content');
  });
  await new Promise((resolve) => fakeCdn.listen(0, '127.0.0.1', resolve));
  const { port } = fakeCdn.address();
  fakeCdnUrl = `http://127.0.0.1:${port}/document.pdf`;
});
afterEach(clearFinancialMongo);
afterAll(async () => { await stopFinancialMongo(); await new Promise((resolve) => fakeCdn.close(resolve)); });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Utilisateur Test', email: `raldoc${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

async function fixture() {
  const admin = await makeUser({ role: 'Admin' });
  const ownerUser = await makeUser({ role: 'Proprietaire' });
  const otherOwnerUser = await makeUser({ role: 'Proprietaire' });
  const tenantUser = await makeUser({ role: 'Client' });
  const otherTenantUser = await makeUser({ role: 'Client' });

  const property = await Property.create({
    title: 'Bien GL-DEBT-1', description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Maison', status: 'location', price: 300000,
    address: { arrondissement: 'Moungali', city: 'Brazzaville' }, latitude: -4.25, longitude: 15.27,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90, bedrooms: 2, bathrooms: 1,
    statusAdmin: 'Validée', owner: ownerUser._id,
  });
  const locataire = await Locataire.create({ nom: 'Locataire', prenom: 'Test', telephone: '+242060000000', user: tenantUser._id });
  const contrat = await Contrat.create({
    type: 'location', statut: 'actif', bien: property._id, locataire: locataire._id,
    documents: [{ nom: 'Bail signé', type: 'bail', url: fakeCdnUrl }],
  });
  const documentId = String(contrat.documents[0]._id);
  return { admin, ownerUser, otherOwnerUser, tenantUser, otherTenantUser, contrat, documentId };
}

test('admin autorisé : reçoit le flux du document', async () => {
  const { admin, documentId } = await fixture();
  const res = await request(app).get(`/api/rental-documents/${documentId}/download`).set('Authorization', `Bearer ${signToken(admin._id)}`);
  expect(res.status).toBe(200);
  // supertest bufferise application/pdf dans res.body (Buffer), pas res.text.
  expect(Buffer.isBuffer(res.body) ? res.body.toString('utf8') : res.text).toContain('fake bail content');
  expect(res.headers['content-disposition']).toContain('Bail');
});

test('contrôle tenant staff : Admin B lit son document B, Admin A connaissant son URL/ID est refusé', async () => {
  const bootstrap = await makeUser({ role: 'Admin' });
  const tenantA = await platformTenantService.createTenant({ name: `Rental Doc A ${Date.now()}`, actor: bootstrap });
  const tenantB = await platformTenantService.createTenant({ name: `Rental Doc B ${Date.now()}`, actor: bootstrap });
  const adminA = await makeUser({ role: 'Admin' });
  const adminB = await makeUser({ role: 'Admin' });
  const ownerB = await makeUser({ role: 'Proprietaire' });
  await Promise.all([
    organizationService.grantMembership({ userId: adminA._id, orgUnitId: tenantA.rootOrgUnit, actor: bootstrap }),
    organizationService.grantMembership({ userId: adminB._id, orgUnitId: tenantB.rootOrgUnit, actor: bootstrap }),
    organizationService.grantMembership({ userId: ownerB._id, orgUnitId: tenantB.rootOrgUnit, actor: bootstrap }),
  ]);
  const propertyB = await Property.create({ title: 'Bien document B', description: 'Description suffisamment longue pour le document B.', pole: 'Altimmo', type: 'Maison', status: 'location', price: 300000, address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.2, longitude: 15.2, images: ['https://placehold.co/1200x800/png'], surface: 80, statusAdmin: 'Validée', owner: ownerB._id });
  const contratB = await Contrat.create({ type: 'location', statut: 'actif', bien: propertyB._id, documents: [{ nom: 'Bail B privé', type: 'bail', url: fakeCdnUrl }] });
  const id = contratB.documents[0]._id;
  const positive = await request(app).get(`/api/rental-documents/${id}/download`).set('Authorization', `Bearer ${signToken(adminB._id)}`);
  expect(positive.status).toBe(200);
  const attack = await request(app).get(`/api/rental-documents/${id}/download`).set('Authorization', `Bearer ${signToken(adminA._id)}`);
  expect(attack.status).toBe(403);
});

test('nouvel asset authenticated : B peut le streamer, A connaissant documentId et publicId est refusé avant lecture', async () => {
  const { readPrivateAsset } = require('../services/storage/secureStorageService');
  readPrivateAsset.mockClear();
  const bootstrap = await makeUser({ role: 'Admin' });
  const tenantA = await platformTenantService.createTenant({ name: `Private Doc A ${Date.now()}`, actor: bootstrap });
  const tenantB = await platformTenantService.createTenant({ name: `Private Doc B ${Date.now()}`, actor: bootstrap });
  const adminA = await makeUser({ role: 'Admin' }); const adminB = await makeUser({ role: 'Admin' }); const ownerB = await makeUser({ role: 'Proprietaire' });
  await Promise.all([
    organizationService.grantMembership({ userId: adminA._id, orgUnitId: tenantA.rootOrgUnit, actor: bootstrap }),
    organizationService.grantMembership({ userId: adminB._id, orgUnitId: tenantB.rootOrgUnit, actor: bootstrap }),
    organizationService.grantMembership({ userId: ownerB._id, orgUnitId: tenantB.rootOrgUnit, actor: bootstrap }),
  ]);
  const propertyB = await Property.create({ title: 'Bien coffre B', description: 'Description suffisamment longue pour le coffre B.', pole: 'Altimmo', type: 'Maison', status: 'location', price: 300000, address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.2, longitude: 15.2, images: ['https://placehold.co/1200x800/png'], surface: 80, statusAdmin: 'Validée', owner: ownerB._id });
  const contratB = await Contrat.create({ type: 'location', statut: 'actif', bien: propertyB._id, documents: [{ nom: 'Bail authenticated', type: 'bail', asset: { assetClass: 'PRIVATE_DOCUMENT', purpose: 'lease', provider: 'cloudinary', publicId: 'tenant-b/known-public-id', resourceType: 'raw', deliveryType: 'authenticated', version: '1', format: 'pdf', mimeType: 'application/pdf', originalFilename: 'bail.pdf', size: 42 } }] });
  expect(contratB.documents[0].url).toBeUndefined();
  const positive = await request(app).get(`/api/rental-documents/${contratB.documents[0]._id}/download`).set('Authorization', `Bearer ${signToken(adminB._id)}`);
  expect(positive.status).toBe(200);
  expect(readPrivateAsset).toHaveBeenCalledTimes(1);
  const attack = await request(app).get(`/api/rental-documents/${contratB.documents[0]._id}/download`).set('Authorization', `Bearer ${signToken(adminA._id)}`);
  expect(attack.status).toBe(403);
  expect(readPrivateAsset).toHaveBeenCalledTimes(1);
});

test('limitation de stockage démontrée : une URL CDN publique exacte contourne nécessairement le RBAC backend', async () => {
  const body = await new Promise((resolve, reject) => http.get(fakeCdnUrl, (res) => {
    let value = ''; res.setEncoding('utf8'); res.on('data', (chunk) => { value += chunk; }); res.on('end', () => resolve(value));
  }).on('error', reject));
  expect(body).toContain('fake bail content');
});

test('propriétaire du bail autorisé', async () => {
  const { ownerUser, documentId } = await fixture();
  const res = await request(app).get(`/api/rental-documents/${documentId}/download`).set('Authorization', `Bearer ${signToken(ownerUser._id)}`);
  expect(res.status).toBe(200);
});

test('locataire du bail autorisé', async () => {
  const { tenantUser, documentId } = await fixture();
  const res = await request(app).get(`/api/rental-documents/${documentId}/download`).set('Authorization', `Bearer ${signToken(tenantUser._id)}`);
  expect(res.status).toBe(200);
});

test('un autre propriétaire (sans relation avec ce bail) est refusé', async () => {
  const { otherOwnerUser, documentId } = await fixture();
  const res = await request(app).get(`/api/rental-documents/${documentId}/download`).set('Authorization', `Bearer ${signToken(otherOwnerUser._id)}`);
  expect(res.status).toBe(403);
});

test('un autre locataire (sans relation avec ce bail) est refusé', async () => {
  const { otherTenantUser, documentId } = await fixture();
  const res = await request(app).get(`/api/rental-documents/${documentId}/download`).set('Authorization', `Bearer ${signToken(otherTenantUser._id)}`);
  expect(res.status).toBe(403);
});

test('utilisateur non authentifié refusé', async () => {
  const { documentId } = await fixture();
  const res = await request(app).get(`/api/rental-documents/${documentId}/download`);
  expect(res.status).toBe(401);
});

test('identifiant invalide (pas un ObjectId) rejeté proprement', async () => {
  const { admin } = await fixture();
  const res = await request(app).get('/api/rental-documents/not-an-id/download').set('Authorization', `Bearer ${signToken(admin._id)}`);
  expect(res.status).toBe(400);
});

test('document absent (ObjectId valide mais inexistant)', async () => {
  const { admin } = await fixture();
  const res = await request(app).get('/api/rental-documents/507f1f77bcf86cd799439099/download').set('Authorization', `Bearer ${signToken(admin._id)}`);
  expect(res.status).toBe(404);
});

test('document sans URL associée : 404 explicite, jamais un flux vide silencieux', async () => {
  const { admin } = await fixture();
  const contratSansUrl = await Contrat.create({ type: 'location', statut: 'actif', adresseBien: 'Test sans URL', documents: [{ nom: 'Doc cassé', type: 'bail' }] });
  const res = await request(app).get(`/api/rental-documents/${contratSansUrl.documents[0]._id}/download`).set('Authorization', `Bearer ${signToken(admin._id)}`);
  expect(res.status).toBe(404);
});

test('ancienne structure de document (sans dateEnvoi/envoiEmail explicites) reste compatible', async () => {
  // Un Contrat.documents[] créé avant l'ajout d'un champ optionnel reste
  // strictement identique au niveau schéma (aucun champ requis ajouté) —
  // ce test simule un document minimal, comme les anciens.
  const admin = await makeUser({ role: 'Admin' });
  const contrat = await Contrat.create({ type: 'location', statut: 'actif', adresseBien: 'Legacy', documents: [{ nom: 'Ancienne quittance', type: 'quittance', url: fakeCdnUrl }] });
  const res = await request(app).get(`/api/rental-documents/${contrat.documents[0]._id}/download`).set('Authorization', `Bearer ${signToken(admin._id)}`);
  expect(res.status).toBe(200);
});

test('erreur en amont (CDN renvoie 404) propagée en 502 sans planter le serveur', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const contrat = await Contrat.create({ type: 'location', statut: 'actif', adresseBien: 'CDN cassé', documents: [{ nom: 'Doc CDN cassé', type: 'bail', url: fakeCdnUrl.replace('document.pdf', 'missing.pdf') }] });
  const res = await request(app).get(`/api/rental-documents/${contrat.documents[0]._id}/download`).set('Authorization', `Bearer ${signToken(admin._id)}`);
  expect(res.status).toBe(502);
});
