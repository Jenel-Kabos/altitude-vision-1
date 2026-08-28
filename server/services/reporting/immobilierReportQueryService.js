const mongoose = require('mongoose');
const Property = require('../../models/Property');
const Transaction = require('../../models/Transaction');
const Visite = require('../../models/Visite');

async function getImmobilierReportData({ scopeUserIds = null } = {}) {
  const now = new Date();
  if (scopeUserIds instanceof Set) scopeUserIds = [...scopeUserIds];
  if (scopeUserIds) scopeUserIds = scopeUserIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const propertyFilter = { status: 'vente', ...(scopeUserIds ? { owner: { $in: scopeUserIds } } : {}) };
  const ids = await Property.find(propertyFilter).distinct('_id');
  const [properties, visits, transactions, recent] = await Promise.all([
    Property.aggregate([{ $match: propertyFilter }, { $group: { _id: null, total: { $sum: 1 }, published: { $sum: { $cond: [{ $and: [{ $eq: ['$statusAdmin', 'Validée'] }, { $eq: ['$isPublished', true] }, { $eq: ['$availability', 'Disponible'] }, { $eq: ['$pole', 'Altimmo'] }] }, 1, 0] } }, drafts: { $sum: { $cond: [{ $or: [{ $ne: ['$statusAdmin', 'Validée'] }, { $ne: ['$isPublished', true] }] }, 1, 0] } }, sold: { $sum: { $cond: [{ $eq: ['$availability', 'Vendu'] }, 1, 0] } }, active: { $sum: { $cond: [{ $eq: ['$availability', 'Disponible'] }, 1, 0] } } } }]),
    Visite.countDocuments({ property: { $in: ids }, scheduledStartAt: { $gte: now }, statut: { $nin: ['Terminée', 'Annulée'] } }),
    Transaction.aggregate([{ $match: { transactionType: 'vente', property: { $in: ids } } }, { $group: { _id: null, pendingOffers: { $sum: { $cond: [{ $in: ['$status', ['En cours', 'Paiement en attente']] }, 1, 0] } }, salesAmount: { $sum: { $cond: [{ $eq: ['$status', 'Réussie'] }, '$finalAmount', 0] } }, commissions: { $sum: { $cond: [{ $eq: ['$status', 'Réussie'] }, '$commission.agencyNet', 0] } } } }]),
    Transaction.find({ transactionType: 'vente', status: 'Réussie', property: { $in: ids } }).sort({ transactionDate: -1 }).limit(5).select('property finalAmount commission.agencyNet transactionDate').populate('property', 'title').lean(),
  ]);
  return { kpis: { ...(properties[0] || { total: 0, published: 0, drafts: 0, sold: 0, active: 0 }), scheduledVisits: visits, ...(transactions[0] || { pendingOffers: 0, salesAmount: 0, commissions: 0 }) }, recent };
}

module.exports = { getImmobilierReportData };
