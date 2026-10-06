const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const mongoose = require('mongoose');
const Locataire = require('../models/Locataire');
const Proprietaire = require('../models/Proprietaire');
const User = require('../models/User');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const {
  discoverLegacyRentalTestData,
  applyLegacyRentalTestDataCleanup,
  computeCleanupManifestHash,
} = require('../services/platformTenant/legacyRentalTestDataCleanupService');

jest.setTimeout(120000);

const db = () => mongoose.connection.db;
const legacyTenant = (suffix) => Locataire.create({ nom: `Legacy ${suffix}`, prenom: 'Test', telephone: `0600${suffix}` });
const legacyOwner = (suffix) => Proprietaire.create({ nom: `Legacy ${suffix}`, prenom: 'Test', telephone: `0500${suffix}` });

beforeAll(startFinancialMongo);
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await Promise.all([
    Paiement.deleteMany({}), Contrat.deleteMany({}), Property.deleteMany({}),
    Locataire.deleteMany({}), Proprietaire.deleteMany({}), User.deleteMany({}),
    db().collection('documents').deleteMany({}), db().collection('tenantlinkrequests').deleteMany({}),
  ]);
});

test('discovery classe les orphelins, dépendances test et ancrages modernes sans élargir la population', async () => {
  const [orphan, withTestDeps, blocked, owner, modern] = await Promise.all([
    legacyTenant('1001'), legacyTenant('1002'), legacyTenant('1003'), legacyOwner('2001'),
    Locataire.create({ nom: 'Modern', prenom: 'Individual', telephone: '06009999', individualOwner: new mongoose.Types.ObjectId() }),
  ]);
  const contract = await Contrat.create({ type: 'location', locataire: withTestDeps._id, statut: 'expiré' });
  const payment = await Paiement.create({ contrat: contract._id, mois: 1, annee: 2020, montant: 1, statut: 'impayé' });
  await db().collection('documents').insertOne({ refType: 'Proprietaire', refId: owner._id, tenant: null, notes: 'test legacy' });
  const user = await User.create({ name: 'Modern owner', email: `modern-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!' });
  const property = await Property.create({ title: 'Modern property', description: 'Description suffisamment longue.', pole: 'Altimmo', type: 'Appartement', status: 'location', price: 1, address: { city: 'Brazzaville', arrondissement: 'Centre' }, images: ['https://example.test/p.jpg'], surface: 30, latitude: -4.27, longitude: 15.27, owner: user._id, tenant: null });
  await Contrat.create({ type: 'location', locataire: blocked._id, bien: property._id, statut: 'actif' });

  const report = await discoverLegacyRentalTestData(db());
  expect(report.counts).toEqual({ locataires: 3, proprietaires: 1, total: 4 });
  expect(report.rows.find((row) => row.id === String(orphan._id)).classification).toBe('SAFE_TEST_ORPHAN');
  expect(report.rows.find((row) => row.id === String(withTestDeps._id))).toMatchObject({ classification: 'TEST_WITH_TEST_DEPENDENCIES', dependencies: expect.arrayContaining([expect.objectContaining({ collection: 'contrats', id: String(contract._id) }), expect.objectContaining({ collection: 'paiements', id: String(payment._id) })]) });
  expect(report.rows.find((row) => row.id === String(owner._id)).classification).toBe('TEST_WITH_TEST_DEPENDENCIES');
  expect(report.rows.find((row) => row.id === String(blocked._id)).classification).toBe('BLOCKED_POSSIBLE_REAL_DATA');
  expect(report.rows.some((row) => row.id === String(modern._id))).toBe(false);
});

test('apply transactionnel utilise le manifest figé, CAS et ne touche jamais Property/User', async () => {
  const [tenant, owner] = await Promise.all([legacyTenant('3001'), legacyOwner('3002')]);
  const contract = await Contrat.create({ type: 'location', locataire: tenant._id, proprietaire: owner._id, statut: 'expiré' });
  await Paiement.create({ contrat: contract._id, mois: 2, annee: 2020, montant: 1, statut: 'impayé' });
  const report = await discoverLegacyRentalTestData(db());
  const hash = computeCleanupManifestHash(report.manifest);
  const tampered = structuredClone(report.manifest);
  tampered.candidates[0].id = new mongoose.Types.ObjectId().toString();
  expect(computeCleanupManifestHash(tampered)).not.toBe(hash);
  const before = { properties: await Property.countDocuments({}), users: await User.countDocuments({}) };

  const result = await applyLegacyRentalTestDataCleanup({ db: db(), manifest: report.manifest, manifestHash: hash });
  expect(result).toMatchObject({ locatairesDeleted: 1, proprietairesDeleted: 1, dependenciesDeleted: 2 });
  expect(await Locataire.countDocuments({ tenant: null, individualOwner: null })).toBe(0);
  expect(await Proprietaire.countDocuments({ tenant: null, individualOwner: null })).toBe(0);
  expect({ properties: await Property.countDocuments({}), users: await User.countDocuments({}) }).toEqual(before);
});

test('apply refuse atomiquement un état changé ou une nouvelle dépendance bloquante', async () => {
  const tenant = await legacyTenant('4001');
  const report = await discoverLegacyRentalTestData(db());
  const hash = computeCleanupManifestHash(report.manifest);
  await Locataire.updateOne({ _id: tenant._id }, { $set: { individualOwner: new mongoose.Types.ObjectId() } });
  await expect(applyLegacyRentalTestDataCleanup({ db: db(), manifest: report.manifest, manifestHash: hash }))
    .rejects.toMatchObject({ code: 'LEGACY_CLEANUP_STATE_CHANGED' });
  expect(await Locataire.exists({ _id: tenant._id })).toBeTruthy();
});
