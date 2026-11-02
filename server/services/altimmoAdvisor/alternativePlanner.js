'use strict';
// Planificateur d'alternatives : une seule proposition à la fois, vérifiée auprès d'IA-03
// avant d'être formulée. Aucun quartier n'est nommé, aucune disponibilité n'est supposée.
const { applyOperations, buildSearchQuery, fcfa } = require('./conversationState');

const ALTERNATIVE_TYPES = { Maison: 'Villa', Villa: 'Maison', Appartement: 'Studio', Studio: 'Appartement', Duplex: 'Maison' };
const plural = (count, word) => `${count} ${word}${count > 1 ? 's' : ''}`;

function preservedList(state, except = []) {
  const c = state.criteria; const out = [];
  if (Number.isInteger(c.budget.max) && !except.includes('budget')) out.push(`votre budget maximum de ${fcfa(c.budget.max)}`);
  if (Number.isInteger(c.bedrooms.min) && !except.includes('bedrooms')) out.push(`au moins ${c.bedrooms.min} chambres`);
  if (c.propertyType && !except.includes('type')) out.push(`le type ${c.propertyType.toLowerCase()}`);
  if (c.transaction && !except.includes('transaction')) out.push({ RENT: 'la location', BUY: 'l’achat', STAY: 'le séjour' }[c.transaction]);
  if (c.district && !except.includes('district')) out.push(`le quartier ${c.district}`);
  return out;
}

const keeping = (preserved) => preserved.filter((item) => !/^(le type|la location|l’achat|le séjour)/.test(item)).join(' et ');

function candidates(state) {
  const c = state.criteria; const list = [];
  if (c.district) {
    const preserved = preservedList(state, ['district']);
    list.push({ id: 'widen_district', operations: [{ op: 'remove', path: 'district', source: 'relaxation' }], preserved,
      label: `autres quartiers de ${c.city || 'la ville'}`,
      rationale: `le quartier est le seul critère élargi ; ${keeping(preserved) || 'vos autres critères'} restent inchangés`,
      ask: (count) => `Je n’ai pas trouvé de bien correspondant à tous vos critères à ${c.district} parmi les annonces publiées. En élargissant la recherche à d’autres quartiers de ${c.city || 'la ville'}, tout en conservant ${keeping(preserved) || 'vos autres critères'}, j’en vois ${count === 1 ? 'une annonce' : plural(count, 'annonce')} à examiner. Voulez-vous que je vous les présente ?` });
  }
  if (c.propertyType && ALTERNATIVE_TYPES[c.propertyType]) {
    const other = ALTERNATIVE_TYPES[c.propertyType];
    const preserved = preservedList(state, ['type']);
    list.push({ id: 'other_type', operations: [{ op: 'replace', path: 'propertyType', value: other, source: 'relaxation' }], preserved,
      label: `type ${other.toLowerCase()}`,
      rationale: `un ${other.toLowerCase()} peut répondre au même besoin d’espace ; ${keeping(preserved) || 'les autres critères'} restent inchangés`,
      ask: (count) => `Aucun bien de type ${c.propertyType.toLowerCase()} ne correspond à tous vos critères. En regardant aussi les biens de type ${other.toLowerCase()}, avec les mêmes critères (${preserved.join(', ')}), j’en vois ${count === 1 ? 'une annonce' : plural(count, 'annonce')}. Voulez-vous les voir ?` });
  }
  if (Number.isInteger(c.bedrooms.min) && c.bedrooms.min > 1) {
    const fewer = c.bedrooms.min - 1;
    const preserved = preservedList(state, ['bedrooms']);
    list.push({ id: 'fewer_bedrooms', operations: [{ op: 'replace', path: 'bedrooms.min', value: fewer, source: 'relaxation' }], preserved,
      label: `${fewer} chambres au lieu de ${c.bedrooms.min}`,
      rationale: 'une chambre de moins élargit le choix, au prix d’un espace de couchage réduit',
      ask: (count) => `Avec ${fewer} chambres au lieu de ${c.bedrooms.min}, en gardant ${keeping(preserved) || 'le reste'}, j’en vois ${count === 1 ? 'une annonce' : plural(count, 'annonce')}. Ce compromis vous conviendrait-il ?` });
  }
  if (Number.isInteger(c.budget.max) && !c.budget.strict) {
    const raised = Math.ceil((c.budget.max * 1.2) / 10_000) * 10_000;
    const preserved = preservedList(state, ['budget']);
    list.push({ id: 'raise_budget', operations: [{ op: 'replace', path: 'budget.max', value: raised, source: 'relaxation' }], preserved,
      label: `budget porté à ${fcfa(raised)}`,
      rationale: `un dépassement de ${fcfa(raised - c.budget.max)}, uniquement avec votre accord`,
      ask: (count) => `Votre budget n’est pas indiqué comme strict : en le portant à ${fcfa(raised)} (soit ${fcfa(raised - c.budget.max)} de plus), j’en vois ${count === 1 ? 'une annonce' : plural(count, 'annonce')}. Souhaitez-vous ce dépassement ?` });
  }
  if (state.motivations.includes('famille')) list.sort((a, b) => (a.id === 'fewer_bedrooms') - (b.id === 'fewer_bedrooms'));
  return list.filter((item) => !state.rejectedRelaxations.includes(item.id));
}

