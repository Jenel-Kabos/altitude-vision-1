import api from './api';

const root = '/platform-tenants/applications';
const platformRequest = { platformScoped: true };
const normalizeApplication = (application) => application ? { ...application, id: application.id || application._id } : null;

export const listTenantApplications = async (params) => {
  const response = await api.get(root, { params, ...platformRequest });
  return {
    applications: (response.data.data.applications || []).map(normalizeApplication),
    pagination: response.data.data.pagination,
  };
};

export const getTenantApplication = async (applicationId) => normalizeApplication(
  (await api.get(`${root}/${applicationId}`, platformRequest)).data.data.application,
);

export const getTenantApplicationPendingCount = async () => (
  await api.get(`${root}/pending-count`, platformRequest)
).data.data.count;

export const startTenantApplicationReview = async (applicationId) => normalizeApplication(
  (await api.post(`${root}/${applicationId}/start-review`, undefined, platformRequest)).data.data.application,
);

export const requestTenantApplicationChanges = async (applicationId, payload) => normalizeApplication(
  (await api.post(`${root}/${applicationId}/request-changes`, payload, platformRequest)).data.data.application,
);

export const rejectTenantApplication = async (applicationId, reason) => normalizeApplication(
  (await api.post(`${root}/${applicationId}/reject`, { reason }, platformRequest)).data.data.application,
);

export const approveTenantApplication = async (applicationId) => (
  await api.post(`${root}/${applicationId}/approve`, undefined, platformRequest)
).data.data;

export const openTenantApplicationDocument = async (applicationId, document) => {
  const response = await api.get(`${root}/${applicationId}/review-documents/${document.id}`, {
    responseType: 'blob',
    ...platformRequest,
  });
  const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: document.mimeType });
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  if (!opened) throw Object.assign(new Error('DOCUMENT_POPUP_BLOCKED'), { code: 'DOCUMENT_POPUP_BLOCKED' });
};
