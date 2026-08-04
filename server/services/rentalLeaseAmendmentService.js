// GL-LIFE-1 — Phase 4 : workflow d'avenant. Un avenant modifie un bail
// existant (loyer, durée, clauses, dépôt de garantie, annexes) SANS jamais
// recréer le Contrat ni écraser l'historique — append-only sur
// `Contrat.avenants[]`. Jamais de transition de cycle de vie ici (un
// avenant ne change pas l'étape du bail, sauf pour le cas 'renouvellement'
// qui reste, par la règle métier validée, une simple prolongation du même
// contrat — voir rentalLeaseRenewalService.js qui appelle ce module).
const Contrat = require('../models/Contrat');
const { LifecycleError } = require('./rentalLeaseLifecycleService');
const { notifyStaff } = require('./notificationService');
const { notifyContractTenant } = require('./rentalTenantNotificationService');

// Champs du bail qu'un avenant est autorisé à modifier directement sur le
// Contrat (en plus de l'entrée d'historique) — toute autre information
// (clauses, annexes) reste uniquement descriptive dans `champsModifies`.
const MUTABLE_FIELDS = {
  montantLoyer: 'loyer',
  dateFinBail: 'duree',
  montantCaution: 'depot_garantie',
};

// GL-UX-1 — extrait pour être réutilisé par rentalLeaseRenewalService.js
// (aperçu de renouvellement) SANS dupliquer cette logique de diff : le
// frontend n'a jamais à recalculer lui-même quel champ a réellement changé
// ("aucune logique métier dans React").
function buildChampsModifies(contrat, changes = {}) {
  const champsModifies = [];
  Object.entries(changes).forEach(([champ, apres]) => {
    if (apres === undefined) return;
    const avant = contrat[champ];
    if (String(avant ?? '') === String(apres ?? '')) return; // pas de changement réel — jamais d'entrée vide
    champsModifies.push({ champ, avant, apres });
  });
  return champsModifies;
}

async function addAvenant(contratId, { type, motif, dateEffet, actor, changes = {} } = {}) {
  const contrat = await Contrat.findById(contratId);
  if (!contrat) throw new LifecycleError('Contrat introuvable.', 404);
  if (contrat.type !== 'location') throw new LifecycleError('Les avenants ne concernent que les baux de location.', 422);

  const champsModifies = buildChampsModifies(contrat, changes);
  champsModifies.forEach(({ champ, apres }) => {
    if (Object.prototype.hasOwnProperty.call(MUTABLE_FIELDS, champ)) {
      contrat[champ] = apres;
    }
  });

  if (champsModifies.length === 0) {
    throw new LifecycleError('Un avenant doit modifier au moins un champ réel du bail.', 422);
  }

  contrat.avenants.push({ type, champsModifies, motif, dateEffet: dateEffet || new Date(), creePar: actor });
  await contrat.save();

  notifyStaff({
    type: 'rental_amendment_created', title: 'Avenant créé', body: `Un avenant (${type}) a été ajouté au bail #${contrat._id}.`,
    entityType: 'Contrat', entityId: contrat._id, metadata: { type },
  }).catch(() => {});
  notifyContractTenant(contrat, {
    type: 'rental_amendment_created', title: 'Avenant à votre bail', body: 'Un avenant a été ajouté à votre bail.',
    entityType: 'Contrat', entityId: contrat._id, dedupeKey: `tenant:amendment:${contrat._id}:${contrat.avenants[contrat.avenants.length - 1]._id}`,
  }).catch(() => {});

  return contrat;
}

module.exports = { addAvenant, MUTABLE_FIELDS, buildChampsModifies };
