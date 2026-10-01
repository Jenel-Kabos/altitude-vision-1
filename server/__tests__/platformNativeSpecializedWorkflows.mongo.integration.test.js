// PLATFORM-ADMIN-04A CLOSURE — H3 : workflows platform-native spécialisés
// (revue des demandes tenant, inbox support) accessibles à des opérateurs
// PARTIELS strictement bornés par leur capability exacte, sans jamais obtenir
// la Vue plateforme ; audit adversarial des routes `allowTenantSelection` ;
// détail ciblé `GET /platform-tenants/:id`.
jest.mock('../services/storage/secureStorageService', () => ({
  uploadPrivateAsset: jest.fn(), readPrivateAsset: jest.fn().mockResolvedValue(Buffer.from('%PDF-test')), deletePrivateAsset: jest.fn(),
}));
jest.mock('../services/notificationService', () => ({ notify: jest.fn().mockResolvedValue({}) }));

const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const User = require('../models/User');
const Property = require('../models/Property');
const Transaction = require('../models/Transaction');
const Contrat = require('../models/Contrat');
const Conversation = require('../models/Conversation');
const TenantApplication = require('../models/TenantApplication');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(240000);

const app = express();
app.use(express.json());
app.use('/api/platform-tenants', require('../routes/platformTenantRoutes'));
app.use('/api/platform-operators', require('../routes/platformOperatorRoutes'));
app.use('/api/users', require('../routes/userRoutes'));
app.use('/api/properties', require('../routes/propertyRoutes'));
app.use('/api/reporting', require('../routes/reportingRoutes'));
app.use('/api/conversations', require('../routes/conversationRoutes'));
app.use('/api/messages', require('../routes/messageRoutes'));
app.use('/api/transactions', require('../routes/transactionRoutes'));
app.use('/api/contrats', require('../routes/contratRoutes'));
app.use(errorHandler);

const bearer = (user, tenantId) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}),
});

