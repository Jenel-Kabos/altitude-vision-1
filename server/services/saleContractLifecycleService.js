// SCL-2 — Machine d'état centralisée du cycle de vie d'un contrat de VENTE
// (Contrat.type='vente'). Même convention que rentalLeaseLifecycleService.js
// (table statique {état: [transitions autorisées]}, dérivation depuis les
// champs déjà persistés, CAS-style transition) : AUCUNE transition de
// `Contrat.saleCycle` ne doit être écrite ailleurs que par ce service.
//
// Frontière d'ownership (SCL-1 §2, §10) :
//   - Ce service NE calcule PAS de commission.
//   - NE finalise PAS de Transaction.
//   - N'écrit PAS `Property.availability`.
//   - NE crée PAS de facture ni d'entrée de ledger.
//   - NE convertit PAS de réservation.
//   - N'enregistre PAS de paiement.
// La transition vers `acte_signe` LIT l'état de Transaction (source de
// vérité financière/commerciale) et n'y écrit RIEN. Toute finalisation
// financière reste orchestrée par realEstateTransactionFinalizationService.

const Contrat = require('../models/Contrat');
const Transaction = require('../models/Transaction');
const { notifyStaff } = require('./notificationService');

const SALE_STATES = ['projet_vente', 'compromis_signe', 'acte_signe'];

const SALE_TRANSITIONS = {
  projet_vente: ['compromis_signe'],
  compromis_signe: ['acte_signe'],
  acte_signe: [], // terminal core — les états d'annulation/résiliation/archive
                   // sont DIFFERÉS (voir SCL-2 §5 : ne peuvent être implémentés
                   // sans toucher à l'autorité financière/platform).
};

// Synchronisation avec le champ légal existant `Contrat.statut` — même
// convention que rentalLeaseLifecycleService.STATUT_BY_CYCLE. Après
// `acte_signe`, `statut='actif'` reflète le contrat exécuté (compat.
// existante : le contrat de vente signé est actif au sens historique).
const STATUT_BY_SALE_CYCLE = {
  projet_vente: 'en_attente',
  compromis_signe: 'en_attente',
  acte_signe: 'actif',
};

