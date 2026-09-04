const mongoose = require('mongoose');
const RentalManagement = require('../models/RentalManagement');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const { aggregatePaymentSummary, publicPayment } = require('./rentalPaymentProjectionService');

const pageOptions = (query = {}) => ({
  page: Math.max(Number.parseInt(query.page, 10) || 1, 1),
  limit: Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 50),
});

async function getOwnerPaymentPage(ownerUserId, query = {}) {
  const rentals = await RentalManagement.find({
    owner: ownerUserId,
    $or: [
      { managementActivated: true },
      { 'workflowHistory.action': 'rental_management_deactivated' },
    ],
  })
    .select('property owner managementActivated').lean();
  let propertyIds = rentals.map((row) => row.property).filter(Boolean);
  if (query.propertyId) {
    if (!mongoose.isValidObjectId(query.propertyId)) propertyIds = [];
    else propertyIds = propertyIds.filter((id) => String(id) === String(query.propertyId));
  }

  let leases = propertyIds.length ? await Contrat.find({ bien: { $in: propertyIds }, type: 'location' })
    .select('bien locataire statut dateEntree dateSortie dateFinBail montantLoyer')
    .populate([{ path: 'bien', select: 'title address city owner' }, { path: 'locataire', select: 'nom prenom' }])
    .lean() : [];
  if (query.contractId) {
    if (!mongoose.isValidObjectId(query.contractId)) leases = [];
    else leases = leases.filter((lease) => String(lease._id) === String(query.contractId));
  }

  const leaseIds = leases.map((lease) => lease._id);
  const leaseMap = new Map(leases.map((lease) => [String(lease._id), lease]));
  const match = { contrat: { $in: leaseIds } };
  if (query.status) match.statut = query.status;
  if (query.annee && Number.isFinite(Number(query.annee))) match.annee = Number(query.annee);
  const { page, limit } = pageOptions(query);
  const [payments, total, summary] = await Promise.all([
    Paiement.find(match).select('contrat mois annee montant montantTotal montantRecu statut modePaiement reference datePaiement penaliteAppliquee penaliteMontant retardJours jourEcheance').sort({ annee: -1, mois: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Paiement.countDocuments(match),
    aggregatePaymentSummary(Paiement, match),
  ]);
  const items = payments.map((payment) => {
    const normalized = publicPayment(payment);
    const lease = leaseMap.get(String(payment.contrat));
    return {
      ...normalized,
      property: lease?.bien ? { _id: lease.bien._id, title: lease.bien.title, address: lease.bien.address, city: lease.bien.city } : null,
      lease: lease ? { _id: lease._id, statut: lease.statut, tenantName: [lease.locataire?.prenom, lease.locataire?.nom].filter(Boolean).join(' ') || null } : null,
    };
  });
  return { items, summary, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

module.exports = { getOwnerPaymentPage };
