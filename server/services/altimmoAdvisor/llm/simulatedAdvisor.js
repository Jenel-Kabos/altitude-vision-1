'use strict';
// Conseiller simulé : fonction de décision du fournisseur « mock » en mode automatique.
// Il lit uniquement ce qu'un vrai modèle recevrait (messages et résultats d'outils) et applique la
// politique validée d'AI-AGENT-02. Il sert aux essais sans dépense ; ce n'est pas DeepSeek.
const { interpretUtterance } = require('../utteranceInterpreter');
const { nextDialogueAction } = require('../dialoguePolicy');
const { createConversationState, fcfa } = require('../conversationState');
const { noResultsAdvice } = require('../groundedNarrator');

const line = (system, prefix) => { const l = system.split('\n').find((x) => x.startsWith(prefix)); return l ? JSON.parse(l.slice(prefix.length)) : null; };
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
const announces = (n) => (n > 1 ? `${n} annonces publiées qui correspondent` : 'une annonce publiée qui correspond');

function stateFrom(system) {
  const memory = line(system, 'MEMOIRE_JSON: ') || {};
  const shown = line(system, 'ANNONCES_PRESENTEES: ') || [];
  const state = createConversationState();
  Object.assign(state.criteria, memory.criteres || {});
  state.amenities = memory.equipements || state.amenities;
  state.proximity = memory.proximite || state.proximity;
  state.motivations = memory.motivations || [];
  state.pendingRelaxation = memory.compromis_en_attente ? { id: memory.compromis_en_attente.id, label: memory.compromis_en_attente.changement, operations: [] } : null;
  state.rejectedRelaxations = memory.compromis_refuses || [];
  state.asked = memory.questions_posees || [];
  state.lastQuestion = memory.derniere_question || null;
  state.lastResults = shown.map((s) => ({ id: s.id }));
  state.proposedIds = shown.map((s) => s.id);
  return { state, extracted: line(system, 'EXTRAIT_AUTOMATIQUE_DU_MESSAGE (déjà enregistré) : ') || [] };
}

function describeCard(a) {
  const size = [a.chambres > 0 ? `${a.chambres} chambre${a.chambres > 1 ? 's' : ''}` : null, a.surface_m2 != null ? `${a.surface_m2} m²` : null].filter(Boolean).join(' et ');
  const plus = (a.atouts || []).filter((x) => / indiquée?$/.test(x)).slice(0, 1);
  const minus = [...(a.limites || []), ...(a.a_verifier || []).filter((x) => x.startsWith('prix'))].slice(0, 1);
  const period = ['par nuit', 'par mois', 'par semaine', 'par an'].includes(a.periode_prix) ? ` ${a.periode_prix}` : '';
  const head = a.prix_fcfa != null ? `coûte ${fcfa(a.prix_fcfa)}${period}${size ? ` pour ${size}` : ''}` : `offre ${size || 'des caractéristiques à vérifier'}`;
  const notes = minus.filter((m) => !(a.prix_fcfa == null && m.startsWith('prix')));
  return `« ${a.titre} »${a.quartier ? ` à ${a.quartier}` : ''} ${head}${plus.length ? `, avec ${plus[0].replace(/ indiquée?$/, '')}` : ''}${a.prix_fcfa == null ? ', mais son prix n’est pas publié' : ''}${notes.length ? ` ; à noter : ${notes[0]}` : ''}.`;
}

