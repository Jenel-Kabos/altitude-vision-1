import api from '../api';
import { cache, CACHE_CATEGORIES } from '../cacheService';
import {
  PUBLICITES_CACHE_KEY,
  PUBLICITES_CACHE_PREFIX,
  getActivePublicites,
} from '../publiciteService';

jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const PUBLICITE = {
  _id: 'pub-1',
  titre: 'Campagne Altimmo',
  media: 'https://res.cloudinary.com/dop8vzm5z/image/upload/v1/pub.jpg',
};

describe('publiciteService — fetch et cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockReset();
    cache.clear();
  });

  test('utilise le namespace canonique déclaré par la catégorie de cache', () => {
    const category = CACHE_CATEGORIES.find((item) => item.key === 'publicites');

    expect(PUBLICITES_CACHE_PREFIX).toBe('publicites:');
    expect(PUBLICITES_CACHE_KEY).toBe(`${PUBLICITES_CACHE_PREFIX}active`);
    expect(category?.prefix).toBe(PUBLICITES_CACHE_PREFIX);
  });

  test('écrit, relit puis invalide la publicité avec le même préfixe', async () => {
    api.get.mockResolvedValueOnce({ data: { data: { publicites: [PUBLICITE] } } });

    await expect(getActivePublicites()).resolves.toEqual([PUBLICITE]);
    await expect(getActivePublicites()).resolves.toEqual([PUBLICITE]);
    expect(api.get).toHaveBeenCalledTimes(1);

    cache.invalidate(PUBLICITES_CACHE_PREFIX);
    api.get.mockResolvedValueOnce({ data: { data: { publicites: [] } } });
    await expect(getActivePublicites()).resolves.toEqual([]);
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  test('un succès vide reste un succès cacheable mais forceRefresh le revalide', async () => {
    api.get
      .mockResolvedValueOnce({ data: { data: { publicites: [] } } })
      .mockResolvedValueOnce({ data: { data: { publicites: [PUBLICITE] } } });

    await expect(getActivePublicites()).resolves.toEqual([]);
    await expect(getActivePublicites()).resolves.toEqual([]);
    expect(api.get).toHaveBeenCalledTimes(1);

    await expect(getActivePublicites({ forceRefresh: true })).resolves.toEqual([PUBLICITE]);
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  test('une erreur réseau n’est jamais mise en cache comme un succès vide', async () => {
    const networkError = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
    api.get
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({ data: { data: { publicites: [PUBLICITE] } } });

    await expect(getActivePublicites()).rejects.toBe(networkError);
    await expect(getActivePublicites()).resolves.toEqual([PUBLICITE]);
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
