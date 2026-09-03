import api from './api';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// SYNC-2A — pur wrapper HTTP autour de /api/platform-operators/me et
// /api/platform-tenants, même contrat que la version Web
// (client/lib/services/platformOperatorService.js et
// platformTenantService.js). Aucune décision métier ici : la validation
// (l'utilisateur est-il un opérateur actif ? le tenant sélectionné est-il
// dans la liste autorisée ?) reste faite par PlatformTenantRuntimeContext.jsx
// à partir des réponses de ces deux endpoints, jamais devinée côté mobile.

export const getMyOperatorStatus = async () => (await api.get('/platform-operators/me')).data.data.operator;
export const listTenants = async () => (await api.get('/platform-tenants')).data.data.tenants;
export const getFirstOrganizationOnboardingStatus = async () => (
  await api.get('/platform-tenants/applications/me/status')
).data.data.state;

export const getMyTenantApplication = async () => (
  await api.get('/platform-tenants/applications/me')
).data.data.application;

export const createTenantApplication = async (businessFields) => (
  await api.post('/platform-tenants/applications', businessFields)
).data.data.application;

export const updateTenantApplication = async (applicationId, businessFields) => (
  await api.patch(`/platform-tenants/applications/${applicationId}`, businessFields)
).data.data.application;

export const uploadTenantApplicationDocument = async (applicationId, category, file) => {
  const body = new FormData();
  body.append('category', category);
  body.append('document', { uri: file.uri, name: file.name, type: file.mimeType });
  return (await api.post(`/platform-tenants/applications/${applicationId}/documents`, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data.data.document;
};

export const deleteTenantApplicationDocument = async (applicationId, documentId) => (
  api.delete(`/platform-tenants/applications/${applicationId}/documents/${documentId}`)
);

export const submitTenantApplication = async (applicationId) => (
  await api.post(`/platform-tenants/applications/${applicationId}/submit`)
).data.data.application;

export const readTenantApplicationDocument = async (applicationId, documentId) => (
  api.get(`/platform-tenants/applications/${applicationId}/documents/${documentId}`, { responseType: 'arraybuffer' })
);

const bytesToBase64 = (value) => {
  const bytes = new Uint8Array(value); let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return global.btoa(binary);
};

export const openTenantApplicationDocument = async (applicationId, document) => {
  const response = await readTenantApplicationDocument(applicationId, document.id);
  const safeName = String(document.displayName || 'justificatif').replace(/[^a-zA-Z0-9._-]+/g, '-');
  const uri = `${FileSystem.cacheDirectory}tenant-application-${document.id}-${safeName}`;
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(response.data), { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: document.mimeType || 'application/octet-stream' });
  return uri;
};
