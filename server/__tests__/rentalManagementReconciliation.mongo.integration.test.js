// GL-ARCH-1.1 — Reproduit et corrige l'anomalie observée en production :
// des contrats de location "actifs" existent sur un Property réel, mais
// aucun RentalManagement n'a jamais été créé pour ce bien (le Contrat a été
// créé/modifié avant l'introduction de `syncLeaseOccupation`, ou par un
// chemin qui ne l'a jamais déclenché) — le KPI « Biens gérés »
// (RentalManagement.managementActivated: true) reste alors à 0 alors que des
// baux actifs existent bel et bien.
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const RentalManagement = require('../models/RentalManagement');
const Locataire = require('../models/Locataire');
const Proprietaire = require('../models/Proprietaire');
const Paiement = require('../models/Paiement');
const ActionLog = require('../models/ActionLog');
const {
  scanRentalManagementConsistency,
  planRentalManagementReconciliation,
  applyRentalManagementReconciliation,
} = require('../services/rentalManagementReconciliationService');
const { stats: getStats } = require('../controllers/rentalManagementController');

jest.setTimeout(120000);

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({
    name: 'Utilisateur Test', email: `reconcile${counter}${Date.now()}@example.com`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides,
  });
};

const makeManagedProperty = (owner, overrides = {}) => Property.create({
  title: 'Villa Historique Test', description: 'Description suffisamment longue pour la validation du modèle Property.',
  pole: 'Altimmo', type: 'Villa', status: 'location', price: 350000,
  address: { arrondissement: 'Moungali', city: 'Brazzaville' }, latitude: -4.25, longitude: 15.27,
  images: ['https://placehold.co/1200x800/png?text=Test'], surface: 100,
  statusAdmin: 'Validée', availability: 'Disponible', owner: owner._id,
  ...overrides,
});

// Simule un contrat historique créé AVANT que `syncLeaseOccupation` existe :
// insertion directe via le modèle, sans passer par contratController.create
// (qui déclenche désormais toujours la synchronisation).
const makeHistoricalActiveContract = async (property, overrides = {}) => {
  counter += 1;
  const locataire = await Locataire.create({ nom: 'Locataire', prenom: `Test ${counter}`, telephone: `0600${counter}` });
  const proprietaire = await Proprietaire.create({ nom: 'Propriétaire', prenom: `Test ${counter}`, telephone: `0700${counter}`, user: property.owner });
  return Contrat.create({
    type: 'location', bien: property._id, statut: 'actif', locataire: locataire._id, proprietaire: proprietaire._id,
    dateEntree: '2025-01-01', dateFinBail: '2025-12-31', montantLoyer: 350000,
    ...overrides,
  });
};

const callStats = async () => {
  let payload;
  const res = { json: (body) => { payload = body; return res; }, status: () => res };
  await getStats({}, res);
  return payload.data.stats;
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('GL-ARCH-1.1 — scanRentalManagementConsistency', () => {
  test('détecte un contrat actif sur un Property réel sans RentalManagement (MISSING_RENTAL_MANAGEMENT)', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    const property = await makeManagedProperty(owner);
    const contract = await makeHistoricalActiveContract(property);

    const report = await scanRentalManagementConsistency();

    expect(report.totalActiveLeaseContracts).toBe(1);
    expect(report.repairableCount).toBe(1);
    expect(report.items[0]).toEqual(expect.objectContaining({
      contractId: String(contract._id), propertyId: String(property._id), status: 'MISSING_RENTAL_MANAGEMENT', repairable: true,
    }));
    // Dry-run : lecture seule, aucune écriture.
    expect(await RentalManagement.countDocuments({})).toBe(0);
  });

  test('ne signale rien pour un dossier déjà cohérent', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    const property = await makeManagedProperty(owner);
    const contract = await makeHistoricalActiveContract(property);
    await RentalManagement.create({
      property: property._id, owner: owner._id, managementActivated: true,
      occupancyStatus: 'occupe', activeLease: contract._id, currentTenant: contract.locataire, monthlyRent: 350000,
    });

    const report = await scanRentalManagementConsistency();
    expect(report.repairableCount).toBe(0);
    expect(report.items[0].status).toBe('CONSISTENT');
  });

  test('signale une anomalie non réparable automatiquement si le Property référencé est introuvable (jamais deviné)', async () => {
    await Contrat.create({
      type: 'location', bien: new mongoose.Types.ObjectId(), statut: 'actif',
      dateEntree: '2025-01-01', dateFinBail: '2025-12-31', montantLoyer: 200000,
    });
    const report = await scanRentalManagementConsistency();
    expect(report.repairableCount).toBe(0);
    expect(report.anomalyCount).toBe(1);
    expect(report.items[0].status).toBe('ANOMALY_PROPERTY_NOT_FOUND');
  });

  test('bloque deux contrats ouverts sur le même Property et ne planifie aucune correction', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    const property = await makeManagedProperty(owner);
    await makeHistoricalActiveContract(property);
    // Contourne volontairement l'index de protection pour simuler une donnée legacy.
    await Contrat.collection.createIndex(
      { bien: 1, type: 1 },
      {
        unique: true,
        partialFilterExpression: { bien: { $type: 'objectId' }, statut: { $in: ['en_attente', 'actif'] } },
        name: 'one_open_contract_per_property_and_type',
      },
    );
    await Contrat.collection.dropIndex('one_open_contract_per_property_and_type');
    try {
      await Contrat.collection.insertOne({
        type: 'location', bien: property._id, statut: 'actif', locataire: new mongoose.Types.ObjectId(),
        proprietaire: new mongoose.Types.ObjectId(), createdAt: new Date(), updatedAt: new Date(),
      });

      const report = await scanRentalManagementConsistency();
      expect(report.duplicateCount).toBe(2);
      expect(report.conflictCount).toBe(2);
      expect(report.items.every((item) => item.status === 'CONFLICT_MULTIPLE_OPEN_CONTRACTS')).toBe(true);
      expect(planRentalManagementReconciliation(report).actionCount).toBe(0);
    } finally {
      await Contrat.collection.deleteMany({ bien: property._id });
      await Contrat.collection.createIndex(
        { bien: 1, type: 1 },
        {
          unique: true,
          partialFilterExpression: { bien: { $type: 'objectId' }, statut: { $in: ['en_attente', 'actif'] } },
          name: 'one_open_contract_per_property_and_type',
        },
      );
    }
  });

  test('signale les paiements dont le contrat est introuvable sans les modifier', async () => {
    await Paiement.collection.insertOne({ contrat: new mongoose.Types.ObjectId(), mois: 1, annee: 2026, montant: 100, statut: 'impayé' });
    const report = await scanRentalManagementConsistency();
    expect(report.paymentIssueCount).toBe(1);
    expect(report.paymentIssues[0].status).toBe('PAYMENT_CONTRACT_NOT_FOUND');
    expect(await Paiement.countDocuments()).toBe(1);
  });
});

