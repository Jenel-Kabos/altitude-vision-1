// TENANT-ATTRIBUTION-1 — Régressions adversariales des trois frontières
// qui avaient démontré des fuites pendant TENANT-CERT-1.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Document = require('../models/Document');
const Conversation = require('../models/Conversation');
const Hotel = require('../models/Hotel');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');
const documentRoutes = require('../routes/documentRoutes');
const conversationRoutes = require('../routes/conversationRoutes');
const { assertFinancialScope } = require('../services/finance/financialAuthorizationService');

jest.setTimeout(120000);
const app = express();
app.use(express.json());
app.use('/api/documents', documentRoutes);
app.use('/api/conversations', conversationRoutes);
app.use((error, _req, res, _next) => res.status(error.statusCode || res.statusCode || 500).json({ message: error.message }));

const makeUser = (name, role = 'Admin') => User.create({
  name, email: `${name.toLowerCase()}-${Date.now()}@tenant-cert.test`, role,
  password: 'Password123!', passwordConfirm: 'Password123!', isEmailVerified: true,
});
const auth = (user) => `Bearer ${jwt.sign({ id: user._id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;

async function fixture() {
  const bootstrap = await makeUser('Bootstrap');
  const [tenantA, tenantB] = await Promise.all([
    platformTenantService.createTenant({ name: `CERT A ${Date.now()}`, actor: bootstrap }),
    platformTenantService.createTenant({ name: `CERT B ${Date.now()}`, actor: bootstrap }),
  ]);
  const [adminA, adminB, clientB] = await Promise.all([
    makeUser('AdminA'), makeUser('AdminB'), makeUser('ClientB', 'Client'),
  ]);
  await Promise.all([
    organizationService.grantMembership({ userId: adminA._id, orgUnitId: tenantA.rootOrgUnit, actor: bootstrap }),
    organizationService.grantMembership({ userId: adminB._id, orgUnitId: tenantB.rootOrgUnit, actor: bootstrap }),
    organizationService.grantMembership({ userId: clientB._id, orgUnitId: tenantB.rootOrgUnit, actor: bootstrap }),
  ]);
  return { tenantA, tenantB, adminA, adminB, clientB };
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('DOCUMENT — Admin A ne lit ni ne liste un Document attribué à B', async () => {
  const { tenantA, adminA, adminB } = await fixture();
  const documentB = await Document.create({ type: 'Contrat', status: 'Brouillon', content: 'SECRET TENANT B', createdBy: adminB._id });
  const headers = { Authorization: auth(adminA), 'X-Platform-Tenant-Id': String(tenantA._id) };
  const detail = await request(app).get(`/api/documents/${documentB._id}`).set(headers);
  const list = await request(app).get('/api/documents').set(headers);
  expect(detail.status).toBe(404);
  expect(list.status).toBe(200);
  expect(list.body.data.documents.map((item) => String(item._id))).not.toContain(String(documentB._id));
});

test('CONVERSATION — un staff A ne lit pas le thread B par ObjectId', async () => {
  const { tenantA, adminA, adminB, clientB } = await fixture();
  const conversationB = await Conversation.create({ participants: [adminB._id, clientB._id], lastMessage: 'SECRET THREAD B' });
  const response = await request(app).get(`/api/conversations/${conversationB._id}`)
    .set({ Authorization: auth(adminA), 'X-Platform-Tenant-Id': String(tenantA._id) });
  expect(response.status).toBe(404);
});

test('FINANCE/HOTEL — Admin A ne bénéficie plus d’un bypass global vers Hotel B', async () => {
  const { tenantA, adminA, adminB } = await fixture();
  const hotelB = await Hotel.create({ name: 'Hotel secret B', manager: adminB._id, createdBy: adminB._id });
  const actorA = { ...adminA.toObject(), platformTenant: tenantA, tenantScopeUserIds: [adminA._id] };
  await expect(assertFinancialScope(actorA, hotelB._id)).rejects.toMatchObject({ statusCode: 404 });
});
