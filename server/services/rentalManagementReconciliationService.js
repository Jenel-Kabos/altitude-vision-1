// GL-RECON-1 — moteur unique de diagnostic et de réconciliation des baux.
// Le scan et le plan sont strictement en lecture seule. L'apply ne traite
// que les cas prouvés réparables, revalide chaque action, puis réutilise le
// service officiel de synchronisation du cycle locatif.
const Contrat = require('../models/Contrat');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const Paiement = require('../models/Paiement');
const Locataire = require('../models/Locataire');
const Proprietaire = require('../models/Proprietaire');
const User = require('../models/User');
const { logAction, buildAuteur } = require('./actionLogService');
const { syncLeaseOccupation } = require('./rentalManagementLeaseSyncService');

const OPEN_STATUSES = ['en_attente', 'actif'];
const BLOCKED_AVAILABILITIES = ['Vendu', 'Retiré'];
const BLOCKED_ASSET_CYCLES = ['vendu', 'archive'];
const REPAIRABLE_STATUSES = new Set([
  'MISSING_RENTAL_MANAGEMENT',
  'RENTAL_MANAGEMENT_INACTIVE',
  'ACTIVE_LEASE_MISMATCH',
  'OCCUPATION_MISMATCH',
]);

const id = (value) => (value ? String(value?._id || value) : null);
const indexById = (rows) => new Map(rows.map((row) => [id(row), row]));

function summarizePayments(rows = []) {
  return rows.reduce((summary, payment) => {
    summary.count += 1;
    summary.expected += Number(payment.montantTotal ?? payment.montant ?? 0);
    summary.received += Number(payment.montantRecu ?? (payment.statut === 'payé' ? payment.montant : 0) ?? 0);
    summary.byStatus[payment.statut] = (summary.byStatus[payment.statut] || 0) + 1;
    return summary;
  }, { count: 0, expected: 0, received: 0, byStatus: {} });
}

function buildCounts(items, paymentIssues) {
  const consistent = items.filter((item) => item.status === 'CONSISTENT');
  const repairable = items.filter((item) => item.repairable);
  const conflicts = items.filter((item) => item.conflict);
  const duplicates = items.filter((item) => item.status === 'CONFLICT_MULTIPLE_OPEN_CONTRACTS');
  const anomalies = items.filter((item) => item.status !== 'CONSISTENT' && !item.repairable);
  return {
    consistentCount: consistent.length,
    repairableCount: repairable.length,
    ignoredCount: consistent.length,
    anomalyCount: anomalies.length + paymentIssues.length,
    conflictCount: conflicts.length,
    duplicateCount: duplicates.length,
  };
}

