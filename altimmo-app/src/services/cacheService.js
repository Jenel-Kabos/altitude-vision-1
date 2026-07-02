/**
 * CacheService — cache mémoire TTL avec stats par catégorie.
 * Utilisé pour les données API (annonces, carte, publicités, visites…).
 * Le cache image (expo-image) est géré séparément via Image.clearDiskCache().
 */

const store = new Map();

export const CACHE_CATEGORIES = [
  { key: 'annonces',        prefix: 'properties:',  label: 'Annonces',        icon: 'home-outline'      },
  { key: 'carte',           prefix: 'carte:',        label: 'Carte',           icon: 'map-outline'       },
  { key: 'recommandations', prefix: 'recommended:',  label: 'Recommandations', icon: 'star-outline'      },
  { key: 'publicites',      prefix: 'publicite:',    label: 'Publicités',      icon: 'megaphone-outline' },
  { key: 'visites',         prefix: 'visites:',      label: 'Visites',         icon: 'calendar-outline'  },
];

export const cache = {
  get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return entry.data;
  },

  set(key, data, ttlMs = 5 * 60 * 1000) {
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
  },

  invalidate(prefix) {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },

  clear() {
    store.clear();
  },

  purgeExpired() {
    const now = Date.now();
    for (const [key, val] of store.entries()) {
      if (now > val.expiresAt) store.delete(key);
    }
    return store.size;
  },

  count() {
    this.purgeExpired();
    return store.size;
  },

  countByPrefix(prefix) {
    this.purgeExpired();
    let n = 0;
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) n++;
    }
    return n;
  },

  getStats() {
    this.purgeExpired();
    const now = Date.now();
    const entries = [];
    for (const [key, val] of store.entries()) {
      entries.push({ key, ttlLeftMs: val.expiresAt - now });
    }
    const byCategory = CACHE_CATEGORIES.map(cat => ({
      ...cat,
      count: entries.filter(e => e.key.startsWith(cat.prefix)).length,
    }));
    return { total: entries.length, byCategory };
  },
};