async function firstVerified(state, list, search) {
  for (const candidate of list) {
    const relaxed = applyOperations(state, candidate.operations);
    const result = await search(buildSearchQuery(relaxed), relaxed);
    const count = result?.items?.length || 0;
    if (count > 0) {
      const { ask, ...rest } = candidate;
      return { ...rest, count, question: ask(count) };
    }
  }
  return null;
}

function proposeRelaxation(state, search) {
  return firstVerified(state, candidates(state), search);
}

const SPACIOUS_TYPES = { Studio: 'Appartement', Appartement: 'Maison', Maison: 'Villa', Duplex: 'Villa' };

function proposeMoreSpace(state, search) {
  if (state.rejectedRelaxations.includes('more_space')) return Promise.resolve(null);
  const shown = state.lastResults || [];
  const biggest = Math.max(state.criteria.bedrooms.min || 0, ...shown.map((item) => (Number.isFinite(item.bedrooms) ? item.bedrooms : 0)));
  const operations = [{ op: state.criteria.bedrooms.min ? 'replace' : 'set', path: 'bedrooms.min', value: biggest + 1, source: 'relaxation' }];
  const elsewhere = Boolean(state.criteria.district);
  if (elsewhere) operations.push({ op: 'remove', path: 'district', source: 'relaxation' });
  const preserved = preservedList(state, ['bedrooms', 'district', 'type']);
  const where = elsewhere ? ` et sans me limiter à ${state.criteria.district}` : '';
  const variants = [{ operations, typeNote: '' }];
  const bigger = SPACIOUS_TYPES[state.criteria.propertyType];
  if (bigger) variants.push({ operations: [...operations, { op: 'replace', path: 'propertyType', value: bigger, source: 'relaxation' }], typeNote: `, en regardant aussi les biens de type ${bigger.toLowerCase()}` });
  return firstVerified(state, variants.map(({ operations: ops, typeNote }) => ({
    id: 'more_space', operations: ops, preserved,
    label: `au moins ${biggest + 1} chambres${elsewhere ? ', dans d’autres quartiers' : ''}${typeNote}`,
    rationale: 'plus de chambres pour gagner de l’espace, en acceptant éventuellement un autre quartier',
    ask: (count) => `Préférez-vous davantage de superficie, même si cela implique de regarder dans un autre quartier ? Avec au moins ${biggest + 1} chambres${where}${typeNote}, en gardant ${keeping(preserved) || 'vos autres critères'}, j’en vois ${count === 1 ? 'une annonce' : plural(count, 'annonce')}.`,
  })), search);
}

module.exports = { proposeRelaxation, proposeMoreSpace };
