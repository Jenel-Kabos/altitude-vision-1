import api from './api';

// TENANT-CORE-1 — pur wrapper HTTP autour de /api/platform-tenants/*.
// Aucune décision métier ici. Nommé `platformTenantService` (jamais
// `tenantService` seul) pour rester cohérent avec le préfixe `PlatformTenant`
// choisi côté backend afin d'éviter toute confusion avec l'espace locataire
// existant (`tenantLinkService`, `TENANT_PORTAL`).

export const listTenants = async (params = {}) => (await api.get('/platform-tenants', { params })).data.data.tenants;
export const createTenant = async (payload) => (await api.post('/platform-tenants', payload)).data.data.tenant;
export const getTenantOverview = async (id) => (await api.get(`/platform-tenants/${id}`)).data.data.overview;
export const suspendTenant = async (id, reason) => (await api.patch(`/platform-tenants/${id}/suspend`, { reason })).data.data.tenant;
export const reactivateTenant = async (id) => (await api.patch(`/platform-tenants/${id}/reactivate`)).data.data.tenant;
export const archiveTenant = async (id) => (await api.patch(`/platform-tenants/${id}/archive`)).data.data.tenant;

export const updateTenantSettings = async (id, payload) => (await api.patch(`/platform-tenants/${id}/settings`, payload)).data.data.settings;
export const updateTenantTheme = async (id, payload) => (await api.patch(`/platform-tenants/${id}/theme`, payload)).data.data.theme;

export const addTenantDomain = async (id, payload) => (await api.post(`/platform-tenants/${id}/domains`, payload)).data.data.domain;
export const verifyTenantDomain = async (domainId) => (await api.patch(`/platform-tenants/domains/${domainId}/verify`)).data.data.domain;

export const listTenantFeatures = async (id) => (await api.get(`/platform-tenants/${id}/features`)).data.data.features;
export const setTenantFeature = async (id, moduleKey, enabled) => (await api.patch(`/platform-tenants/${id}/features/${moduleKey}`, { enabled })).data.data.feature;

export const changeTenantSubscription = async (id, payload) => (await api.post(`/platform-tenants/${id}/subscription`, payload)).data.data.subscription;
export const cancelTenantSubscription = async (id, reason) => (await api.delete(`/platform-tenants/${id}/subscription`, { data: { reason } })).data.data.subscription;
