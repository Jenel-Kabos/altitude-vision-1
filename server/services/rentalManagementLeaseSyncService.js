// GL-ARCH-1.1 — Extrait de contratController.syncLeaseOccupation (comportement
// strictement inchangé) pour être réutilisable par le script de
// réconciliation historique (server/scripts/reconcileRentalManagement.js)
// sans dupliquer cette logique. Un bail (Contrat.type === 'location') signé
// implique toujours une gestion active — même si l'écran d'activation dédié
// (POST /api/rental-management) n'a jamais été utilisé pour ce bien.
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const RealEstateReservation = require('../models/RealEstateReservation');
const rentalSync = require('./rentalListingSyncService');

async function syncLeaseOccupation(contract, actor) {
  if (contract.type !== 'location' || !contract.bien) return null;
  const propertyId = contract.bien?._id || contract.bien;
  const property = await Property.findById(propertyId).select('_id owner status price');
  if (!property || property.status !== 'location') return null;
  const rental = await RentalManagement.findOneAndUpdate(
    { property: property._id },
    {
      $setOnInsert: { property: property._id, owner: property.owner, manager: actor },
      $set: { monthlyRent: contract.montantLoyer ?? property.price, managementActivated: true },
    },
    { new: true, upsert: true, runValidators: true },
  );
  if (contract.statut === 'actif') {
    await rentalSync.markPropertyRented(rental._id, { leaseId: contract._id, tenantId: contract.locataire, actor, source: 'contract' });
    if (contract.reservation) {
      await RealEstateReservation.updateOne(
        { _id: contract.reservation, status: 'active', contract: contract._id, expiresAt: { $gt: new Date() } },
        { $set: { status: 'converted' }, $push: { history: { from: 'active', to: 'converted', action: 'contract_activated', actor, at: new Date() } } },
      );
    }
  } else if (['résilié', 'expiré'].includes(contract.statut) && rental.activeLease?.toString() === contract._id.toString()) {
    await rentalSync.schedulePropertyExit(rental._id, { actor, source: 'contract' });
  }
  return rental;
}

module.exports = { syncLeaseOccupation };
