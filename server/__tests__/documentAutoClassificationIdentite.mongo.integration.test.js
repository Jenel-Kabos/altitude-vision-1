// DOC-ARCH-2 — les pièces d'identité (Locataire/Proprietaire) sont créées par
// leur workflow métier (fiche locataire/propriétaire), jamais une saisie
// manuelle dans le Centre documentaire : leur classement (pole/service/
// categorie/entityType) doit donc être déduit automatiquement à la création,
// sans aucune intervention du staff.
jest.mock('../config/cloudinary', () => {
  const actual = jest.requireActual('../config/cloudinary');
  return { ...actual, uploadToCloudinary: jest.fn().mockResolvedValue({ secure_url: 'https://cdn.test/piece-identite.pdf', public_id: 'private/identity', resource_type: 'raw', version: 1, format: 'pdf', bytes: 16 }) };
});

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Document = require('../models/Document');
const locataireRoutes = require('../routes/locataireRoutes');
const proprietaireRoutes = require('../routes/proprietaireRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/locataires', locataireRoutes);
app.use('/api/proprietaires', proprietaireRoutes);
app.use(errorHandler);

const signToken = (id, tokenVersion = 0) => jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-I-TEST-CONVERGENCE.1 —
// `POST /api/proprietaires` is canonical TENANT (requireTenantMembershipRole).
// The actor must therefore be an Admin *member* of a tenant, not merely a
// User whose global role is Admin. Locataire routes still use the legacy
// `requireCapability('tenants.manage')` gate, so the locataire test keeps
// the pre-canonical fixture as a stable coverage point on that legacy
// surface.
let counter = 0;
const makeAdmin = () => {
  counter += 1;
  return User.create({ name: 'Admin Test', email: `docauto${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin' });
};
const makeTenantAdminFixture = async () => {
  const fixture = await createTenantFixture({ label: `DocAutoClassif ${counter++}`, withAdminMembership: true });
  return fixture;
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('une pièce d’identité locataire est classée automatiquement (Altimmo/gestion_locative) sans saisie manuelle', async () => {
  const admin = await makeAdmin();
  const res = await request(app)
    .post('/api/locataires')
    .set('Authorization', `Bearer ${signToken(admin._id)}`)
    .field('nom', 'Moke').field('prenom', 'Paul').field('telephone', '+242060000001')
    .attach('pieceIdentite', Buffer.from('%PDF-1.4 test'), { filename: 'cni.pdf', contentType: 'application/pdf' });

  expect(res.status).toBe(201);
  const locataireId = res.body.data.locataire._id;
  const doc = await Document.findOne({ refType: 'Locataire', refId: locataireId });
  expect(doc).toMatchObject({
    pole: 'Altimmo', service: 'gestion_locative', categorie: "Pièces d'identité", entityType: 'Locataire', visibility: 'tenant',
  });
  expect(String(doc.entityId)).toBe(String(locataireId));
});

test('une pièce d’identité propriétaire est classée automatiquement (Altimmo/gestion_locative) sans saisie manuelle', async () => {
  const { tenant, bootstrap: admin } = await makeTenantAdminFixture();
  const res = await request(app)
    .post('/api/proprietaires')
    .set('Authorization', `Bearer ${signToken(admin._id)}`)
    .set('X-Platform-Tenant-Id', String(tenant._id))
    .field('nom', 'Nkounkou').field('prenom', 'Alice').field('telephone', '+242060000002')
    .attach('pieceIdentite', Buffer.from('%PDF-1.4 test'), { filename: 'cni.pdf', contentType: 'application/pdf' });

  expect(res.status).toBe(201);
  const proprietaireId = res.body.data.proprietaire._id;
  const doc = await Document.findOne({ refType: 'Proprietaire', refId: proprietaireId });
  expect(doc).toMatchObject({
    pole: 'Altimmo', service: 'gestion_locative', categorie: "Pièces d'identité", entityType: 'Proprietaire', visibility: 'owner',
  });
  expect(String(doc.entityId)).toBe(String(proprietaireId));
});
