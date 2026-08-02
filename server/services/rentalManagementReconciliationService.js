// GL-ARCH-1.1 — Réconciliation des contrats de location historiques dont le
// bien réel (Property) n'a jamais reçu de RentalManagement activé, expliquant
// un KPI « Biens gérés » à 0 malgré des contrats actifs en base : ce dossier
// n'a jamais été activé automatiquement car le Contrat correspondant a été
// créé/modifié avant l'introduction de `syncLeaseOccupation`
// (server/services/rentalManagementLeaseSyncService.js) et n'a plus été
// re-sauvegardé depuis (seuls `contratController.create`/`update`
// déclenchent cette synchronisation).
//
// Portée volontairement limitée aux contrats `statut: 'actif'` : c'est
// l'anomalie rapportée (contrats actifs non reflétés dans le portefeuille
// géré). Un bien dont l'historique ne contient que des contrats
// résiliés/expirés est laissé de côté (anomalie journalée, jamais
// « deviné ») — voir README ci-dessous pour la justification.
const Contrat = require('../models/Contrat');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const { syncLeaseOccupation } = require('./rentalManagementLeaseSyncService');

/**
 * Analyse en lecture seule — ne modifie jamais la base.
 */
async function scanRentalManagementConsistency() {
  const contracts = await Contrat.find({ type: 'location', statut: 'actif' })
    .select('_id bien locataire montantLoyer statut').lean();

  const items = [];
  for (const contract of contracts) {
    if (!contract.bien) {
      items.push({ contractId: contract._id, status: 'ANOMALY_NO_PROPERTY_REFERENCE', repairable: false });
      continue;
    }
    const property = await Property.findById(contract.bien).select('_id status owner availability').lean();
    if (!property) {
      items.push({ contractId: contract._id, propertyId: contract.bien, status: 'ANOMALY_PROPERTY_NOT_FOUND', repairable: false });
      continue;
    }
    if (property.status !== 'location') {
      items.push({ contractId: contract._id, propertyId: property._id, status: 'ANOMALY_PROPERTY_TYPE_MISMATCH', repairable: false, detail: { propertyStatus: property.status } });
      continue;
    }
    const rental = await RentalManagement.findOne({ property: property._id })
      .select('_id managementActivated activeLease occupancyStatus').lean();

    if (!rental) {
      items.push({ contractId: contract._id, propertyId: property._id, status: 'MISSING_RENTAL_MANAGEMENT', repairable: true });
      continue;
    }
    const activeLeaseId = rental.activeLease ? String(rental.activeLease) : null;
    if (!rental.managementActivated) {
      items.push({ contractId: contract._id, propertyId: property._id, rentalManagementId: rental._id, status: 'NOT_ACTIVATED', repairable: true });
      continue;
    }
    if (activeLeaseId !== String(contract._id) || rental.occupancyStatus !== 'occupe') {
      items.push({ contractId: contract._id, propertyId: property._id, rentalManagementId: rental._id, status: 'ACTIVE_LEASE_MISMATCH', repairable: true, detail: { currentActiveLease: activeLeaseId, currentOccupancyStatus: rental.occupancyStatus } });
      continue;
    }
    items.push({ contractId: contract._id, propertyId: property._id, rentalManagementId: rental._id, status: 'CONSISTENT', repairable: false });
  }

  const consistent = items.filter((item) => item.status === 'CONSISTENT');
  const repairable = items.filter((item) => item.repairable);
  const anomalies = items.filter((item) => !item.repairable && item.status !== 'CONSISTENT');

  return {
    scannedAt: new Date().toISOString(),
    totalActiveLeaseContracts: contracts.length,
    consistentCount: consistent.length,
    repairableCount: repairable.length,
    anomalyCount: anomalies.length,
    items,
  };
}

/**
 * Traduit le rapport de scan en actions concrètes — aucune écriture ici.
 */
function planRentalManagementReconciliation(report) {
  const actions = report.items
    .filter((item) => item.repairable)
    .map((item) => ({ contractId: item.contractId, propertyId: item.propertyId, reason: item.status }));
  return {
    plannedAt: new Date().toISOString(),
    actionCount: actions.length,
    actions,
    anomalies: report.items.filter((item) => !item.repairable && item.status !== 'CONSISTENT'),
  };
}

/**
 * Exécute le plan — idempotent (réutilise `syncLeaseOccupation`, qui
 * upsert le RentalManagement et court-circuite déjà si l'état cible est
 * déjà atteint). `actor` doit être l'ObjectId du staff qui lance le script.
 */
async function applyRentalManagementReconciliation({ plan, actor }) {
  const results = [];
  for (const action of plan.actions) {
    const contract = await Contrat.findById(action.contractId);
    if (!contract) {
      results.push({ ...action, outcome: 'SKIPPED_CONTRACT_NOT_FOUND' });
      continue;
    }
    const before = await RentalManagement.findOne({ property: action.propertyId }).select('_id managementActivated').lean();
    await syncLeaseOccupation(contract, actor);
    const after = await RentalManagement.findOne({ property: action.propertyId }).select('_id managementActivated activeLease occupancyStatus').lean();
    results.push({
      ...action,
      outcome: before ? 'UPDATED' : 'CREATED',
      rentalManagementId: after?._id || null,
      before: before || null,
      after: after || null,
    });
  }
  return { appliedAt: new Date().toISOString(), results };
}

module.exports = {
  scanRentalManagementConsistency,
  planRentalManagementReconciliation,
  applyRentalManagementReconciliation,
};
