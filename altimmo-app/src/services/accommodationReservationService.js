import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import api, { getToken } from './api';
import { cache } from './cacheService';
import { environment } from '../config/environment';

const TTL = 3 * 60 * 1000;
const key = (path, params = {}) => `accommodation-reservations:${path}:${JSON.stringify(params)}`;

async function cachedGet(path, params = {}, { refresh = false } = {}) {
  const cacheKey = key(path, params);
  if (!refresh) {
    const saved = cache.get(cacheKey);
    if (saved) return { data: saved, offline: false, cached: true };
  }
  try {
    const response = await api.get(path, { params });
    const data = response.data?.data;
    cache.set(cacheKey, data, TTL);
    return { data, offline: false, cached: false };
  } catch (error) {
    const saved = cache.get(cacheKey);
    if (error.normalized?.isNetworkError && saved) return { data: saved, offline: true, cached: true };
    throw error;
  }
}

export const listAccommodationReservations = (params = {}, options) => cachedGet('/accommodation-reservations', params, options);
export const getAccommodationReservation = (id, options) => cachedGet(`/accommodation-reservations/${id}`, {}, options);
export const getAccommodationAvailability = (id, params, options) => cachedGet(`/accommodations/${id}/availability`, params, options);
export const getAccommodationFinancialSummary = (id, options) => cachedGet(`/accommodation-reservations/${id}/financial-summary`, {}, options);
export const getAccommodationRefundableSummary = (id, options) => cachedGet(`/accommodation-reservations/${id}/refundable-summary`, {}, options);
export const getFinancialDocument = (id, options) => cachedGet(`/financial/documents/${id}`, {}, options);
export const getFinancialDocumentPdf = (id, options) => cachedGet(`/financial/documents/${id}/pdf`, {}, options);

const invalidateReservations = () => cache.invalidate('accommodation-reservations:');
export async function createAccommodationReservation(payload) {
  const response = await api.post('/accommodation-reservations', { ...payload, source: 'mobile' });
  invalidateReservations();
  return response.data?.data?.reservation;
}
export async function cancelAccommodationReservation(id, reason) {
  const response = await api.post(`/accommodation-reservations/${id}/cancel`, { reason });
  invalidateReservations();
  return response.data?.data?.reservation;
}
export async function requestAccommodationRefund(id, payload, idempotencyKey) {
  const response = await api.post(`/accommodation-reservations/${id}/refunds`, payload, { headers: { 'Idempotency-Key': idempotencyKey } });
  invalidateReservations();
  return response.data?.data;
}

export async function downloadFinancialDocument(documentId, documentNumber = 'facture') {
  const token = await getToken();
  const safeName = String(documentNumber || 'facture').replace(/[^a-zA-Z0-9_-]/g, '_');
  const target = `${FileSystem.cacheDirectory}${safeName}.pdf`;
  const result = await FileSystem.downloadAsync(
    `${environment.apiUrl}/financial/documents/${documentId}/pdf/download`,
    target,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (result.status < 200 || result.status >= 300) throw new Error('Téléchargement du document impossible.');
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', dialogTitle: 'Ouvrir la facture' });
  return result.uri;
}
