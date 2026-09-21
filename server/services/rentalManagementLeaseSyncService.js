// GL-ARCH-1.1 — Extrait de contratController.syncLeaseOccupation (comportement
// strictement inchangé) pour être réutilisable par le script de
// réconciliation historique (server/scripts/reconcileRentalManagement.js)
// sans dupliquer cette logique. Un bail (Contrat.type === 'location') signé
// implique toujours une gestion active — même si l'écran d'activation dédié
// (POST /api/rental-management) n'a jamais été utilisé pour ce bien.
//
// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-H.1 — cette voie d'activation
// (side-effect d'un save Contrat) doit AUSSI passer par la garde de quota
// canonique. Si le quota est atteint, on refuse l'activation avec
// TENANT_MANAGED_PROPERTY_QUOTA_EXCEEDED ; le contrôleur appelant décide
// alors de rollback ou d'exposer l'erreur telle quelle.
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const RealEstateReservation = require('../models/RealEstateReservation');
const rentalSync = require('./rentalListingSyncService');
const { withActivationQuotaGuard } = require('./rentalManagementQuotaService');

async function ensureRentalManagementActive({ property, actor, monthlyRent }) {
  const propertyId = property?._id || property;
  const resolvedProperty = property?.status && property?.tenant !== undefined
    ? property
    : await Property.findById(propertyId).select('_id owner status price tenant');
  if (!resolvedProperty || resolvedProperty.status !== 'location') return null;

  // Fast-path : si le RentalManagement existe déjà et est actif, on n'incrémente
  // pas l'usage — pas de contrôle de quota (l'invariant activeManagedCount ne
  // change pas).
  const existing = await RentalManagement.findOne({ property: resolvedProperty._id })
    .select('_id managementActivated tenant');
  if (existing?.managementActivated) {
    return RentalManagement.findOneAndUpdate(
      { _id: existing._id },
      { $set: { active: true, monthlyRent: monthlyRent ?? resolvedProperty.price } },
      { new: true, runValidators: true },
    );
  }

  let rental = null;
  await withActivationQuotaGuard({
    tenantId: resolvedProperty.tenant || null,
    run: async (session) => {
      const opts = session ? { new: true, upsert: true, runValidators: true, session } : { new: true, upsert: true, runValidators: true };
      rental = await RentalManagement.findOneAndUpdate(
        { property: resolvedProperty._id, managementActivated: { $ne: true } },
        {
          $setOnInsert: { property: resolvedProperty._id, owner: resolvedProperty.owner, manager: actor },
          $set: {
            active: true,
            managementActivated: true,
            tenant: resolvedProperty.tenant || null,
            monthlyRent: monthlyRent ?? resolvedProperty.price,
          },
        },
        opts,
      );
    },
  });
  return rental;
}

async function syncLeaseOccupation(contract, actor) {
  if (contract.type !== 'location' || !contract.bien) return null;
  const propertyId = contract.bien?._id || contract.bien;
  const property = await Property.findById(propertyId).select('_id owner status price tenant');
  if (!property || property.status !== 'location') return null;
  const rental = await ensureRentalManagementActive({
    property,
    actor,
    monthlyRent: contract.montantLoyer,
  });
  if (!rental) return null;
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

module.exports = { ensureRentalManagementActive, syncLeaseOccupation };
