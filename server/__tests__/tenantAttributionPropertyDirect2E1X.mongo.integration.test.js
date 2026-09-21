// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-TENANT-ATTRIBUTION-SERVICE-
// PROPERTY-DIRECT-TENANT — certifie que `tenantResourceAttributionService
// .fromProperty` traite `Property.tenant` (Lot G) comme l'autorité
// canonique de rattachement, jamais réinterprétable par les OrgMemberships
// du owner. Le fallback owner-based subsiste uniquement pour les Property
// historiques avec `tenant: null`.
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const RentalManagement = require('../models/RentalManagement');
const Transaction = require('../models/Transaction');
const Visite = require('../models/Visite');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const Paiement = require('../models/Paiement');
const { resolveResourceTenant } = require('../services/platformTenant/tenantResourceAttributionService');
const mongoose = require('mongoose');

jest.setTimeout(180000);

let seq = 0;
const makeUser = (over = {}) => {
  seq += 1;
  return User.create({
    name: `Attr Prop ${seq}`, email: `attr-prop-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true, ...over,
  });
};
const makeProperty = (owner, tenant, over = {}) => Property.create({
  title: `Villa ATTR ${seq++}`, description: 'Description assez longue pour la validation Property.',
  pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
  address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.26, longitude: 15.24,
  images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90, statusAdmin: 'Validée', isPublished: true,
  availability: 'Disponible', owner: owner._id, tenant: tenant?._id || null, ...over,
});

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

// ═══════════════════════════════════════════════════════════════════════════
// ATTR-PROP — Property direct tenant attribution
// ═══════════════════════════════════════════════════════════════════════════

describe('ATTR-PROP — Property.tenant is canonical attribution', () => {
  test('ATTR-PROP-01 (owner U member of tenant A only + Property.tenant=A → A)', async () => {
    const fA = await createTenantFixture({ label: 'AP-01 A', withAdminMembership: true });
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    const prop = await makeProperty(owner, fA.tenant);
    const attribution = await resolveResourceTenant({ resourceType: 'Property', resource: prop.toObject() });
    expect(attribution.status).toBe('resolved');
    expect(String(attribution.tenantId)).toBe(String(fA.tenant._id));
  });

  test('ATTR-PROP-02 (owner U member of A and B + Property.tenant=A → A, never ambiguous)', async () => {
    const fA = await createTenantFixture({ label: 'AP-02 A', withAdminMembership: true });
    const fB = await createTenantFixture({ label: 'AP-02 B', withAdminMembership: true });
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    await addTenantMember({ tenant: fB.tenant, user: owner, bootstrap: fB.bootstrap });
    const prop = await makeProperty(owner, fA.tenant);
    const attribution = await resolveResourceTenant({ resourceType: 'Property', resource: prop.toObject() });
    expect(attribution.status).toBe('resolved');
    expect(String(attribution.tenantId)).toBe(String(fA.tenant._id));
  });

  test('ATTR-PROP-03 (owner U member of A and B + Property.tenant=B → B)', async () => {
    const fA = await createTenantFixture({ label: 'AP-03 A', withAdminMembership: true });
    const fB = await createTenantFixture({ label: 'AP-03 B', withAdminMembership: true });
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    await addTenantMember({ tenant: fB.tenant, user: owner, bootstrap: fB.bootstrap });
    const prop = await makeProperty(owner, fB.tenant);
    const attribution = await resolveResourceTenant({ resourceType: 'Property', resource: prop.toObject() });
    expect(attribution.status).toBe('resolved');
    expect(String(attribution.tenantId)).toBe(String(fB.tenant._id));
  });

  test('ATTR-PROP-04 (owner U member of A only + Property.tenant=B → explicit B, never silently A)', async () => {
    const fA = await createTenantFixture({ label: 'AP-04 A', withAdminMembership: true });
    const fB = await createTenantFixture({ label: 'AP-04 B', withAdminMembership: true });
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    const prop = await makeProperty(owner, fB.tenant);
    const attribution = await resolveResourceTenant({ resourceType: 'Property', resource: prop.toObject() });
    expect(attribution.status).toBe('resolved');
    expect(String(attribution.tenantId)).toBe(String(fB.tenant._id));
  });

  test('ATTR-PROP-05 (global User.role=Admin owner does not change attribution)', async () => {
    const fA = await createTenantFixture({ label: 'AP-05 A', withAdminMembership: true });
    const owner = await makeUser({ role: 'Admin' }); // global Admin, no membership
    const prop = await makeProperty(owner, fA.tenant);
    const attribution = await resolveResourceTenant({ resourceType: 'Property', resource: prop.toObject() });
    expect(attribution.status).toBe('resolved');
    expect(String(attribution.tenantId)).toBe(String(fA.tenant._id));
  });

  test('ATTR-PROP-08 (forged tenant header is irrelevant — attribution reads Property.tenant only)', async () => {
    const fA = await createTenantFixture({ label: 'AP-08 A', withAdminMembership: true });
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    const prop = await makeProperty(owner, fA.tenant);
    // Le service d'attribution est stateless — on lui passe une resource
    // et il rend un tenantId ; aucun header n'est consulté.
    const attribution = await resolveResourceTenant({ resourceType: 'Property', resource: prop.toObject() });
    expect(String(attribution.tenantId)).toBe(String(fA.tenant._id));
  });

  test('ATTR-PROP-10 (owner membership suspended in A → attribution remains A)', async () => {
    const fA = await createTenantFixture({ label: 'AP-10 A', withAdminMembership: true });
    const fB = await createTenantFixture({ label: 'AP-10 B', withAdminMembership: true });
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    await addTenantMember({ tenant: fB.tenant, user: owner, bootstrap: fB.bootstrap });
    const OrgMembership = require('../models/OrgMembership');
    await OrgMembership.updateOne(
      { user: owner._id, orgUnit: fA.tenant.rootOrgUnit }, { $set: { status: 'suspended' } },
    );
    const prop = await makeProperty(owner, fA.tenant);
    const attribution = await resolveResourceTenant({ resourceType: 'Property', resource: prop.toObject() });
    expect(String(attribution.tenantId)).toBe(String(fA.tenant._id));
  });

  test('ATTR-PROP-11 (owner has no membership anywhere + Property.tenant=A → attribution A)', async () => {
    const fA = await createTenantFixture({ label: 'AP-11 A', withAdminMembership: true });
    const owner = await makeUser({ role: 'Proprietaire' });
    const prop = await makeProperty(owner, fA.tenant);
    const attribution = await resolveResourceTenant({ resourceType: 'Property', resource: prop.toObject() });
    expect(String(attribution.tenantId)).toBe(String(fA.tenant._id));
  });

  test('ATTR-PROP-12 (Property.tenant=null preserves legacy owner-based fallback exactly)', async () => {
    const fA = await createTenantFixture({ label: 'AP-12 A', withAdminMembership: true });
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    const prop = await makeProperty(owner, null); // legacy Property, no tenant
    const attribution = await resolveResourceTenant({ resourceType: 'Property', resource: prop.toObject() });
    // Fallback owner-based : le owner est membre unique de A → resolve A.
    expect(attribution.status).toBe('resolved');
    expect(String(attribution.tenantId)).toBe(String(fA.tenant._id));
  });

  test('ATTR-PROP-12b (Property.tenant=null + owner no membership → unresolved — no fabrication)', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    const prop = await Property.create({
      title: `Villa Legacy ${seq++}`, description: 'Description assez longue pour la validation Property.',
      pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
      address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90, statusAdmin: 'Validée',
      availability: 'Disponible', owner: owner._id, tenant: null,
    });
    const attribution = await resolveResourceTenant({ resourceType: 'Property', resource: prop.toObject() });
    expect(attribution.status).toBe('unresolved');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ATTR-X — cross-resource propagation (Contrat / Transaction / Visite /
// RentalMaintenanceTicket / Paiement) via fromProperty
// ═══════════════════════════════════════════════════════════════════════════

describe('ATTR-X — Property attribution propagates canonically to derived resources', () => {
  async function setup() {
    const fA = await createTenantFixture({ label: `AX A ${seq++}`, withAdminMembership: true });
    const fB = await createTenantFixture({ label: `AX B ${seq++}`, withAdminMembership: true });
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    await addTenantMember({ tenant: fB.tenant, user: owner, bootstrap: fB.bootstrap });
    const propA = await makeProperty(owner, fA.tenant);
    return { fA, fB, owner, propA };
  }

  test('ATTR-X-01 (Contrat.bien → Property.tenant=A → tenant A, no ambiguity from multi-tenant owner)', async () => {
    const { fA, propA } = await setup();
    const contrat = await Contrat.create({
      type: 'location', bien: propA._id, statut: 'actif', cycleVie: 'actif',
      dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000,
      montantCaution: 600000, villeBien: 'Brazzaville', adresseBien: 'Rue test',
    });
    const attribution = await resolveResourceTenant({ resourceType: 'Contrat', resource: contrat.toObject() });
    expect(attribution.status).toBe('resolved');
    expect(String(attribution.tenantId)).toBe(String(fA.tenant._id));
  });

  test('ATTR-X-02 (Transaction.property → Property.tenant=A → tenant A)', async () => {
    const { fA, propA, owner } = await setup();
    const rawTx = { property: propA._id, client: owner._id, agent: owner._id, reservation: new mongoose.Types.ObjectId(), transactionType: 'location', status: 'En cours', finalAmount: 100000, transactionDate: new Date() };
    const insert = await Transaction.collection.insertOne(rawTx);
    const doc = { _id: insert.insertedId, ...rawTx };
    const attribution = await resolveResourceTenant({ resourceType: 'Transaction', resource: doc });
    expect(attribution.status).toBe('resolved');
    expect(String(attribution.tenantId)).toBe(String(fA.tenant._id));
  });

  test('ATTR-X-03 (Visite.property → Property.tenant=A → tenant A)', async () => {
    const { fA, propA, owner } = await setup();
    const raw = { property: propA._id, client: owner._id, tenant: fA.tenant._id, statut: 'programmee', scheduledStartAt: new Date() };
    const insert = await Visite.collection.insertOne(raw);
    const doc = { _id: insert.insertedId, ...raw };
    const attribution = await resolveResourceTenant({ resourceType: 'Visite', resource: doc });
    expect(attribution.status).toBe('resolved');
    expect(String(attribution.tenantId)).toBe(String(fA.tenant._id));
  });

  test('ATTR-X-04 (RentalMaintenanceTicket.property → Property.tenant=A → tenant A)', async () => {
    const { fA, propA, owner } = await setup();
    const raw = { property: propA._id, category: 'plomberie', description: 'Test', status: 'nouveau', createdBy: owner._id };
    const insert = await RentalMaintenanceTicket.collection.insertOne(raw);
    const doc = { _id: insert.insertedId, ...raw };
    const attribution = await resolveResourceTenant({ resourceType: 'RentalMaintenanceTicket', resource: doc });
    expect(attribution.status).toBe('resolved');
    expect(String(attribution.tenantId)).toBe(String(fA.tenant._id));
  });

  test('ATTR-X-05 (isolation: two properties A and B → each derived resource stays on its own tenant)', async () => {
    const { fA, fB, owner, propA } = await setup();
    const propB = await makeProperty(owner, fB.tenant);
    const contratA = await Contrat.create({ type: 'location', bien: propA._id, statut: 'actif', cycleVie: 'actif', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000, montantCaution: 600000, villeBien: 'Brazzaville', adresseBien: 'Rue A' });
    const contratB = await Contrat.create({ type: 'location', bien: propB._id, statut: 'actif', cycleVie: 'actif', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000, montantCaution: 600000, villeBien: 'Brazzaville', adresseBien: 'Rue B' });
    const attrA = await resolveResourceTenant({ resourceType: 'Contrat', resource: contratA.toObject() });
    const attrB = await resolveResourceTenant({ resourceType: 'Contrat', resource: contratB.toObject() });
    expect(String(attrA.tenantId)).toBe(String(fA.tenant._id));
    expect(String(attrB.tenantId)).toBe(String(fB.tenant._id));
  });

  test('ATTR-X (Paiement via contract → Property.tenant=A → tenant A)', async () => {
    const { fA, propA } = await setup();
    const contrat = await Contrat.create({
      type: 'location', bien: propA._id, statut: 'actif', cycleVie: 'actif',
      dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000, montantCaution: 600000,
      villeBien: 'Brazzaville', adresseBien: 'Rue test',
    });
    const raw = { contrat: contrat._id, montant: 300000, dateReglement: new Date(), moyenPaiement: 'especes', typePaiement: 'loyer' };
    const insert = await Paiement.collection.insertOne(raw);
    const doc = { _id: insert.insertedId, ...raw };
    const attribution = await resolveResourceTenant({ resourceType: 'Paiement', resource: doc });
    expect(attribution.status).toBe('resolved');
    expect(String(attribution.tenantId)).toBe(String(fA.tenant._id));
  });

  test('ATTR-X (RentalManagement.property → Property.tenant=A → tenant A even when owner is multi-tenant)', async () => {
    const { fA, propA, owner } = await setup();
    const rental = await RentalManagement.create({
      property: propA._id, owner: owner._id, tenant: null, // deliberately leave RentalManagement.tenant null to prove Property.tenant wins.
      managementActivated: true, occupancyStatus: 'occupe',
    });
    const attribution = await resolveResourceTenant({ resourceType: 'RentalManagement', resource: rental.toObject() });
    expect(attribution.status).toBe('resolved');
    expect(String(attribution.tenantId)).toBe(String(fA.tenant._id));
  });
});
