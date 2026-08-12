// STORAGE-LEGACY-CERT-1 — certification du moteur de migration avant tout
// batch réel. AUCUN compte Cloudinary réel n'est utilisé ici : le seul
// compte configuré dans ce dépôt (`CLOUDINARY_CLOUD_NAME`/`_API_KEY`/
// `_API_SECRET` dans `server/.env`) est le compte de production de
// l'application (même identifiants que Netlify/Render, confirmé par le
// guide du projet) — il n'existe aucun environnement Cloudinary de test
// distinct et explicitement sûr. Conformément à la Phase 5 du sprint
// ("sinon, créer un mode de certification simulée/mocked et documenter que
// la preuve HTTP réelle Cloudinary reste partielle"), cette suite certifie
// le comportement du moteur avec un client Cloudinary et une sonde HTTP
// mockés, PAS avec le compte réel. Ce gap est documenté explicitement dans
// STORAGE_LEGACY_CERT_1_REPORT.md §8/§28 — jamais présenté comme une preuve
// réelle contre Cloudinary.
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const Locataire = require('../models/Locataire');
const PrivateAssetMigration = require('../models/PrivateAssetMigration');
const { planLegacyMigration, executeLegacyMigration } = require('../services/storage/legacyAssetMigrationService');
const { classifyLegacyAsset, resourceTypeFromUrl } = require('../services/storage/legacyAssetClassification');

jest.setTimeout(180000);

let tenantA;
let tenantB;
let ownerA;

beforeAll(async () => {
  await startFinancialMongo();
  await PrivateAssetMigration.syncIndexes();
  const fixtureA = await createTenantFixture({ label: 'Cert A' });
  tenantA = fixtureA.tenant;
  ownerA = (await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap })).user;
  tenantB = (await createTenantFixture({ label: 'Cert B' })).tenant;
});
afterEach(async () => Promise.all([Property.deleteMany({}), Contrat.deleteMany({}), Locataire.deleteMany({}), PrivateAssetMigration.deleteMany({})]));
afterAll(async () => stopFinancialMongo());

// La quasi-totalité de cette suite exerce des chemins `apply=true` avec
// toutes les preuves fournies explicitement (voir `AUTHORIZED` ci-dessous) —
// seule la garde "guardrails" en fin de fichier teste volontairement
// l'absence de cette variable.
beforeEach(() => { process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY = 'true'; });
afterEach(() => { delete process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY; });

const AUTHORIZED = {
  apply: true, mongoUriExplicit: 'mongodb://explicit-test-only', tenantIdExplicit: 'tenant-explicit',
  classification: 'B', confirmToken: 'I_UNDERSTAND_THIS_MODIFIES_CLOUDINARY_AND_MONGODB',
};

function mockDeps({ oldUrlAccessibleAfter = false } = {}) {
  return {
    cloudinaryClient: { rename: jest.fn(async (_from, to, opts) => ({ public_id: to, type: opts.to_type, resource_type: opts.resource_type })) },
    applyDbUpdate: jest.fn().mockResolvedValue(true),
    verifyDbUpdate: jest.fn().mockResolvedValue(true),
    verifyOldUrlInaccessible: jest.fn().mockResolvedValue(!oldUrlAccessibleAfter),
  };
}

async function makeResolvedContract() {
  const property = await Property.create({
    title: 'Cert fixture', description: 'Description suffisamment longue pour une fixture STORAGE-LEGACY-CERT-1.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 500000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.2, longitude: 15.2,
    images: ['https://res.cloudinary.com/demo/image/upload/v1/altitude-vision/photo.jpg'], surface: 90,
    statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', owner: ownerA._id,
  });
  const contrat = await Contrat.create({ type: 'location', bien: property._id });
  return { property, contrat };
}

