import api from './api';

// API-PUBLIC-1 (Phase 9) — pur wrapper HTTP autour de /api/dev-portal/*.
// Aucune décision métier ici.

export const listApiKeys = async () => (await api.get('/dev-portal/keys')).data.data.keys;
export const createApiKey = async (payload) => (await api.post('/dev-portal/keys', payload)).data.data; // { apiKey, rawKey }
export const revokeApiKey = async (id, reason) => (await api.post(`/dev-portal/keys/${id}/revoke`, { reason })).data.data.apiKey;
export const rotateApiKey = async (id, reason) => (await api.post(`/dev-portal/keys/${id}/rotate`, { reason })).data.data; // { apiKey, rawKey }
export const getCallLogs = async (params = {}) => (await api.get('/dev-portal/call-logs', { params })).data.data.logs;
export const getWebhookSubscriptions = async () => (await api.get('/dev-portal/webhooks')).data.data.subscriptions;
