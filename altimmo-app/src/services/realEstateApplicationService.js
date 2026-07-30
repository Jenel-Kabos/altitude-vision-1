import api from './api';

const root = '/real-estate-applications';
export const submitApplication = async (payload) => (await api.post(root, payload)).data.data.application;
export const getMyApplications = async (params) => (await api.get(root, { params })).data.data.applications;
export const getApplication = async (id) => (await api.get(`${root}/${id}`)).data.data.application;
export const withdrawApplication = async (id) => (await api.post(`${root}/${id}/withdraw`)).data.data.application;
export const getReservation = async (id) => (await api.get(`${root}/reservations/${id}`)).data.data.reservation;
export const uploadApplicationAttachments = async (id, assets) => {
  const body = new FormData();
  assets.forEach((asset) => body.append('attachments', { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/pdf' }));
  return (await api.post(`${root}/${id}/attachments`, body, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 90000 })).data.data.attachments;
};
