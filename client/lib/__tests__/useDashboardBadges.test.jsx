import { renderHook, waitFor, act } from '@testing-library/react';
import { useDashboardBadges } from '../hooks/useDashboardBadges';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

const okResponse = (unreadCount) => Promise.resolve({ data: { data: { unreadCount } } });
const countResponse = (count) => Promise.resolve({ data: { data: { count } } });

const mockCoreEndpoints = () => {
  api.get.mockImplementation((url) => {
    if (url === '/conversations/count/unread') return okResponse(0);
    if (url === '/internal-mails/count/unread') return okResponse(0);
    if (url === '/litiges/unread-count') return okResponse(0);
    if (url === '/contact/unread-count') return okResponse(0);
    if (url === '/visites/unread-count') return okResponse(0);
    if (url === '/properties/status/pending-count') return okResponse(0);
    if (url === '/estimation/unread-count') return okResponse(0);
    return Promise.reject(new Error(`unexpected url: ${url}`));
  });
};

describe('useDashboardBadges — badge Activations professionnelles (tenantApplications)', () => {
  beforeEach(() => { vi.clearAllMocks(); mockCoreEndpoints(); });

  test('sans capacité, aucune requête pending-count n’est envoyée et le badge reste à 0', async () => {
    const { result } = renderHook(() => useDashboardBadges(true, false));
    await waitFor(() => expect(result.current.badges.conversations).toBe(0));
    expect(result.current.badges.tenantApplications).toBe(0);
    expect(api.get).not.toHaveBeenCalledWith('/platform-tenants/applications/pending-count', expect.anything());
  });

  test('avec capacité et un dossier en attente, le badge reflète le compte exact', async () => {
    api.get.mockImplementation((url, config) => {
      if (url === '/platform-tenants/applications/pending-count') {
        expect(config).toEqual(expect.objectContaining({ platformScoped: true }));
        return countResponse(3);
      }
      if (url === '/conversations/count/unread') return okResponse(0);
      if (url === '/internal-mails/count/unread') return okResponse(0);
      if (url === '/litiges/unread-count') return okResponse(0);
      if (url === '/contact/unread-count') return okResponse(0);
      if (url === '/visites/unread-count') return okResponse(0);
      if (url === '/properties/status/pending-count') return okResponse(0);
      if (url === '/estimation/unread-count') return okResponse(0);
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    const { result } = renderHook(() => useDashboardBadges(true, true));
    await waitFor(() => expect(result.current.badges.tenantApplications).toBe(3));
  });

  test('avec capacité et zéro dossier en attente, le badge est à 0', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/platform-tenants/applications/pending-count') return countResponse(0);
      return okResponse(0);
    });
    const { result } = renderHook(() => useDashboardBadges(true, true));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/platform-tenants/applications/pending-count', expect.anything()));
    expect(result.current.badges.tenantApplications).toBe(0);
  });

  test('une erreur sur pending-count échoue fermé (0) sans bloquer les autres badges', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/platform-tenants/applications/pending-count') return Promise.reject(new Error('403'));
      if (url === '/conversations/count/unread') return okResponse(5);
      return okResponse(0);
    });
    const { result } = renderHook(() => useDashboardBadges(true, true));
    await waitFor(() => expect(result.current.badges.conversations).toBe(5));
    expect(result.current.badges.tenantApplications).toBe(0);
  });

  test('un rafraîchissement manuel met à jour le compte après une action de revue', async () => {
    let count = 1;
    api.get.mockImplementation((url) => {
      if (url === '/platform-tenants/applications/pending-count') return countResponse(count);
      return okResponse(0);
    });
    const { result } = renderHook(() => useDashboardBadges(true, true));
    await waitFor(() => expect(result.current.badges.tenantApplications).toBe(1));

    count = 0;
    await act(async () => { await result.current.refreshAllBadges(); });
    expect(result.current.badges.tenantApplications).toBe(0);
  });
});
