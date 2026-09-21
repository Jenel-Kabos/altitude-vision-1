// TENANT-DATA-ISOLATION-SALES-RENTALS-1A — la fuite historique (aggrégats
// sales/rentals mélangeaient plusieurs tenants) est provoquée par un filtre
// `owner: { $in: scopeUserIds }` seul, qui ne borne PAS les biens attribués
// (`Property.tenant`) dans un autre tenant mais possédés par un User global
// aussi membre du tenant courant. Ces tests fixent la frontière : `Property.tenant`.

const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const Transaction = require('../models/Transaction');
const OrgMembership = require('../models/OrgMembership');
const { getImmobilierReportData } = require('../services/reporting/immobilierReportQueryService');
const { getRentalReportData } = require('../services/reporting/rentalReportQueryService');
const { resolveTenantScope } = require('../services/platformTenant/tenantContextService');

jest.setTimeout(120000);

const makeUser = async (overrides = {}) => User.create({
  name: 'Owner user', email: `own-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true,
  ...overrides,
});

const baseProperty = (owner, tenantId, overrides = {}) => ({
  title: 'Bien test',
  description: 'Description suffisamment longue pour la validation du modèle.',
  pole: 'Altimmo', type: 'Appartement', status: 'vente', price: 1000,
  address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' },
  images: ['https://example.test/image.jpg'],
  surface: 120, statusAdmin: 'Validée', isPublished: true, availability: 'Disponible',
  latitude: -4.27, longitude: 15.27,
  location: { type: 'Point', coordinates: [15.27, -4.27] },
  owner, tenant: tenantId,
  ...overrides,
});

let tA; let tB; let bA; let bB; let ownerCross;

beforeAll(async () => {
  await startFinancialMongo();
  // Exercise the canonical unique reservation index in isolation as in full Mongo.
  await Transaction.syncIndexes();
});
afterAll(stopFinancialMongo);

beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'Tenant A' });
  const fB = await createTenantFixture({ label: 'Tenant B' });
  tA = fA.tenant; bA = fA.bootstrap;
  tB = fB.tenant; bB = fB.bootstrap;
  // ownerCross est membre des DEUX tenants — le vecteur de fuite historique :
  // un User global membre A + membre B possédant des biens dans les deux.
  ownerCross = await makeUser();
  await addTenantMember({ tenant: tA, user: ownerCross, bootstrap: bA });
  await addTenantMember({ tenant: tB, user: ownerCross, bootstrap: bB });
});

const scopeUsersOf = async (tenant) => {
  const scope = await resolveTenantScope(tenant._id);
  return [...(scope.scopeUserIds || [])];
};

describe('ISO — sales aggregate tenant-scoped', () => {
  test('ISO-01 · ISO-02: tenant A sales aggregate excludes tenant B properties', async () => {
    // 1 bien Vente dans tenant A à 150_000 · 1 bien Vente dans tenant B à 80_000_000
    await Property.create(baseProperty(ownerCross._id, tA._id, { price: 150000 }));
    await Property.create(baseProperty(ownerCross._id, tB._id, { price: 80000000 }));

    const scopeA = await scopeUsersOf(tA);
    const dataA = await getImmobilierReportData({ scopeUserIds: scopeA, tenantId: tA._id });
    expect(dataA.kpis.total).toBe(1);
    expect(dataA.kpis.active).toBe(1);

    // Sans le fix, la fuite historique reproduit :
    const leaky = await getImmobilierReportData({ scopeUserIds: scopeA }); // pas de tenantId
    // scopeUserIds inclut ownerCross qui possède les DEUX biens ; sans tenantId le total ≥ 2.
    expect(leaky.kpis.total).toBeGreaterThanOrEqual(2);
  });

  test('ISO-01 (Transaction) : ventes réussies tenant A n\'incluent pas les ventes tenant B', async () => {
    const propA = await Property.create(baseProperty(ownerCross._id, tA._id, { price: 150000, availability: 'Vendu' }));
    const propB = await Property.create(baseProperty(ownerCross._id, tB._id, { price: 80000000, availability: 'Vendu' }));
    // Direct collection.insertOne bypasse la validation (les Transaction en
    // prod portent d'autres champs required tests n'ont pas à reproduire).
    await Transaction.collection.insertMany([
      { reservation: new mongoose.Types.ObjectId(), property: propA._id, transactionType: 'vente', status: 'Réussie', finalAmount: 150000, commission: { agencyNet: 7500 }, transactionDate: new Date() },
      { reservation: new mongoose.Types.ObjectId(), property: propB._id, transactionType: 'vente', status: 'Réussie', finalAmount: 80000000, commission: { agencyNet: 4000000 }, transactionDate: new Date() },
    ]);
    const scopeA = await scopeUsersOf(tA);
    const dataA = await getImmobilierReportData({ scopeUserIds: scopeA, tenantId: tA._id });
    expect(dataA.kpis.salesAmount).toBe(150000);
    expect(dataA.kpis.commissions).toBe(7500);
  });
});

describe('ISO — rentals aggregate tenant-scoped', () => {
  test('ISO-03 · ISO-04: tenant A rental aggregate excludes tenant B rentals', async () => {
    const RentalManagement = require('../models/RentalManagement');
    const propA = await Property.create(baseProperty(ownerCross._id, tA._id, { status: 'location', price: 650 }));
    const propB = await Property.create(baseProperty(ownerCross._id, tB._id, { status: 'location', price: 900 }));
    await RentalManagement.collection.insertMany([
      { property: propA._id, tenant: tA._id, owner: ownerCross._id, managementActivated: true, availabilityStatus: 'disponible', occupancyStatus: 'disponible', createdBy: ownerCross._id },
      { property: propB._id, tenant: tB._id, owner: ownerCross._id, managementActivated: true, availabilityStatus: 'occupe', occupancyStatus: 'occupe', createdBy: ownerCross._id },
    ]);

    const scopeA = await scopeUsersOf(tA);
    const dataA = await getRentalReportData({ scopeUserIds: scopeA, tenantId: tA._id });
    expect(dataA.kpis.available).toBe(1);
    expect(dataA.kpis.occupied).toBe(0);

    // Fuite historique (sans tenantId) inclurait la propriété de tenant B.
    const leaky = await getRentalReportData({ scopeUserIds: scopeA });
    expect(leaky.kpis.available + leaky.kpis.occupied).toBeGreaterThanOrEqual(2);
  });
});

describe('ISO — PlatformOperator + fuit prévention', () => {
  test('ISO-12 (selected tenant) : PlatformOperator agit sur le tenant sélectionné uniquement', async () => {
    await Property.create(baseProperty(ownerCross._id, tA._id, { price: 500 }));
    await Property.create(baseProperty(ownerCross._id, tB._id, { price: 5000 }));
    // Simule un PlatformOperator ayant sélectionné tenant B : scopeUserIds vient de tB.
    const scopeB = await scopeUsersOf(tB);
    const dataB = await getImmobilierReportData({ scopeUserIds: scopeB, tenantId: tB._id });
    expect(dataB.kpis.total).toBe(1);
  });

  test('ISO (unscoped) : sans tenantId ET sans scopeUserIds → global (comportement PlatformOperator unscoped préservé)', async () => {
    await Property.create(baseProperty(ownerCross._id, tA._id));
    await Property.create(baseProperty(ownerCross._id, tB._id));
    const data = await getImmobilierReportData({});
    expect(data.kpis.total).toBe(2);
  });
});
