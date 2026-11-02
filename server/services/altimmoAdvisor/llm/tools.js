'use strict';
// Outils exposés au modèle de langage : liste blanche fermée, arguments validés côté serveur,
// identifiants limités aux biens déjà présentés, aucune opération d'écriture ni financière.
// Le modèle ne fait que demander ; le serveur décide, exécute IA-03 et renvoie des faits publics.
const { applyOperations, addMotivations, buildSearchQuery, variantCriteria, describeState, evaluateListing, fcfa, LIMITS, describeFilters, searchVariants } = require('../conversationState');
const { proposeRelaxation, proposeMoreSpace } = require('../alternativePlanner');
const { shortTitle } = require('../groundedNarrator');

const MEMORY_PATHS = ['transaction', 'propertyType', 'propertyTypes', 'budget.unrestricted', 'city', 'district', 'budget.min', 'budget.max', 'budget.strict', 'budget.period', 'furnished', 'bedrooms.min', 'surface.min', 'proximity.school', 'proximity.market', 'amenities.preferred', 'amenities.required'];
const MOTIVATIONS = ['famille', 'ecole', 'espace', 'mobilite', 'budget', 'calme', 'courses', 'commerce', 'exterieur'];
const ID = { type: 'string', minLength: 1, maxLength: 64 };
const fn = (name, description, properties = {}, required = []) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } });

const TOOL_DEFINITIONS = [
  fn('update_criteria', 'Enregistre ou modifie les critères que le client vient d’exprimer clairement. Remplacer (replace) une valeur existante plutôt que d’additionner. N’enregistre une motivation que si le client l’a confirmée.', {
    operations: { type: 'array', maxItems: 8, items: { type: 'object', additionalProperties: false, required: ['op', 'path'], properties: { op: { type: 'string', enum: ['set', 'replace', 'remove', 'restore'] }, path: { type: 'string', enum: MEMORY_PATHS }, value: { type: ['string', 'number', 'boolean', 'null', 'array'], items: { type: 'string' } } } } },
    motivations: { type: 'array', maxItems: 4, items: { type: 'string', enum: MOTIVATIONS } },
  }),
  fn('search_properties', 'Recherche les annonces publiées et autorisées correspondant aux critères enregistrés (moteur Altimmo IA-03). À utiliser quand les critères sont suffisants ou que le client demande des propositions.'),
  fn('get_public_property_details', 'Donne les informations publiques d’une annonce déjà présentée au client.', { property_id: ID }, ['property_id']),
  fn('evaluate_property_match', 'Évalue des annonces déjà présentées face aux critères du client : atouts, limites, points à vérifier.', { property_ids: { type: 'array', minItems: 1, maxItems: 5, items: ID } }, ['property_ids']),
  fn('compare_properties', 'Compare 2 à 5 annonces déjà présentées au client, à partir des fiches publiées.', { property_ids: { type: 'array', minItems: 2, maxItems: 5, items: ID } }, ['property_ids']),
  fn('propose_alternative', 'Cherche un compromis vérifié (autre quartier, autre type, plus d’espace…) quand rien ne correspond ou quand le client veut plus d’espace. Ne l’applique pas.', { reason: { type: 'string', enum: ['aucun_resultat', 'plus_d_espace'] } }, ['reason']),
  fn('apply_alternative', 'Applique le compromis proposé, uniquement si le client vient de l’accepter explicitement, puis relance la recherche.', { alternative_id: ID }, ['alternative_id']),
  fn('decline_alternative', 'Enregistre que le client refuse le compromis proposé ; ses critères sont conservés.', { alternative_id: ID }, ['alternative_id']),
];
const TOOL_NAMES = TOOL_DEFINITIONS.map((t) => t.function.name);

