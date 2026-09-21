// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-H.1 — All Write Paths Closure.
//
// Complements the Lot H suite by exercising every runtime write path
// capable of flipping `RentalManagement.managementActivated=true` and
// verifying that each one honors `PlatformTenantSubscription.quotas.
// maxManagedProperties`. Path inventory (see Lot H.1 final report):
//   P1 — rentalAssetOnboardingService.activateExisting  (covered by Lot H)
//   P2 — rentalManagementController.create              (PATH-01/02)
//   P3 — rentalManagementLeaseSyncService.ensure…       (PATH-03/04)
//   P4 — proprietaireGestionImportService.import…       (PATH-05/06)
//   P5 — rentalAssetOnboardingService.reconstructHist…  (PATH-07/08)
//   idempotency — findExistingImport re-run             (PATH-09)
//   cross-path race                                     (CROSS-PATH-01)

const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const Property = require('../models/Property');
const Proprietaire = require('../models/Proprietaire');
const RentalManagement = require('../models/RentalManagement');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
const { QUOTA_ERROR_CODE, getActiveManagedCount } = require('../services/rentalManagementQuotaService');
const { ensureRentalManagementActive } = require('../services/rentalManagementLeaseSyncService');
const { importBienPropreVersGestion, ImportError } = require('../services/proprietaireGestionImportService');

jest.setTimeout(240000);

