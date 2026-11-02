'use strict';
// Politique de dialogue déterministe : sécurité et contradictions d'abord, puis information
// indispensable, recherche, information importante. Une seule question par tour.
const { normalize } = require('./utteranceInterpreter');
const { fcfa, applyOperations } = require('./conversationState');

const FORBIDDEN_COMMERCIAL = /(\bpaie\b|\bpayer|paiement|yabetoo|pawapay|mobile money|acompte|virement|\breserv\w*|rembours\w*|previens?|prevenir|notifi\w*|alert\w*|rappel\w*|rappelle\w*|surveill\w*|programm\w* (une )?visite|organis\w* (une )?visite|telephone|\bnumero\b|whatsapp|e-?mail|coordonnees|contact\w* (du |le |la )?proprietaire|confirme[rz]? (la )?vente|publie[rz]? (une |l'|mon )?annonce|modifie[rz]? (l'annonce|le bien)|mot de passe|conversations? (privee|des autres))/;
const EXPLICIT_CHANGE = /(augment|ajout|rajout|hausse|\bmonte|finalement|plutot|nouveau budget|change|passe a|desormais|maintenant|en fait|je peux aller|porte[rz]?)/;
const CONFIRM_REMOVAL = /(vraiment|finalement|oui|confirme|tant pis)/;

const QUESTIONS = {
  project: 'Quel type de bien recherchez-vous, et est-ce pour acheter ou pour louer ?',
  transaction: 'C’est pour acheter ou pour louer ?',
  transaction_conflict: 'Vous hésitez entre achat et location : lequel voulez-vous que je regarde en premier ?',
  location: 'Dans quel secteur ou quartier souhaitez-vous habiter ?',
  compare_first: 'Voulez-vous que je lance d’abord une recherche pour vous montrer des biens à comparer ?',
};
const budgetQuestion = (tx) => ({ RENT: 'Quel loyer mensuel maximum envisagez-vous ?', BUY: 'Quel budget maximum prévoyez-vous pour l’achat ?', STAY: 'Quel budget par nuit envisagez-vous ?' }[tx] || 'Quel budget maximum envisagez-vous ?');

const clarify = (questionKey, question, operations, reason, extra = {}) => ({ action: 'clarify', questionKey, question, operations, reason, ...extra });