const EXPLICIT_CHANGE = /(augment|ajout|rajout|hausse|\bmonte|finalement|plutot|plutôt|nouveau budget|change|passe a|passe à|desormais|désormais|maintenant|en fait|je peux aller|porte[rz]?|jusqu)/i;
const CONFIRM = /(vraiment|finalement|oui|confirme|tant pis|d'accord|d’accord)/i;
const toolError = (code, detail) => ({ erreur: code, detail });

function publicCard(listing, state) {
  const fit = evaluateListing(state, listing);
  return { id: listing.id, titre: shortTitle(listing), quartier: listing.address?.arrondissement || null, ville: listing.address?.city || null, prix_fcfa: Number.isFinite(listing.price) ? listing.price : null, periode_prix: { night: 'par nuit', month: 'par mois', sale: 'prix de vente', week: 'par semaine', year: 'par an' }[listing.pricePeriod] || 'non indiquée', chambres: Number.isFinite(listing.bedrooms) ? listing.bedrooms : null, surface_m2: Number.isFinite(listing.surface) ? listing.surface : null, equipements: listing.amenities || [], atouts: fit.strengths, limites: fit.limits, a_verifier: fit.toVerify };
}

function differences(items) {
  const out = [];
  const priced = items.filter((i) => Number.isFinite(i.price)).sort((a, b) => a.price - b.price);
  if (priced.length >= 2 && priced[0].price !== priced.at(-1).price) out.push(`le moins cher : ${shortTitle(priced[0])} (${fcfa(priced[0].price)})`);
  const rooms = items.filter((i) => Number.isFinite(i.bedrooms)).sort((a, b) => b.bedrooms - a.bedrooms);
  if (rooms.length >= 2 && rooms[0].bedrooms !== rooms.at(-1).bedrooms) out.push(`le plus de chambres : ${shortTitle(rooms[0])} (${rooms[0].bedrooms})`);
  const wide = items.filter((i) => Number.isFinite(i.surface)).sort((a, b) => b.surface - a.surface);
  if (wide.length >= 2 && wide[0].surface !== wide.at(-1).surface) out.push(`la plus grande surface : ${shortTitle(wide[0])} (${wide[0].surface} m²)`);
  const missing = items.filter((i) => !Number.isFinite(i.price)).map((i) => `${shortTitle(i)} : prix non publié`);
  return { differences: out, informations_manquantes: missing };
}

// Demande ouverte sur le catalogue (« quels biens sont publiés ? ») : liste publique complète, sans critère implicite.
const GENERAL = /\b(tous|tout|toutes|quels?|quelles?|qu.avez|que proposez)\b.*\b(biens?|annonces?|proprietes?)\b.*\b(publie|disponible|propos|comme)/;
const SPECIFIC = /\b(louer|location|acheter|achat|vendre|vente|sejour|terrain|bureau|villa|maison|appartement|studio|hotel|chambres?|budget|fcfa)\b/;
function isGeneralCatalogRequest(text) {
  const n = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, ' ');
  return GENERAL.test(n) && !SPECIFIC.test(n);
}
// « peu importe mes anciens critères » : remise à zéro déterministe des critères de recherche (la ville est conservée).
const RESET = /\b(peu importe|oublie[rz]?|sans tenir compte|sans filtre|anciens criteres)\b/;
const RESET_PATHS = ['transaction', 'propertyType', 'district', 'budget.min', 'budget.max', 'budget.period', 'furnished', 'bedrooms.min', 'surface.min'];
function resetForGeneralRequest(state, text) {
  const n = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!isGeneralCatalogRequest(text) || !RESET.test(n)) return [];
  const value = (path) => path.split('.').reduce((o, k) => o?.[k], state.criteria);
  return RESET_PATHS.filter((path) => value(path) !== null && value(path) !== undefined).map((path) => ({ op: 'remove', path, source: 'explicit' }));
}
// Une ville demandée filtre la liste générale ; une ville non publiée n'exclut pas l'annonce.
const filterGeneralListing = (state, listing) => (!state.criteria.city || !listing.address?.city || normalizeCity(listing.address.city) === normalizeCity(state.criteria.city))
  && (!state.criteria.district || !listing.address?.arrondissement || normalizeCity(listing.address.arrondissement) === normalizeCity(state.criteria.district));
