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
const makeHistoricalActiveContract = (property) => Contrat.create({
  type: 'location', bien: property._id, statut: 'actif',
  dateEntree: '2025-01-01', dateFinBail: '2025-12-31', montantLoyer: 350000,
});

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
      contractId: contract._id, propertyId: property._id, status: 'MISSING_RENTAL_MANAGEMENT', repairable: true,
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
      occupancyStatus: 'occupe', activeLease: contract._id, monthlyRent: 350000,
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
