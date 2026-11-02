/** @jest-environment ./__tests__/altimmoAdvisor/realmCloneEnvironment.js */
'use strict';
const assert = require('node:assert/strict');
const { nextDialogueAction } = require('../../services/altimmoAdvisor/dialoguePolicy');
const { interpretUtterance } = require('../../services/altimmoAdvisor/utteranceInterpreter');
const { createConversationState, applyOperations } = require('../../services/altimmoAdvisor/conversationState');

// Rejoue une conversation : applique les opérations retenues par la politique et mémorise la question posée.
function converse(messages, state = createConversationState()) {
  let decision;
  for (const text of messages) {
    const interp = interpretUtterance(text, state);
    decision = nextDialogueAction(state, interp, text);
    state = applyOperations(state, decision.operations);
    if (decision.questionKey) state = { ...state, asked: [...state.asked, decision.questionKey], lastQuestion: decision.questionKey };
  }
  return { decision, state };
}

test('maison seule : demande achat ou location', () => {
  const { decision } = converse(['Je cherche une maison.']);
  assert.equal(decision.action, 'clarify');
  assert.equal(decision.questionKey, 'transaction');
  assert.match(decision.question, /acheter.*louer|louer.*acheter/i);
});

test('parcours appartement : opération, puis budget mensuel, puis secteur, puis recherche', () => {
  assert.equal(converse(['Je cherche un appartement.']).decision.questionKey, 'transaction');
  const budget = converse(['Je cherche un appartement.', 'Pour louer.']).decision;
  assert.equal(budget.questionKey, 'budget');
  assert.match(budget.question, /mensuel/i);
  const area = converse(['Je cherche un appartement.', 'Pour louer.', '150 000 FCFA.']).decision;
  assert.equal(area.questionKey, 'location');
  assert.match(area.question, /secteur|quartier/i);
  assert.equal(converse(['Je cherche un appartement.', 'Pour louer.', '150 000 FCFA.', 'À Bacongo.']).decision.action, 'search');
});

test('phrase multi-critères : une seule question, sur l opération, sans redemander le reste', () => {
  const { decision } = converse(["Je cherche une maison avec trois chambres et une cour, à Poto-Poto, pour 200 000 FCFA maximum. C'est pour mes enfants, donc j'aimerais être proche d'une école."]);
  assert.equal(decision.action, 'clarify');
  assert.equal(decision.questionKey, 'transaction');
  assert.match(decision.question, /200 000 FCFA/);
  assert.doesNotMatch(decision.question, /chambres|quartier|cour/i);
  assert.equal((decision.question.match(/\?/g) || []).length, 1);
});

test('critères suffisants : recherche sans questionnaire', () => {
  assert.equal(converse(['Je veux louer une maison à Poto-Poto pour 250 000 FCFA maximum.']).decision.action, 'search');
  assert.equal(converse(["Je veux louer une maison. Qu'est-ce que tu me proposes ?"]).decision.action, 'search');
});

test('ne repose pas une question indispensable déjà ignorée et recherche à la demande', () => {
  const { decision, state } = converse(['Je cherche une maison à Poto-Poto pour 200 000 FCFA.', 'Finalement, 250 000 FCFA maximum.', 'Et je voudrais une cour.', "Qu'est-ce que tu me proposes ?"]);
  assert.equal(decision.action, 'search');
  assert.equal(state.asked.filter((key) => key === 'transaction').length, 1);
  assert.equal(state.criteria.budget.max, 250000);
  assert.deepEqual(state.amenities.preferred, ['cour']);
});

