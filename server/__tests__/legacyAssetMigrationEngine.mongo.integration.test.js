// STORAGE-LEGACY-1 — moteur de migration : idempotence, concurrence,
// reprise après panne, gating classification/tenant, réversibilité
// contrôlée. Cloudinary est mocké via `deps` (aucun appel réseau réel,
// aucune donnée réelle touchée) — conforme à l'interdiction absolue de
// migration réelle pendant ce sprint (§34).
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const PrivateAssetMigration = require('../models/PrivateAssetMigration');
const { planLegacyMigration, executeLegacyMigration, rollbackFailedMigration, assertApplyAuthorized } = require('../services/storage/legacyAssetMigrationService');

jest.setTimeout(180000);

let tenantA;
let tenantB;
let ownerA;

beforeAll(async () => {
  await startFinancialMongo();
  // `startFinancialMongo` connecte avec `autoIndex: false` (perf globale de
  // la suite) : l'index unique {resource, resourceId, field} — au cœur de
  // l'idempotence et de la concurrence testées ici — doit être construit
  // explicitement, sinon deux upserts concurrents créeraient deux documents
  // sans jamais être rejetés par MongoDB.
  await PrivateAssetMigration.syncIndexes();
  const fixtureA = await createTenantFixture({ label: 'Legacy A' });
  tenantA = fixtureA.tenant;
  ownerA = (await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap })).user;
  tenantB = (await createTenantFixture({ label: 'Legacy B' })).tenant;
});
afterEach(async () => clearFinancialMongoKeepTenants());
afterAll(async () => stopFinancialMongo());

// Les tenants doivent survivre au nettoyage entre tests (fixtures coûteuses,
// même patron que les autres suites Mongo du dépôt) — seules les
// collections métier du test sont vidées.
async function clearFinancialMongoKeepTenants() {
  await Promise.all([Property.deleteMany({}), Contrat.deleteMany({}), PrivateAssetMigration.deleteMany({})]);
}

async function makeResolvedContract(owner) {
  const property = await Property.create({
    title: 'Legacy fixture', description: 'Description suffisamment longue pour une fixture STORAGE-LEGACY-1.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 500000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.2, longitude: 15.2,
    images: ['https://placehold.co/1200x800/png'], surface: 90, statusAdmin: 'Validée', isPublished: true,
    availability: 'Disponible', owner: owner._id,
  });
  const contrat = await Contrat.create({ type: 'location', bien: property._id });
  return { property, contrat };
}

function fakeCloudinaryClient() {
  return { rename: jest.fn(async (_from, to) => ({ public_id: to, type: 'authenticated', resource_type: 'raw' })) };
}

describe('planLegacyMigration — gating par classification/attribution', () => {
  test('Contrat rattaché à une Property → resolved → B → migratable', async () => {
    const { contrat, property } = await makeResolvedContract(ownerA);
    const plan = await planLegacyMigration({
      resourceType: 'Contrat', resource: { _id: contrat._id, bien: property._id }, field: 'documents[0].url',
      url: 'https://res.cloudinary.com/demo/raw/upload/v1/legacy/doc.pdf',
    });
    expect(plan.attribution.status).toBe('resolved');
    expect(plan.classification).toBe('B');
    expect(plan.decision).toBe('migratable');
  });

  test('Contrat sans bien → unresolved → C/F → jamais migratable', async () => {
    const contrat = await Contrat.create({ type: 'location' });
    const plan = await planLegacyMigration({
      resourceType: 'Contrat', resource: { _id: contrat._id, bien: null }, field: 'documents[0].url',
      url: 'https://res.cloudinary.com/demo/raw/upload/v1/legacy/doc2.pdf',
    });
    expect(plan.attribution.status).toBe('unresolved');
    expect(plan.decision).toBe('stop');
  });

  test('média public → E, jamais présenté comme migratable même avec tenant resolved', async () => {
    const { contrat, property } = await makeResolvedContract(ownerA);
    const plan = await planLegacyMigration({
      resourceType: 'Contrat', resource: { _id: contrat._id, bien: property._id }, field: 'images[0]',
      url: 'https://res.cloudinary.com/demo/image/upload/v1/property/photo.jpg', isPublicMedia: true,
    });
    expect(plan.classification).toBe('E');
    expect(plan.decision).toBe('stop');
  });
});

