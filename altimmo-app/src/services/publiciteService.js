import api from './api';
import { cache } from './cacheService';

export async function getActivePublicites() {
  const KEY = 'publicites:active';
  const hit = cache.get(KEY);
  if (hit) return hit;
  const res = await api.get('/publicites/active');
  const data = res.data?.data?.publicites || res.data?.publicites || [];
  // Mise en cache 15 minutes — les pubs changent très rarement
  cache.set(KEY, data, 15 * 60 * 1000);
  return data;
}
