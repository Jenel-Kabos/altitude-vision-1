const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const PlatformTenant = require('../models/PlatformTenant');
const OrgMembership = require('../models/OrgMembership');
const PlatformOperator = require('../models/PlatformOperator');
const RentalManagement = require('../models/RentalManagement');
const ActionLog = require('../models/ActionLog');
const {
  REASON,
  regularizeAssetProjectionBatch,
} = require('../services/platformTenant/assetProjectionConsistencyApplyService');

jest.setTimeout(180000);

let sequence = 0;
const makeUser = async (label, role = 'Proprietaire') => {
  sequence += 1;
  return User.create({
    name: label,
    email: `c28m-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${sequence}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role,
    isEmailVerified: true, isActive: true, status: 'Actif',
  });
};

const makeProperty = (owner, overrides = {}) => Property.create({
  title: `C2.8M Property ${++sequence}`,
  tenant: null,
  owner: owner._id,
  pole: 'Altimmo',
  status: 'vente',
  description: 'Fixture atomique C2.8M suffisamment détaillée pour la validation.',
  type: 'Parcelle', price: 1000000,
  address: { city: 'Brazzaville', arrondissement: 'Centre' },
  latitude: -4.26, longitude: 15.28, surface: 100,
  images: ['https://example.test/c28m.jpg'],
  statusAdmin: 'Validée', isPublished: true, availability: 'Disponible',
  ...overrides,
});

let owner;
let actor;
let tenant;

const input = (propertyIds, overrides = {}) => ({
  mode: 'apply',
  targetTenantId: tenant._id,
  expectedOwnerId: owner._id,
  propertyIds,
  actorId: actor._id,
  reason: REASON,
  operationId: `C2_8M_TEST_${++sequence}`,
  ...overrides,
});

beforeAll(async () => {
  await startFinancialMongo();
  await ActionLog.syncIndexes();
});

afterAll(stopFinancialMongo);

beforeEach(async () => {
  await clearFinancialMongo();
  const fixture = await createTenantFixture({ label: 'Mila Events C2.8M', withAdminMembership: true });
  tenant = fixture.tenant;
  owner = fixture.bootstrap;
  actor = await makeUser('Platform Operator', 'Admin');
  await PlatformOperator.create({
    user: actor._id,
    status: 'active',
    capabilities: ['platform.properties.manage'],
    grantedBy: actor._id,
    grantReason: 'C2.8M local certification',
  });
});

test('APPLY-01 — un candidat valide passe uniquement de tenant:null au tenant cible', async () => {
  const property = await makeProperty(owner);
  const before = property.toObject();

  const result = await regularizeAssetProjectionBatch(input([property._id]));

  const after = await Property.findById(property._id).lean();
  expect(result).toMatchObject({ mode: 'apply', status: 'APPLIED', migratedCount: 1 });
  expect(String(after.tenant)).toBe(String(tenant._id));
  const changed = Object.keys(after).filter((key) => JSON.stringify(after[key]) !== JSON.stringify(before[key]));
  expect(changed.filter((key) => !['tenant', 'updatedAt', '__v'].includes(key))).toEqual([]);
});

test('APPLY-02 — Property.owner reste strictement inchangé et l’audit décrit la transition', async () => {
  const property = await makeProperty(owner);
  const operationId = `C2_8M_OWNER_${++sequence}`;

  await regularizeAssetProjectionBatch(input([property._id], { operationId }));

  const after = await Property.findById(property._id).lean();
  const log = await ActionLog.findOne({ action: 'asset_projection_consistency.applied', 'cible.id': String(property._id) }).lean();
  expect(String(after.owner)).toBe(String(owner._id));
  expect(log).toMatchObject({
    tenant: tenant._id,
    auteur: { id: actor._id, role: 'PlatformOperator' },
    metadata: { regularization: { batchId: operationId, reason: REASON, operation: 'apply' } },
  });
  expect(log.metadata.regularization.before).toMatchObject({ tenant: null, owner: String(owner._id) });
  expect(log.metadata.regularization.after).toMatchObject({ tenant: String(tenant._id), owner: String(owner._id) });
});

test('APPLY-03 — un bien déjà dans le tenant est ALREADY_IN_TARGET sans écriture ni audit', async () => {
  const property = await makeProperty(owner, { tenant: tenant._id });
  const updatedAt = property.updatedAt;

  const result = await regularizeAssetProjectionBatch(input([property._id]));

  const after = await Property.findById(property._id).lean();
  expect(result).toMatchObject({ status: 'ALREADY_IN_TARGET', migratedCount: 0 });
  expect(after.updatedAt).toEqual(updatedAt);
  expect(await ActionLog.countDocuments({ action: 'asset_projection_consistency.applied' })).toBe(0);
});

test('APPLY-04 — un bien déjà rattaché à un autre tenant est refusé sans réattribution', async () => {
  const otherTenant = await PlatformTenant.create({ name: 'Other C2.8M', slug: `other-c28m-${++sequence}`, rootOrgUnit: tenant.rootOrgUnit, status: 'active' });
  const property = await makeProperty(owner, { tenant: otherTenant._id });

  await expect(regularizeAssetProjectionBatch(input([property._id])))
    .rejects.toMatchObject({ code: 'TENANT_CONFLICT' });

  expect(String((await Property.findById(property._id)).tenant)).toBe(String(otherTenant._id));
  expect(await ActionLog.countDocuments({ action: 'asset_projection_consistency.applied' })).toBe(0);
});

test('APPLY-05 — un owner réel différent de expectedOwner provoque un refus', async () => {
  const otherOwner = await makeUser('Other Owner');
  const property = await makeProperty(otherOwner);

  await expect(regularizeAssetProjectionBatch(input([property._id])))
    .rejects.toMatchObject({ code: 'OWNER_MISMATCH' });

  expect((await Property.findById(property._id)).tenant).toBeNull();
});

test('APPLY-06 — la preuve owner/Admin du tenant est refaite dans la transaction', async () => {
  const property = await makeProperty(owner);
  await OrgMembership.updateOne(
    { user: owner._id, orgUnit: tenant.rootOrgUnit },
    { $set: { status: 'suspended' } },
  );

  await expect(regularizeAssetProjectionBatch(input([property._id])))
    .rejects.toMatchObject({ code: 'TARGET_OWNERSHIP_INVALID' });

  expect((await Property.findById(property._id)).tenant).toBeNull();
});

test('APPLY-07 — un RentalManagement apparu après le dry-run bloque tout apply', async () => {
  const property = await makeProperty(owner, { status: 'location', type: 'Bureau' });
  await RentalManagement.create({ property: property._id, owner: owner._id, managementActivated: true });

  await expect(regularizeAssetProjectionBatch(input([property._id])))
    .rejects.toMatchObject({ code: 'ACTIVE_WORKFLOW_BLOCKER' });

  expect((await Property.findById(property._id)).tenant).toBeNull();
});

test('APPLY-08 — un actif devenu vendu est historique et ne peut plus migrer', async () => {
  const property = await makeProperty(owner, { availability: 'Vendu', assetCycle: 'vendu' });

  await expect(regularizeAssetProjectionBatch(input([property._id])))
    .rejects.toMatchObject({ code: 'HISTORICAL_ASSET_REFUSED' });

  expect((await Property.findById(property._id)).tenant).toBeNull();
});

test('APPLY-09 — deux apply concurrents produisent un seul changement logique et un audit par Property', async () => {
  const bureau = await makeProperty(owner, { title: 'C28M Bureau concurrent', status: 'location', type: 'Bureau' });
  const parcelle = await makeProperty(owner, { title: 'C28M Parcelle concurrente', status: 'vente', type: 'Parcelle' });
  const batch = input([bureau._id, parcelle._id], { operationId: `C2_8M_CONCURRENT_${++sequence}` });

  const results = await Promise.all([
    regularizeAssetProjectionBatch(batch),
    regularizeAssetProjectionBatch(batch),
  ]);

  expect(results.reduce((sum, result) => sum + result.migratedCount, 0)).toBe(2);
  expect(results.map(({ status }) => status).sort()).toEqual(['ALREADY_IN_TARGET', 'APPLIED']);
  expect(await Property.countDocuments({ _id: { $in: [bureau._id, parcelle._id] }, tenant: tenant._id })).toBe(2);
  expect(await ActionLog.countDocuments({ action: 'asset_projection_consistency.applied' })).toBe(2);
});

test('APPLY-10 — un conflit sur le deuxième ID annule le lot exact avant toute mutation', async () => {
  const bureau = await makeProperty(owner, { title: 'C28M Bureau atomic', status: 'location', type: 'Bureau' });
  const otherTenantFixture = await createTenantFixture({ label: 'Tenant conflit C2.8M' });
  const parcelle = await makeProperty(owner, { title: 'C28M Parcelle conflit', tenant: otherTenantFixture.tenant._id });

  await expect(regularizeAssetProjectionBatch(input([bureau._id, parcelle._id])))
    .rejects.toMatchObject({ code: 'TENANT_CONFLICT' });

  expect((await Property.findById(bureau._id)).tenant).toBeNull();
  expect(String((await Property.findById(parcelle._id)).tenant)).toBe(String(otherTenantFixture.tenant._id));
  expect(await ActionLog.countDocuments({ action: 'asset_projection_consistency.applied' })).toBe(0);
});

test.each([
  'before_first_mutation',
  'after_first_property',
  'before_second_property',
  'before_commit',
])('APPLY-11 — failure injectée %s rollback intégral du lot', async (failureInjection) => {
  const bureau = await makeProperty(owner, { title: `C28M Bureau ${failureInjection}`, status: 'location', type: 'Bureau' });
  const parcelle = await makeProperty(owner, { title: `C28M Parcelle ${failureInjection}` });

  await expect(regularizeAssetProjectionBatch(input(
    [bureau._id, parcelle._id],
    { failureInjection },
  ))).rejects.toMatchObject({ code: 'INJECTED_FAILURE' });

  expect(await Property.countDocuments({ _id: { $in: [bureau._id, parcelle._id] }, tenant: null })).toBe(2);
  expect(await ActionLog.countDocuments({ action: 'asset_projection_consistency.applied' })).toBe(0);
});

test('APPLY-12 — rejouer le batch complet est idempotent et ne double aucun événement', async () => {
  const bureau = await makeProperty(owner, { title: 'C28M Bureau replay', status: 'location', type: 'Bureau' });
  const parcelle = await makeProperty(owner, { title: 'C28M Parcelle replay' });
  const batch = input([bureau._id, parcelle._id], { operationId: `C2_8M_REPLAY_${++sequence}` });

  const first = await regularizeAssetProjectionBatch(batch);
  const second = await regularizeAssetProjectionBatch(batch);

  expect(first).toMatchObject({ status: 'APPLIED', migratedCount: 2 });
  expect(second).toMatchObject({ status: 'ALREADY_IN_TARGET', migratedCount: 0 });
  expect(second.items.every(({ action }) => action === 'ALREADY_IN_TARGET')).toBe(true);
  expect(await ActionLog.countDocuments({ action: 'asset_projection_consistency.applied' })).toBe(2);
  const owners = await Property.find({ _id: { $in: [bureau._id, parcelle._id] } }).distinct('owner');
  expect(owners.map(String)).toEqual([String(owner._id)]);
});