function nextDialogueAction(state, interp, text = '') {
  const n = normalize(text);
  if (FORBIDDEN_COMMERCIAL.test(n)) return { action: 'refuse', operations: [], reason: 'commercial' };

  let operations = [...interp.operations];
  const c = state.criteria;

  // Contradictions : question ciblée avant toute mutation concernée.
  if (interp.ambiguity.includes('transaction_conflict')) return clarify('transaction_conflict', QUESTIONS.transaction_conflict, operations, 'contradiction');
  const budgetOp = operations.find((item) => item.path === 'budget.max');
  if (budgetOp && c.budget.strict && Number.isInteger(c.budget.max) && budgetOp.value > c.budget.max && !EXPLICIT_CHANGE.test(n)) {
    const kept = operations.filter((item) => item !== budgetOp);
    const question = `Votre budget de ${fcfa(c.budget.max)} est indiqué comme strict. Voulez-vous vraiment le porter à ${fcfa(budgetOp.value)} ?`;
    return clarify('budget_strict_increase', question, kept, 'contradiction', { pending: { id: 'confirm_budget', operations: [{ ...budgetOp, op: 'replace', source: 'confirmation' }], question, preserved: [], label: `budget porté à ${fcfa(budgetOp.value)}` } });
  }
  const removal = operations.find((item) => item.op === 'remove' && item.path.startsWith('amenities') && state.amenities.required.includes(item.value));
  if (removal && !CONFIRM_REMOVAL.test(n)) {
    const question = `Le critère « ${removal.value} » était indispensable pour vous : je le retire vraiment de la recherche ?`;
    return clarify('remove_required', question, operations.filter((item) => item !== removal), 'contradiction', { pending: { id: 'confirm_removal', operations: [removal], question, preserved: [], label: `retrait de « ${removal.value} »` } });
  }

  // Proposition en attente : seul un accord explicite l'applique.
  let clearPending = false;
  if (state.pendingRelaxation) {
    if (interp.intents.accept && !operations.length) return { action: 'apply_relaxation', operations: state.pendingRelaxation.operations, relaxation: state.pendingRelaxation, reason: 'accord explicite' };
    if (interp.intents.reject) return { action: 'decline_relaxation', operations: operations.filter((item) => item.op !== 'remove'), relaxation: state.pendingRelaxation, reason: 'refus explicite' };
    if (!operations.length && !Object.values(interp.intents).some(Boolean)) return { action: 'respond', operations, question: state.pendingRelaxation.question, reason: 'proposition toujours en attente' };
    clearPending = true;
  }

  const shown = state.lastResults || [];
  if (interp.intents.compare) {
    const ids = interp.selection.length >= 2 ? interp.selection.map((index) => shown[index]?.id).filter(Boolean) : shown.slice(0, 2).map((item) => item.id);
    if (ids.length >= 2) return { action: 'compare', operations, propertyIds: [...new Set(ids)].slice(0, 5), reason: 'comparaison demandée', clearPending };
    return { action: 'respond', operations, question: QUESTIONS.compare_first, questionKey: 'compare_first', reason: 'rien à comparer', clearPending };
  }
  if (interp.intents.tooSmall && shown.length) return { action: 'propose_space', operations, reason: 'logement jugé trop petit', clearPending };
  if (interp.intents.advice && shown.length && !operations.length) return { action: 'advise', operations, reason: 'conseil sur les biens montrés', clearPending };

  // Exploration du catalogue : recherche générale immédiate, aucune question de projet, de ville ou de budget.
  let projected = state;
  for (const item of operations) { try { projected = applyOperations(projected, [item]); } catch { /* opération refusée plus tard */ } }
  if (projected.criteria.mode === 'explore') return { action: 'search', operations, mode: interp.intents.advice ? 'advise' : 'present', general: true, reason: 'exploration du catalogue', clearPending };
  const unrestricted = projected.criteria.budget.unrestricted === true;

  const next = { ...c, ...Object.fromEntries(operations.filter((item) => !item.path.includes('.') && item.op !== 'remove').map((item) => [item.path, item.value])) };
  const budget = operations.find((item) => item.path === 'budget.max')?.value ?? c.budget.max;
  const located = Boolean(next.district || next.city) && !operations.some((item) => item.op === 'remove' && item.path === 'district' && !next.city);
  const known = Boolean(next.transaction || next.propertyType || located || Number.isInteger(budget) || unrestricted);
  const asked = new Set(state.asked);

  if (!known) return clarify('project', interp.intents.greeting ? `Bonjour ! ${QUESTIONS.project}` : QUESTIONS.project, operations, 'projet inconnu', { clearPending });
  const mode = interp.intents.advice ? 'advise' : 'present';
  const explicitSearch = interp.intents.results || (/\bje cherche\b/.test(n) && Boolean(next.transaction));
  if (explicitSearch) return { action: 'search', operations, mode, reason: 'résultats demandés explicitement', clearPending };
  if (!next.transaction && !asked.has('transaction')) {
    const question = Number.isInteger(budget) ? `Les ${fcfa(budget)} correspondent-ils à un loyer mensuel ou à un prix d’achat ?` : QUESTIONS.transaction;
    return clarify('transaction', question, operations, 'information indispensable', { clearPending });
  }
  if (next.transaction && !Number.isInteger(budget) && !unrestricted && !asked.has('budget')) return clarify('budget', budgetQuestion(next.transaction), operations, 'information importante', { clearPending });
  // Le client a répondu autre chose que le budget demandé : une seule relance, en reprenant ce qu'il vient de dire.
  if (next.transaction && !Number.isInteger(budget) && !unrestricted && state.lastQuestion === 'budget' && !asked.has('budget_again') && operations.length && !interp.intents.results) {
    const reason = operations.some((item) => item.path === 'proximity.school') ? 'Je comprends, la proximité d’une école est donc importante pour vous. ' : '';
    return clarify('budget_again', `${reason}${budgetQuestion(next.transaction).replace(/ envisagez-vous \?$/, ' souhaitez-vous y consacrer ?')}`, operations, 'information importante reformulée', { clearPending });
  }
  if (next.transaction && !located && !asked.has('location')) return clarify('location', QUESTIONS.location, operations, 'information importante', { clearPending });
  return { action: 'search', operations, mode, reason: 'critères suffisants', clearPending };
}

module.exports = { FORBIDDEN_COMMERCIAL, nextDialogueAction };
