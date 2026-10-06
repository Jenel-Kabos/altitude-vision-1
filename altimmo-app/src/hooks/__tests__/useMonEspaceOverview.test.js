// GL-MOBILE-CLIENT-SPACE-01 — vérifie que useMonEspaceOverview :
//   - agrège les 4 compteurs depuis les APIs backend réelles
//   - détecte le statut locataire (linked YES/NO)
//   - dégrade proprement si une API échoue (autres compteurs intacts)
//   - n'invente aucune valeur

import { renderHook, act, waitFor } from '@testing-library/react-native';

let mockFocusCallback;

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (callback) => {
      mockFocusCallback = callback;
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

jest.mock('../../services/transactionService', () => ({
  __esModule: true,
  getMyTransactions: jest.fn(),
}));

jest.mock('../../services/personalDocumentService', () => ({
  __esModule: true,
  getPersonalDocuments: jest.fn(),
}));

jest.mock('../../services/tenantPortalService', () => ({
  __esModule: true,
  getTenantLinkStatus: jest.fn(),
}));

const api = require('../../services/api').default;
const { getMyTransactions } = require('../../services/transactionService');
const { getPersonalDocuments } = require('../../services/personalDocumentService');
const { getTenantLinkStatus } = require('../../services/tenantPortalService');
const { useMonEspaceOverview } = require('../useMonEspaceOverview');

describe('useMonEspaceOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusCallback = undefined;
  });

  test('agrège les compteurs depuis les APIs réelles + linked YES', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/likes/my-favorites')) {
        return Promise.resolve({
          data: {
            status: 'success',
            results: 3,
            data: { favorites: { properties: [{ _id: 'p1' }, { _id: 'p2' }, { _id: 'p3' }], events: [], services: [] } },
          },
        });
      }
      if (url === '/visites/my') {
        return Promise.resolve({ data: { data: { visites: [{}, {}] } } });
      }
      return Promise.reject(new Error(`unexpected: ${url}`));
    });
    getMyTransactions.mockResolvedValue([{}, {}, {}, {}, {}]);
    getPersonalDocuments.mockResolvedValue({ documents: [{}] });
    getTenantLinkStatus.mockResolvedValue({ linked: true, locataire: { _id: 'loc-1' } });

    const { result } = renderHook(() => useMonEspaceOverview());
    await waitFor(() => expect(result.current.stats.favorites.loading).toBe(false));

    expect(result.current.stats.favorites.count).toBe(3);
    expect(result.current.stats.visits.count).toBe(2);
    expect(result.current.stats.transactions.count).toBe(5);
    expect(result.current.stats.documents.count).toBe(1);
    expect(result.current.tenantLink.linked).toBe(true);
    expect(result.current.tenantLink.data?.locataire?._id).toBe('loc-1');
  });

  test('linked NO lorsque backend renvoie linked=false', async () => {
    api.get.mockResolvedValue({ data: { status: 'success', results: 0, data: { favorites: { properties: [], events: [], services: [] } } } });
    getMyTransactions.mockResolvedValue([]);
    getPersonalDocuments.mockResolvedValue({ documents: [] });
    getTenantLinkStatus.mockResolvedValue({ linked: false });

    const { result } = renderHook(() => useMonEspaceOverview());
    await waitFor(() => expect(result.current.tenantLink.loading).toBe(false));
    expect(result.current.tenantLink.linked).toBe(false);
  });

  test('une API en échec ne casse pas les autres compteurs', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/likes/my-favorites')) return Promise.reject(new Error('boom favorites'));
      if (url === '/visites/my') return Promise.resolve({ data: { data: { visites: [{}] } } });
      return Promise.reject(new Error(`unexpected: ${url}`));
    });
    getMyTransactions.mockResolvedValue([{}, {}]);
    getPersonalDocuments.mockResolvedValue({ documents: [{}, {}, {}] });
    getTenantLinkStatus.mockRejectedValue(new Error('portal off'));

    const { result } = renderHook(() => useMonEspaceOverview());
    await waitFor(() => expect(result.current.stats.favorites.loading).toBe(false));

    expect(result.current.stats.favorites.count).toBeNull();
    expect(result.current.stats.favorites.error).toMatch(/boom favorites/);
    expect(result.current.stats.visits.count).toBe(1);
    expect(result.current.stats.transactions.count).toBe(2);
    expect(result.current.stats.documents.count).toBe(3);
    expect(result.current.tenantLink.linked).toBe(false); // fallback safe
  });

  test.each([
    [0, []],
    [1, [{ _id: 'p1' }]],
    [4, [{ _id: 'p1' }, { _id: 'p2' }, { _id: 'p3' }, { _id: 'p4' }]],
  ])('compte %i favori(s) depuis favorites.properties', async (expected, properties) => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/likes/my-favorites')) {
        return Promise.resolve({
          data: {
            status: 'success',
            results: properties.length,
            data: { favorites: { properties, events: [], services: [] } },
          },
        });
      }
      if (url === '/visites/my') return Promise.resolve({ data: { data: { visites: [] } } });
      return Promise.reject(new Error(`unexpected: ${url}`));
    });
    getMyTransactions.mockResolvedValue([]);
    getPersonalDocuments.mockResolvedValue({ documents: [] });
    getTenantLinkStatus.mockResolvedValue({ linked: false });

    const { result } = renderHook(() => useMonEspaceOverview());
    await waitFor(() => expect(result.current.stats.favorites.loading).toBe(false));

    expect(result.current.stats.favorites.count).toBe(expected);
  });

  test('une erreur visites ne masque pas le compteur favoris', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/likes/my-favorites')) {
        return Promise.resolve({
          data: {
            status: 'success',
            results: 1,
            data: { favorites: { properties: [{ _id: 'p1' }], events: [], services: [] } },
          },
        });
      }
      if (url === '/visites/my') return Promise.reject(new Error('visites indisponibles'));
      return Promise.reject(new Error(`unexpected: ${url}`));
    });
    getMyTransactions.mockResolvedValue([]);
    getPersonalDocuments.mockResolvedValue({ documents: [] });
    getTenantLinkStatus.mockResolvedValue({ linked: false });

    const { result } = renderHook(() => useMonEspaceOverview());
    await waitFor(() => expect(result.current.stats.visits.loading).toBe(false));

    expect(result.current.stats.favorites.count).toBe(1);
    expect(result.current.stats.favorites.error).toBeNull();
    expect(result.current.stats.visits.count).toBeNull();
    expect(result.current.stats.visits.error).toMatch(/visites indisponibles/);
  });

  test('recharge les favoris lorsque Mon espace reprend le focus', async () => {
    let properties = [{ _id: 'p1' }];
    api.get.mockImplementation((url) => {
      if (url.startsWith('/likes/my-favorites')) {
        return Promise.resolve({
          data: {
            status: 'success',
            results: properties.length,
            data: { favorites: { properties, events: [], services: [] } },
          },
        });
      }
      if (url === '/visites/my') return Promise.resolve({ data: { data: { visites: [] } } });
      return Promise.reject(new Error(`unexpected: ${url}`));
    });
    getMyTransactions.mockResolvedValue([]);
    getPersonalDocuments.mockResolvedValue({ documents: [] });
    getTenantLinkStatus.mockResolvedValue({ linked: false });

    const { result } = renderHook(() => useMonEspaceOverview());
    await waitFor(() => expect(result.current.stats.favorites.count).toBe(1));

    properties = [{ _id: 'p1' }, { _id: 'p2' }];
    await act(async () => { await mockFocusCallback(); });

    expect(result.current.stats.favorites.count).toBe(2);
  });

  test('refresh() relance toutes les sources', async () => {
    api.get.mockResolvedValue({ data: { status: 'success', results: 1, data: { favorites: { properties: [{ _id: 'p1' }], events: [], services: [] } } } });
    getMyTransactions.mockResolvedValue([]);
    getPersonalDocuments.mockResolvedValue({ documents: [] });
    getTenantLinkStatus.mockResolvedValue({ linked: false });

    const { result } = renderHook(() => useMonEspaceOverview());
    await waitFor(() => expect(result.current.stats.favorites.loading).toBe(false));
    const initialCalls = api.get.mock.calls.length;

    await act(async () => { await result.current.refresh(); });

    expect(api.get.mock.calls.length).toBeGreaterThan(initialCalls);
    expect(getMyTransactions).toHaveBeenCalledTimes(2);
    expect(getTenantLinkStatus).toHaveBeenCalledTimes(2);
  });
});
