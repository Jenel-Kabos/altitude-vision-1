const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const Property = require('../models/Property');
const PlatformOperator = require('../models/PlatformOperator');
const ActionLog = require('../models/ActionLog');
const { buildManifest, applyManifest, rollbackManifest } = require('../services/platformTenant/tenantDataRegularizationService');

jest.setTimeout(180000);
const baseProperty = (owner) => ({ title: 'Regularization fixture', description: 'Description de test suffisamment longue.', pole: 'Altimmo', type: 'Villa', status: 'location', price: 100000,
  address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: 4.26, longitude: 15.28, images: ['https://example.test/image.jpg'], surface: 150,
  statusAdmin: 'Validée', isPublished: false, availability: 'Disponible', owner });
let tenant; let actor; let property; let manifest; let dbName;

beforeAll(async () => {
  const { uri } = await startFinancialMongo();
  await mongoose.connect(uri).catch(() => {});
  dbName = mongoose.connection.name;
  const fixture = await createTenantFixture({ label: 'Exec Tenant A' });
  tenant = fixture.tenant;
  const member = await createTenantUser({ tenant, bootstrap: fixture.bootstrap });
  actor = member.user;
  await PlatformOperator.create({ user: actor._id, status: 'active', capabilities: [], grantedBy: actor._id, grantReason: 'test' });
  property = await Property.create(baseProperty(actor._id));
  await ActionLog.syncIndexes();
});
afterAll(async () => stopFinancialMongo());
beforeEach(async () => {
  await Property.updateOne({ _id: property._id }, { $set: { tenant: null, isPublished: false, price: 100000 } });
  await ActionLog.deleteMany({ 'metadata.regularization.batchId': /^exec-/ });
  const audit = { manifest: [{ resourceType: 'Property', resourceId: String(property._id), classification: 'A' }] };
  manifest = await buildManifest({ audit, tenantId: tenant._id, actorId: actor._id, database: dbName, batchId: `exec-${Date.now()}-${Math.random()}` });
});

test('A attribution is atomic, journaled and preserves Property business fields', async () => {
  await expect(applyManifest(manifest)).resolves.toEqual(['APPLIED']);
  const after = await Property.findById(property._id).lean();
  expect(String(after.tenant)).toBe(String(tenant._id));
  expect(after.isPublished).toBe(false); expect(after.price).toBe(100000);
  expect(await ActionLog.countDocuments({ 'metadata.regularization.batchId': manifest.batchId, 'metadata.regularization.operation': 'apply' })).toBe(1);
});

test('B/C/D/E/F are technically rejected', async () => {
  for (const classification of ['B', 'C', 'D', 'E', 'F']) {
    const bad = structuredClone(manifest); bad.entries[0].classification = classification;
    await expect(applyManifest(bad)).rejects.toMatchObject({ code: 'MANIFEST_INVALID' });
  }
});

test('concurrent apply yields one effective mutation and a stable already-applied result', async () => {
  const settled = await Promise.allSettled([applyManifest(manifest), applyManifest(manifest)]);
  expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
  expect(settled.flatMap((r) => r.value)).toEqual(expect.arrayContaining(['APPLIED', 'ALREADY_APPLIED']));
  expect(await ActionLog.countDocuments({ 'metadata.regularization.batchId': manifest.batchId, 'metadata.regularization.operation': 'apply' })).toBe(1);
});

test('crash recovery and idempotent rerun resume from the append-only checkpoint', async () => {
  await expect(applyManifest(manifest, { simulateCrashAfter: 1 })).rejects.toMatchObject({ code: 'SIMULATED_CRASH' });
  await expect(applyManifest(manifest)).resolves.toEqual(['ALREADY_APPLIED']);
});

test('fingerprint divergence fails closed', async () => {
  await Property.updateOne({ _id: property._id }, { $set: { owner: new mongoose.Types.ObjectId() } });
  await expect(applyManifest(manifest)).rejects.toMatchObject({ code: 'FINGERPRINT_DIVERGED' });
  await Property.updateOne({ _id: property._id }, { $set: { owner: actor._id } });
});

test('rollback restores only tenant and refuses post-apply divergence', async () => {
  await applyManifest(manifest);
  await expect(rollbackManifest(manifest)).resolves.toEqual(['ROLLED_BACK']);
  expect((await Property.findById(property._id).lean()).tenant).toBeNull();
  await Property.updateOne({ _id: property._id }, { $set: { tenant: tenant._id, owner: new mongoose.Types.ObjectId() } });
  await expect(rollbackManifest(manifest)).rejects.toMatchObject({ code: 'ROLLBACK_DIVERGED' });
  await Property.updateOne({ _id: property._id }, { $set: { owner: actor._id } });
});

test('wrong database, tenant and inactive actor fail closed during manifest construction', async () => {
  const audit = { manifest: [{ resourceType: 'Property', resourceId: String(property._id), classification: 'A' }] };
  await expect(buildManifest({ audit, tenantId: tenant._id, actorId: actor._id, database: 'wrong', batchId: 'x' })).rejects.toMatchObject({ code: 'DATABASE_MISMATCH' });
  await PlatformOperator.updateOne({ user: actor._id }, { $set: { status: 'suspended' } });
  await expect(buildManifest({ audit, tenantId: tenant._id, actorId: actor._id, database: dbName, batchId: 'x' })).rejects.toMatchObject({ code: 'ACTOR_NOT_AUTHORIZED' });
  await PlatformOperator.updateOne({ user: actor._id }, { $set: { status: 'active' } });
  await expect(buildManifest({ audit, tenantId: new mongoose.Types.ObjectId(), actorId: actor._id, database: dbName, batchId: 'x' })).rejects.toMatchObject({ code: 'RESOURCE_DIVERGED' });
});