// ── Phase 4-7 : couverture par resource_type Cloudinary réellement observé ─
// (image / raw / video — voir CLOUDINARY_DEFAULTS.resource_type: 'auto'
// dans config/cloudinary.js : aucun type n'est jamais forcé à l'upload, donc
// le moteur DOIT dériver le type réel depuis l'URL, jamais le supposer).
describe.each([
  ['image', 'https://res.cloudinary.com/demo/image/upload/v1/altitude-vision/legacy/piece-identite.jpg'],
  ['raw', 'https://res.cloudinary.com/demo/raw/upload/v1/altitude-vision/legacy/quittance.pdf'],
  ['video', 'https://res.cloudinary.com/demo/video/upload/v1/altitude-vision/legacy/note-vocale.mp3'],
])('Certification par resource_type Cloudinary — %s', (kind, oldUrl) => {
  test(`${kind} : classification correcte + rename appelé avec resource_type dérivé (jamais un défaut fixe)`, async () => {
    const { contrat, property } = await makeResolvedContract();
    const plan = await planLegacyMigration({
      resourceType: 'Contrat', resource: { _id: contrat._id, bien: property._id }, field: `documents[0].url`, url: oldUrl,
    });
    expect(plan.classification).toBe('B');
    expect(plan.decision).toBe('migratable');
    expect(resourceTypeFromUrl(oldUrl)).toBe(kind);

    const deps = mockDeps();
    const result = await executeLegacyMigration({
      resource: 'Contrat', resourceId: contrat._id, field: `documents[0].url`, tenant: tenantA._id,
      oldPublicId: `altitude-vision/legacy/${kind}-doc`, oldUrl, resourceType: 'Contrat', ...AUTHORIZED, deps,
    });
    expect(result.status).toBe('completed');
    expect(deps.cloudinaryClient.rename).toHaveBeenCalledWith(
      expect.any(String), expect.any(String),
      expect.objectContaining({ resource_type: kind, to_type: 'authenticated', invalidate: true }),
    );
  });

  test(`${kind} : OLD URL toujours accessible après tentative de migration → jamais completed`, async () => {
    const { contrat, property } = await makeResolvedContract();
    const deps = mockDeps({ oldUrlAccessibleAfter: true });
    await expect(executeLegacyMigration({
      resource: 'Contrat', resourceId: contrat._id, field: 'documents[1].url', tenant: tenantA._id,
      oldPublicId: `altitude-vision/legacy/${kind}-leak`, oldUrl, resourceType: 'Contrat', ...AUTHORIZED, deps,
    })).rejects.toThrow('OLD_URL_STILL_ACCESSIBLE');
    const journal = await PrivateAssetMigration.findOne({ resource: 'Contrat', resourceId: contrat._id, field: 'documents[1].url' });
    expect(journal.status).toBe('failed');
    void property;
  });
});

test('resource_type indérivable (URL non-Cloudinary reconnaissable) → refus explicite avant tout appel Cloudinary, jamais un défaut "raw"', async () => {
  const { contrat } = await makeResolvedContract();
  const deps = mockDeps();
  await expect(executeLegacyMigration({
    resource: 'Contrat', resourceId: contrat._id, field: 'documents[2].url', tenant: tenantA._id,
    oldPublicId: 'altitude-vision/legacy/unknown-kind', oldUrl: null, resourceType: 'Contrat', ...AUTHORIZED, deps,
  })).rejects.toThrow('CLOUDINARY_RESOURCE_KIND_UNKNOWN');
  expect(deps.cloudinaryClient.rename).not.toHaveBeenCalled();
});

