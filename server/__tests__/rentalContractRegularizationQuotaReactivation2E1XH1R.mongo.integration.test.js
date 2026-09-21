const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const Locataire = require('../models/Locataire');
const Proprietaire = require('../models/Proprietaire');
const RentalManagement = require('../models/RentalManagement');
const Reconciliation = require('../models/RentalContractReconciliation');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
const { getActiveManagedCount, QUOTA_ERROR_CODE } = require('../services/rentalManagementQuotaService');
const service = require('../services/rentalContractRegularizationService');

jest.setTimeout(240000);

const makeUser = (role = 'Proprietaire') => User.create({
  name: `H1R ${role}`,
  email: `h1r-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true,
});

async function setPlan(tenant, plan, maxManagedProperties) {
  await PlatformTenantSubscription.updateOne(
    { tenant: tenant._id, status: { $in: ['trialing', 'active'] } },
    { $set: { plan, status: 'active', 'quotas.maxManagedProperties': maxManagedProperties } },
  );
}

async function seedManagedProperty({ tenant, owner, active }) {
  const property = await Property.create({
    title: `H1R property ${Math.random()}`, description: 'Description suffisamment longue pour le test de réactivation.',
    pole: 'Altimmo', type: 'Appartement', status: 'location', price: 150000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.2, longitude: 15.2,
    images: ['https://example.test/h1r.jpg'], surface: 50, availability: 'Disponible',
    owner: owner._id, tenant: tenant._id,
  });
  const rental = await RentalManagement.create({
    property: property._id, owner: owner._id, tenant: tenant._id,
    managementActivated: active, active, occupancyStatus: 'vacant', availabilityStatus: 'disponible',
  });
  return { property, rental };
}

async function seedRevertCase({ tenant, owner, restoredActive, currentActive }) {
  const proprietaire = await Proprietaire.create({
    nom: 'Owner', prenom: 'H1R', telephone: `06${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`, user: owner._id,
  });
  const locataire = await Locataire.create({ nom: 'Tenant', prenom: 'H1R', telephone: `07${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}` });
  const { property, rental } = await seedManagedProperty({ tenant, owner, active: currentActive });
  const contract = await Contrat.create({
    type: 'location', statut: 'actif', cycleVie: 'actif', bien: property._id,
    proprietaire: proprietaire._id, locataire: locataire._id, montantLoyer: 150000,
  });
  const originalContract = { bien: null, statut: 'en_attente', cycleVie: null };
  const originalProperty = { _id: property._id, availability: 'En maintenance', isPublished: false, assetCycle: null };
  const originalRental = {
    _id: rental._id, active: restoredActive, managementActivated: restoredActive,
    activeLease: null, currentTenant: null, occupancyStatus: 'vacant', availabilityStatus: 'disponible',
    publicationStatus: 'brouillon',
  };
  const record = await Reconciliation.create({
    contract: contract._id, status: 'resolved', decision: 'link_existing', property: property._id,
    decidedBy: owner._id, decidedAt: new Date(),
    events: [{ action: 'link_existing', actor: owner._id, reason: 'Snapshot historique vérifié', before: { contract: originalContract, property: originalProperty, rental: originalRental }, after: {} }],
  });
  return { property, rental, contract, record };
}

async function revertCase(fx, actor) {
  return service.revert({
    contractId: fx.contract._id, reason: 'Réversion quota contrôlée', actor,
    actorBusinessRole: 'Admin', tenantScopeUserIds: [fx.ownerId || actor._id],
  });
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function tenantFixture(label, limit) {
  const { tenant } = await createTenantFixture({ label });
  const owner = await makeUser();
  await setPlan(tenant, limit === null ? 'trial' : 'essentiel', limit);
  return { tenant, owner };
}

test('H1R-01: quota plein refuse false -> true et conserve les deux états', async () => {
  const { tenant, owner } = await tenantFixture('H1R-01', 1);
  const fx = await seedRevertCase({ tenant, owner, restoredActive: true, currentActive: false });
  fx.ownerId = owner._id;
  const other = await seedManagedProperty({ tenant, owner, active: true });

  await expect(revertCase(fx, owner)).rejects.toMatchObject({ code: QUOTA_ERROR_CODE, statusCode: 409 });
  expect((await RentalManagement.findById(fx.rental._id)).managementActivated).toBe(false);
  expect((await RentalManagement.findById(other.rental._id)).managementActivated).toBe(true);
  expect(await getActiveManagedCount(tenant._id)).toBe(1);
});

test('H1R-02: quota disponible autorise false -> true', async () => {
  const { tenant, owner } = await tenantFixture('H1R-02', 2);
  const fx = await seedRevertCase({ tenant, owner, restoredActive: true, currentActive: false }); fx.ownerId = owner._id;
  await seedManagedProperty({ tenant, owner, active: true });
  await expect(revertCase(fx, owner)).resolves.toMatchObject({ status: 'reverted' });
  expect(await getActiveManagedCount(tenant._id)).toBe(2);
});

test('H1R-03: true -> true reste idempotent même au quota', async () => {
  const { tenant, owner } = await tenantFixture('H1R-03', 1);
  const fx = await seedRevertCase({ tenant, owner, restoredActive: true, currentActive: true }); fx.ownerId = owner._id;
  await expect(revertCase(fx, owner)).resolves.toMatchObject({ status: 'reverted' });
  expect(await getActiveManagedCount(tenant._id)).toBe(1);
});

test('H1R-04: true -> false libère une place sans garde d’activation', async () => {
  const { tenant, owner } = await tenantFixture('H1R-04', 1);
  const fx = await seedRevertCase({ tenant, owner, restoredActive: false, currentActive: true }); fx.ownerId = owner._id;
  await expect(revertCase(fx, owner)).resolves.toMatchObject({ status: 'reverted' });
  expect(await getActiveManagedCount(tenant._id)).toBe(0);
});

test('H1R-05: false -> false reste sans impact quota', async () => {
  const { tenant, owner } = await tenantFixture('H1R-05', 1);
  const fx = await seedRevertCase({ tenant, owner, restoredActive: false, currentActive: false }); fx.ownerId = owner._id;
  await expect(revertCase(fx, owner)).resolves.toMatchObject({ status: 'reverted' });
  expect(await getActiveManagedCount(tenant._id)).toBe(0);
});

test('H1R-06: deux réactivations concurrentes pour une place donnent un seul succès', async () => {
  const { tenant, owner } = await tenantFixture('H1R-06', 1);
  const a = await seedRevertCase({ tenant, owner, restoredActive: true, currentActive: false }); a.ownerId = owner._id;
  const b = await seedRevertCase({ tenant, owner, restoredActive: true, currentActive: false }); b.ownerId = owner._id;
  const results = await Promise.allSettled([revertCase(a, owner), revertCase(b, owner)]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  expect(results.find((r) => r.status === 'rejected').reason).toMatchObject({ code: QUOTA_ERROR_CODE });
  expect(await getActiveManagedCount(tenant._id)).toBe(1);
});

test('H1R-07: le quota plein du tenant A ne bloque pas B', async () => {
  const a = await tenantFixture('H1R-07-A', 1); await seedManagedProperty({ tenant: a.tenant, owner: a.owner, active: true });
  const b = await tenantFixture('H1R-07-B', 1);
  const fx = await seedRevertCase({ tenant: b.tenant, owner: b.owner, restoredActive: true, currentActive: false }); fx.ownerId = b.owner._id;
  await expect(revertCase(fx, b.owner)).resolves.toMatchObject({ status: 'reverted' });
  expect(await getActiveManagedCount(a.tenant._id)).toBe(1);
  expect(await getActiveManagedCount(b.tenant._id)).toBe(1);
});

test('H1R-08: maxManagedProperties=null conserve la sémantique illimitée', async () => {
  const { tenant, owner } = await tenantFixture('H1R-08', null);
  await seedManagedProperty({ tenant, owner, active: true });
  const fx = await seedRevertCase({ tenant, owner, restoredActive: true, currentActive: false }); fx.ownerId = owner._id;
  await expect(revertCase(fx, owner)).resolves.toMatchObject({ status: 'reverted' });
  expect(await getActiveManagedCount(tenant._id)).toBe(2);
});

test('H1R-09: absence d’abonnement conserve la sémantique canonique permissive', async () => {
  const { tenant, owner } = await tenantFixture('H1R-09', 1);
  await PlatformTenantSubscription.deleteMany({ tenant: tenant._id });
  await seedManagedProperty({ tenant, owner, active: true });
  const fx = await seedRevertCase({ tenant, owner, restoredActive: true, currentActive: false }); fx.ownerId = owner._id;
  await expect(revertCase(fx, owner)).resolves.toMatchObject({ status: 'reverted' });
  expect(await getActiveManagedCount(tenant._id)).toBe(2);
});

test('H1R-10: rejet quota ne restaure ni contrat, ni Property, ni décision', async () => {
  const { tenant, owner } = await tenantFixture('H1R-10', 1);
  const fx = await seedRevertCase({ tenant, owner, restoredActive: true, currentActive: false }); fx.ownerId = owner._id;
  await seedManagedProperty({ tenant, owner, active: true });
  const beforeContract = await Contrat.findById(fx.contract._id).lean();
  const beforeProperty = await Property.findById(fx.property._id).lean();

  await expect(revertCase(fx, owner)).rejects.toMatchObject({ code: QUOTA_ERROR_CODE });
  const [contract, property, rental, record] = await Promise.all([
    Contrat.findById(fx.contract._id).lean(), Property.findById(fx.property._id).lean(),
    RentalManagement.findById(fx.rental._id).lean(), Reconciliation.findById(fx.record._id).lean(),
  ]);
  expect(contract.bien.toString()).toBe(beforeContract.bien.toString());
  expect(contract.statut).toBe(beforeContract.statut);
  expect(property.availability).toBe(beforeProperty.availability);
  expect(rental.managementActivated).toBe(false);
  expect(record.status).toBe('resolved');
  expect(record.events).toHaveLength(1);
});
