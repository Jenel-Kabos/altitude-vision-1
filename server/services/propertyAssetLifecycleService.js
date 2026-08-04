// GL-ASSET-1 — Phase 1 : machine d'état patrimoniale du bien, INDÉPENDANTE
// du bail (Contrat.cycleVie, GL-LIFE-1) — un bien traverse plusieurs baux
// au cours de sa vie. Même convention que rentalLeaseLifecycleService.js
// (table statique {état: [transitions autorisées]}, fonction unique
// `transition()`) : AUCUNE transition de `Property.assetCycle` ne doit être
// écrite ailleurs.
//
// `Property.availability` (champ historique, écrit par 3 sous-systèmes
// existants : rentalListingSyncService, realEstateApplicationService,
// realEstateTransactionFinalizationService) reste INCHANGÉ dans sa
// sémantique et continue d'être la source lue par tout le code existant —
// `assetCycle` est une granularité supplémentaire, synchronisée avec lui
// dès qu'elle est utilisée, jamais une source concurrente.
const Property = require('../models/Property');
const { notifyStaff } = require('./notificationService');

const ASSET_STATES = ['disponible', 'reserve', 'en_location', 'preavis', 'inspection', 'travaux', 'vendu', 'archive'];

const ASSET_TRANSITIONS = {
  disponible: ['reserve', 'en_location', 'travaux', 'vendu', 'archive'],
  reserve: ['en_location', 'vendu', 'disponible'],
  en_location: ['preavis'],
  preavis: ['inspection', 'en_location'],
  inspection: ['travaux', 'disponible'],
  travaux: ['disponible'],
  vendu: ['archive'],
  archive: [],
};

// Synchronisation avec le champ historique `Property.availability` — jamais
// de désynchronisation possible puisque toute transition passe par ici.
const AVAILABILITY_BY_CYCLE = {
  disponible: 'Disponible',
  reserve: 'Réservé',
  en_location: 'Loué',
  preavis: 'Loué',
  inspection: 'Indisponible',
  travaux: 'En maintenance',
  vendu: 'Vendu',
  archive: 'Retiré',
};

class AssetLifecycleError extends Error {
  constructor(message, statusCode = 409) { super(message); this.statusCode = statusCode; }
}

// Dérivation pour les biens créés AVANT ce sprint (`assetCycle` absent —
// aucune migration nécessaire) : approxime l'étape la plus probable depuis
// `availability`, uniquement pour amorcer la première transition ; jamais
// utilisé pour ré-écrire silencieusement le champ.
function deriveAssetCycle(property) {
  if (property.assetCycle) return property.assetCycle;
  const byAvailability = {
    Disponible: 'disponible', Réservé: 'reserve', Loué: 'en_location',
    Indisponible: 'disponible', 'En maintenance': 'travaux', Retiré: 'archive', Vendu: 'vendu',
  };
  return byAvailability[property.availability] || 'disponible';
}

async function appendHistoryAndNotify(property, { from, to, action, actor, comment }) {
  property.assetCycleHistory.push({ from, to, action, actor, comment });
  property.assetCycle = to;
  property.availability = AVAILABILITY_BY_CYCLE[to];
  await property.save();

  // GL-ASSET-UX-1 — `link` explicite : sans lui, ce type partagé
  // ('contrat_updated', réutilisé exprès plutôt que d'ajouter un nouveau
  // NOTIFICATION_TYPE — voir en-tête de fichier) hériterait par défaut du
  // lien STAFF_LINKS générique du bail (`/dashboard/gestion-locative/baux`,
  // GL-UX-1), qui n'a aucun sens pour un Property — jamais une notification
  // orpheline.
  notifyStaff({
    type: 'contrat_updated', title: 'Cycle de vie du bien mis à jour', body: `Le bien « ${property.title} » est passé à l'étape « ${to} ».`,
    entityType: 'Property', entityId: property._id, metadata: { assetCycle: to },
    link: `/dashboard/properties/${property._id}`,
  }).catch(() => {});
  return property;
}

// GL-ASSET-1 — point d'entrée UNIQUE pour faire avancer le cycle de vie
// patrimonial. `bestEffort:true` (utilisé par les hooks dans les flux
// existants) avale silencieusement une transition illégale plutôt que de
// faire échouer l'opération métier qui l'a déclenchée (réservation,
// activation locative, finalisation de vente...).
async function transition(propertyId, target, { actor, comment, action, bestEffort = false } = {}) {
  const property = await Property.findById(propertyId);
  if (!property) throw new AssetLifecycleError('Bien introuvable.', 404);
  if (!ASSET_STATES.includes(target)) throw new AssetLifecycleError(`État de cycle de vie inconnu : ${target}.`, 422);

  // Déjà EXPLICITEMENT à cette étape (le champ est réellement renseigné) —
  // vrai no-op. Comparer sur `property.assetCycle` et non sur la valeur
  // dérivée : les hooks best-effort s'exécutent APRÈS que le sous-système
  // appelant a déjà écrit `availability` (ex: markPropertyRented écrit
  // 'Loué' avant d'appeler ce hook), donc la valeur dérivée coïnciderait
  // déjà avec la cible même lors du tout premier engagement du bien sur
  // cette machine — un vrai no-op se reconnaît au champ stocké, jamais à la
  // dérivation.
  if (property.assetCycle === target) return property;

  // Bien jamais engagé sur la machine (`assetCycle` absent) ET appelé depuis
  // un hook best-effort : on AMORCE plutôt que de valider une transition
  // depuis un état "actuel" dérivé d'une `availability` que le sous-système
  // appelant vient tout juste de modifier lui-même (même principe que
  // deriveCycleVie en GL-LIFE-1, "uniquement pour amorcer la première
  // transition"). Un appel EXPLICITE (API/staff, bestEffort=false) reste
  // toujours strictement validé — jamais de contournement de la machine
  // d'état pour une action déclenchée par un utilisateur.
  const bootstrap = bestEffort && !property.assetCycle;
  const current = deriveAssetCycle(property);
  if (!bootstrap) {
    const allowed = ASSET_TRANSITIONS[current] || [];
    if (!allowed.includes(target)) {
      if (bestEffort) return property;
      throw new AssetLifecycleError(`Transition invalide : ${current} → ${target}.`, 409);
    }
  }

  return appendHistoryAndNotify(property, { from: bootstrap ? null : current, to: target, action: action || `${bootstrap ? 'bootstrap' : 'transition'}_${target}`, actor, comment });
}

// Expose la table de transitions pour UN bien donné — le frontend n'a
// jamais à connaître/dupliquer `ASSET_TRANSITIONS`.
async function getAvailableTransitions(propertyId) {
  const property = await Property.findById(propertyId).select('assetCycle availability');
  if (!property) throw new AssetLifecycleError('Bien introuvable.', 404);
  const current = deriveAssetCycle(property);
  return { assetCycle: current, allowed: ASSET_TRANSITIONS[current] || [] };
}

module.exports = {
  ASSET_STATES, ASSET_TRANSITIONS, AVAILABILITY_BY_CYCLE, AssetLifecycleError,
  deriveAssetCycle, transition, getAvailableTransitions,
};