describe('assertApplyAuthorized — refus par défaut', () => {
  test('apply sans aucun flag → refusé', () => {
    expect(() => assertApplyAuthorized({ apply: true })).toThrow(/APPLY_NOT_AUTHORIZED/);
  });

  test('dry-run (apply=false) → jamais bloqué', () => {
    expect(() => assertApplyAuthorized({ apply: false })).not.toThrow();
  });

  test('apply avec classification C (pas B) → refusé même avec le reste correct', () => {
    process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY = 'true';
    expect(() => assertApplyAuthorized({
      apply: true, mongoUriExplicit: 'mongodb://x', tenantIdExplicit: 'abc', classification: 'C',
      confirmToken: 'I_UNDERSTAND_THIS_MODIFIES_CLOUDINARY_AND_MONGODB',
    })).toThrow(/classification_not_B/);
    delete process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY;
  });
});

describe('executeLegacyMigration — dry-run jamais destructif', () => {
  test('apply=false : aucun appel Cloudinary, journal en pending, jamais complété', async () => {
    const { contrat } = await makeResolvedContract(ownerA);
    const cloudinaryClient = fakeCloudinaryClient();
    const result = await executeLegacyMigration({
      resource: 'Contrat', resourceId: contrat._id, field: 'documents[0].url', tenant: tenantA._id,
      oldPublicId: 'legacy/doc', resourceType: 'Contrat', classification: 'B', apply: false,
      deps: { cloudinaryClient, applyDbUpdate: jest.fn(), verifyDbUpdate: jest.fn(), verifyOldUrlInaccessible: jest.fn() },
    });
    expect(result.status).toBe('dry_run');
    expect(cloudinaryClient.rename).not.toHaveBeenCalled();
    const journal = await PrivateAssetMigration.findOne({ resource: 'Contrat', resourceId: contrat._id, field: 'documents[0].url' });
    expect(journal.status).toBe('pending');
    expect(journal.lockedAt).toBeNull();
  });
});

