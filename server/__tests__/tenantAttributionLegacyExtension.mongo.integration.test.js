// STORAGE-LEGACY-CERT-1 (Phase 17) — régression ciblée des 9 resourceType
// ajoutés additivement à tenantResourceAttributionService par
// STORAGE-LEGACY-1, non couverts par tenantAttribution.mongo.integration.test.js
// (qui ne teste que Document/Hotel/Conversation, déjà existants avant).
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const Hotel = require('../models/Hotel');
const Litige = require('../models/Litige');
const Signalement = require('../models/Signalement');
const RentalPaymentReceipt = require('../models/RentalPaymentReceipt');
const Proprietaire = require('../models/Proprietaire');
const PaiementTransaction = require('../models/PaiementTransaction');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { resolveResourceTenant } = require('../services/platformTenant/tenantResourceAttributionService');

jest.setTimeout(180000);

let tenant;
let owner;

beforeAll(async () => {
  await startFinancialMongo();
  const fixture = await createTenantFixture({ label: 'Attribution Extension' });
  tenant = fixture.tenant;
  owner = (await createTenantUser({ tenant, bootstrap: fixture.bootstrap })).user;
});
afterAll(async () => stopFinancialMongo());

async function makeProperty() {
  return Property.create({
    title: 'Attribution fixture', description: 'Description suffisamment longue pour une fixture d\'attribution étendue.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.2, longitude: 15.2,
    images: ['https://placehold.co/1200x800/png'], surface: 70, statusAdmin: 'Validée', isPublished: true,
    availability: 'Disponible', owner: owner._id,
  });
}

test('RentalMaintenanceTicket : property tenant-resolved → resolved', async () => {
  const property = await makeProperty();
  const result = await resolveResourceTenant({ resourceType: 'RentalMaintenanceTicket', resource: { property: property._id } });
  expect(result.status).toBe('resolved');
  expect(String(result.tenantId)).toBe(String(tenant._id));
});

test('RentalMaintenanceTicket : property absente → unresolved', async () => {
  const result = await resolveResourceTenant({ resourceType: 'RentalMaintenanceTicket', resource: { property: null } });
  expect(result.status).toBe('unresolved');
});

test('RealEstateApplication : property tenant-resolved → resolved', async () => {
  const property = await makeProperty();
  const result = await resolveResourceTenant({ resourceType: 'RealEstateApplication', resource: { property: property._id } });
  expect(result.status).toBe('resolved');
});

test('Litige : bienConcerné tenant-resolved → resolved ; absent → unresolved', async () => {
  const property = await makeProperty();
  const litige = await Litige.create({ description: 'Fixture litige STORAGE-LEGACY-CERT-1', bienConcerné: property._id, type: 'Autre', statut: 'Ouvert' });
  const resolved = await resolveResourceTenant({ resourceType: 'Litige', resource: litige });
  expect(resolved.status).toBe('resolved');
  const litigeSansBien = await Litige.create({ description: 'Fixture litige orpheline STORAGE-LEGACY-CERT-1', type: 'Autre', statut: 'Ouvert' });
  const unresolved = await resolveResourceTenant({ resourceType: 'Litige', resource: litigeSansBien });
  expect(unresolved.status).toBe('unresolved');
});

test('Signalement : property tenant-resolved → resolved', async () => {
  const property = await makeProperty();
  const signalement = await Signalement.create({ property: property._id, signalePar: owner._id, raison: 'autre', details: 'Fixture STORAGE-LEGACY-CERT-1' });
  const result = await resolveResourceTenant({ resourceType: 'Signalement', resource: signalement });
  expect(result.status).toBe('resolved');
});

test('RentalPaymentReceipt : contrat→property tenant-resolved → resolved', async () => {
  const property = await makeProperty();
  const contrat = await Contrat.create({ type: 'location', bien: property._id });
  const receipt = await RentalPaymentReceipt.create({
    paiement: new (require('mongoose').Types.ObjectId)(), contrat: contrat._id, auteur: owner._id,
    montant: 1000, datePaiement: new Date(), modePaiement: 'virement',
  });
  const result = await resolveResourceTenant({ resourceType: 'RentalPaymentReceipt', resource: receipt });
  expect(result.status).toBe('resolved');
});