// ── Phase 11 : cas contradictoires ─────────────────────────────────────────
describe('Cas contradictoires — refus contrôlé, jamais une migration incertaine', () => {
  test('tenant direct B + preuve relationnelle A (via property) → ambiguous → migration refusée', async () => {
    const { property } = await makeResolvedContract();
    // `RentalMaintenanceTicket` inclut la preuve directe `resource.tenant`
    // ET la preuve relationnelle via `property` (contrairement à `Contrat`,
    // qui n'utilise que la relation). `tenant` direct pointe vers B alors
    // que la Property liée appartient réellement à A : `mergeProofs` doit
    // produire `ambiguous` (deux tenantId distincts résolus), jamais un
    // choix arbitraire de l'un des deux.
    const plan = await planLegacyMigration({
      resourceType: 'RentalMaintenanceTicket',
      resource: { _id: property._id, tenant: tenantB._id, property: property._id },
      field: 'attachments[0]', url: 'https://res.cloudinary.com/demo/raw/upload/v1/altitude-vision/legacy/contradictory.pdf',
    });
    expect(plan.attribution.status).toBe('ambiguous');
    expect(plan.decision).toBe('stop');
  });

  test('publicId absent et URL non-Cloudinary → classification F/D, jamais migratable', async () => {
    const { contrat, property } = await makeResolvedContract();
    const plan = await planLegacyMigration({
      resourceType: 'Contrat', resource: { _id: contrat._id, bien: property._id }, field: 'documents[0].url',
      url: null, publicId: null,
    });
    expect(plan.decision).toBe('stop');
    expect(['D', 'F']).toContain(plan.classification);
  });

  test('ressource inexistante (resource=null) → unresolved → refus', async () => {
    const plan = await planLegacyMigration({
      resourceType: 'Contrat', resource: null, field: 'documents[0].url',
      url: 'https://res.cloudinary.com/demo/raw/upload/v1/altitude-vision/legacy/orphan.pdf',
    });
    expect(plan.attribution.status).toBe('unresolved');
    expect(plan.decision).toBe('stop');
  });

  test('classification E (média public) → migration interdite même en forçant apply=true', async () => {
    const { contrat } = await makeResolvedContract();
    const classification = classifyLegacyAsset({ isPublicMedia: true, url: 'https://res.cloudinary.com/demo/image/upload/v1/altitude-vision/photo.jpg' });
    expect(classification.classification).toBe('E');
    // Le moteur refuse d'exécuter un apply pour toute classification ≠ 'B',
    // quelle que soit la valeur de `apply` — testé directement ici plutôt
    // que par un détour de plan, pour prouver le refus au niveau du garde
    // d'autorisation lui-même (assertApplyAuthorized), pas seulement au
        // niveau du plan.
    await expect(executeLegacyMigration({
      resource: 'Contrat', resourceId: contrat._id, field: 'images[0]', tenant: tenantA._id,
      oldPublicId: 'altitude-vision/photo', oldUrl: 'https://res.cloudinary.com/demo/image/upload/v1/altitude-vision/photo.jpg',
      resourceType: 'Contrat', ...AUTHORIZED, classification: 'E', deps: mockDeps(),
    })).rejects.toThrow(/APPLY_NOT_AUTHORIZED/);
  });
});

// ── Phase 12 : protection des assets publics ───────────────────────────────
describe('Assets publics — jamais des candidats privés, même en forçant', () => {
  test('Property.images classifié E par construction, jamais B, même avec tenant resolved', async () => {
    const { contrat, property } = await makeResolvedContract();
    const plan = await planLegacyMigration({
      resourceType: 'Contrat', resource: { _id: contrat._id, bien: property._id }, field: 'images[0]',
      url: property.images[0], isPublicMedia: true,
    });
    expect(plan.classification).toBe('E');
    expect(plan.decision).toBe('stop');
  });

  test('tentative apply forcée sur un asset marqué public → refusée par le garde de classification', async () => {
    const { contrat } = await makeResolvedContract();
    await expect(executeLegacyMigration({
      resource: 'Contrat', resourceId: contrat._id, field: 'images[0]', tenant: tenantA._id,
      oldPublicId: 'altitude-vision/photo', oldUrl: 'https://res.cloudinary.com/demo/image/upload/v1/altitude-vision/photo.jpg',
      resourceType: 'Contrat', ...AUTHORIZED, classification: 'E', deps: mockDeps(),
    })).rejects.toThrow(/APPLY_NOT_AUTHORIZED/);
  });
});