describe('executeLegacyMigration (apply=true, deps mockées) — protocole complet', () => {
  const authorizedFlags = () => ({
    apply: true, mongoUriExplicit: 'mongodb://explicit-test-only', tenantIdExplicit: 'tenant-explicit',
    classification: 'B', confirmToken: 'I_UNDERSTAND_THIS_MODIFIES_CLOUDINARY_AND_MONGODB',
  });

  beforeEach(() => { process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY = 'true'; });
  afterEach(() => { delete process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY; });

  test('run complet → completed, OLD URL vérifiée inaccessible, journal sans secret', async () => {
    const { contrat } = await makeResolvedContract(ownerA);
    const cloudinaryClient = fakeCloudinaryClient();
    const verifyOldUrlInaccessible = jest.fn().mockResolvedValue(true);
    const result = await executeLegacyMigration({
      resource: 'Contrat', resourceId: contrat._id, field: 'documents[0].url', tenant: tenantA._id,
      oldPublicId: 'legacy/doc-complete', oldUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/legacy/doc-complete.pdf',
      resourceType: 'Contrat', ...authorizedFlags(),
      deps: {
        cloudinaryClient, resourceKind: 'raw',
        applyDbUpdate: jest.fn().mockResolvedValue(true),
        verifyDbUpdate: jest.fn().mockResolvedValue(true),
        verifyOldUrlInaccessible,
      },
    });
    expect(result.status).toBe('completed');
    expect(cloudinaryClient.rename).toHaveBeenCalledTimes(1);
    expect(verifyOldUrlInaccessible).toHaveBeenCalledWith('https://res.cloudinary.com/demo/raw/upload/v1/legacy/doc-complete.pdf');
    expect(result.journal.oldUrlVerifiedInaccessible).toBe(true);
    expect(JSON.stringify(result.journal)).not.toMatch(/api_secret|signature/i);
  });

  test('IDEMPOTENCE — un deuxième run sur la même ressource/champ est un no-op', async () => {
    const { contrat } = await makeResolvedContract(ownerA);
    const deps = () => ({
      cloudinaryClient: fakeCloudinaryClient(), resourceKind: 'raw',
      applyDbUpdate: jest.fn().mockResolvedValue(true), verifyDbUpdate: jest.fn().mockResolvedValue(true),
      verifyOldUrlInaccessible: jest.fn().mockResolvedValue(true),
    });
    const base = {
      resource: 'Contrat', resourceId: contrat._id, field: 'documents[0].url', tenant: tenantA._id,
      oldPublicId: 'legacy/doc-idem', resourceType: 'Contrat', ...authorizedFlags(),
    };
    const first = await executeLegacyMigration({ ...base, deps: deps() });
    expect(first.status).toBe('completed');
    const second = await executeLegacyMigration({ ...base, deps: deps() });
    expect(second.status).toBe('no_op');
    expect(second.reason).toBe('already_migrated');
    const count = await PrivateAssetMigration.countDocuments({ resource: 'Contrat', resourceId: contrat._id, field: 'documents[0].url' });
    expect(count).toBe(1);
  });

  test('CONCURRENCE — deux exécutions simultanées ne produisent qu\'une seule migration effective', async () => {
    const { contrat } = await makeResolvedContract(ownerA);
    const base = {
      resource: 'Contrat', resourceId: contrat._id, field: 'documents[0].url', tenant: tenantA._id,
      oldPublicId: 'legacy/doc-concurrent', resourceType: 'Contrat', ...authorizedFlags(),
    };
    const runOnce = () => executeLegacyMigration({
      ...base,
      deps: {
        cloudinaryClient: fakeCloudinaryClient(), resourceKind: 'raw',
        applyDbUpdate: jest.fn().mockResolvedValue(true), verifyDbUpdate: jest.fn().mockResolvedValue(true),
        verifyOldUrlInaccessible: jest.fn().mockResolvedValue(true),
      },
    });
    const results = await Promise.allSettled([runOnce(), runOnce()]);
    const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.status === 'completed');
    const lockedOut = results.filter((r) => r.status === 'rejected' && /MIGRATION_LOCKED/.test(r.reason.message));
    expect(succeeded.length).toBe(1);
    expect(succeeded.length + lockedOut.length).toBe(2);
    const count = await PrivateAssetMigration.countDocuments({ resource: 'Contrat', resourceId: contrat._id, field: 'documents[0].url' });
    expect(count).toBe(1);
  });

  test('REPRISE APRÈS PANNE — échec avant bascule DB, puis retry réussit sans re-appeler Cloudinary inutilement', async () => {
    const { contrat } = await makeResolvedContract(ownerA);
    const base = {
      resource: 'Contrat', resourceId: contrat._id, field: 'documents[0].url', tenant: tenantA._id,
      oldPublicId: 'legacy/doc-resume', resourceType: 'Contrat', ...authorizedFlags(),
    };
    const failingCloudinary = fakeCloudinaryClient();
    await expect(executeLegacyMigration({
      ...base,
      deps: {
        cloudinaryClient: failingCloudinary, resourceKind: 'raw',
        applyDbUpdate: jest.fn().mockRejectedValue(new Error('DB_DOWN')),
        verifyDbUpdate: jest.fn(), verifyOldUrlInaccessible: jest.fn(),
      },
    })).rejects.toThrow('DB_DOWN');

    const failedJournal = await PrivateAssetMigration.findOne({ resource: 'Contrat', resourceId: contrat._id, field: 'documents[0].url' });
    expect(failedJournal.status).toBe('failed');
    expect(failedJournal.lockedAt).toBeNull();

    const retry = await executeLegacyMigration({
      ...base,
      deps: {
        cloudinaryClient: fakeCloudinaryClient(), resourceKind: 'raw',
        applyDbUpdate: jest.fn().mockResolvedValue(true), verifyDbUpdate: jest.fn().mockResolvedValue(true),
        verifyOldUrlInaccessible: jest.fn().mockResolvedValue(true),
      },
    });
    expect(retry.status).toBe('completed');
    expect(retry.journal.attempt).toBeGreaterThanOrEqual(2);
  });

  test('OLD URL toujours accessible après tentative → migration marquée failed, jamais completed', async () => {
    const { contrat } = await makeResolvedContract(ownerA);
    await expect(executeLegacyMigration({
      resource: 'Contrat', resourceId: contrat._id, field: 'documents[0].url', tenant: tenantA._id,
      oldPublicId: 'legacy/doc-leak', oldUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/legacy/doc-leak.pdf',
      resourceType: 'Contrat', ...authorizedFlags(),
      deps: {
        cloudinaryClient: fakeCloudinaryClient(), resourceKind: 'raw',
        applyDbUpdate: jest.fn().mockResolvedValue(true), verifyDbUpdate: jest.fn().mockResolvedValue(true),
        verifyOldUrlInaccessible: jest.fn().mockResolvedValue(false),
      },
    })).rejects.toThrow('OLD_URL_STILL_ACCESSIBLE');

    const journal = await PrivateAssetMigration.findOne({ resource: 'Contrat', resourceId: contrat._id, field: 'documents[0].url' });
    expect(journal.status).toBe('failed');
    expect(journal.oldUrlVerifiedInaccessible).toBe(false);
  });
});