describe('GL-ARCH-1.1 — réconciliation (plan + apply) : idempotente, jamais destructive', () => {
  test('le KPI « Biens gérés » passe de 0 à 1 après application, et reflète désormais le bail actif historique', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const owner = await makeUser({ role: 'Proprietaire' });
    const property = await makeManagedProperty(owner);
    await makeHistoricalActiveContract(property);

    expect((await callStats()).total).toBe(0);

    const report = await scanRentalManagementConsistency();
    const plan = planRentalManagementReconciliation(report);
    expect(plan.actionCount).toBe(1);

    const result = await applyRentalManagementReconciliation({ plan, actor: admin._id });
    expect(result.results[0].outcome).toBe('CREATED');

    const rental = await RentalManagement.findOne({ property: property._id });
    expect(rental.managementActivated).toBe(true);
    expect(rental.occupancyStatus).toBe('occupe');
    expect(String(rental.activeLease)).toBe(String((await Contrat.findOne({ bien: property._id }))._id));

    const updatedProperty = await Property.findById(property._id);
    expect(updatedProperty.availability).toBe('Loué');

    expect((await callStats()).total).toBe(1);
    expect(result.verification.items[0].status).toBe('CONSISTENT');
    const log = await ActionLog.findOne({ action: 'Réconciliation Gestion locative' });
    expect(log).toBeTruthy();
    expect(log.metadata.ancienneValeur).toBe('null');
    expect(log.metadata.nouvelleValeur).toContain(String(property._id));
  });

  test('réactive un RentalManagement inactif sans en créer un second', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const owner = await makeUser({ role: 'Proprietaire' });
    const property = await makeManagedProperty(owner);
    const contract = await makeHistoricalActiveContract(property);
    await RentalManagement.create({ property: property._id, owner: owner._id, active: false, managementActivated: false });

    const report = await scanRentalManagementConsistency();
    expect(report.items[0].status).toBe('RENTAL_MANAGEMENT_INACTIVE');
    const result = await applyRentalManagementReconciliation({ plan: planRentalManagementReconciliation(report), actor: admin._id });
    expect(result.repairedCount).toBe(1);
    expect(await RentalManagement.countDocuments({ property: property._id })).toBe(1);
    expect(await RentalManagement.exists({ property: property._id, active: true, managementActivated: true, activeLease: contract._id })).toBeTruthy();
  });

  test('exécuter la réconciliation deux fois ne crée jamais de second RentalManagement (idempotence)', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const owner = await makeUser({ role: 'Proprietaire' });
    const property = await makeManagedProperty(owner);
    await makeHistoricalActiveContract(property);

    for (let i = 0; i < 2; i += 1) {
      const report = await scanRentalManagementConsistency();
      const plan = planRentalManagementReconciliation(report);
      if (plan.actionCount > 0) await applyRentalManagementReconciliation({ plan, actor: admin._id });
    }

    expect(await RentalManagement.countDocuments({ property: property._id })).toBe(1);
    const finalReport = await scanRentalManagementConsistency();
    expect(finalReport.items[0].status).toBe('CONSISTENT');
  });

  test('une annonce personnelle sans contrat (hors gestion) n’est jamais comptée ni touchée par la réconciliation', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    await makeManagedProperty(owner, { title: 'Annonce personnelle non gérée' });

    const report = await scanRentalManagementConsistency();
    expect(report.totalActiveLeaseContracts).toBe(0);
    expect((await callStats()).total).toBe(0);
    expect(await RentalManagement.countDocuments({})).toBe(0);
  });
});
