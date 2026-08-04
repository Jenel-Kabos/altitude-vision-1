// GL-LIFE-1 — Machine d'état centralisée du cycle de vie d'un bail
// (Contrat de type 'location'). Suit la même convention que
// `RentalMaintenanceTicket.RENTAL_MAINTENANCE_STATUS_TRANSITIONS` (table
// statique {état: [transitions autorisées]}) : AUCUNE transition de
// `Contrat.cycleVie` ne doit être écrite ailleurs que par `transition()`
// ci-dessous. `Contrat.statut` (champ légal déjà utilisé par l'index
// unique, le portail locataire et le Centre documentaire DOC-EVO-1/2) reste
// inchangé dans sa sémantique — il est maintenu synchronisé avec
// `cycleVie` par ce service, jamais écrit indépendamment pour un contrat de
// location une fois ce sprint en place (voir contratController.update).
const Contrat = require('../models/Contrat');
const { notifyStaff } = require('./notificationService');
const { notifyContractTenant } = require('./rentalTenantNotificationService');

const LEASE_STATES = ['projet', 'en_preparation', 'a_signer', 'actif', 'preavis', 'inspection_sortie', 'cloture_financiere', 'resilie', 'archive'];

const LEASE_TRANSITIONS = {
  projet: ['en_preparation'],
  en_preparation: ['a_signer'],
  a_signer: ['actif'],
  actif: ['preavis', 'resilie'],
  preavis: ['inspection_sortie', 'actif'], // 'actif' = annulation du préavis
  inspection_sortie: ['cloture_financiere'],
  cloture_financiere: ['resilie'],
  resilie: ['archive'],
  archive: [],
};

// Synchronisation avec le champ légal existant `Contrat.statut` — jamais de
// désynchronisation possible puisque toute transition passe par ici.
const STATUT_BY_CYCLE = {
  projet: 'en_attente',
  en_preparation: 'en_attente',
  a_signer: 'en_attente',
  actif: 'actif',
  preavis: 'actif',
  inspection_sortie: 'actif',
  cloture_financiere: 'actif',
  resilie: 'résilié',
  archive: 'résilié',
};

class LifecycleError extends Error {
  constructor(message, statusCode = 409) { super(message); this.statusCode = statusCode; }
}

// Dérivation pour les contrats créés AVANT ce sprint (`cycleVie` absent —
// aucune migration nécessaire) : approxime l'étape la plus probable à
// partir des champs déjà existants, uniquement pour amorcer la première
// transition ; jamais utilisé pour ré-écrire silencieusement le champ.
function deriveCycleVie(contrat) {
  if (contrat.cycleVie) return contrat.cycleVie;
  if (contrat.statut === 'en_attente') return 'a_signer';
  if (contrat.statut === 'actif') return 'actif';
  return 'resilie'; // résilié / expiré
}

// Correspondance la plus proche pour une demande brute de changement de
// `statut` (ex: via contratController.update) — refuse toute demande qui ne
// correspond à aucune transition légale depuis l'état courant.
function nearestCycleForStatut(currentCycle, requestedStatut) {
  const candidates = Object.entries(STATUT_BY_CYCLE).filter(([, statut]) => statut === requestedStatut).map(([cycle]) => cycle);
  return candidates.find((cycle) => (LEASE_TRANSITIONS[currentCycle] || []).includes(cycle)) || null;
}

async function appendHistoryAndNotify(contrat, { from, to, action, actor, comment }) {
  contrat.cycleHistory.push({ from, to, action, actor, comment });
  contrat.cycleVie = to;
  contrat.statut = STATUT_BY_CYCLE[to];
  await contrat.save();

  notifyStaff({
    type: 'contrat_updated', title: 'Cycle de vie du bail mis à jour', body: `Le bail #${contrat._id} est passé à l'étape « ${to} ».`,
    entityType: 'Contrat', entityId: contrat._id, metadata: { cycleVie: to },
  }).catch(() => {});
  return contrat;
}

// GL-LIFE-1 — point d'entrée UNIQUE pour faire avancer le cycle de vie.
async function transition(contratId, target, { actor, comment, action } = {}) {
  const contrat = await Contrat.findById(contratId);
  if (!contrat) throw new LifecycleError('Contrat introuvable.', 404);
  if (contrat.type !== 'location') throw new LifecycleError('Le cycle de vie du bail ne concerne que les contrats de location.', 422);
  if (!LEASE_STATES.includes(target)) throw new LifecycleError(`État de cycle de vie inconnu : ${target}.`, 422);

  const current = deriveCycleVie(contrat);
  const allowed = LEASE_TRANSITIONS[current] || [];
  if (!allowed.includes(target)) {
    throw new LifecycleError(`Transition invalide : ${current} → ${target}.`, 409);
  }

  await appendHistoryAndNotify(contrat, { from: current, to: target, action: action || `transition_${target}`, actor, comment });

  if (target === 'inspection_sortie') {
    notifyStaff({ type: 'rental_exit_inspection_cleared', title: 'Inspection de sortie', body: `Le bail #${contrat._id} est en inspection de sortie.`, entityType: 'Contrat', entityId: contrat._id }).catch(() => {});
  }
  if (target === 'archive') {
    notifyStaff({ type: 'rental_lease_archived', title: 'Bail archivé', body: `Le bail #${contrat._id} a été archivé.`, entityType: 'Contrat', entityId: contrat._id }).catch(() => {});
    notifyContractTenant(contrat, { type: 'rental_lease_archived', title: 'Bail archivé', body: 'Votre bail a été archivé.', entityType: 'Contrat', entityId: contrat._id, dedupeKey: `tenant:lease_archived:${contrat._id}` }).catch(() => {});
  }

  return contrat;
}

// Utilisé par contratController.update quand `req.body.statut` change : la
// machine d'état devient l'unique porte d'entrée, y compris pour cette
// route historique (aucune transition ne doit la contourner).
async function requestStatutChange(contratId, requestedStatut, { actor, comment } = {}) {
  const contrat = await Contrat.findById(contratId);
  if (!contrat) throw new LifecycleError('Contrat introuvable.', 404);
  if (contrat.type !== 'location') return contrat; // hors périmètre (vente) — inchangé
  if (contrat.statut === requestedStatut) return contrat; // pas de changement demandé

  const current = deriveCycleVie(contrat);
  const target = nearestCycleForStatut(current, requestedStatut);
  if (!target) {
    throw new LifecycleError(`Transition de statut invalide depuis l'étape actuelle du cycle de vie (${current}) vers « ${requestedStatut} ».`, 409);
  }
  return transition(contrat._id, target, { actor, comment, action: `statut_request_${requestedStatut}` });
}

// GL-UX-1 — expose la table de transitions déjà existante pour UN contrat
// donné, afin que le frontend n'ait JAMAIS à connaître/dupliquer
// `LEASE_TRANSITIONS` ("aucune logique métier dans React") : il se contente
// d'afficher les boutons pour les cibles renvoyées ici.
async function getAvailableTransitions(contratId) {
  const contrat = await Contrat.findById(contratId).select('type cycleVie statut');
  if (!contrat) throw new LifecycleError('Contrat introuvable.', 404);
  if (contrat.type !== 'location') return { cycleVie: null, allowed: [] };
  const current = deriveCycleVie(contrat);
  return { cycleVie: current, allowed: LEASE_TRANSITIONS[current] || [] };
}

module.exports = {
  LEASE_STATES, LEASE_TRANSITIONS, STATUT_BY_CYCLE, LifecycleError,
  deriveCycleVie, transition, requestStatutChange, getAvailableTransitions,
};
