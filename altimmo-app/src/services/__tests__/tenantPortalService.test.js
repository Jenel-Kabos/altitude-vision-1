jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() }, getToken: jest.fn().mockResolvedValue('token') }));
jest.mock('../cacheService', () => ({ cache: { get: jest.fn(), set: jest.fn(), invalidate: jest.fn() } }));
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', downloadAsync: jest.fn().mockResolvedValue({ status: 200, uri: 'file:///cache/bail.pdf' }) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn().mockResolvedValue(false), shareAsync: jest.fn() }));

import api from '../api';
import { cache } from '../cacheService';
import * as FileSystem from 'expo-file-system/legacy';
import { createTenantMaintenance, downloadTenantDocument, getTenantDashboard } from '../tenantPortalService';

describe('service portail locataire Mobile', () => {
  beforeEach(() => jest.clearAllMocks());

  test('consomme le même dashboard que le Web et met la lecture en cache', async () => {
    api.get.mockResolvedValue({ data: { data: { dashboard: { montantRestant: 12000 } } } });
    await expect(getTenantDashboard()).resolves.toEqual({ data: { dashboard: { montantRestant: 12000 } }, offline: false });
    expect(api.get).toHaveBeenCalledWith('/tenant-portal/dashboard', { params: {} });
    expect(cache.set).toHaveBeenCalled();
  });

  test('retourne le cache uniquement lors d une erreur réseau de lecture', async () => {
    api.get.mockRejectedValue({ normalized: { isNetworkError: true } });
    cache.get.mockReturnValue({ dashboard: { montantRestant: 10 } });
    await expect(getTenantDashboard()).resolves.toEqual({ data: { dashboard: { montantRestant: 10 } }, offline: true });
  });

  test('ne met jamais en file une mutation maintenance hors connexion', async () => {
    api.post.mockRejectedValue({ normalized: { isNetworkError: true } });
    await expect(createTenantMaintenance({ category: 'plomberie', description: 'Une fuite' })).rejects.toMatchObject({ normalized: { isNetworkError: true } });
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  test('télécharge via le proxy authentifié sans demander une URL Cloudinary', async () => {
    await expect(downloadTenantDocument('doc-1', 'bail.pdf')).resolves.toBe('file:///cache/bail.pdf');
    expect(FileSystem.downloadAsync).toHaveBeenCalledWith(
      expect.stringContaining('/tenant-portal/documents/doc-1/download'),
      'file:///cache/bail.pdf',
      { headers: { Authorization: 'Bearer token' } },
    );
    expect(api.get).not.toHaveBeenCalled();
  });
});
