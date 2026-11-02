'use strict';
// Intention du message (côté serveur, avant le modèle) : affiner, nouvelle recherche ou exploration du catalogue.
// Produit des opérations mémoire structurées : les anciens critères restent dans l'historique, pas dans les filtres actifs.
// Le texte reçu est déjà normalisé (minuscules, sans accents, apostrophes droites).

const EXPLORE = [
  /\b(tous|toutes|tout)\b.{0,25}\b(biens|annonces|proprietes|offres|logements)\b/,
  /\b(ton|votre|vos|le|du) catalogue\b/,
  /tout ce que (vous|tu) (avez|as|proposez|proposes)/,
  /(qu'avez-vous|qu'est-ce que vous avez)/,
  /(oublie[rz]?|efface[rz]?) (mes|les|tous mes) (anciens )?criteres/,
  /\b(recommencons|recommencer|repartons de zero|repartir de zero|on recommence)\b/,
  /(decouvrir|explorer|parcourir) (toutes |tous )?(vos|tes|les) (annonces|biens|offres)/,
  /(montre|propose|presente)[sz]?-moi (les|vos|tes) (biens|annonces|offres) (disponibles|publie)/,
  /\b(quels?|quelles?)\b.*\b(biens?|annonces?|proprietes?)\b.*\b(publie|disponible|propos|comme)/,
];
const BUDGET_FREE = /((peu importe|quel que soit|quelque soit|n'importe quel) (le |mon |la )?(budget|prix|loyer|montant)|sans (limite|plafond|restriction|contrainte) (de |du )?(prix|budget|loyer)|budget (illimite|libre|ouvert)|pas de (limite de )?budget)/;
const DISTRICT_FREE = /(oublie[rz]? le quartier|peu importe le quartier|quel que soit le quartier|n'importe quel (quartier|arrondissement)|dans toute la ville|toute la ville|tous les quartiers)/;
const TYPE_FREE = /(peu importe le type|quel que soit le type|n'importe quel type|tous (les )?types|tout type)/;
const CITY_FREE = /(peu importe la ville|n'importe quelle ville|toutes les villes)/;
const NEW_PROJECT = /(on change de projet|changeons de projet|un autre projet|nouvelle recherche|une autre recherche|nouveau projet)/;
const CATEGORY = { Maison: 'logement', Villa: 'logement', Appartement: 'logement', Studio: 'logement', Duplex: 'logement', Terrain: 'terrain', Bureau: 'professionnel', Commerce: 'professionnel', Hôtel: 'hebergement' };

// Chemins de filtres actifs ; la mémoire de la conversation (historique, motivations) n'est pas touchée.
const PROJECT_PATHS = ['budget.min', 'budget.max', 'budget.strict', 'budget.period', 'budget.unrestricted', 'furnished', 'bedrooms.min', 'surface.min', 'proximity.school', 'proximity.market'];
const valueOf = (state, path) => (path.startsWith('proximity.') ? state.proximity[path.split('.')[1]] : path.split('.').reduce((o, k) => o?.[k], state.criteria));
const isSet = (v) => !(v === null || v === undefined || v === false || (Array.isArray(v) && !v.length));
const op = (o, path, value) => (value === undefined ? { op: o, path, source: 'explicit' } : { op: o, path, value, source: 'explicit' });
const removeAll = (state, paths) => paths.filter((p) => isSet(valueOf(state, p))).map((p) => op('remove', p));
const removeAmenities = (state) => [...state.amenities.required, ...state.amenities.preferred].map((a) => op('remove', 'amenities.preferred', a));

function isExploreRequest(n) { return EXPLORE.some((pattern) => pattern.test(n)); }

/**
 * @param n texte normalisé ; @param state état avant le tour ; @param found { types, tx, operations } extraits par l'interpréteur.
 * @returns { intent, operations } : opérations finales du tour, dans l'ordre d'application.
 */
function classifyIntent(n, state, { types, tx, operations }) {
  const c = state.criteria;
  const removals = [];
  const located = operations.some((o) => (o.path === 'city' || o.path === 'district') && o.op !== 'remove');

  // C. Exploration libre : aucun type ni opération demandé, demande ouverte sur le catalogue.
  if (!types.length && !tx.length && isExploreRequest(n)) {
    const paths = ['transaction', 'propertyType', 'propertyTypes', ...PROJECT_PATHS, ...(located ? [] : ['district', 'city'])];
    const kept = operations.filter((o) => o.path === 'city' || o.path === 'district');
    const out = [...removeAll(state, paths), ...removeAmenities(state), ...kept];
    if (c.mode !== 'explore') out.push(op('set', 'mode', 'explore'));
    return { intent: 'explore', operations: out };
  }

  // B. Nouvelle recherche : changement de catégorie de bien ou de projet annoncé.
  const previous = c.propertyTypes.length ? c.propertyTypes : c.propertyType ? [c.propertyType] : [];
  const categoryChange = types.length && previous.length && !types.some((t) => previous.some((p) => CATEGORY[p] === CATEGORY[t]));
  const intent = (categoryChange || (NEW_PROJECT.test(n) && (types.length || tx.length))) ? 'new_search' : 'refine';
  if (intent === 'new_search') {
    removals.push(...removeAll(state, [...PROJECT_PATHS, ...(tx.length ? [] : ['transaction']), ...(types.length ? [] : ['propertyType', 'propertyTypes'])]), ...removeAmenities(state));
  }

  // Suppressions explicites (affinage) : aucune borne ne subsiste, jamais remplacée par zéro.
  if (BUDGET_FREE.test(n)) removals.push(...removeAll(state, ['budget.min', 'budget.max', 'budget.strict', 'budget.period']), op('set', 'budget.unrestricted', true));
  if (DISTRICT_FREE.test(n)) removals.push(...removeAll(state, ['district']));
  if (CITY_FREE.test(n)) removals.push(...removeAll(state, ['district', 'city']));
  if (TYPE_FREE.test(n)) removals.push(...removeAll(state, ['propertyType', 'propertyTypes']));

  // Plusieurs types acceptés : « maison ou appartement ».
  const extra = [];
  if (types.length >= 2 && JSON.stringify(c.propertyTypes) !== JSON.stringify(types)) extra.push(op('set', 'propertyTypes', types));

  const seen = new Set(removals.map((o) => `${o.op}:${o.path}:${o.value ?? ''}`));
  const rest = operations.filter((o) => !seen.has(`${o.op}:${o.path}:${o.value ?? ''}`) && !(o.path.startsWith('budget.') && BUDGET_FREE.test(n) && o.op !== 'remove'));
  return { intent, operations: [...removals, ...rest, ...extra] };
}

module.exports = { isExploreRequest, classifyIntent };
