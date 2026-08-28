import api from './api';
import { cache } from './cacheService';

export const PUBLICITES_CACHE_PREFIX = 'publicites:';
export const PUBLICITES_CACHE_KEY = `${PUBLICITES_CACHE_PREFIX}active`;

export async function getActivePublicites({ forceRefresh = false } = {}) {
  if (forceRefresh) cache.invalidate(PUBLICITES_CACHE_PREFIX);

  const hit = cache.get(PUBLICITES_CACHE_KEY);
  // [] est un succès valide et cacheable. Un refocus/pull-to-refresh appelle
  // explicitement forceRefresh pour ne pas rester bloqué sur ce succès vide.
  if (hit !== null) return hit;

  const res = await api.get('/publicites/active');
  const data = res.data?.data?.publicites || res.data?.publicites || [];
  // Mise en cache 15 minutes — les pubs changent très rarement
  cache.set(PUBLICITES_CACHE_KEY, data, 15 * 60 * 1000);
  return data;
}
