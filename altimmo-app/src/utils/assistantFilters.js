// ALTIMMO-AI-01 — filtres transmis à l'assistant depuis la liste d'annonces (« Affiner avec
// l'IA »). Miroir de client/lib/utils/assistantFilters.js : seuls les filtres publics
// explicitement autorisés sont transmis ; le serveur les revalide intégralement.
import { buildPropertyQueryParams } from './propertyQueryParams';

export const ASSISTANT_FILTER_KEYS = Object.freeze([
  'offerType', 'propertyType', 'accommodationType', 'city', 'arrondissement', 'minPrice', 'maxPrice', 'minBedrooms',
]);

const SENTINELS = /^(tous|toutes|all)$/i;
const MAX_VALUE_LENGTH = 60;

/** @param {object|null} source — objet de paramètres (chaînes). */
export function pickAssistantFilters(source) {
  if (!source || typeof source !== 'object') return {};
  const out = {};
  ASSISTANT_FILTER_KEYS.forEach((key) => {
    const value = source[key];
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_VALUE_LENGTH || SENTINELS.test(trimmed)) return;
    out[key] = trimmed;
  });
  return out;
}

/** Filtres actifs de la liste (même nomenclature que la recherche) → filtres de l'assistant. */
export function assistantFiltersFromListFilters(listFilters) {
  if (!listFilters) return {};
  // Décodage manuel : l'URLSearchParams de React Native n'implémente pas toutes les méthodes.
  const decode = (s) => { try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch { return ''; } };
  const object = {};
  buildPropertyQueryParams(listFilters).split('&').filter(Boolean).forEach((pair) => {
    const [key, value = ''] = pair.split('=');
    object[decode(key)] = decode(value);
  });
  return pickAssistantFilters(object);
}
