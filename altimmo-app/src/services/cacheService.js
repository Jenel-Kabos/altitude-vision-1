const store = new Map();

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

  // Invalide toutes les entrées dont la clé commence par prefix
  invalidate(prefix) {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },

  clear() {
    store.clear();
  },
};
