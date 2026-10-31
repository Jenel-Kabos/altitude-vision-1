// ALTIMMO-AI-01 — filtres transmis à l'assistant depuis une liste d'annonces
// (« Affiner avec l'IA »). Seuls les filtres publics explicitement autorisés sont transmis ;
// le serveur les revalide intégralement (liste blanche + catalogue) à la réception.

export const ASSISTANT_FILTER_KEYS = Object.freeze([
  'offerType', 'propertyType', 'accommodationType', 'city', 'arrondissement', 'minPrice', 'maxPrice', 'minBedrooms',
]);

const SENTINELS = /^(tous|toutes|all)$/i;
const MAX_VALUE_LENGTH = 60;

/**
 * @param {URLSearchParams|object|null} source — paramètres de l'URL (ou objet équivalent).
 * @returns {object} filtres autorisés, non vides, sous forme de chaînes.
 */
export function pickAssistantFilters(source) {
  if (!source) return {};
  const get = typeof source.get === 'function' ? (key) => source.get(key) : (key) => source[key];
  const out = {};
  ASSISTANT_FILTER_KEYS.forEach((key) => {
    const value = get(key);
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_VALUE_LENGTH || SENTINELS.test(trimmed)) return;
    out[key] = trimmed;
  });
  return out;
}

/** Lien vers l'assistant, critères de la liste repris. */
export function assistantHref(filters) {
  const params = new URLSearchParams(pickAssistantFilters(filters));
  const query = params.toString();
  return query ? `/immobilier/assistant?${query}` : '/immobilier/assistant';
}
