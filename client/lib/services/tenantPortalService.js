import api from './api';

export const getTenantDashboard = async () => (await api.get('/tenant-portal/dashboard')).data.data.dashboard;
export const getTenantProfile = async () => (await api.get('/tenant-portal/me')).data.data.locataire;
export const getTenantLeases = async () => (await api.get('/tenant-portal/leases')).data.data.leases;
export const getTenantPayments = async (params = {}) => (await api.get('/tenant-portal/payments', { params })).data.data;
export const getTenantDocuments = async (params = {}) => (await api.get('/tenant-portal/documents', { params })).data.data;
export const getTenantNotice = async () => (await api.get('/tenant-portal/notice')).data.data.notice;
export const getTenantMaintenance = async (params = {}) => (await api.get('/tenant-portal/maintenance', { params })).data.data;
export const getTenantLinkStatus = async () => (await api.get('/tenant-portal/link-status')).data.data;
export const activateTenantInvitation = async (token) => (await api.post('/tenant-portal/activate', { token })).data.data;
export const requestTenantLink = async (locataireId) => (await api.post('/tenant-portal/request-link', { locataireId })).data.data;
export const createTenantMaintenance = async ({ category, description, photos = [] }) => {
  const body = new FormData(); body.append('category', category); body.append('description', description);
  photos.forEach((photo) => body.append('photos', photo));
  return (await api.post('/tenant-portal/maintenance', body)).data.data.ticket;
};
export const downloadTenantDocument = async (documentId, filename = 'document') => {
  const response = await api.get(`/tenant-portal/documents/${documentId}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
};