async function scanRentalManagementConsistency() {
  const [contracts, allPayments] = await Promise.all([
    Contrat.find({ type: 'location', statut: { $in: OPEN_STATUSES } })
      .select('_id bien locataire proprietaire montantLoyer statut cycleVie dateEntree dateFinBail').lean(),
    Paiement.find({}).select('_id contrat statut montant montantTotal montantRecu mois annee').lean(),
  ]);

  const propertyIds = [...new Set(contracts.map((contract) => id(contract.bien)).filter(Boolean))];
  const tenantIds = [...new Set(contracts.map((contract) => id(contract.locataire)).filter(Boolean))];
  const ownerIds = [...new Set(contracts.map((contract) => id(contract.proprietaire)).filter(Boolean))];
  const [properties, rentals, tenants, owners, referencedContracts] = await Promise.all([
    Property.find({ _id: { $in: propertyIds } }).select('_id status owner availability assetCycle title').lean(),
    RentalManagement.find({ property: { $in: propertyIds } })
      .select('_id property owner active managementActivated activeLease currentTenant occupancyStatus availabilityStatus').lean(),
    Locataire.find({ _id: { $in: tenantIds } }).select('_id').lean(),
    Proprietaire.find({ _id: { $in: ownerIds } }).select('_id user').lean(),
    Contrat.find({ _id: { $in: allPayments.map((payment) => payment.contrat).filter(Boolean) } }).select('_id type bien statut').lean(),
  ]);

  const propertyById = indexById(properties);
  const tenantById = indexById(tenants);
  const ownerById = indexById(owners);
  const rentalByProperty = new Map(rentals.map((rental) => [id(rental.property), rental]));
  const contractById = indexById(referencedContracts);
  const paymentsByContract = new Map();
  allPayments.forEach((payment) => {
    const contractId = id(payment.contrat);
    if (!paymentsByContract.has(contractId)) paymentsByContract.set(contractId, []);
    paymentsByContract.get(contractId).push(payment);
  });

  const openByProperty = new Map();
  contracts.forEach((contract) => {
    const propertyId = id(contract.bien);
    if (!propertyId) return;
    if (!openByProperty.has(propertyId)) openByProperty.set(propertyId, []);
    openByProperty.get(propertyId).push(contract);
  });

  const items = contracts.map((contract) => {
    const contractId = id(contract);
    const propertyId = id(contract.bien);
    const property = propertyById.get(propertyId);
    const rental = rentalByProperty.get(propertyId);
    const matrix = {
      contractId,
      contractStatus: contract.statut,
      propertyId,
      rentalManagementId: id(rental),
      occupancyStatus: rental?.occupancyStatus || null,
      paymentSummary: summarizePayments(paymentsByContract.get(contractId)),
      state: null,
    };
    const result = (status, extra = {}) => ({ ...matrix, status, state: status, repairable: REPAIRABLE_STATUSES.has(status), conflict: false, ...extra });

    if (!propertyId) return result('ANOMALY_NO_PROPERTY_REFERENCE', { case: 'C' });
    if (!property) return result('ANOMALY_PROPERTY_NOT_FOUND', { case: 'C' });
    if (property.status !== 'location') return result('ANOMALY_PROPERTY_TYPE_MISMATCH', { case: 'C', detail: { propertyStatus: property.status } });
    if (BLOCKED_AVAILABILITIES.includes(property.availability) || BLOCKED_ASSET_CYCLES.includes(property.assetCycle)) {
      return result('CONFLICT_PROPERTY_UNAVAILABLE', {
        case: 'E', conflict: true,
        detail: { availability: property.availability, assetCycle: property.assetCycle },
      });
    }
    if ((openByProperty.get(propertyId) || []).length > 1) {
      return result('CONFLICT_MULTIPLE_OPEN_CONTRACTS', {
        case: 'D', conflict: true,
        duplicateContractIds: openByProperty.get(propertyId).map(id),
      });
    }
    if (!contract.locataire || !tenantById.has(id(contract.locataire))) {
      return result('ANOMALY_TENANT_NOT_FOUND', { case: 'C', detail: { tenantId: id(contract.locataire) } });
    }
    if (!contract.proprietaire || !ownerById.has(id(contract.proprietaire))) {
      return result('ANOMALY_OWNER_NOT_FOUND', { case: 'C', detail: { ownerId: id(contract.proprietaire) } });
    }
    if (!rental) return result('MISSING_RENTAL_MANAGEMENT', { case: 'B' });
    if (id(rental.owner) !== id(property.owner)) {
      return result('CONFLICT_RENTAL_OWNER_MISMATCH', {
        case: 'E', conflict: true,
        detail: { propertyOwner: id(property.owner), rentalOwner: id(rental.owner) },
      });
    }
    if (!rental.active || !rental.managementActivated) {
      return result('RENTAL_MANAGEMENT_INACTIVE', {
        case: 'F',
        detail: { active: rental.active, managementActivated: rental.managementActivated },
      });
    }
    if (contract.statut === 'actif' && id(rental.activeLease) !== contractId) {
      return result('ACTIVE_LEASE_MISMATCH', { case: 'F', detail: { currentActiveLease: id(rental.activeLease) } });
    }
    if (contract.statut === 'actif' && (rental.occupancyStatus !== 'occupe' || id(rental.currentTenant) !== id(contract.locataire))) {
      return result('OCCUPATION_MISMATCH', {
        case: 'F',
        detail: { currentOccupancyStatus: rental.occupancyStatus, currentTenant: id(rental.currentTenant) },
      });
    }
    return result('CONSISTENT', { case: 'A' });
  });

  const paymentIssues = allPayments.flatMap((payment) => {
    const contract = contractById.get(id(payment.contrat));
    if (!contract) return [{ paymentId: id(payment), contractId: id(payment.contrat), status: 'PAYMENT_CONTRACT_NOT_FOUND' }];
    if (contract.type !== 'location') return [];
    if (!contract.bien) return [{ paymentId: id(payment), contractId: id(contract), status: 'PAYMENT_CONTRACT_WITHOUT_PROPERTY' }];
    return [];
  });
  const counts = buildCounts(items, paymentIssues);

  return {
    scannedAt: new Date().toISOString(),
    totalOpenLeaseContracts: contracts.length,
    totalActiveLeaseContracts: contracts.filter((contract) => contract.statut === 'actif').length,
    totalPayments: allPayments.length,
    ...counts,
    paymentIssueCount: paymentIssues.length,
    items,
    paymentIssues,
  };
}

