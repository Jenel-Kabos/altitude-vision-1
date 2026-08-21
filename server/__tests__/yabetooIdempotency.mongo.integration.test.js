const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Visite = require('../models/Visite');
const PaiementTransaction = require('../models/PaiementTransaction');

jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([Visite.syncIndexes(), PaiementTransaction.syncIndexes()]);
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('10 claims concurrents d’une visite ne donnent qu’un propriétaire de CREATE', async () => {
  const visiteId = id(); const client = id();
  await Visite.collection.insertOne({ _id: visiteId, property: id(), client, date: new Date(), time: '10:00', type: 'physical', status: 'pending', paiementStatus: 'en_attente', paiementRef: null, yabetooBusinessKey: null, createdAt: new Date(), updatedAt: new Date() });
  const claims = await Promise.all(Array.from({ length: 10 }, () => Visite.findOneAndUpdate(
    { _id: visiteId, client, yabetooBusinessKey: null, paiementStatus: { $ne: 'payé' } },
    { $set: { yabetooBusinessKey: `yabetoo:visite:${visiteId}:payer:${client}:v1`, yabetooState: 'creating' } },
    { new: true },
  )));
  expect(claims.filter(Boolean)).toHaveLength(1);
});

test('business key et référence provider refusent les collisions', async () => {
  const transaction = id(); const payer = id();
  const base = { transaction, initiéPar: payer, montant: 5000, methode: 'yabetoo_momo', statut: 'En attente', yabetooBusinessKey: `yabetoo:transaction:${transaction}:payer:${payer}:v1` };
  const results = await Promise.allSettled(Array.from({ length: 10 }, () => PaiementTransaction.create(base)));
  expect(results.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
  const first = results.find((entry) => entry.status === 'fulfilled').value;
  await PaiementTransaction.findByIdAndUpdate(first._id, { yabetooIntentId: 'pi_unique' });
  await expect(PaiementTransaction.create({ ...base, transaction: id(), yabetooBusinessKey: 'different', yabetooIntentId: 'pi_unique' })).rejects.toMatchObject({ code: 11000 });
});
