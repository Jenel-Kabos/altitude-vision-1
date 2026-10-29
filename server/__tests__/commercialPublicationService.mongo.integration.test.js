const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const CommercialPublicationRevision = require('../models/CommercialPublicationRevision');
const {
  SUBSTANTIVE_PUBLIC_FIELDS,
  classifySubstantiveChanges,
  createPendingRevision,
  decideRevision,
} = require('../services/commercialPublicationService');

jest.setTimeout(180000);

const testListingSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, default: null },
  owner: { type: mongoose.Schema.Types.ObjectId, required: true },
  commercialPublicationVersion: { type: Number, default: 0 },
  approvedPublicSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  currentPublicationRevision: { type: mongoose.Schema.Types.ObjectId, default: null },
});
const TestCommercialListing = mongoose.models.TestCommercialListing || mongoose.model('TestCommercialListing', testListingSchema);
const adapter = { model: TestCommercialListing };

const id = () => new mongoose.Types.ObjectId();
let operator; let owner;

beforeAll(startFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  owner = id();
  operator = await User.create({ name: 'Publication Operator', email: `publication-${Date.now()}-${Math.random()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  await PlatformOperator.create({ user: operator._id, capabilities: ['platform.commercial.manage'], grantedBy: operator._id, grantReason: 'TEST DATA publication authority' });
});
afterAll(stopFinancialMongo);

const snapshot = (price = 100000) => ({ title: 'Villa approuvée', description: 'Description publique', price, status: 'vente', type: 'Villa', address: { city: 'Brazzaville' }, latitude: -4.2, longitude: 15.2, images: ['approved.jpg'], bedrooms: 3, availability: 'Disponible' });

test('le jeu fermé des champs substantiels classe prix, média et disponibilité sans accepter owner/tenant', () => {
  expect(SUBSTANTIVE_PUBLIC_FIELDS).toEqual(expect.arrayContaining(['price', 'images', 'description', 'availability']));
  expect(SUBSTANTIVE_PUBLIC_FIELDS).not.toEqual(expect.arrayContaining(['owner', 'tenant']));
  expect(classifySubstantiveChanges(snapshot(), { ...snapshot(), price: 125000, images: ['new.jpg'], owner: id() })).toEqual(['price', 'images']);
});

test('une révision en attente préserve le snapshot public approuvé et l’attribution', async () => {
  const tenant = id();
  const listing = await TestCommercialListing.create({ tenant, owner, commercialPublicationVersion: 1, approvedPublicSnapshot: snapshot() });
  const revision = await createPendingRevision({ resourceType: 'Property', resource: listing, proposedSnapshot: snapshot(125000), actor: owner });
  const fresh = await TestCommercialListing.findById(listing._id).lean();
  expect(revision).toMatchObject({ status: 'pending', baseVersion: 1, changedFields: ['price'] });
  expect(fresh.approvedPublicSnapshot.price).toBe(100000);
  expect(fresh.owner).toEqual(owner);
  expect(fresh.tenant).toEqual(tenant);
});

test('seul un opérateur actif doté de platform.commercial.manage peut approuver', async () => {
  const listing = await TestCommercialListing.create({ owner, approvedPublicSnapshot: snapshot() });
  const revision = await createPendingRevision({ resourceType: 'Property', resource: listing, proposedSnapshot: snapshot(125000), actor: owner });
  await expect(decideRevision({ revisionId: revision._id, decision: 'approve', actor: { _id: owner }, reason: 'OK', adapter })).rejects.toMatchObject({ code: 'COMMERCIAL_PUBLICATION_AUTHORITY_REQUIRED' });
  await PlatformOperator.updateOne({ user: operator._id }, { status: 'revoked', revokedBy: operator._id, revokedAt: new Date(), revokeReason: 'TEST DATA' });
  await expect(decideRevision({ revisionId: revision._id, decision: 'approve', actor: operator, reason: 'OK', adapter })).rejects.toMatchObject({ code: 'COMMERCIAL_PUBLICATION_AUTHORITY_REQUIRED' });
});

test('l’approbation promeut atomiquement le snapshot sans modifier owner ni tenant', async () => {
  const tenant = id();
  const listing = await TestCommercialListing.create({ tenant, owner, approvedPublicSnapshot: snapshot() });
  const revision = await createPendingRevision({ resourceType: 'Property', resource: listing, proposedSnapshot: snapshot(125000), actor: owner });
  await decideRevision({ revisionId: revision._id, decision: 'approve', actor: operator, reason: 'Informations vérifiées', adapter });
  const [fresh, decided] = await Promise.all([TestCommercialListing.findById(listing._id).lean(), CommercialPublicationRevision.findById(revision._id).lean()]);
  expect(fresh).toMatchObject({ commercialPublicationVersion: 1, approvedPublicSnapshot: { price: 125000 }, owner, tenant });
  expect(decided).toMatchObject({ status: 'approved', decidedBy: operator._id, decisionReason: 'Informations vérifiées' });
});

test('le rejet conserve la dernière version publique et exige un motif', async () => {
  const listing = await TestCommercialListing.create({ owner, approvedPublicSnapshot: snapshot() });
  const revision = await createPendingRevision({ resourceType: 'Property', resource: listing, proposedSnapshot: snapshot(125000), actor: owner });
  await expect(decideRevision({ revisionId: revision._id, decision: 'reject', actor: operator, reason: '', adapter })).rejects.toMatchObject({ code: 'PUBLICATION_DECISION_REASON_REQUIRED' });
  await decideRevision({ revisionId: revision._id, decision: 'reject', actor: operator, reason: 'Prix non justifié', adapter });
  expect((await TestCommercialListing.findById(listing._id).lean()).approvedPublicSnapshot.price).toBe(100000);
  expect(await CommercialPublicationRevision.findById(revision._id)).toMatchObject({ status: 'rejected', decisionReason: 'Prix non justifié' });
});

test('deux décisions concurrentes ont un seul gagnant et la décision obsolète échoue', async () => {
  const listing = await TestCommercialListing.create({ owner, approvedPublicSnapshot: snapshot() });
  const revision = await createPendingRevision({ resourceType: 'Property', resource: listing, proposedSnapshot: snapshot(125000), actor: owner });
  const results = await Promise.allSettled([
    decideRevision({ revisionId: revision._id, decision: 'approve', actor: operator, reason: 'Premier contrôle', adapter }),
    decideRevision({ revisionId: revision._id, decision: 'reject', actor: operator, reason: 'Deuxième contrôle', adapter }),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((result) => result.status === 'rejected')[0].reason).toMatchObject({ statusCode: 409 });
  expect(['approved', 'rejected']).toContain((await CommercialPublicationRevision.findById(revision._id)).status);
});

test('une nouvelle révision rend l’ancienne obsolète sans publier ses valeurs', async () => {
  const listing = await TestCommercialListing.create({ owner, approvedPublicSnapshot: snapshot() });
  const first = await createPendingRevision({ resourceType: 'Property', resource: listing, proposedSnapshot: snapshot(125000), actor: owner });
  const second = await createPendingRevision({ resourceType: 'Property', resource: listing, proposedSnapshot: snapshot(140000), actor: owner });
  expect(await CommercialPublicationRevision.findById(first._id)).toMatchObject({ status: 'superseded' });
  await expect(decideRevision({ revisionId: first._id, decision: 'approve', actor: operator, reason: 'Trop tard', adapter })).rejects.toMatchObject({ statusCode: 409 });
  expect(second.status).toBe('pending');
  expect((await TestCommercialListing.findById(listing._id).lean()).approvedPublicSnapshot.price).toBe(100000);
});