function planRentalManagementReconciliation(report) {
  const actions = report.items
    .filter((item) => item.repairable && !item.conflict)
    .map((item) => ({ contractId: item.contractId, propertyId: item.propertyId, reason: item.status }));
  return {
    plannedAt: new Date().toISOString(),
    actionCount: actions.length,
    repairablePropertyCount: new Set(actions.map((action) => action.propertyId)).size,
    ignoredCount: report.ignoredCount,
    anomalyCount: report.anomalyCount,
    conflictCount: report.conflictCount,
    duplicateCount: report.duplicateCount,
    actions,
    anomalies: report.items.filter((item) => item.status !== 'CONSISTENT' && !item.repairable),
    paymentIssues: report.paymentIssues,
  };
}

async function applyRentalManagementReconciliation({ plan, actor }) {
  if (!actor) throw new Error('RECONCILIATION_ACTOR_REQUIRED');
  const actingUser = await User.findById(actor).select('_id name role email').lean();
  if (!actingUser || !['Admin', 'GestionnaireImmobilier'].includes(actingUser.role)) {
    throw new Error('RECONCILIATION_ACTOR_FORBIDDEN');
  }

  const results = [];
  for (const action of plan.actions) {
    const fresh = await scanRentalManagementConsistency();
    const item = fresh.items.find((candidate) => candidate.contractId === id(action.contractId));
    if (!item || !item.repairable || item.conflict || item.propertyId !== id(action.propertyId)) {
      results.push({ ...action, outcome: 'SKIPPED_REVALIDATION_FAILED', currentStatus: item?.status || 'CONTRACT_NOT_OPEN' });
      continue;
    }

    const contract = await Contrat.findById(action.contractId);
    const before = await RentalManagement.findOne({ property: action.propertyId }).lean();
    await syncLeaseOccupation(contract, actingUser._id);
    const after = await RentalManagement.findOne({ property: action.propertyId }).lean();
    const outcome = before ? 'UPDATED' : 'CREATED';

    await logAction({
      action: 'Réconciliation Gestion locative',
      description: `Réconciliation ${outcome.toLowerCase()} du bien ${action.propertyId} pour le contrat ${action.contractId}`,
      module: 'GestionLocative',
      auteur: buildAuteur(actingUser),
      cible: { id: String(after?._id || action.propertyId), type: 'RentalManagement', nom: `Réconciliation bail #${action.contractId}` },
      typeAction: before ? 'MODIFICATION' : 'CRÉATION',
      metadata: {
        ancienneValeur: JSON.stringify(before || null),
        nouvelleValeur: JSON.stringify(after || null),
      },
    });

    results.push({ ...action, outcome, rentalManagementId: id(after), before: before || null, after: after || null });
  }

  const verification = await scanRentalManagementConsistency();
  return {
    appliedAt: new Date().toISOString(),
    repairedCount: results.filter((result) => ['CREATED', 'UPDATED'].includes(result.outcome)).length,
    skippedCount: results.filter((result) => result.outcome.startsWith('SKIPPED')).length,
    results,
    verification,
  };
}

module.exports = {
  OPEN_STATUSES,
  scanRentalManagementConsistency,
  planRentalManagementReconciliation,
  applyRentalManagementReconciliation,
};
