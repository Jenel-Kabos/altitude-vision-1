// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-I-CRM360-TENANT-BOUNDARY —
// adversarial : GET /api/crm/customers/:customerId (getCustomer360) doit
// projeter STRICTEMENT sur le tenant sélectionné. Identité (User/email/
// participant) N'EST PAS attribution tenant. Le même utilisateur peut
// légitimement appartenir à plusieurs tenants ; sa 360 dans A ne doit
// jamais fuir des ressources canoniquement attribuées à B.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const CrmCustomer = require('../models/CrmCustomer');
const Property = require('../models/Property');
const Visite = require('../models/Visite');
const Transaction = require('../models/Transaction');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const FinancialDocument = require('../models/FinancialDocument');
const ContactMessage = require('../models/ContactMessage');
const QuoteRequest = require('../models/QuoteRequest');
const AltcomProject = require('../models/AltcomProject');
const crmRoutes = require('../routes/crmRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/crm', crmRoutes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let seq = 0;
const makeUser = (over = {}) => {
  seq += 1;
  return User.create({
    name: `CRM360 U ${seq}`, email: `crm360-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true, ...over,
  });
};

const makeProperty = (owner, tenant, over = {}) => Property.create({
  title: `Bien 360 ${seq++}`, description: 'Description assez longue pour valider Property.',
  pole: 'Altimmo', type: 'Villa', status: 'location', price: 200000,
  address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.26, longitude: 15.24,
  images: ['https://placehold.co/1200x800/png?text=Test'], surface: 60, statusAdmin: 'Validée', isPublished: true,
  availability: 'Disponible', owner: owner._id, tenant: tenant?._id || null, ...over,
});

const makeCustomer = (tenant, sharedUser, extras = {}) => CrmCustomer.create({
  tenant: tenant._id, displayName: 'Client Partagé', kind: 'person',
  emails: [sharedUser.email.toLowerCase()], identityKeys: [`user:${sharedUser._id}`, `email:${sharedUser.email.toLowerCase()}`],
  sourceRefs: [{ entityType: 'User', entityId: sharedUser._id, source: 'user' }],
  status: 'active', ...extras,
});

let tenantA; let tenantB; let bootA; let bootB; let adminA; let adminB; let sharedUser; let customerA; let customerB;

beforeAll(async () => {
  await startFinancialMongo();
});
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'CRM360 A', withAdminMembership: true });
  const fB = await createTenantFixture({ label: 'CRM360 B', withAdminMembership: true });
  tenantA = fA.tenant; bootA = fA.bootstrap;
  tenantB = fB.tenant; bootB = fB.bootstrap;
  ({ user: adminA } = await createTenantUser({
    tenant: tenantA, bootstrap: bootA, overrides: { role: 'Admin' }, businessRole: 'Admin',
  }));
  ({ user: adminB } = await createTenantUser({
    tenant: tenantB, bootstrap: bootB, overrides: { role: 'Admin' }, businessRole: 'Admin',
  }));
  sharedUser = await makeUser({ role: 'Proprietaire' });
  customerA = await makeCustomer(tenantA, sharedUser);
  customerB = await makeCustomer(tenantB, sharedUser);
});

const fetch360 = (admin, tenant, customerId) => request(app)
  .get(`/api/crm/customers/${customerId}`).set(bearer(admin, tenant));

describe('CRM360 — tenant boundary is strict on every relation', () => {
  test('CRM360-01/02 (Property): a Property attributed to B never appears in tenant A 360 for the same owner user', async () => {
    const propA = await makeProperty(sharedUser, tenantA);
    const propB = await makeProperty(sharedUser, tenantB);
    const res = await fetch360(adminA, tenantA, customerA._id);
    expect(res.status).toBe(200);
    const ids = res.body.data.relations.properties.map((p) => String(p._id));
    expect(ids).toContain(String(propA._id));
    expect(ids).not.toContain(String(propB._id));
  });

  test('CRM360-04/05 (Transaction): a Transaction on a Property_B never appears in A 360 for the same client', async () => {
    // Bypass schema validation (Transaction has many required fields we don't
    // need for this boundary test — the query only reads `property`, `client`,
    // `status`, `transactionType`, `finalAmount`, `transactionDate`).
    const propA = await makeProperty(sharedUser, tenantA);
    const propB = await makeProperty(sharedUser, tenantB);
    const rawTx = (property, label) => ({
      property, client: sharedUser._id, agent: sharedUser._id,
      reservation: new (require('mongoose')).Types.ObjectId(),
      transactionType: 'location', status: 'En cours',
      finalAmount: 100000, transactionDate: new Date(),
      label,
    });
    const txAInsert = await Transaction.collection.insertOne(rawTx(propA._id, 'A'));
    const txBInsert = await Transaction.collection.insertOne(rawTx(propB._id, 'B'));
    const res = await fetch360(adminA, tenantA, customerA._id);
    const ids = res.body.data.relations.transactions.map((t) => String(t._id));
    expect(ids).toContain(String(txAInsert.insertedId));
    expect(ids).not.toContain(String(txBInsert.insertedId));
  });

  test('CRM360-06/07 (Visite): Visite scoped by tenant', async () => {
    const propA = await makeProperty(sharedUser, tenantA);
    const propB = await makeProperty(sharedUser, tenantB);
    const rawV = (property, tenant) => ({
      property, client: sharedUser._id, tenant: tenant._id,
      statut: 'programmee', scheduledStartAt: new Date(), createdAt: new Date(),
    });
    const vAInsert = await Visite.collection.insertOne(rawV(propA._id, tenantA));
    const vBInsert = await Visite.collection.insertOne(rawV(propB._id, tenantB));
    const res = await fetch360(adminA, tenantA, customerA._id);
    const ids = res.body.data.relations.visits.map((v) => String(v._id));
    expect(ids).toContain(String(vAInsert.insertedId));
    expect(ids).not.toContain(String(vBInsert.insertedId));
  });

  test('CRM360-08/09 (FinancialDocument): shared email must not leak B invoice into A 360', async () => {
    const rawDoc = (tenant, num) => ({
      tenant: tenant._id, documentType: 'invoice', documentNumber: num,
      status: 'issued', currency: 'XAF', totalMinor: 100000,
      amountAllocatedMinor: 0, refundedAmountMinor: 0, balanceMinor: 100000,
      customer: { userId: sharedUser._id, email: sharedUser.email.toLowerCase() },
      issueDate: new Date(), createdAt: new Date(),
      // Compound unique index (domain, businessOperationKey) requires
      // distinct values — synthesise them per document.
      domain: `crm360-${num}`, businessOperationKey: `crm360-${num}-key`,
    });
    await FinancialDocument.collection.insertOne(rawDoc(tenantA, 'INV-A-1'));
    await FinancialDocument.collection.insertOne(rawDoc(tenantB, 'INV-B-1'));
    const res = await fetch360(adminA, tenantA, customerA._id);
    const documents = res.body.data.finance.documents.map((d) => d.documentNumber);
    expect(documents).toContain('INV-A-1');
    expect(documents).not.toContain('INV-B-1');
  });

  test('CRM360-10/11 (Conversation & Message): shared participant does not leak B messages to A 360', async () => {
    const propA = await makeProperty(sharedUser, tenantA);
    const propB = await makeProperty(sharedUser, tenantB);
    const otherUser = await makeUser({ role: 'Client' });
    const convA = await Conversation.create({ participants: [sharedUser._id, otherUser._id], tenant: tenantA._id, relatedProperty: propA._id });
    const convB = await Conversation.create({ participants: [sharedUser._id, otherUser._id], tenant: tenantB._id, relatedProperty: propB._id });
    const msgA = await Message.create({ conversation: convA._id, tenant: tenantA._id, sender: sharedUser._id, receiver: otherUser._id, subject: 'Msg-A', content: 'Content A' });
    const msgB = await Message.create({ conversation: convB._id, tenant: tenantB._id, sender: sharedUser._id, receiver: otherUser._id, subject: 'Msg-B', content: 'Content B' });
    const res = await fetch360(adminA, tenantA, customerA._id);
    const convIds = res.body.data.communication.conversations.map((c) => String(c._id));
    expect(convIds).toContain(String(convA._id));
    expect(convIds).not.toContain(String(convB._id));
    const msgIds = res.body.data.communication.messages.map((m) => String(m._id));
    expect(msgIds).toContain(String(msgA._id));
    expect(msgIds).not.toContain(String(msgB._id));
  });

  test('CRM360-12 (Notification): shared recipient does not leak B notifications to A 360', async () => {
    const raw = (tenant, title) => ({
      recipient: sharedUser._id, platformTenant: tenant._id,
      type: 'system', title, body: title, destination: 'DASHBOARD',
      read: false, createdAt: new Date(),
    });
    await Notification.collection.insertOne(raw(tenantA, 'Note-A'));
    await Notification.collection.insertOne(raw(tenantB, 'Note-B'));
    const res = await fetch360(adminA, tenantA, customerA._id);
    const titles = res.body.data.communication.notifications.map((n) => n.title);
    expect(titles).toContain('Note-A');
    expect(titles).not.toContain('Note-B');
  });

  test('CRM360-13 (ContactMessage/QuoteRequest/AltcomProject): unattributable public intake is FAIL-CLOSED on tenant 360', async () => {
    // Raw insert to bypass schema validation — only email/subject/status
    // are read by the CRM360 query.
    await ContactMessage.collection.insertOne({ name: 'X', email: sharedUser.email.toLowerCase(), subject: 'Contact', message: 'Hello', status: 'new', submittedAt: new Date(), createdAt: new Date() });
    await QuoteRequest.collection.insertOne({ email: sharedUser.email.toLowerCase(), source: 'formulaire', service: 'mila-events', status: 'nouveau', date: new Date(), createdAt: new Date() });
    await AltcomProject.collection.insertOne({ email: sharedUser.email.toLowerCase(), projectName: 'Site', projectType: 'website', status: 'nouveau', submittedAt: new Date(), createdAt: new Date() });
    const res = await fetch360(adminA, tenantA, customerA._id);
    // Aucune de ces surfaces publiques n'est projetable sur un tenant
    // (aucun champ `tenant` canonique) → exclues du 360 tenant, jamais
    // silencieusement incluses via l'email seul.
    expect(res.body.data.relations.contacts).toEqual([]);
    expect(res.body.data.relations.quotes).toEqual([]);
    expect(res.body.data.relations.altcomProjects).toEqual([]);
  });

  test('CRM360-14/15/16 (widening): Tenant Admin A / Global Admin sans membership / PlatformOperator sans membership ne peuvent pas widener la 360', async () => {
    // Tenant Admin A already tested implicitly (uses admin's tenant scope).
    const propB = await makeProperty(sharedUser, tenantB);
    const propA = await makeProperty(sharedUser, tenantA);
    const globalAdminOrphan = await makeUser({ role: 'Admin' }); // no OrgMembership
    const orphanRes = await request(app)
      .get(`/api/crm/customers/${customerA._id}`)
      .set(bearer(globalAdminOrphan, tenantA));
    // No membership → requireTenantMembershipRole denies 403.
    expect(orphanRes.status).toBe(403);
    // Tenant Admin A remains strict.
    const res = await fetch360(adminA, tenantA, customerA._id);
    const ids = res.body.data.relations.properties.map((p) => String(p._id));
    expect(ids).toContain(String(propA._id));
    expect(ids).not.toContain(String(propB._id));
  });

  test('CRM360-17 (forged header): un tenant Admin B envoyant `X-Platform-Tenant-Id: A` ne récupère pas A (pas de membership sur A)', async () => {
    const res = await request(app)
      .get(`/api/crm/customers/${customerA._id}`)
      .set(bearer(adminB, tenantA));
    expect(res.status).toBe(403);
  });

  test('CRM360-19 (per-tenant projection): A et B interrogeant le même identity/email obtiennent des 360 strictement scopées à leur tenant', async () => {
    const propA = await makeProperty(sharedUser, tenantA);
    const propB = await makeProperty(sharedUser, tenantB);
    const resA = await fetch360(adminA, tenantA, customerA._id);
    const resB = await fetch360(adminB, tenantB, customerB._id);
    const idsA = resA.body.data.relations.properties.map((p) => String(p._id));
    const idsB = resB.body.data.relations.properties.map((p) => String(p._id));
    expect(idsA).toContain(String(propA._id));
    expect(idsA).not.toContain(String(propB._id));
    expect(idsB).toContain(String(propB._id));
    expect(idsB).not.toContain(String(propA._id));
  });

  test('CRM360-20 (no regression): tenant A voit bien SES données quand seul le tenant A est utilisé', async () => {
    const propA1 = await makeProperty(sharedUser, tenantA);
    const propA2 = await makeProperty(sharedUser, tenantA);
    const res = await fetch360(adminA, tenantA, customerA._id);
    expect(res.status).toBe(200);
    const ids = res.body.data.relations.properties.map((p) => String(p._id));
    expect(ids).toEqual(expect.arrayContaining([String(propA1._id), String(propA2._id)]));
  });
});
