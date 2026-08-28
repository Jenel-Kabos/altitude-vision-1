const mongoose = require('mongoose');
const Property = require('../../models/Property');
const RentalManagement = require('../../models/RentalManagement');
const Contrat = require('../../models/Contrat');
const Paiement = require('../../models/Paiement');
const RentalMaintenanceTicket = require('../../models/RentalMaintenanceTicket');

// Owner canonique read-only des KPI de gestion locative. Le scope est fourni
// par l'appelant ; ce service ne décide ni tenant, ni IAM, ni PlatformOperator.
async function getRentalReportData({ scopeUserIds = null } = {}) {
  const now = new Date(); const soon = new Date(now.getTime() + 30 * 86400000);
  if (scopeUserIds instanceof Set) scopeUserIds = [...scopeUserIds];
  if (scopeUserIds) scopeUserIds = scopeUserIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const properties = scopeUserIds ? await Property.find({ owner: { $in: scopeUserIds } }).distinct('_id') : null;
  const rentalFilter = properties ? { property: { $in: properties } } : {};
  const contractFilter = properties ? { bien: { $in: properties } } : {};
  const contractsInScope = properties ? await Contrat.find(contractFilter).distinct('_id') : null;
  const [management, contracts, payments, maintenance] = await Promise.all([
    RentalManagement.aggregate([{ $match: { managementActivated: true, ...rentalFilter } }, { $group: { _id: null, available: { $sum: { $cond: [{ $eq: ['$availabilityStatus', 'disponible'] }, 1, 0] } }, occupied: { $sum: { $cond: [{ $eq: ['$occupancyStatus', 'occupe'] }, 1, 0] } }, notices: { $sum: { $cond: [{ $eq: ['$occupancyStatus', 'preavis'] }, 1, 0] } } } }]),
    Contrat.aggregate([{ $match: { type: 'location', ...contractFilter } }, { $group: { _id: null, activeContracts: { $sum: { $cond: [{ $eq: ['$statut', 'actif'] }, 1, 0] } }, expiringContracts: { $sum: { $cond: [{ $and: [{ $eq: ['$statut', 'actif'] }, { $gte: ['$dateFinBail', now] }, { $lte: ['$dateFinBail', soon] }] }, 1, 0] } } } }]),
    Paiement.aggregate([{ $match: contractsInScope ? { contrat: { $in: contractsInScope } } : {} }, { $group: { _id: null, rentCollected: { $sum: { $ifNull: ['$montantRecu', 0] } }, unpaidRent: { $sum: { $cond: [{ $in: ['$statut', ['impayé', 'en_retard', 'partiel']] }, { $max: [{ $subtract: [{ $ifNull: ['$montantTotal', '$montant'] }, { $ifNull: ['$montantRecu', 0] }] }, 0] }, 0] } }, penalties: { $sum: { $cond: ['$penaliteAppliquee', '$penaliteMontant', 0] } } } }]),
    RentalMaintenanceTicket.countDocuments({ status: { $in: RentalMaintenanceTicket.OPEN_RENTAL_MAINTENANCE_STATUSES }, ...(properties ? { property: { $in: properties } } : {}) }),
  ]);
  return { kpis: { ...(management[0] || { available: 0, occupied: 0, notices: 0 }), ...(contracts[0] || { activeContracts: 0, expiringContracts: 0 }), ...(payments[0] || { rentCollected: 0, unpaidRent: 0, penalties: 0 }), maintenance } };
}

module.exports = { getRentalReportData };
