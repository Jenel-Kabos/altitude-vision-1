import api from './api';

const root = '/real-estate-applications';
export const submitRealEstateApplication = (payload) => api.post(root, payload).then((r) => r.data.data.application);
export const listRealEstateApplications = (params) => api.get(root, { params }).then((r) => ({ applications: r.data.data.applications, pagination: r.data.pagination }));
export const getRealEstateApplication = (id) => api.get(`${root}/${id}`).then((r) => r.data.data.application);
export const withdrawRealEstateApplication = (id) => api.post(`${root}/${id}/withdraw`).then((r) => r.data.data.application);
export const reviewRealEstateApplication = (id) => api.post(`${root}/${id}/review`).then((r) => r.data.data.application);
export const acceptRealEstateApplication = (id, key) => api.post(`${root}/${id}/accept`, {}, { headers: { 'Idempotency-Key': key } }).then((r) => r.data.data);
export const rejectRealEstateApplication = (id, reason) => api.post(`${root}/${id}/reject`, { reason }).then((r) => r.data.data.application);
export const getRealEstateReservation = (id) => api.get(`${root}/reservations/${id}`).then((r) => r.data.data.reservation);
export const cancelRealEstateReservation = (id, reason) => api.post(`${root}/reservations/${id}/cancel`, { reason }).then((r) => r.data.data);
export const uploadRealEstateAttachments = (id, files) => {
  const data = new FormData(); files.forEach((file) => data.append('attachments', file));
  return api.post(`${root}/${id}/attachments`, data).then((r) => r.data.data.attachments);
};
export const downloadRealEstateAttachment = (applicationId, attachmentId) =>
  api.get(`${root}/${applicationId}/attachments/${attachmentId}`, { responseType: 'blob' }).then((r) => r.data);