describe('rollbackFailedMigration — réversibilité sans republication automatique', () => {
  beforeEach(() => { process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY = 'true'; });
  afterEach(() => { delete process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY; });

  test('une migration completed ne peut jamais être rollback (pas de re-exposition publique)', async () => {
    const { contrat } = await makeResolvedContract(ownerA);
    const authorizedFlags = {
      apply: true, mongoUriExplicit: 'mongodb://explicit-test-only', tenantIdExplicit: 'tenant-explicit',
      classification: 'B', confirmToken: 'I_UNDERSTAND_THIS_MODIFIES_CLOUDINARY_AND_MONGODB',
    };
    const result = await executeLegacyMigration({
      resource: 'Contrat', resourceId: contrat._id, field: 'documents[0].url', tenant: tenantA._id,
      oldPublicId: 'legacy/doc-rollback', resourceType: 'Contrat', ...authorizedFlags,
      deps: {
        cloudinaryClient: fakeCloudinaryClient(), resourceKind: 'raw',
        applyDbUpdate: jest.fn().mockResolvedValue(true), verifyDbUpdate: jest.fn().mockResolvedValue(true),
        verifyOldUrlInaccessible: jest.fn().mockResolvedValue(true),
      },
    });
    await expect(rollbackFailedMigration({ journalId: result.journal._id, deps: {} })).rejects.toThrow('CANNOT_ROLLBACK_COMPLETED_MIGRATION');
  });

  test('une migration failed APRÈS bascule DB peut être rollback (restauration DB uniquement, jamais Cloudinary public)', async () => {
    const { contrat } = await makeResolvedContract(ownerA);
    const authorizedFlags = {
      apply: true, mongoUriExplicit: 'mongodb://explicit-test-only', tenantIdExplicit: 'tenant-explicit',
      classification: 'B', confirmToken: 'I_UNDERSTAND_THIS_MODIFIES_CLOUDINARY_AND_MONGODB',
    };
    // Échec APRÈS la bascule DB (OLD URL encore accessible) : c'est le seul
    // cas où une restauration de la référence DB a un sens (§20/§21).
    await expect(executeLegacyMigration({
      resource: 'Contrat', resourceId: contrat._id, field: 'documents[0].url', tenant: tenantA._id,
      oldPublicId: 'legacy/doc-rollback2', oldUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/legacy/doc-rollback2.pdf',
      resourceType: 'Contrat', ...authorizedFlags,
      deps: {
        cloudinaryClient: fakeCloudinaryClient(), resourceKind: 'raw',
        applyDbUpdate: jest.fn().mockResolvedValue(true), verifyDbUpdate: jest.fn().mockResolvedValue(true),
        verifyOldUrlInaccessible: jest.fn().mockResolvedValue(false),
      },
    })).rejects.toThrow('OLD_URL_STILL_ACCESSIBLE');
    const journal = await PrivateAssetMigration.findOne({ resource: 'Contrat', resourceId: contrat._id, field: 'documents[0].url' });
    const restoreDbReference = jest.fn().mockResolvedValue(true);
    const rolledBack = await rollbackFailedMigration({ journalId: journal._id, deps: { restoreDbReference } });
    expect(rolledBack.status).toBe('rolled_back');
    expect(restoreDbReference).toHaveBeenCalled();
  });
});

// Rappel adversarial tenant-cross : une ressource attribuée au Tenant A ne
// doit jamais produire un plan `migratable` sous le Tenant B — couvert
// indirectement ici via `resolveResourceTenant`, déjà testé de façon
// adversariale par TENANT-CERT-2/TENANT-HARDENING-2. Aucune règle tenant
// n'est recréée par ce fichier.
describe('cross-tenant — un plan ne fournit jamais un tenantId différent de celui réellement attribué', () => {
  test('tenant attribué correspond à la Property réellement liée, jamais un autre tenant', async () => {
    const { contrat, property } = await makeResolvedContract(ownerA);
    const plan = await planLegacyMigration({
      resourceType: 'Contrat', resource: { _id: contrat._id, bien: property._id }, field: 'documents[0].url',
      url: 'https://res.cloudinary.com/demo/raw/upload/v1/legacy/doc3.pdf',
    });
    expect(plan.attribution.tenantId).not.toBe(String(tenantB._id));
  });
});