const normalizeCity = (v) => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Exécuteur d'outils pour un tour. `draft` est le brouillon de session (mémoire non encore validée).
function createToolRunner({ engine, draft, userText, interp, deterministicPaths = [], allowedAction = null, generalSearch = false, maxCalls = 6, signal, emit = () => {} }) {
  let calls = 0; const done = new Map();
  const facts = { results: null, evaluated: null, comparison: null, proposal: null, searched: false, catalog: [] };
  const remember = (listings) => { const add = listings.map((l) => ({ listing: l, fit: evaluateListing(draft.state, l) })); facts.evaluated = [...(facts.evaluated || []).filter((e) => !listings.some((l) => l.id === e.listing.id)), ...add]; };

  async function searchState(state) {
    if (generalSearch) { const all = await engine.listPublished({ signal }); return { ...all, items: (all.items || []).filter((item) => filterGeneralListing(state, item.listing)) }; }
    // Une recherche IA-03 par type accepté (et par opération si elle manque) ; fusion sans doublon plus bas.
    const variants = searchVariants(state);
    const results = [];
    for (const variant of variants) results.push(await engine.searchPublished({ query: buildSearchQuery(variant), criteria: variantCriteria(variant), signal }));
    const seen = new Set();
    return { items: results.flatMap((r) => r.items || []).filter((item) => !seen.has(item.listing.id) && seen.add(item.listing.id)), criteria: variants.length === 1 ? results[0]?.criteria : null };
  }

  async function search() {
    const state = draft.state;
    const { items, criteria } = await searchState(state);
    // Classement secondaire côté serveur : à pertinence IA-03 égale, les biens offrant les équipements souhaités passent devant.
    const wanted = [...state.amenities.required, ...state.amenities.preferred];
    const score = (item) => wanted.filter((a) => (item.listing.amenities || []).map((x) => String(x).toLowerCase()).includes(a)).length;
    const shown = items.map((item, rank) => ({ item, rank })).sort((a, b) => score(b.item) - score(a.item) || a.rank - b.rank).map((x) => x.item).slice(0, 5);
    state.lastResults = shown.map((item) => item.listing);
    state.proposedIds = [...new Set([...state.proposedIds, ...shown.map((item) => item.listing.id)])].slice(-LIMITS.proposedIds);
    state.certified = criteria && typeof criteria === 'object' ? structuredClone(criteria) : null;
    facts.searched = true;
    facts.results = shown.map((item) => ({ listing: item.listing, fit: evaluateListing(state, item.listing) }));
    if (shown.length) emit('facts', { cards: shown, fits: Object.fromEntries(facts.results.map((r) => [r.listing.id, r.fit])), criteria: describeFilters(state) });
    // Aucun résultat : les autres annonces publiques (liste générale, lecture seule) sont fournies comme faits citables,
    // pour que le modèle ne les évoque jamais de mémoire ; elles ne deviennent ni des résultats ni des fiches affichées.
    if (!shown.length && !generalSearch && typeof engine.listPublished === 'function') {
      try { facts.catalog = ((await engine.listPublished({ signal })).items || []).map((item) => item.listing).filter((l) => filterGeneralListing(state, l)).slice(0, 5); } catch { facts.catalog = []; }
    }
    const alternatives = facts.catalog.length ? { alternatives_catalogue: facts.catalog.map((l) => publicCard(l, state)), alternatives_catalogue_consigne: 'Ces annonces publiées ne correspondent pas aux critères actifs : présente-les seulement comme autres catégories du catalogue, sans les dire conformes.' } : {};
    return { nombre: shown.length, classement: wanted.length ? `annonces avec ${wanted.join(', ')} placées en premier` : 'ordre du moteur IA-03', operation_non_precisee: !state.criteria.transaction, annonces: shown.map((item) => publicCard(item.listing, state)), conseil: shown.length ? undefined : 'Aucune annonce publiée ne correspond : propose un compromis avec propose_alternative, sans relâcher toi-même un critère.', ...alternatives };
  }

  const known = (id) => draft.state.proposedIds.includes(id);
  const listingOf = (id) => draft.state.lastResults.find((l) => l.id === id) || (facts.comparison?.items || []).find((i) => i.listing.id === id)?.listing || null;

  const handlers = {
    async update_criteria(args) {
      const operations = Array.isArray(args.operations) ? args.operations : [];
      const applied = []; const refused = [];
      for (const raw of operations) {
        const op = { op: raw.op, path: raw.path, ...(raw.value === undefined || raw.value === null ? {} : { value: raw.value }), source: 'model' };
        if (!MEMORY_PATHS.includes(op.path)) { refused.push({ ...op, raison: 'chemin interdit' }); continue; }
        if (generalSearch && op.op !== 'remove' && !deterministicPaths.includes(op.path)) { refused.push({ ...op, raison: 'demande générale : ne réintroduis aucun ancien critère' }); continue; }
        if (deterministicPaths.includes(op.path) && op.path !== 'amenities.preferred' && op.path !== 'amenities.required') { refused.push({ ...op, raison: 'valeur déjà extraite du message' }); continue; }
        const c = draft.state.criteria;
        if (op.path === 'budget.max' && c.budget.strict && Number.isInteger(c.budget.max) && op.value > c.budget.max && !EXPLICIT_CHANGE.test(userText)) { refused.push({ ...op, raison: 'budget strict : demander une confirmation explicite au client' }); continue; }
        if (op.op === 'remove' && op.path.startsWith('amenities') && draft.state.amenities.required.includes(op.value) && !CONFIRM.test(userText)) { refused.push({ ...op, raison: 'critère indispensable : demander confirmation' }); continue; }
        try { draft.state = applyOperations(draft.state, [op]); applied.push(op); } catch (error) { refused.push({ ...op, raison: error.message.slice(0, 80) }); }
      }
      const motivations = (Array.isArray(args.motivations) ? args.motivations : []).filter((m) => MOTIVATIONS.includes(m));
      draft.state = addMotivations(draft.state, motivations);
      return { memoire: describeState(draft.state), appliquees: applied.map(({ op, path, value }) => ({ op, path, value })), refusees: refused.map(({ op, path, value, raison }) => ({ op, path, value, raison })) };
    },
    async search_properties() { return allowedAction === 'clarify' ? toolError('recherche_non_autorisee', 'Une clarification est requise avant la recherche.') : search(); },
    async get_public_property_details(args) {
      if (!known(args.property_id)) return toolError('identifiant_inconnu', 'Seules les annonces déjà présentées peuvent être détaillées.');
      const listing = listingOf(args.property_id);
      if (!listing) return toolError('details_indisponibles');
      remember([listing]);
      return publicCard(listing, draft.state);
    },
    async evaluate_property_match(args) {
      const ids = [...new Set(args.property_ids || [])];
      if (!ids.length || ids.some((id) => !known(id))) return toolError('identifiant_inconnu', 'Seules les annonces déjà présentées peuvent être évaluées.');
      const listings = ids.map((id) => listingOf(id)).filter(Boolean);
      remember(listings);
      return { evaluations: listings.map((l) => publicCard(l, draft.state)) };
    },
    async compare_properties(args) {
      const ids = [...new Set(args.property_ids || [])];
      if (ids.length < 2 || ids.length > 5 || ids.some((id) => !known(id))) return toolError('identifiants_invalides', 'Comparer 2 à 5 annonces déjà présentées.');
      const comparison = await engine.comparePublished(ids, { signal });
      facts.comparison = comparison;
      const fits = Object.fromEntries((comparison.items || []).map((i) => [i.listing.id, evaluateListing(draft.state, i.listing)]));
      emit('facts', { comparison, fits, criteria: describeFilters(draft.state) });
      const out = { biens: (comparison.items || []).map((i) => publicCard(i.listing, draft.state)), ...differences((comparison.items || []).map((i) => i.listing)) };
      if (comparison.unavailable?.length) out.non_comparables = { nombre: comparison.unavailable.length, raison: 'le moteur de comparaison ne vérifie pas ces annonces (hébergements sans fiche de séjour publique) ; dis-le simplement, sans inventer de différence' };
      return out;
    },
    async propose_alternative(args) {
      const finder = args.reason === 'plus_d_espace' ? proposeMoreSpace : proposeRelaxation;
      const proposal = await finder(draft.state, (_q, relaxed) => searchState(relaxed));
      if (!proposal) return { compromis: null, message: 'Aucun compromis simple ne donne d’annonce publiée.' };
      draft.state.pendingRelaxation = proposal; facts.proposal = proposal;
      return { compromis: { id: proposal.id, changement: proposal.label, criteres_conserves: proposal.preserved, raison: proposal.rationale, annonces_trouvees: proposal.count }, consigne: 'Présente ce compromis et demande l’accord du client. Ne l’applique pas sans son accord explicite.' };
    },
    async apply_alternative(args) {
      const pending = draft.state.pendingRelaxation;
      if (!pending || pending.id !== args.alternative_id) return toolError('aucun_compromis_en_attente');
      if (!interp.intents.accept) return toolError('accord_explicite_requis', 'Le client n’a pas accepté explicitement ce compromis.');
      draft.state = applyOperations(draft.state, pending.operations);
      draft.state.acceptedRelaxations = [...draft.state.acceptedRelaxations.filter((id) => id !== pending.id), pending.id].slice(-LIMITS.rejected);
      draft.state.pendingRelaxation = null;
      return { compromis_applique: pending.label, ...(await search()) };
    },
    async decline_alternative(args) {
      const pending = draft.state.pendingRelaxation;
      if (!pending || pending.id !== args.alternative_id) return toolError('aucun_compromis_en_attente');
      draft.state.rejectedRelaxations = [...draft.state.rejectedRelaxations.filter((id) => id !== pending.id), pending.id].slice(-LIMITS.rejected);
      draft.state.pendingRelaxation = null;
      return { refus_enregistre: pending.label, criteres: describeState(draft.state) };
    },
  };

  return {
    facts,
    calls: () => calls,
    // Recherche décidée par le serveur : comptée dans le plafond d'outils du tour, comme un appel du modèle.
    ensureSearch: () => { calls += 1; return search(); },
    async run(call) {
      if (!TOOL_NAMES.includes(call.name)) return { name: call.name, result: toolError('outil_inconnu', 'Outil non autorisé.') };
      let args;
      try { args = call.arguments ? JSON.parse(call.arguments) : {}; } catch { return { name: call.name, result: toolError('arguments_invalides') }; }
      if (!args || typeof args !== 'object' || Array.isArray(args)) return { name: call.name, result: toolError('arguments_invalides') };
      const key = `${call.name}:${JSON.stringify(args)}`;
      if (done.has(key)) return { name: call.name, result: { deja_execute: true, ...done.get(key) } };
      if (calls >= maxCalls) return { name: call.name, result: toolError('limite_appels', 'Nombre maximal d’outils pour ce tour atteint : réponds au client.') };
      calls += 1;
      const result = await handlers[call.name](args);
      done.set(key, result);
      return { name: call.name, result };
    },
  };
}

module.exports = { TOOL_DEFINITIONS, TOOL_NAMES, publicCard, isGeneralCatalogRequest, resetForGeneralRequest, filterGeneralListing, createToolRunner };