let seq = 0;
const makeUser = (role, label) => {
  seq += 1;
  return User.create({ name: `PA04A-C ${label} ${seq}`, email: `pa04a-c-${label}-${seq}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
};
const makeOperator = async (label, capabilities, actor) => {
  const user = await makeUser('Admin', label);
  await grantOperator({ userId: user._id, actor, reason: `PA04A closure ${label}`, capabilities });
  return user;
};
const makeProperty = (owner, tenant, status = 'vente') => Property.create({
  title: `PA04A-C bien ${seq++}`, description: 'Description assez longue pour la validation Property.',
  pole: 'Altimmo', type: 'Villa', status, price: 300000,
  address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.26, longitude: 15.24,
  images: ['https://example.test/x.jpg'], surface: 120, statusAdmin: 'Validée', isPublished: true,
  availability: 'Disponible', owner: owner._id, tenant: tenant?._id || null,
});
const makeTransaction = async (property, client, agent) => {
  const result = await Transaction.collection.insertOne({
    property: property._id, client: client._id, agent: agent._id, reservation: new mongoose.Types.ObjectId(),
    transactionType: 'vente', status: 'En cours', finalAmount: 300000,
    commission: { taux: 10, total: 30000, ownerPayout: 0, agencyNet: 30000 },
    notes: 'initial', transactionDate: new Date(), createdAt: new Date(),
  });
  return { _id: result.insertedId };
};
const submitted = (owner) => TenantApplication.create({
  applicant: owner._id, organizationName: 'Organisation PA04A', status: 'SUBMITTED', activeApplicantKey: String(owner._id),
  history: [{ from: null, to: 'DRAFT', actor: owner._id }, { from: 'DRAFT', to: 'SUBMITTED', actor: owner._id }],
});
const contractBody = (property) => ({
  bien: String(property._id), type: 'location',
  dateEntree: new Date().toISOString(), dateFinBail: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(), montantLoyer: 150000,
});
const expectNotEligible = (res) => {
  expect(res.status).toBe(403);
  expect(res.body.code).toBe('PLATFORM_VIEW_NOT_ELIGIBLE');
};
const expectNoPlatformView = async (user) => {
  const me = await request(app).get('/api/platform-operators/me').set(bearer(user));
  expect(me.status).toBe(200);
  expect(me.body.data.platformViewEligible).toBe(false);
  expectNotEligible(await request(app).get('/api/users').set(bearer(user)));
  expectNotEligible(await request(app).get('/api/properties?dashboardRegistry=1').set(bearer(user)));
  expectNotEligible(await request(app).get('/api/reporting/executive').set(bearer(user)));
};

const S = {};
beforeAll(async () => {
  await startFinancialMongo();
  await TenantApplication.syncIndexes();
  const fA = await createTenantFixture({ label: 'PA04A-C Tenant A', withAdminMembership: true });
  const fB = await createTenantFixture({ label: 'PA04A-C Tenant B', withAdminMembership: true });
  S.tenantA = fA.tenant; S.tenantB = fB.tenant; S.adminA = fA.bootstrap; S.adminB = fB.bootstrap;
  ({ user: S.memberA } = await createTenantUser({ tenant: S.tenantA, bootstrap: S.adminA, overrides: { role: 'Collaborateur' }, businessRole: 'Collaborateur' }));
  ({ user: S.memberB } = await createTenantUser({ tenant: S.tenantB, bootstrap: S.adminB, overrides: { role: 'Collaborateur' }, businessRole: 'Collaborateur' }));
  ({ user: S.clientA } = await createTenantUser({ tenant: S.tenantA, bootstrap: S.adminA, overrides: { role: 'Client' } }));
  S.unaffiliatedOwner = await makeUser('Proprietaire', 'unaffiliated-owner');
  S.unaffiliatedClient = await makeUser('Client', 'unaffiliated-client');
  S.agent = await makeUser('Admin', 'agent');

  S.reviewer = await makeOperator('reviewer', ['platform.tenant_applications.read', 'platform.tenant_applications.review'], S.adminA);
  S.approver = await makeOperator('approver', ['platform.tenant_applications.read', 'platform.tenant_applications.approve'], S.adminA);
  S.support = await makeOperator('support', ['platform.support.read'], S.adminA);
  S.tenantReader = await makeOperator('tenant-reader', ['platform.tenants.read'], S.adminA);
  S.partialFinance = await makeOperator('partial-finance', ['platform.finance.read', 'platform.finance.manage', 'platform.commercial.manage', 'platform.users.read', 'platform.users.manage'], S.adminA);
  S.full = await makeOperator('full', [...PLATFORM_VIEW_REQUIRED_CAPABILITIES], S.adminA);

  S.propertyA = await makeProperty(S.adminA, S.tenantA);
  S.propertyB = await makeProperty(S.adminB, S.tenantB);
  S.propertyNull = await makeProperty(S.unaffiliatedOwner, null);
  S.rentalA = await makeProperty(S.adminA, S.tenantA, 'location');
  S.rentalB = await makeProperty(S.adminB, S.tenantB, 'location');
  S.rentalNull = await makeProperty(S.unaffiliatedOwner, null, 'location');
  S.txA = await makeTransaction(S.propertyA, S.clientA, S.agent);
  S.txB = await makeTransaction(S.propertyB, S.memberB, S.agent);
  S.txNull = await makeTransaction(S.propertyNull, S.unaffiliatedClient, S.agent);

  S.supportConvA = await Conversation.create({ isStaffInbox: true, tenant: S.tenantA._id, participants: [S.clientA._id], lastMessage: 'Support A' });
  S.supportConvB = await Conversation.create({ isStaffInbox: true, tenant: S.tenantB._id, participants: [S.memberB._id], lastMessage: 'Support B' });
  S.privateConvA = await Conversation.create({ isStaffInbox: false, tenant: S.tenantA._id, participants: [S.clientA._id, S.memberA._id], lastMessage: 'Privé A' });
});
afterAll(stopFinancialMongo);

describe('H3 — revue des demandes tenant (workflow platform-native spécialisé)', () => {
  test('reviewer partiel : liste et démarre la revue, sans Vue plateforme', async () => {
    const owner = await makeUser('Proprietaire', 'applicant-1');
    const item = await submitted(owner);
    const list = await request(app).get('/api/platform-tenants/applications').set(bearer(S.reviewer));
    expect(list.status).toBe(200);
    expect((await request(app).get('/api/platform-tenants/applications/pending-count').set(bearer(S.reviewer))).status).toBe(200);
    const started = await request(app).post(`/api/platform-tenants/applications/${item._id}/start-review`).set(bearer(S.reviewer));
    expect(started.status).toBe(200);
    expect(started.body.data.application.status).toBe('UNDER_REVIEW');
    await expectNoPlatformView(S.reviewer);
  });

  test('séparation des responsabilités : le reviewer n’approuve pas, l’approver ne démarre pas la revue', async () => {
    const owner = await makeUser('Proprietaire', 'applicant-2');
    const item = await submitted(owner);
    expect((await request(app).post(`/api/platform-tenants/applications/${item._id}/start-review`).set(bearer(S.approver))).status).toBe(403);
    expect((await request(app).post(`/api/platform-tenants/applications/${item._id}/start-review`).set(bearer(S.reviewer))).status).toBe(200);
    expect((await request(app).post(`/api/platform-tenants/applications/${item._id}/approve`).set(bearer(S.reviewer))).status).toBe(403);
    const approved = await request(app).post(`/api/platform-tenants/applications/${item._id}/approve`).set(bearer(S.approver));
    expect(approved.status).toBe(200);
    await expectNoPlatformView(S.approver);
  });

  test('mauvaise capability (support) → 403 sur le workflow tenant-application', async () => {
    expect((await request(app).get('/api/platform-tenants/applications').set(bearer(S.support))).status).toBe(403);
  });

  test('le workflow spécialisé ne crée aucun scope réutilisable : registre tenants et surfaces générales refusés', async () => {
    expect((await request(app).get('/api/platform-tenants').set(bearer(S.reviewer))).status).toBe(403);
    expectNotEligible(await request(app).get('/api/properties?dashboardRegistry=1').set(bearer(S.reviewer)));
    expect((await request(app).get('/api/conversations/staff-inbox').set(bearer(S.reviewer))).status).toBe(403);
  });
});

describe('H3 — inbox support globale (workflow platform-native spécialisé)', () => {
  const ids = (res) => (res.body.data?.conversations || []).map((item) => String(item._id));

  test('agent support partiel : inbox support multi-tenant, sans Vue plateforme', async () => {
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(S.support));
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual(expect.arrayContaining([String(S.supportConvA._id), String(S.supportConvB._id)]));
    expect(ids(res)).not.toContain(String(S.privateConvA._id));
    await expectNoPlatformView(S.support);
  });

  test('agent support partiel : ouvre et lit une conversation de l’inbox support', async () => {
    expect((await request(app).get(`/api/conversations/${S.supportConvA._id}`).set(bearer(S.support))).status).toBe(200);
    expect((await request(app).get(`/api/messages/${S.supportConvB._id}`).set(bearer(S.support))).status).toBe(200);
  });

  test('agent support partiel : jamais une conversation hors inbox support', async () => {
    expect((await request(app).get(`/api/conversations/${S.privateConvA._id}`).set(bearer(S.support))).status).toBe(403);
    expect((await request(app).get(`/api/conversations/${S.privateConvA._id}/messages`).set(bearer(S.support))).status).toBe(403);
    expect((await request(app).get(`/api/messages/${S.privateConvA._id}`).set(bearer(S.support))).status).toBe(403);
  });

  test('agent support partiel : aucun message direct hors conversation support', async () => {
    const direct = await request(app).post('/api/messages').set(bearer(S.support)).send({ receiverId: String(S.memberA._id), content: 'Direct' });
    expect(direct.status).toBe(403);
    const legacy = await request(app).get(`/api/messages/${S.memberA._id}`).set(bearer(S.support));
    expect(legacy.status).toBe(403);
  });

  test('opérateur sans support.read (reviewer) → inbox globale refusée', async () => {
    expect((await request(app).get('/api/conversations/staff-inbox').set(bearer(S.reviewer))).status).toBe(403);
  });
});

describe('Détail ciblé GET /platform-tenants/:id', () => {
  test('opérateur partiel platform.tenants.read : détail du tenant ciblé uniquement, sans Vue plateforme', async () => {
    const res = await request(app).get(`/api/platform-tenants/${S.tenantA._id}`).set(bearer(S.tenantReader));
    expect(res.status).toBe(200);
    expect(String(res.body.data.overview.tenant._id)).toBe(String(S.tenantA._id));
    expect(JSON.stringify(res.body)).not.toContain(String(S.tenantB._id));
    expectNotEligible(await request(app).get('/api/platform-tenants').set(bearer(S.tenantReader)));
    await expectNoPlatformView(S.tenantReader);
  });

  test('capability exacte requise : support.read → 403 sur le détail tenant', async () => {
    expect((await request(app).get(`/api/platform-tenants/${S.tenantA._id}`).set(bearer(S.support))).status).toBe(403);
  });
});

describe('allowTenantSelection — preuve selectedTenant → ressource du tenant', () => {
  const FORGED = () => new mongoose.Types.ObjectId();

  test('transactions (lecture) : Tenant A sélectionné ne voit que A', async () => {
    const res = await request(app).get('/api/transactions').set(bearer(S.partialFinance, S.tenantA._id));
    expect(res.status).toBe(200);
    const ids = JSON.stringify(res.body);
    expect(ids).toContain(String(S.txA._id));
    expect(ids).not.toContain(String(S.txB._id));
    expect(ids).not.toContain(String(S.txNull._id));
  });

  test('notes : A sélectionné + ressource A → autorisé ; ressource B → 404 ; tenant:null → refus', async () => {
    expect((await request(app).patch(`/api/transactions/${S.txA._id}/notes`).set(bearer(S.partialFinance, S.tenantA._id)).send({ notes: 'ok A' })).status).toBe(200);
    expect((await request(app).patch(`/api/transactions/${S.txB._id}/notes`).set(bearer(S.partialFinance, S.tenantA._id)).send({ notes: 'x' })).status).toBe(404);
    expect((await request(app).patch(`/api/transactions/${S.txNull._id}/notes`).set(bearer(S.partialFinance, S.tenantA._id)).send({ notes: 'x' })).status).toBe(404);
    expect((await Transaction.findById(S.txB._id).lean()).notes).toBe('initial');
    expect((await Transaction.findById(S.txNull._id).lean()).notes).toBe('initial');
  });

  test.each(['finalize', 'cancel'])('%s : ressource B → 404 ; tenant:null → refus, sous Tenant A', async (action) => {
    const method = action === 'finalize' ? 'post' : 'patch';
    expect((await request(app)[method](`/api/transactions/${S.txB._id}/${action}`).set(bearer(S.partialFinance, S.tenantA._id)).send({})).status).toBe(404);
    expect((await request(app)[method](`/api/transactions/${S.txNull._id}/${action}`).set(bearer(S.partialFinance, S.tenantA._id)).send({})).status).toBe(404);
    expect((await Transaction.findById(S.txB._id).lean()).status).toBe('En cours');
    expect((await Transaction.findById(S.txNull._id).lean()).status).toBe('En cours');
  });

  test('paiement espèces : ressource B → 404 ; tenant:null → refus, sous Tenant A', async () => {
    expect((await request(app).post(`/api/transactions/${S.txB._id}/paiements/especes`).set(bearer(S.partialFinance, S.tenantA._id)).send({ methode: 'especes', montant: 1000 })).status).toBe(404);
    expect((await request(app).post(`/api/transactions/${S.txNull._id}/paiements/especes`).set(bearer(S.partialFinance, S.tenantA._id)).send({ methode: 'especes', montant: 1000 })).status).toBe(404);
  });

  test('en-tête forgé vers un tenant inexistant → jamais de contournement (403 PLATFORM_VIEW_NOT_ELIGIBLE)', async () => {
    expectNotEligible(await request(app).patch(`/api/transactions/${S.txA._id}/notes`).set(bearer(S.partialFinance, FORGED())).send({ notes: 'forged' }));
    expectNotEligible(await request(app).get('/api/transactions').set(bearer(S.partialFinance, FORGED())));
    expectNotEligible(await request(app).post('/api/contrats').set(bearer(S.partialFinance, FORGED())).send(contractBody(S.rentalA)));
    expect((await Transaction.findById(S.txA._id).lean()).notes).not.toBe('forged');
  });

  test('contrat marketplace : A sélectionné + bien A → 201 ; bien B → 404 ; bien tenant:null → refus', async () => {
    expect((await request(app).post('/api/contrats').set(bearer(S.partialFinance, S.tenantA._id)).send(contractBody(S.rentalA))).status).toBe(201);
    expect((await request(app).post('/api/contrats').set(bearer(S.partialFinance, S.tenantA._id)).send(contractBody(S.rentalB))).status).toBe(404);
    expect((await request(app).post('/api/contrats').set(bearer(S.partialFinance, S.tenantA._id)).send(contractBody(S.rentalNull))).status).toBe(404);
    expect(await Contrat.countDocuments({ bien: { $in: [S.rentalB._id, S.rentalNull._id] } })).toBe(0);
  });

  test('utilisateurs : A sélectionné + utilisateur B ou non affilié → 404, utilisateur A → autorisé', async () => {
    expect((await request(app).patch(`/api/users/${S.memberB._id}/activate`).set(bearer(S.partialFinance, S.tenantA._id))).status).toBe(404);
    expect((await request(app).patch(`/api/users/${S.unaffiliatedClient._id}/activate`).set(bearer(S.partialFinance, S.tenantA._id))).status).toBe(404);
    const own = await request(app).patch(`/api/users/${S.memberA._id}/activate`).set(bearer(S.partialFinance, S.tenantA._id));
    expect(own.status).toBe(200);
  });

  test('sans tenant sélectionné, l’opérateur partiel reste hors Vue plateforme', async () => {
    expectNotEligible(await request(app).patch(`/api/transactions/${S.txA._id}/notes`).set(bearer(S.partialFinance)).send({ notes: 'global' }));
    expectNotEligible(await request(app).post('/api/contrats').set(bearer(S.partialFinance)).send(contractBody(S.rentalA)));
  });

  test('opérateur complet sans tenant : Vue plateforme et ressource tenant:null administrable', async () => {
    const me = await request(app).get('/api/platform-operators/me').set(bearer(S.full));
    expect(me.body.data.platformViewEligible).toBe(true);
    expect((await request(app).get('/api/users').set(bearer(S.full))).status).toBe(200);
  });
});
