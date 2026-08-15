import api from './api';

// SYNC-2A — pur wrapper HTTP autour de /api/platform-operators/me et
// /api/platform-tenants, même contrat que la version Web
// (client/lib/services/platformOperatorService.js et
// platformTenantService.js). Aucune décision métier ici : la validation
// (l'utilisateur est-il un opérateur actif ? le tenant sélectionné est-il
// dans la liste autorisée ?) reste faite par PlatformTenantRuntimeContext.jsx
// à partir des réponses de ces deux endpoints, jamais devinée côté mobile.

export const getMyOperatorStatus = async () => (await api.get('/platform-operators/me')).data.data.operator;
export const listTenants = async () => (await api.get('/platform-tenants')).data.data.tenants;
