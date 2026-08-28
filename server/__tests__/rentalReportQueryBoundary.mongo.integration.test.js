const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const { getRentalReportData } = require('../services/reporting/rentalReportQueryService');

jest.setTimeout(120000);

beforeAll(async () => {
  await startFinancialMongo();
  await RentalManagement.syncIndexes();
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

const oid = () => new mongoose.Types.ObjectId();

async function insertCompleteOwnerFixture() {
  const ownerA = oid();
  const ownerB = oid();
  const propertyA1 = oid();
  const propertyA2 = oid();
  const propertyA3 = oid();
  const propertyB = oid();
  const contractA = oid();
  const contractB = oid();
  const soon = new Date(Date.now() + 10 * 86400000);

  await Property.collection.insertMany([
    { _id: propertyA1, owner: ownerA },
    { _id: propertyA2, owner: ownerA },
    { _id: propertyA3, owner: ownerA },
    { _id: propertyB, owner: ownerB },
  ]);
  await RentalManagement.collection.insertMany([
    { property: propertyA1, managementActivated: true, availabilityStatus: 'disponible', occupancyStatus: 'vacant' },
    { property: propertyA2, managementActivated: true, availabilityStatus: 'indisponible', occupancyStatus: 'occupe' },
    { property: propertyA3, managementActivated: true, availabilityStatus: 'indisponible', occupancyStatus: 'preavis' },
    { property: propertyB, managementActivated: true, availabilityStatus: 'disponible', occupancyStatus: 'preavis' },
  ]);
  await Contrat.collection.insertMany([
    { _id: contractA, bien: propertyA1, type: 'location', statut: 'actif', dateFinBail: soon },
    { _id: contractB, bien: propertyB, type: 'location', statut: 'actif', dateFinBail: soon },
  ]);
  await Paiement.collection.insertMany([
    { contrat: contractA, statut: 'partiel', montantRecu: 100, montantTotal: 300, penaliteAppliquee: true, penaliteMontant: 20 },
    { contrat: contractB, statut: 'impayé', montantRecu: 9000, montantTotal: 10000, penaliteAppliquee: true, penaliteMontant: 800 },
  ]);
  await RentalMaintenanceTicket.collection.insertMany([
    { property: propertyA1, status: 'ouvert' },
    { property: propertyB, status: 'en_cours' },
  ]);

  return { ownerA, ownerB };
}

describe('ARCH-2L — caractérisation de la query locative historique', () => {
  test('Owner A reçoit ses KPI complets sans contamination Owner B', async () => {
    const { ownerA } = await insertCompleteOwnerFixture();

    await expect(getRentalReportData({ scopeUserIds: new Set([ownerA]) })).resolves.toEqual({
      kpis: {
        _id: null,
        available: 1,
        occupied: 1,
        notices: 1,
        activeContracts: 1,
        expiringContracts: 1,
        rentCollected: 100,
        unpaidRent: 200,
        penalties: 20,
        maintenance: 1,
      },
    });
  });

  test('plusieurs owners sont agrégés ensemble quand le scope les contient', async () => {
    const { ownerA, ownerB } = await insertCompleteOwnerFixture();
    const result = await getRentalReportData({ scopeUserIds: [ownerA, ownerB] });

    expect(result.kpis).toMatchObject({
      available: 2,
      occupied: 1,
      notices: 2,
      activeContracts: 2,
      expiringContracts: 2,
      rentCollected: 9100,
      unpaidRent: 1200,
      penalties: 820,
      maintenance: 2,
    });
  });

  test('mode global sans scope — contrat utilisé par le PlatformOperator non scopé — agrège tous les owners', async () => {
    await insertCompleteOwnerFixture();
    const result = await getRentalReportData();

    expect(result.kpis).toMatchObject({
      available: 2,
      occupied: 1,
      notices: 2,
      activeContracts: 2,
      expiringContracts: 2,
      rentCollected: 9100,
      unpaidRent: 1200,
      penalties: 820,
      maintenance: 2,
    });
  });

  test('owner valide sans donnée conserve exactement tous les fallbacks à zéro', async () => {
    await expect(getRentalReportData({ scopeUserIds: [oid()] })).resolves.toEqual({
      kpis: {
        available: 0,
        occupied: 0,
        notices: 0,
        activeContracts: 0,
        expiringContracts: 0,
        rentCollected: 0,
        unpaidRent: 0,
        penalties: 0,
        maintenance: 0,
      },
    });
  });

  test('données partielles : RentalManagement seul conserve la forme complète', async () => {
    const owner = oid();
    const property = oid();
    await Property.collection.insertOne({ _id: property, owner });
    await RentalManagement.collection.insertOne({ property, managementActivated: true, availabilityStatus: 'disponible', occupancyStatus: 'vacant' });

    await expect(getRentalReportData({ scopeUserIds: [owner] })).resolves.toEqual({
      kpis: {
        _id: null,
        available: 1,
        occupied: 0,
        notices: 0,
        activeContracts: 0,
        expiringContracts: 0,
        rentCollected: 0,
        unpaidRent: 0,
        penalties: 0,
        maintenance: 0,
      },
    });
  });

  test('une erreur de la première query Property est propagée sans fallback', async () => {
    const failure = new Error('property query failure');
    const spy = jest.spyOn(Property, 'find').mockImplementationOnce(() => ({ distinct: jest.fn().mockRejectedValue(failure) }));

    await expect(getRentalReportData({ scopeUserIds: [oid()] })).rejects.toBe(failure);
    spy.mockRestore();
  });
});