// ── Phase 13 : priorité pièces d'identité ──────────────────────────────────
describe('Pièces d\'identité — priorité HIGH/CRITICAL, jamais migrées sans tenant resolved', () => {
  test('Locataire avec pieceIdentite legacy mais aucun Contrat rattaché → unresolved → refus', async () => {
    const locataire = await Locataire.create({ nom: 'Test', prenom: 'Cert', telephone: '+242000000', pieceIdentite: 'https://res.cloudinary.com/demo/image/upload/v1/altitude-vision/legacy/cni.jpg' });
    const plan = await planLegacyMigration({
      resourceType: 'Locataire', resource: locataire, field: 'pieceIdentite', url: locataire.pieceIdentite,
    });
    expect(plan.attribution.status).toBe('unresolved');
    expect(plan.decision).toBe('stop');
  });

  test('Locataire rattaché à un Contrat sur une Property tenant-resolved → resolved → migratable', async () => {
    const { contrat } = await makeResolvedContract();
    const locataire = await Locataire.create({ nom: 'Test', prenom: 'Cert2', telephone: '+242000001', pieceIdentite: 'https://res.cloudinary.com/demo/image/upload/v1/altitude-vision/legacy/cni2.jpg' });
    await Contrat.findByIdAndUpdate(contrat._id, { locataire: locataire._id });
    const plan = await planLegacyMigration({
      resourceType: 'Locataire', resource: locataire, field: 'pieceIdentite', url: locataire.pieceIdentite,
    });
    expect(plan.attribution.status).toBe('resolved');
    expect(plan.classification).toBe('B');
    expect(plan.decision).toBe('migratable');
  });
});

// ── Phase 14 : gardes --apply, exhaustif condition par condition ──────────
// Ce describe teste volontairement l'ABSENCE de la variable d'activation —
// le `beforeEach` global du fichier l'active pour le reste de la suite, donc
// on la retire explicitement en tête de chaque test qui en a besoin.
describe('Guardrails --apply — refus par défaut, chaque condition manquante testée isolément', () => {
  const { assertApplyAuthorized } = require('../services/storage/legacyAssetMigrationService');
  beforeEach(() => { delete process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY; });
  const full = () => ({
    apply: true, mongoUriExplicit: 'mongodb://x', tenantIdExplicit: 'tenant-x', classification: 'B',
    confirmToken: 'I_UNDERSTAND_THIS_MODIFIES_CLOUDINARY_AND_MONGODB',
  });

  test('apply seul, sans ALLOW_PRIVATE_ASSET_MIGRATION_APPLY → refus', () => {
    delete process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY;
    expect(() => assertApplyAuthorized({ apply: true })).toThrow(/APPLY_NOT_AUTHORIZED/);
  });

  test('ALLOW + mongoUri seul (pas de tenant/classification/confirm) → refus', () => {
    process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY = 'true';
    expect(() => assertApplyAuthorized({ apply: true, mongoUriExplicit: 'mongodb://x' })).toThrow(/tenantId_not_explicit/);
    delete process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY;
  });

  test('mauvais tenant (tenantIdExplicit manquant) → refus', () => {
    process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY = 'true';
    expect(() => assertApplyAuthorized({ ...full(), tenantIdExplicit: null })).toThrow(/tenantId_not_explicit/);
    delete process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY;
  });

  test('classification non-B → refus', () => {
    process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY = 'true';
    expect(() => assertApplyAuthorized({ ...full(), classification: 'C' })).toThrow(/classification_not_B/);
    delete process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY;
  });

  test('confirmation manquante/incorrecte → refus', () => {
    process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY = 'true';
    expect(() => assertApplyAuthorized({ ...full(), confirmToken: 'oui' })).toThrow(/confirmToken_invalid/);
    delete process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY;
  });

  test('"environnement production détecté" — ALLOW_PRIVATE_ASSET_MIGRATION_APPLY absent par défaut en toute circonstance → refus par défaut', () => {
    // Ce dépôt n'a pas de détecteur d'environnement dédié : la garde
    // effective est que la variable d'activation n'est JAMAIS positionnée
    // par défaut (absente de .env, absente de la config CI) — un
    // détournement accidentel exigerait qu'un opérateur l'exporte
    // manuellement ET fournisse les 4 autres preuves explicites.
    expect(process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY).toBeUndefined();
    expect(() => assertApplyAuthorized({ apply: true })).toThrow(/ALLOW_PRIVATE_ASSET_MIGRATION_APPLY/);
  });

  test('toutes les conditions réunies → autorisé (dry-run logique, aucun effet ici)', () => {
    process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY = 'true';
    expect(() => assertApplyAuthorized(full())).not.toThrow();
    delete process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY;
  });
});
