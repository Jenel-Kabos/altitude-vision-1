import api from './api';

// PLATFORM-ADMIN-1 — pur wrapper HTTP autour de /api/platform-operators/*.
// Aucune décision métier ici (voir platformTenantService.js pour la même
// convention).

export const getMyOperatorStatus = async () => (await api.get('/platform-operators/me')).data.data.operator;
export const listOperators = async () => (await api.get('/platform-operators')).data.data.operators;
export const grantOperator = async (payload) => (await api.post('/platform-operators', payload)).data.data.operator;
export const suspendOperator = async (userId, reason) => (await api.patch(`/platform-operators/${userId}/suspend`, { reason })).data.data.operator;
export const reactivateOperator = async (userId, reason) => (await api.patch(`/platform-operators/${userId}/reactivate`, { reason })).data.data.operator;
export const revokeOperator = async (userId, reason) => (await api.patch(`/platform-operators/${userId}/revoke`, { reason })).data.data.operator;

// Sélection de tenant côté client (voir intercepteur dans api.js). `null`
// = mode plateforme (aucun tenant sélectionné) — jamais l'état par défaut
// silencieux d'un utilisateur ordinaire, seul un opérateur actif voit
// l'UI qui appelle ces fonctions (voir AdminDashboard.jsx).
const STORAGE_KEY = 'platformOperatorTenantId';

export const getSelectedPlatformTenantId = () => (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null);

export const setSelectedPlatformTenantId = (tenantId) => {
  if (typeof window === 'undefined') return;
  if (tenantId) localStorage.setItem(STORAGE_KEY, tenantId);
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('altimmo:platform-operator:tenant-changed', { detail: { tenantId: tenantId || null } }));
};