const makeUser = async (over = {}) => User.create({
  name: 'Test User', email: `u-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true,
  ...over,
});
const setRole = (uid, t, br) => OrgMembership.updateOne(
  { user: uid, orgUnit: t.rootOrgUnit, status: 'active' }, { $set: { businessRole: br } },
);
const setSubscriptionPlan = (tenantId, plan, quotas) => PlatformTenantSubscription.updateOne(
  { tenant: tenantId, status: { $in: ['trialing', 'active'] } },
  { $set: { plan, status: 'active', ...(quotas ? { quotas } : {}) } },
);
const seedProperty = ({ owner, tenant, overrides = {} }) => Property.create({
  title: 'Bien Path', description: 'Description suffisamment longue pour la validation.',
  pole: 'Altimmo', type: 'Appartement', status: 'location', price: 150000,
  address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' },
  images: ['https://example.test/image.jpg'], surface: 80, statusAdmin: 'Validée',
  availability: 'Disponible', latitude: -4.27, longitude: 15.27,
  location: { type: 'Point', coordinates: [15.27, -4.27] },
  owner: owner._id, tenant: tenant?._id || null, ...overrides,
});
const seedActiveManagement = async ({ tenant, ownerUser }) => {
  const property = await seedProperty({ owner: ownerUser, tenant });
  const rental = await RentalManagement.create({
    property: property._id, owner: ownerUser._id, tenant: tenant?._id || null,
    managementActivated: true, availabilityStatus: 'disponible', occupancyStatus: 'vacant', createdBy: ownerUser._id,
  });
  return { property, rental };
};

let tA; let bA; let admin; let ownerP;

beforeAll(async () => { await startFinancialMongo(); await OrgMembership.syncIndexes(); });
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'Path Tenant A' });
  tA = fA.tenant; bA = fA.bootstrap;

  admin = await makeUser({ role: 'Client' });
  await addTenantMember({ tenant: tA, user: admin, bootstrap: bA });
  await setRole(admin._id, tA, 'Admin');

  ownerP = await makeUser({ role: 'Proprietaire' });
  await addTenantMember({ tenant: tA, user: ownerP, bootstrap: bA });
  await setRole(ownerP._id, tA, 'Collaborateur');
  await Proprietaire.create({ nom: 'Owner', prenom: 'P', telephone: `06${Date.now() % 100000000}`, user: ownerP._id });
});

// ═══════════════════════════════════════════════════════════════════════════
// P3 — rentalManagementLeaseSyncService.ensureRentalManagementActive
// ═══════════════════════════════════════════════════════════════════════════

describe('PATH — lease-sync activation (Contrat.save side effect)', () => {
  test('PATH-03: Essentiel + 0 active → lease-sync ensure() → ALLOW, count=1', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    const property = await seedProperty({ owner: ownerP, tenant: tA });
    const rental = await ensureRentalManagementActive({ property, actor: admin._id, monthlyRent: 200000 });
    expect(rental).toBeTruthy();
    expect(rental.managementActivated).toBe(true);
    expect(String(rental.tenant)).toBe(String(tA._id));
    expect(await getActiveManagedCount(tA._id)).toBe(1);
  });

  test('PATH-04: Essentiel + 1 active → second lease-sync → REFUSE with QUOTA code', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    await seedActiveManagement({ tenant: tA, ownerUser: ownerP });
    const property2 = await seedProperty({ owner: ownerP, tenant: tA, overrides: { title: 'Second' } });
    await expect(ensureRentalManagementActive({ property: property2, actor: admin._id, monthlyRent: 200000 }))
      .rejects.toMatchObject({ code: QUOTA_ERROR_CODE });
    expect(await getActiveManagedCount(tA._id)).toBe(1);
  });

  test('PATH-04b: lease-sync on already-active RentalManagement → idempotent, no quota check', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    const { property } = await seedActiveManagement({ tenant: tA, ownerUser: ownerP });
    // Ré-appel : la gestion est déjà active → aucune incrémentation, aucun rejet.
    const rental = await ensureRentalManagementActive({ property, actor: admin._id, monthlyRent: 210000 });
    expect(rental).toBeTruthy();
    expect(await getActiveManagedCount(tA._id)).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P4 — proprietaireGestionImportService.importBienPropreVersGestion
// ═══════════════════════════════════════════════════════════════════════════

describe('PATH — Proprietaire.biensPropres → Gestion locative import', () => {
  const seedBienPropre = async () => {
    const proprietaire = await Proprietaire.findOne({ user: ownerP._id });
    proprietaire.biensPropres.push({
      titre: 'Studio Poto-Poto', description: 'Bien de test.', type: 'Appartement',
      typeBien: 'location', ville: 'Brazzaville', quartier: 'Poto-Poto', adresse: 'Avenue de la Paix',
      photos: ['https://example.test/img.jpg'], superficie: 40, prixLoyer: 120000,
    });
    await proprietaire.save();
    return proprietaire;
  };

  test('PATH-05: Essentiel + 0 active → import → ALLOW, count=1, Property.tenant set', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    const proprietaire = await seedBienPropre();
    const actor = { ...admin.toObject(), platformTenant: { _id: tA._id } };
    const result = await importBienPropreVersGestion({
      proprietaireId: proprietaire._id, bienIndex: 0,
      overrides: { latitude: -4.27, longitude: 15.27, arrondissement: 'Poto-Poto' },
      actor,
    });
    expect(result.rentalManagement.managementActivated).toBe(true);
    expect(String(result.property.tenant)).toBe(String(tA._id));
    expect(await getActiveManagedCount(tA._id)).toBe(1);
  });

  test('PATH-06: Essentiel + 1 active → import → REFUSE with ImportError.code=QUOTA, no orphan Property', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    await seedActiveManagement({ tenant: tA, ownerUser: ownerP });
    const proprietaire = await seedBienPropre();
    const actor = { ...admin.toObject(), platformTenant: { _id: tA._id } };
    const propertiesBefore = await Property.countDocuments({ tenant: tA._id });
    await expect(importBienPropreVersGestion({
      proprietaireId: proprietaire._id, bienIndex: 0,
      overrides: { latitude: -4.27, longitude: 15.27, arrondissement: 'Poto-Poto' },
      actor,
    })).rejects.toMatchObject({ code: QUOTA_ERROR_CODE });
    // Compensation : le Property créé pendant l'import est supprimé quand la
    // garde de quota refuse l'activation — pas d'orphelin.
    expect(await Property.countDocuments({ tenant: tA._id })).toBe(propertiesBefore);
    expect(await getActiveManagedCount(tA._id)).toBe(1);
  });

  test('PATH-09: import idempotent (double-clic) sur gestion déjà activée → no quota check, no count change', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    const proprietaire = await seedBienPropre();
    const actor = { ...admin.toObject(), platformTenant: { _id: tA._id } };
    const first = await importBienPropreVersGestion({
      proprietaireId: proprietaire._id, bienIndex: 0,
      overrides: { latitude: -4.27, longitude: 15.27, arrondissement: 'Poto-Poto' },
      actor,
    });
    expect(first.alreadyImported).toBe(false);
    const second = await importBienPropreVersGestion({
      proprietaireId: proprietaire._id, bienIndex: 0,
      overrides: { latitude: -4.27, longitude: 15.27, arrondissement: 'Poto-Poto' },
      actor,
    });
    expect(second.alreadyImported).toBe(true);
    expect(await getActiveManagedCount(tA._id)).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CROSS-PATH — two different H.1 write paths racing at the tenant boundary.
// ═══════════════════════════════════════════════════════════════════════════

describe('CROSS-PATH-CONCURRENCY — lease-sync + import racing on the same limit', () => {
  test('CROSS-PATH-01: Essentiel/limit=1 — one lease-sync + one import in parallel → exactly one succeeds', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    const propertyLease = await seedProperty({ owner: ownerP, tenant: tA, overrides: { title: 'Race-Lease' } });

    const proprietaire = await Proprietaire.findOne({ user: ownerP._id });
    proprietaire.biensPropres.push({
      titre: 'Race-Import', description: 'Bien import race.', type: 'Appartement',
      typeBien: 'location', ville: 'Brazzaville', quartier: 'Poto-Poto', adresse: 'Avenue de la Paix',
      photos: ['https://example.test/img.jpg'], superficie: 42, prixLoyer: 130000,
    });
    await proprietaire.save();
    const actor = { ...admin.toObject(), platformTenant: { _id: tA._id } };

    const results = await Promise.allSettled([
      ensureRentalManagementActive({ property: propertyLease, actor: admin._id, monthlyRent: 100000 }),
      importBienPropreVersGestion({
        proprietaireId: proprietaire._id, bienIndex: 0,
        overrides: { latitude: -4.27, longitude: 15.27, arrondissement: 'Poto-Poto' },
        actor,
      }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length + rejected.length).toBe(2);
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(rejected[0].reason.code).toBe(QUOTA_ERROR_CODE);
    expect(await getActiveManagedCount(tA._id)).toBe(1);
  });
});
