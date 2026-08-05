import api from './api';
import { getToken } from './api';
import { cache } from './cacheService';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { environment } from '../config/environment';

const CACHE_PREFIX = 'tenant-portal:';
const TTL = 3 * 60 * 1000;

async function cachedGet(key, path, params = {}) {
  const cacheKey = `${CACHE_PREFIX}${key}:${JSON.stringify(params)}`;
  try {
    const response = await api.get(path, { params });
    const data = response.data?.data;
    cache.set(cacheKey, data, TTL);
    return { data, offline: false };
  } catch (error) {
    const cached = cache.get(cacheKey);
    if (cached && error.normalized?.isNetworkError) return { data: cached, offline: true };
    throw error;
  }
}

export const getTenantDashboard = () => cachedGet('dashboard', '/tenant-portal/dashboard');
export const getTenantProfile = () => cachedGet('profile', '/tenant-portal/me');
export const getTenantLeases = () => cachedGet('leases', '/tenant-portal/leases');
export const getTenantPayments = (params = {}) => cachedGet('payments', '/tenant-portal/payments', params);
export const getTenantDocuments = (params = {}) => cachedGet('documents', '/tenant-portal/documents', params);
export const getTenantNotice = () => cachedGet('notice', '/tenant-portal/notice');
export const getTenantMaintenance = (params = {}) => cachedGet('maintenance', '/tenant-portal/maintenance', params);
export const getTenantLinkStatus = () => cachedGet('link-status', '/tenant-portal/link-status');

export async function activateTenantInvitation(token) {
  const response = await api.post('/tenant-portal/activate', { token });
  cache.invalidate(CACHE_PREFIX);
  return response.data?.data;
}

export async function createTenantMaintenance({ category, description, photos = [] }) {
  const body = new FormData();
  body.append('category', category);
  body.append('description', description);
  photos.forEach((photo, index) => body.append('photos', {
    uri: photo.uri,
    name: photo.fileName || `maintenance-${index + 1}.jpg`,
    type: photo.mimeType || 'image/jpeg',
  }));
  const response = await api.post('/tenant-portal/maintenance', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  cache.invalidate(CACHE_PREFIX);
  return response.data?.data?.ticket;
}

export async function downloadTenantDocument(documentId, name = 'document') {
  const token = await getToken();
  const safeName = String(name || 'document').replace(/[^a-zA-Z0-9._-]/g, '-');
  const result = await FileSystem.downloadAsync(
    `${environment.apiUrl}/tenant-portal/documents/${encodeURIComponent(documentId)}/download`,
    `${FileSystem.cacheDirectory}${safeName}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (result.status < 200 || result.status >= 300) throw new Error('Téléchargement impossible.');
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { dialogTitle: name });
  return result.uri;
}

export const clearTenantPortalCache = () => cache.invalidate(CACHE_PREFIX);