test('FinancialDocumentArtifact : domain=hotel → resolved via Hotel.tenant', async () => {
  const hotel = await Hotel.create({ name: 'Hotel Cert', tenant: tenant._id, manager: owner._id, createdBy: owner._id });
  const artifact = { domain: 'hotel', establishmentId: hotel._id };
  const result = await resolveResourceTenant({ resourceType: 'FinancialDocumentArtifact', resource: artifact });
  expect(result.status).toBe('resolved');
  expect(String(result.tenantId)).toBe(String(tenant._id));
});

test('FinancialDocumentArtifact : domain=real_estate → resolved via Property.owner', async () => {
  const property = await makeProperty();
  const artifact = { domain: 'real_estate', establishmentId: property._id };
  const result = await resolveResourceTenant({ resourceType: 'FinancialDocumentArtifact', resource: artifact });
  expect(result.status).toBe('resolved');
});

test('FinancialDocumentArtifact : domain inconnu → unresolved, jamais une supposition', async () => {
  const result = await resolveResourceTenant({ resourceType: 'FinancialDocumentArtifact', resource: { domain: 'other', establishmentId: null } });
  expect(result.status).toBe('unresolved');
});

test('Proprietaire : via user rattaché à un tenant → resolved', async () => {
  const proprietaire = await Proprietaire.create({ nom: 'Cert', prenom: 'Proprio', telephone: '+242000010', adresse: 'Adresse test', user: owner._id });
  const result = await resolveResourceTenant({ resourceType: 'Proprietaire', resource: proprietaire });
  expect(result.status).toBe('resolved');
});

test('Proprietaire : sans user ni contrat rattaché → unresolved', async () => {
  const proprietaire = await Proprietaire.create({ nom: 'Cert', prenom: 'Orphelin', telephone: '+242000011', adresse: 'Adresse test' });
  const result = await resolveResourceTenant({ resourceType: 'Proprietaire', resource: proprietaire });
  expect(result.status).toBe('unresolved');
});

test('Proprietaire : via Contrat.proprietaire → Property tenant-resolved → resolved', async () => {
  const property = await makeProperty();
  const proprietaire = await Proprietaire.create({ nom: 'Cert', prenom: 'ViaContrat', telephone: '+242000012', adresse: 'Adresse test' });
  await Contrat.create({ type: 'vente', bien: property._id, proprietaire: proprietaire._id });
  const result = await resolveResourceTenant({ resourceType: 'Proprietaire', resource: proprietaire });
  expect(result.status).toBe('resolved');
});

test('PaiementTransaction : via Transaction.property tenant-resolved → resolved', async () => {
  const property = await makeProperty();
  const buyer = await User.create({ name: 'Buyer', email: `buyer-cert-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true });
  const transaction = await Transaction.create({
    property: property._id, client: buyer._id, agent: owner._id, reservation: new (require('mongoose').Types.ObjectId)(),
    transactionType: 'vente', finalAmount: 100000,
  });
  const paiementTransaction = await PaiementTransaction.create({
    transaction: transaction._id, initiéPar: buyer._id, montant: 50000, methode: 'virement',
  });
  const result = await resolveResourceTenant({ resourceType: 'PaiementTransaction', resource: paiementTransaction });
  expect(result.status).toBe('resolved');
});

test('PaiementTransaction : sans transaction rattachée → unresolved', async () => {
  const result = await resolveResourceTenant({ resourceType: 'PaiementTransaction', resource: { transaction: null } });
  expect(result.status).toBe('unresolved');
});

// Rappel : `ambiguous`/`unresolved` doivent tous deux rester fail-closed pour
// la migration (§10 STORAGE-LEGACY-1) — déjà prouvé par
// legacyAssetMigrationCertification.mongo.integration.test.js pour
// RentalMaintenanceTicket (cas contradictoire) et Locataire (identité).
