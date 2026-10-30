const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const PlatformOperator = require('../models/PlatformOperator');
const CommercialPublicationRevision = require('../models/CommercialPublicationRevision');
const Notification = require('../models/Notification');
const propertyRoutes = require('../routes/propertyRoutes');
const adminPropertyRoutes = require('../routes/adminPropertyRoutes');
const { createPendingRevision, decideRevision, publicSnapshot } = require('../services/commercialPublicationService');
const { getPublicPropertyById } = require('../services/publicApi/publicPropertyService');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);
const app = express(); app.use(express.json());
app.use('/api/properties', propertyRoutes); app.use('/api/admin', adminPropertyRoutes); app.use(errorHandler);
const bearer = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function eventuallyCount(filter, expected) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const count = await Notification.countDocuments(filter);
    if (count === expected) return count;
    await new Promise((resolve) => setImmediate(resolve));
  }
  return Notification.countDocuments(filter);
}

async function fixture({ withdrawn = false, suspended = false } = {}) {
  const createUser = (name, role) => User.create({
    name, email: `${name.toLowerCase().replaceAll(' ', '-')}-${Date.now()}-${Math.random()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true,
  });
  const owner = await createUser('Owner Concurrent', 'Proprietaire');
  const operatorA = await createUser('Operator A Concurrent', 'Admin');
  const operatorB = await createUser('Operator B Concurrent', 'Admin');
  for (const operator of [operatorA, operatorB]) {
    await PlatformOperator.create({ user: operator._id, capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES], grantedBy: operatorA._id, grantReason: 'TEST DATA concurrency' });
  }
  const snapshot = {
    title: 'Villa concurrence', description: 'Description concurrence', price: 100000,
    status: 'vente', type: 'Villa', address: { arrondissement: 'Bacongo', city: 'Brazzaville' },
    latitude: -4.2, longitude: 15.2, images: ['concurrency.jpg'], surface: 120, availability: 'Disponible',
  };
  const property = await Property.create({
    ...snapshot, pole: 'Altimmo', owner: owner._id,
    statusAdmin: 'Validée', isPublished: !withdrawn && !suspended,
    publicationLifecycleState: suspended ? 'admin_suspended' : withdrawn ? 'owner_withdrawn' : 'published',
    availability: withdrawn ? 'Retiré' : 'Disponible', approvedPublicSnapshot: snapshot,
    commercialPublicationVersion: 1,
  });
  return { owner, operatorA, operatorB, property, snapshot };
}

async function pendingChange(ctx, price = 125000) {
  const revision = await createPendingRevision({
    resourceType: 'Property', resource: ctx.property,
    proposedSnapshot: { ...ctx.snapshot, price }, actor: ctx.owner,
  });
  await Property.updateOne({ _id: ctx.property._id }, {
    $set: { currentPublicationRevision: revision._id, publicationLifecycleState: 'change_pending', statusAdmin: 'En attente', isPublished: false },
  });
  return revision;
}

test('A — retrait et approbation réellement concurrents: le retrait reste prioritaire dans les deux lancements', async () => {
  for (const reverse of [false, true]) {
    await clearFinancialMongo();
    const ctx = await fixture(); await pendingChange(ctx);
    const approve = () => request(app).patch(`/api/admin/properties/${ctx.property._id}/validate`).set(bearer(ctx.operatorA)).send({ reason: 'Contrôle terminé' });
    const withdraw = () => request(app).patch(`/api/properties/${ctx.property._id}/lifecycle`).set(bearer(ctx.owner)).send({ availability: 'Retiré', reason: 'Retrait concurrent' });
    const actions = reverse ? [withdraw, approve] : [approve, withdraw];
    await Promise.allSettled(actions.map((action) => Promise.resolve().then(action)));
    const fresh = await Property.findById(ctx.property._id).lean();
    expect(fresh).toMatchObject({ publicationLifecycleState: 'owner_withdrawn', availability: 'Retiré', isPublished: false });
    expect(await getPublicPropertyById(ctx.property._id)).toBeNull();
    expect(await eventuallyCount({ entityId: ctx.property._id, type: 'property_owner_withdrawn' }, 2)).toBe(2);
  }
});

test('B — une ancienne révision supersédée ne peut jamais être approuvée', async () => {
  const ctx = await fixture();
  const first = await createPendingRevision({ resourceType: 'Property', resource: ctx.property, proposedSnapshot: { ...ctx.snapshot, price: 120000 }, actor: ctx.owner });
  const second = await createPendingRevision({ resourceType: 'Property', resource: ctx.property, proposedSnapshot: { ...ctx.snapshot, price: 130000 }, actor: ctx.owner });
  await expect(decideRevision({ revisionId: first._id, decision: 'approve', actor: ctx.operatorA, reason: 'Obsolète', adapter: { model: Property } }))
    .rejects.toMatchObject({ code: 'PUBLICATION_REVISION_STALE' });
  expect(await CommercialPublicationRevision.findById(first._id)).toMatchObject({ status: 'superseded' });
  expect(second.status).toBe('pending');
  expect(await getPublicPropertyById(ctx.property._id)).toMatchObject({ price: 100000 });
});

test('C — déclaration Loué et approbation concurrentes: Loué reste non public dans les deux lancements', async () => {
  for (const reverse of [false, true]) {
    await clearFinancialMongo();
    const ctx = await fixture(); await pendingChange(ctx);
    const approve = () => request(app).patch(`/api/admin/properties/${ctx.property._id}/validate`).set(bearer(ctx.operatorA)).send({ reason: 'Contrôle terminé' });
    const rent = () => request(app).patch(`/api/properties/${ctx.property._id}/lifecycle`).set(bearer(ctx.owner)).send({ availability: 'Loué', reason: 'Bail externe' });
    await Promise.allSettled((reverse ? [rent, approve] : [approve, rent]).map((action) => Promise.resolve().then(action)));
    expect(await Property.findById(ctx.property._id).lean()).toMatchObject({ availability: 'Loué', publicationLifecycleState: 'owner_withdrawn', isPublished: false });
    expect(await getPublicPropertyById(ctx.property._id)).toBeNull();
  }
});

test('D — réactivations simultanées: une seule demande active et une notification par opérateur', async () => {
  const ctx = await fixture({ withdrawn: true });
  const calls = [1, 2, 3].map(() => request(app).post(`/api/properties/${ctx.property._id}/reactivation`).set(bearer(ctx.owner)).send({ reason: 'Retour au marché' }));
  await Promise.allSettled(calls);
  expect(await CommercialPublicationRevision.countDocuments({ resource: ctx.property._id, status: 'pending' })).toBe(1);
  expect(await Property.findById(ctx.property._id)).toMatchObject({ publicationLifecycleState: 'pending', isPublished: false });
  expect(await eventuallyCount({ entityId: ctx.property._id, type: 'property_reactivation_requested' }, 2)).toBe(2);
});

test('E — une annonce suspendue refuse la réactivation directe mais accepte le réexamen', async () => {
  const ctx = await fixture({ suspended: true });
  const denied = await request(app).post(`/api/properties/${ctx.property._id}/reactivation`).set(bearer(ctx.owner)).send({ reason: 'Tentative directe' });
  expect(denied.status).toBe(409);
  const review = await request(app).post(`/api/properties/${ctx.property._id}/suspension-review`).set(bearer(ctx.owner)).send({ reason: 'Documents corrigés' });
  expect(review.status).toBe(202);
  expect(await Property.findById(ctx.property._id)).toMatchObject({ publicationLifecycleState: 'admin_suspended', isPublished: false });
  expect(await getPublicPropertyById(ctx.property._id)).toBeNull();
});

test('F — approbation et refus concurrents: une seule décision et une seule notification propriétaire', async () => {
  const ctx = await fixture(); await pendingChange(ctx);
  const [approve, reject] = await Promise.all([
    request(app).patch(`/api/admin/properties/${ctx.property._id}/validate`).set(bearer(ctx.operatorA)).send({ reason: 'Approuvé A' }),
    request(app).patch(`/api/admin/properties/${ctx.property._id}/reject`).set(bearer(ctx.operatorB)).send({ reason: 'Refusé B' }),
  ]);
  expect([approve.status, reject.status].filter((status) => status === 200)).toHaveLength(1);
  const fresh = await Property.findById(ctx.property._id).lean();
  expect(['published', 'rejected']).toContain(fresh.publicationLifecycleState);
  const decided = await CommercialPublicationRevision.find({ resource: ctx.property._id, status: { $in: ['approved', 'rejected'] } }).lean();
  expect(decided).toHaveLength(1);
  expect(await eventuallyCount({ entityId: ctx.property._id, type: { $in: ['property_publication_approved', 'property_publication_rejected'] } }, 1)).toBe(1);
  expect(Boolean(await getPublicPropertyById(ctx.property._id))).toBe(fresh.publicationLifecycleState === 'published');
});