class SaleLifecycleError extends Error {
  constructor(message, statusCode = 409, code = 'CONTRACT_ILLEGAL_TRANSITION') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Dérivation pour les contrats créés AVANT ce sprint (`saleCycle` absent —
// aucune migration nécessaire) : l'ordre de priorité s'appuie uniquement
// sur les champs déjà persistés (dateSignatureActe > dateSignatureCompromis).
// `statut='résilié'`/'expiré' n'est PAS interprété comme un état de cycle
// de vie — la sémantique historique ne le supporte pas (voir SCL-2 §6).
function deriveSaleCycle(contrat) {
  if (contrat.saleCycle) return contrat.saleCycle;
  if (contrat.dateSignatureActe) return 'acte_signe';
  if (contrat.dateSignatureCompromis) return 'compromis_signe';
  return 'projet_vente';
}

// Champs verrouillés après `acte_signe` : le contrat signé est un instantané
// légal/financier. `notes` et `documents` restent modifiables (ajout de
// pièces justificatives post-signature = workflow existant).
const POST_ACTE_LOCKED_FIELDS = new Set([
  'prixVente',
  'commissionAgence',
  'dateSignatureCompromis',
  'dateSignatureActe',
  'acheteur',
  'bien',
  'conditionsSuspensives',
]);

function assertNotPostActeLocked(contrat, payload) {
  const current = deriveSaleCycle(contrat);
  if (current !== 'acte_signe') return;
  // Une réécriture strictement idempotente d'un champ verrouillé (mêmes
  // valeurs légales, ex: retry PUT avec le même dateSignatureActe) n'est
  // PAS une mutation : elle n'affecte ni l'historique ni les invariants.
  // Seuls les champs dont la valeur change réellement sont bloqués.
  const violating = Object.keys(payload || {}).filter((k) => {
    if (!POST_ACTE_LOCKED_FIELDS.has(k)) return false;
    const before = contrat[k];
    const after = payload[k];
    if (before instanceof Date || after instanceof Date || (typeof before === 'string' && k.startsWith('date')) || (typeof after === 'string' && k.startsWith('date'))) {
      const b = before ? new Date(before).getTime() : null;
      const a = after ? new Date(after).getTime() : null;
      return b !== a;
    }
    return JSON.stringify(before ?? null) !== JSON.stringify(after ?? null);
  });
  if (violating.length) {
    throw new SaleLifecycleError(
      `Champ(s) immuables après signature de l'acte : ${violating.join(', ')}.`,
      409,
      'CONTRACT_POST_ACTE_IMMUTABLE',
    );
  }
}

// Étant donné un payload PUT contenant potentiellement `dateSignatureCompromis`
// et/ou `dateSignatureActe`, détermine la transition demandée. Refuse tout
// saut single-step (projet_vente → acte_signe direct).
function planTransition(contrat, payload) {
  const current = deriveSaleCycle(contrat);
  const compromisRequested = Object.prototype.hasOwnProperty.call(payload, 'dateSignatureCompromis') && payload.dateSignatureCompromis;
  const acteRequested = Object.prototype.hasOwnProperty.call(payload, 'dateSignatureActe') && payload.dateSignatureActe;

  if (!compromisRequested && !acteRequested) {
    return { current, target: null, kind: 'noop' };
  }

  // Deux dates fournies simultanément sur un projet_vente → saut illégal.
  if (compromisRequested && acteRequested && current === 'projet_vente') {
    throw new SaleLifecycleError(
      'Transition invalide : projet_vente → acte_signe direct interdit. Signer d’abord le compromis.',
      409,
      'CONTRACT_ILLEGAL_TRANSITION',
    );
  }

  if (acteRequested) {
    // Idempotence : dateSignatureActe déjà persistée à même valeur.
    if (current === 'acte_signe' && contrat.dateSignatureActe
        && new Date(contrat.dateSignatureActe).getTime() === new Date(acteRequested).getTime()) {
      return { current, target: 'acte_signe', kind: 'idempotent' };
    }
    if (!SALE_TRANSITIONS[current].includes('acte_signe')) {
      throw new SaleLifecycleError(
        `Transition invalide : ${current} → acte_signe.`,
        409,
        'CONTRACT_ILLEGAL_TRANSITION',
      );
    }
    return { current, target: 'acte_signe', kind: 'transition' };
  }

  // compromisRequested only
  if (current === 'compromis_signe' && contrat.dateSignatureCompromis
      && new Date(contrat.dateSignatureCompromis).getTime() === new Date(compromisRequested).getTime()) {
    return { current, target: 'compromis_signe', kind: 'idempotent' };
  }
  if (current === 'acte_signe') {
    throw new SaleLifecycleError(
      'Contrat déjà signé (acte) : modification du compromis interdite.',
      409,
      'CONTRACT_POST_ACTE_IMMUTABLE',
    );
  }
  if (!SALE_TRANSITIONS[current].includes('compromis_signe')) {
    throw new SaleLifecycleError(
      `Transition invalide : ${current} → compromis_signe.`,
      409,
      'CONTRACT_ILLEGAL_TRANSITION',
    );
  }
  return { current, target: 'compromis_signe', kind: 'transition' };
}

// Pré-conditions structurelles de projet → compromis, strictement basées
// sur les champs déjà persistables/persistés via le PUT typé (SCL-2 §8 —
// « Do not add requirements unsupported by the current model »). Un
// `acheteur` identifiable est FORTEMENT recommandé mais reste optionnel
// à ce stade : plusieurs parcours (staff manuel avant identification du
// client) créent le compromis avant que l'acheteur ne soit collecté.
function assertReadyForCompromis(contrat) {
  const missing = [];
  if (!contrat.bien) missing.push('bien');
  if (contrat.prixVente == null || contrat.prixVente <= 0) missing.push('prixVente');
  if (missing.length) {
    throw new SaleLifecycleError(
      `Champ(s) requis pour signer le compromis : ${missing.join(', ')}.`,
      409,
      'CONTRACT_COMPROMIS_PRECONDITION_FAILED',
    );
  }
}

// Assertion canonique de finalisation Transaction avant `acte_signe`. Le
// service NE finalise PAS la Transaction — il LIT son état. La Transaction
// doit être trouvée pour le même `bien`, en type='vente', avec
// `status='Réussie'` (signal canonique de finalisation par
// realEstateTransactionFinalizationService).
async function findFinalizedSaleTransaction(contrat) {
  if (!contrat.bien) return null;
  return Transaction.findOne({
    property: contrat.bien,
    transactionType: 'vente',
    status: 'Réussie',
  }).select('_id property transactionType status finalAmount commission finalization');
}

async function assertSaleTransactionFinalized(contrat) {
  const tx = await findFinalizedSaleTransaction(contrat);
  if (!tx) {
    throw new SaleLifecycleError(
      'La Transaction commerciale n’est pas finalisée : impossible de signer l’acte.',
      409,
      'SALE_TRANSACTION_NOT_FINALIZED',
    );
  }
  return tx;
}

// SCL-3 — durcissement CAS legacy : le prédicat « saleCycle:null » ne peut
// jamais servir d'oracle générique. Il DOIT être accompagné de l'évidence
// persistée qui prouve que la dérivation `deriveSaleCycle` renvoie
// exactement `from`, sinon un appel concurrent avec un `from` incorrect
// pourrait apparier un contrat legacy dont l'état réel est différent.
// Sans cette évidence, la ligne « legacy null » du CAS serait trop laxe
// (par exemple : deux transitions distinctes prétendant partir de
// `projet_vente` ou `compromis_signe` du même contrat legacy — la
// première atteint la base et écrit son état, mais si `commitTransition`
// est ré-appelée avec un mauvais `from` par erreur d'orchestration, la
// version durcie du CAS refuse toujours d'apparier).
function legacyEvidenceForFrom(from) {
  if (from === 'projet_vente') return { dateSignatureCompromis: null, dateSignatureActe: null };
  if (from === 'compromis_signe') return { dateSignatureCompromis: { $ne: null }, dateSignatureActe: null };
  if (from === 'acte_signe') return { dateSignatureActe: { $ne: null } };
  return null;
}

// Applique une transition avec CAS sur `saleCycle` (état attendu = from).
// Deux appels concurrents ne peuvent pas tous les deux gagner : le
// findOneAndUpdate n'appariera qu'une seule pré-image.
async function commitTransition({ contratId, from, to, actor, comment, extraSet }) {
  const statut = STATUT_BY_SALE_CYCLE[to];
  const now = new Date();
  const historyEntry = { from, to, action: `transition_${to}`, actor, comment, at: now };
  const evidence = legacyEvidenceForFrom(from) || {};
  // Le CAS accepte deux pré-images distinctes : (1) `saleCycle=from` posé
  // par une transition précédente de la machine ; (2) contrat legacy
  // (`saleCycle=null`) DONT l'évidence persistée prouve que la dérivation
  // renvoie `from` (SCL-3 §2/§4). Aucun autre cas.
  const cond = { _id: contratId, type: 'vente', $or: [{ saleCycle: from }, { saleCycle: null, ...evidence }] };
  const updated = await Contrat.findOneAndUpdate(
    cond,
    {
      $set: { saleCycle: to, statut, ...(extraSet || {}) },
      $push: { saleCycleHistory: historyEntry },
    },
    { new: true, runValidators: true },
  );
  if (!updated) {
    throw new SaleLifecycleError(
      'La transition a été interrompue par une écriture concurrente.',
      409,
      'CONTRACT_TRANSITION_CONFLICT',
    );
  }
  notifyStaff({
    type: 'contrat_updated',
    title: 'Cycle de vie du contrat de vente mis à jour',
    body: `Le contrat de vente #${contratId} est passé à l'étape « ${to} ».`,
    entityType: 'Contrat', entityId: contratId, metadata: { saleCycle: to },
  }).catch(() => {});
  return updated;
}

// Interprète un PUT typé `/api/contrats/vente/:id` : décide si la transition
// s'applique, l'exécute, puis renvoie le Contrat mis à jour ainsi que la
// liste des champs déjà consommés par la machine (pour que le controller
// n'écrive pas ces champs deux fois).
async function applyPutMutation({ contratId, payload, actor, comment }) {
  const contrat = await Contrat.findById(contratId);
  if (!contrat) throw new SaleLifecycleError('Contrat introuvable.', 404, 'CONTRACT_NOT_FOUND');
  if (contrat.type !== 'vente') {
    // Sécurité défensive — normalement le router applique déjà requireContratType.
    throw new SaleLifecycleError('Le cycle de vie de vente ne concerne que les contrats de type vente.', 422, 'CONTRACT_DOMAIN_MISMATCH');
  }

  // Un demandeur ne peut pas rebypass la machine en écrivant directement
  // `statut='actif'` : la seule voie vers `actif` est acte_signe.
  if (Object.prototype.hasOwnProperty.call(payload, 'statut')) {
    const requested = payload.statut;
    const currentSale = deriveSaleCycle(contrat);
    const projected = STATUT_BY_SALE_CYCLE[currentSale] || contrat.statut;
    if (requested && requested !== projected) {
      throw new SaleLifecycleError(
        `Modification directe de statut interdite sur un contrat de vente : la machine d'état contrôle cette valeur (état courant: ${currentSale}).`,
        409,
        'CONTRACT_STATUT_LOCKED_BY_LIFECYCLE',
      );
    }
  }

  // Immutabilité post-acte : rejet AVANT toute écriture partielle. On passe
  // le payload en entier pour que la comparaison idempotente distingue une
  // vraie mutation d'une simple répétition (dateSignatureActe identique).
  assertNotPostActeLocked(contrat, payload || {});

  const plan = planTransition(contrat, payload);

  if (plan.kind === 'noop') {
    return { contrat, consumedFields: [], transitioned: false, idempotent: false };
  }

  if (plan.kind === 'idempotent') {
    // Aucune écriture, aucun push d'historique, aucune notification.
    return { contrat, consumedFields: plan.target === 'acte_signe' ? ['dateSignatureActe'] : ['dateSignatureCompromis'], transitioned: false, idempotent: true };
  }

  // Réelle transition.
  if (plan.target === 'compromis_signe') {
    // Persister d'abord la date proposée sur l'objet en mémoire pour que les
    // assertions structurelles puissent valider.
    contrat.dateSignatureCompromis = new Date(payload.dateSignatureCompromis);
    assertReadyForCompromis(contrat);
    const updated = await commitTransition({
      contratId: contrat._id, from: plan.current, to: 'compromis_signe',
      actor, comment,
      extraSet: { dateSignatureCompromis: contrat.dateSignatureCompromis },
    });
    return { contrat: updated, consumedFields: ['dateSignatureCompromis'], transitioned: true, idempotent: false };
  }

  if (plan.target === 'acte_signe') {
    const tx = await assertSaleTransactionFinalized(contrat);
    const acteDate = new Date(payload.dateSignatureActe);
    // Snapshot légal : prixVente et commissionAgence sont figés depuis
    // Transaction (source de vérité). Le service N'ÉCRIT PAS sur Transaction.
    const snapshot = {
      dateSignatureActe: acteDate,
      prixVente: tx.finalAmount,
      commissionAgence: tx.commission?.total ?? contrat.commissionAgence,
    };
    const updated = await commitTransition({
      contratId: contrat._id, from: plan.current, to: 'acte_signe',
      actor, comment,
      extraSet: snapshot,
    });
    return { contrat: updated, consumedFields: ['dateSignatureActe', 'prixVente', 'commissionAgence'], transitioned: true, idempotent: false };
  }

  return { contrat, consumedFields: [], transitioned: false, idempotent: false };
}

module.exports = {
  SALE_STATES,
  SALE_TRANSITIONS,
  STATUT_BY_SALE_CYCLE,
  POST_ACTE_LOCKED_FIELDS,
  SaleLifecycleError,
  deriveSaleCycle,
  planTransition,
  assertReadyForCompromis,
  findFinalizedSaleTransaction,
  assertSaleTransactionFinalized,
  applyPutMutation,
};