test('contradictions : opération hésitante, hausse implicite d un budget strict, retrait d un indispensable', () => {
  const conflict = converse(['Je veux louer ou acheter une maison, je ne sais pas']).decision;
  assert.equal(conflict.questionKey, 'transaction_conflict');
  const strict = converse(['Je veux louer une maison à Poto-Poto, budget strict de 200 000 FCFA.', '300 000 FCFA.']);
  assert.equal(strict.decision.action, 'clarify');
  assert.equal(strict.decision.questionKey, 'budget_strict_increase');
  assert.equal(strict.state.criteria.budget.max, 200000, 'aucune mutation avant accord');
  const explicit = converse(['Je veux louer une maison à Poto-Poto, budget strict de 200 000 FCFA.', "J'augmente mon budget de 50 000 FCFA."]);
  assert.equal(explicit.state.criteria.budget.max, 250000);
  const required = converse(['Je veux louer une maison à Poto-Poto, il me faut absolument un parking.', 'Sans parking.']);
  assert.equal(required.decision.questionKey, 'remove_required');
  assert.deepEqual(required.state.amenities.required, ['parking']);
});

test('alternative en attente : accord, refus, nouveau critère', () => {
  const pending = { id: 'widen_district', operations: [{ op: 'remove', path: 'district', source: 'relaxation' }], preserved: ['budget'], rationale: 'r', label: 'l', count: 2 };
  const state = { ...applyOperations(createConversationState(), [{ op: 'set', path: 'district', value: 'Moungali' }]), pendingRelaxation: pending };
  assert.equal(nextDialogueAction(state, interpretUtterance("Oui, d'accord", state), "Oui, d'accord").action, 'apply_relaxation');
  assert.equal(nextDialogueAction(state, interpretUtterance('Non, je préfère rester à Moungali', state), 'Non, je préfère rester à Moungali').action, 'decline_relaxation');
  const other = nextDialogueAction(state, interpretUtterance('Et avec 3 chambres ?', state), 'Et avec 3 chambres ?');
  assert.equal(other.clearPending, true);
});

test('comparaison, conseil, trop petit et refus commercial', () => {
  const shown = { ...createConversationState(), proposedIds: ['a', 'b', 'c'], lastResults: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
  const compare = nextDialogueAction(shown, interpretUtterance('Compare le premier et le troisième', shown), 'Compare le premier et le troisième');
  assert.deepEqual([compare.action, compare.propertyIds], ['compare', ['a', 'c']]);
  assert.deepEqual(nextDialogueAction(shown, interpretUtterance('Compare les deux', shown), 'Compare les deux').propertyIds, ['a', 'b']);
  const empty = createConversationState();
  assert.equal(nextDialogueAction(empty, interpretUtterance('Compare les deux', empty), 'Compare les deux').action, 'respond');
  assert.equal(nextDialogueAction(shown, interpretUtterance('Quels sont les avantages ?', shown), 'Quels sont les avantages ?').action, 'advise');
  assert.equal(nextDialogueAction(shown, interpretUtterance('Ce logement est trop petit.', shown), 'Ce logement est trop petit.').action, 'propose_space');
  for (const text of ['Je veux payer avec Yabetoo', 'Réserve cette maison', 'Donne-moi le téléphone du propriétaire', 'Envoie un acompte par mobile money']) {
    assert.equal(nextDialogueAction(empty, interpretUtterance(text, empty), text).action, 'refuse', text);
  }
});

test('salutation : réponse polie puis question de projet', () => {
  const { decision } = converse(['Bonjour']);
  assert.equal(decision.questionKey, 'project');
  assert.match(decision.question, /^Bonjour ! Quel type de bien/);
});

test('budget demandé mais quartier donné : une seule relance du budget, en reprenant la motivation', () => {
  const { decision, state } = converse(['Bonjour, je cherche une maison pour ma famille.', 'À louer, avec trois chambres.', 'Poto-Poto, mais j’aimerais être proche d’une école.']);
  assert.equal(decision.questionKey, 'budget_again');
  assert.match(decision.question, /^Je comprends, la proximité d’une école est donc importante pour vous\. Quel loyer mensuel maximum souhaitez-vous y consacrer \?$/);
  assert.equal(state.criteria.district, 'Poto-Poto');
  assert.equal(converse(['Bonjour, je cherche une maison pour ma famille.', 'À louer, avec trois chambres.', 'Poto-Poto, mais j’aimerais être proche d’une école.', 'Avec une cour.']).decision.action, 'search', 'pas de seconde relance');
});
