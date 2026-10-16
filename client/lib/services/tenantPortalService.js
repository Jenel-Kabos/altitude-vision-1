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
// F-U2.10 — échéances de loyer et signalement d'une difficulté de paiement
// (la date de déclaration est fixée par le serveur).
export const getTenantRentDues = async () => (await api.get('/tenant-portal/rent-dues')).data.data;
export const reportTenantPaymentDifficulty = async (documentId, { reason, proposedPaymentDate }) => (await api.post(`/tenant-portal/rent-dues/${documentId}/difficulty-report`, { reason: reason || undefined, proposedPaymentDate: proposedPaymentDate || undefined })).data.data.report;
// F-U2.12 — confirmer ou contester un loyer déclaré reçu par le bailleur.
export const respondToDirectReceipt = async (receiptId, { decision, reason }) => (await api.post(`/tenant-portal/direct-receipts/${receiptId}/respond`, { decision, reason: reason || undefined })).data.data.receipt;
// F-U2.13 — conditions contractuelles du bail : consultation puis acceptation explicite.
export const getTenantLeasePolicies = async () => (await api.get('/tenant-portal/lease-policies')).data.data.policies;
export const presentTenantLeasePolicy = async (policyId) => (await api.get(`/tenant-portal/lease-policies/${policyId}/present`)).data.data;
export const acceptTenantLeasePolicy = async (policyId, { presentationToken, documentHash }) => (await api.post(`/tenant-portal/lease-policies/${policyId}/accept`, { presentationToken, documentHash, accept: true })).data.data.consent;
