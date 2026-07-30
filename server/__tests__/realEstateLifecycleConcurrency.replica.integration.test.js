const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Transaction = require('../models/Transaction');
const Contrat = require('../models/Contrat');

jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([Transaction.syncIndexes(), Contrat.syncIndexes()]);
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('deux ouvertures concurrentes du même dossier immobilier : une seule est persistée', async () => {
  const property = id();
  const common = {
    property, agent: id(), finalAmount: 25000000, transactionType: 'vente',
    commission: { taux: 10, total: 2500000, ownerPayout: 0, agencyNet: 2500000 },
    status: 'En cours', paymentStatus: 'non_initié',
  };
  const results = await Promise.allSettled([
    Transaction.create({ ...common, client: id() }),
    Transaction.create({ ...common, client: id() }),
  ]);

  expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(({ status }) => status === 'rejected')[0].reason).toMatchObject({ code: 11000 });
  expect(await Transaction.countDocuments({ property })).toBe(1);
});

test('deux créations concurrentes de bail sur le même bien : une seule est persistée', async () => {
  const bien = id();
  const results = await Promise.allSettled([
    Contrat.create({ type: 'location', bien, statut: 'en_attente', locataire: id(), montantLoyer: 150000 }),
    Contrat.create({ type: 'location', bien, statut: 'en_attente', locataire: id(), montantLoyer: 150000 }),
  ]);

  expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(({ status }) => status === 'rejected')[0].reason).toMatchObject({ code: 11000 });
  expect(await Contrat.countDocuments({ bien, type: 'location' })).toBe(1);
});

test('un contrat clôturé ne bloque pas un nouveau cycle locatif', async () => {
  const bien = id();
  await Contrat.create({ type: 'location', bien, statut: 'expiré', locataire: id(), montantLoyer: 120000 });
  await expect(Contrat.create({ type: 'location', bien, statut: 'en_attente', locataire: id(), montantLoyer: 130000 })).resolves.toBeDefined();
  expect(await Contrat.countDocuments({ bien, type: 'location' })).toBe(2);
});