function summarize(name, result, memory = {}, extracted = []) {
  if (name === 'search_properties' || name === 'apply_alternative') {
    const n = result.nombre;
    const budget = extracted.find((op) => op.path === 'budget.max');
    const widened = extracted.some((op) => op.path === 'district' && op.op === 'remove');
    const ack = budget && budget.op === 'replace' ? `C’est noté, votre budget maximum passe à ${fcfa(budget.value)}. ` : widened ? `D’accord, j’élargis la recherche${result.classement?.startsWith('annonces avec') ? ` en privilégiant les ${result.classement.replace('annonces avec ', 'biens avec ').replace(' placées en premier', '')}` : ''}, en conservant vos autres critères. ` : '';
    const intro = `${ack}${result.compromis_applique ? 'C’est fait, j’ai élargi la recherche. ' : ''}J’ai trouvé ${announces(n)} à vos critères.`;
    const scope = result.operation_non_precisee ? ' Comme vous n’avez pas précisé achat ou location, j’ai regardé les deux.' : '';
    const places = [...new Set((result.annonces || []).flatMap((a) => (a.a_verifier || []).filter((x) => x.startsWith('proximité')).map((x) => x.replace(/ \(.*$/, ''))))];
    const verify = places.length ? ` La ${places.join(' et la ')} n’${places.length > 1 ? 'apparaissent' : 'apparaît'} pas dans les annonces : il faudra la vérifier sur place.` : '';
    const motivations = memory.motivations || [];
    const follow = memory.proximite?.market && !motivations.includes('courses') && !motivations.includes('commerce') ? ' Vous souhaitez être proche du marché pour vos courses quotidiennes ou pour exercer une activité commerciale ?' : motivations.includes('courses') && extracted.length === 0 ? ' Je retiens que c’est pour vos courses quotidiennes ; voulez-vous que je compare ces biens ?' : ' Voulez-vous que je compare ces biens ou que j’affine la recherche ?';
    return `${intro}${scope} ${(result.annonces || []).slice(0, 2).map(describeCard).join(' ')}${verify}${follow}`;
  }
  if (name === 'propose_alternative') {
    const c = result.compromis;
    if (!c) return memory.criteres ? noResultsAdvice(memory.criteres) : 'Je n’ai trouvé aucune annonce publiée qui corresponde, et aucun compromis simple ne donne de résultat.';
    return `Je n’ai pas trouvé d’annonce correspondant à tous vos critères. En considérant ${c.changement}, tout en conservant ${c.criteres_conserves.join(', ') || 'vos autres critères'}, je vois ${plural(c.annonces_trouvees, 'annonce')}. Voulez-vous que je vous les présente ?`;
  }
  if (name === 'decline_alternative') return 'Entendu, je garde vos critères tels quels. Voulez-vous ajuster autre chose, par exemple le nombre de chambres ou le type de bien ?';
  if (name === 'compare_properties') {
    const biens = result.biens || [];
    return `Voici la comparaison des fiches publiées. ${biens.map(describeCard).join(' ')} En résumé : ${(result.differences || []).join(' ; ') || 'les deux biens sont proches'}${(result.informations_manquantes || []).length ? ` ; information manquante : ${result.informations_manquantes.join(', ')}` : ''}.`;
  }
  if (name === 'evaluate_property_match') {
    const [best, ...others] = [...(result.evaluations || [])].sort((a, b) => (b.chambres ?? -1) - (a.chambres ?? -1));
    if (!best) return 'Je n’ai pas encore de bien à commenter : voulez-vous que je lance une recherche ?';
    return `Je regarderais d’abord « ${best.titre} » : ${(best.atouts || []).slice(0, 2).join(', ') || 'il correspond à vos critères vérifiables'}${(best.limites || []).length || (best.a_verifier || []).length ? `, mais ${[...(best.limites || []), ...(best.a_verifier || [])].slice(0, 2).join(' et ')}` : ''}. ${others[0] ? `Autre option : ${describeCard(others[0])}` : ''}`.trim();
  }
  return 'Pouvez-vous préciser votre projet ?';
}

async function simulatedDecide({ messages, tools }) {
  const lastUser = messages.map((m) => m.role).lastIndexOf('user');
  const text = messages[lastUser]?.content || '';
  const after = messages.slice(lastUser + 1);
  const toolMessages = after.filter((m) => m.role === 'tool');
  if (toolMessages.length) {
    const calls = after.filter((m) => m.role === 'assistant').flatMap((m) => m.tool_calls || []);
    const last = toolMessages.at(-1); const name = calls.find((c) => c.id === last.tool_call_id)?.function.name;
    const result = JSON.parse(last.content);
    const memory = line(messages[0].content, 'MEMOIRE_JSON: ') || {};
    const extracted = line(messages[0].content, 'EXTRAIT_AUTOMATIQUE_DU_MESSAGE (déjà enregistré) : ') || [];
    if (!tools.length || result.erreur) return { content: result.erreur ? 'Je préfère vérifier avec vous avant d’aller plus loin : pouvez-vous confirmer votre choix ?' : summarize(name, result, memory, extracted) };
    if ((name === 'search_properties' || name === 'apply_alternative') && result.nombre === 0) return { toolCalls: [{ name: 'propose_alternative', arguments: { reason: 'aucun_resultat' } }] };
    return { content: summarize(name, result, memory, extracted) };
  }
  const { state, extracted } = stateFrom(messages[0].content);
  // Le serveur a déjà enregistré les critères explicites : ils comptent comme « nouvelles informations » du tour.
  const interp = interpretUtterance(text, state);
  const decision = nextDialogueAction(state, { ...interp, operations: interp.operations.length ? interp.operations : extracted }, text);
  const pendingId = state.pendingRelaxation?.id;
  switch (decision.action) {
    case 'search': return { toolCalls: [{ name: 'search_properties', arguments: {} }] };
    case 'apply_relaxation': return pendingId ? { toolCalls: [{ name: 'apply_alternative', arguments: { alternative_id: pendingId } }] } : { content: 'Très bien. Que souhaitez-vous ajuster ?' };
    case 'decline_relaxation': return pendingId ? { toolCalls: [{ name: 'decline_alternative', arguments: { alternative_id: pendingId } }] } : { content: 'Entendu.' };
    case 'compare': return { toolCalls: [{ name: 'compare_properties', arguments: { property_ids: decision.propertyIds } }] };
    case 'advise': return { toolCalls: [{ name: 'evaluate_property_match', arguments: { property_ids: state.proposedIds.slice(0, 3) } }] };
    case 'propose_space': return { toolCalls: [{ name: 'propose_alternative', arguments: { reason: 'plus_d_espace' } }] };
    default: {
      const q = decision.question || 'Que puis-je préciser pour vous ?';
      const openers = ['Très bien.', 'D’accord.', 'Entendu.', 'Parfait.'];
      const opener = extracted.length && !/^(Bonjour|Je comprends)/.test(q) ? `${openers[(messages.length >> 1) % openers.length]} ` : '';
      return { content: `${opener}${q}` };
    }
  }
}

module.exports = { simulatedDecide };
