import api from './api';

// F-U1.I — KYC financier à deux niveaux. Toutes les autorisations sont
// décidées par le serveur ; ces appels ne transmettent jamais de tenant,
// rôle ou capacité dans le corps.
const data = (response) => response.data.data;
const BASE = '/v1/financial-kyc';

export const getKycProcedure = async () => data(await api.get(`${BASE}/procedure`));
export const listKycCases = async () => data(await api.get(`${BASE}/cases`));
export const createKycCase = async ({ purpose, subjectUserId } = {}) => data(await api.post(`${BASE}/cases`, { purpose, ...(subjectUserId ? { subjectUserId } : {}) }));
export const getKycCase = async (caseId) => data(await api.get(`${BASE}/cases/${caseId}`));
export const updateKycCase = async (caseId, payload) => data(await api.patch(`${BASE}/cases/${caseId}`, payload));
export const uploadKycDocument = async (caseId, slot, file) => {
  const form = new FormData();
  form.append('slot', slot);
  form.append('file', file);
  return data(await api.post(`${BASE}/cases/${caseId}/documents`, form));
};
export const acknowledgeKycNotice = async (caseId, version) => data(await api.post(`${BASE}/cases/${caseId}/privacy-notice`, { version }));
export const submitKycCase = async (caseId, expectedRevision) => data(await api.post(`${BASE}/cases/${caseId}/submit`, { expectedRevision }));
export const cancelKycCase = async (caseId, reason) => data(await api.post(`${BASE}/cases/${caseId}/cancel`, { reason }));
export const kycDocumentUrl = (caseId, docId, { review = false } = {}) => `${BASE}${review ? '/review' : ''}/cases/${caseId}/documents/${docId}`;
export const fetchKycDocumentBlob = async (caseId, docId, options) => (await api.get(kycDocumentUrl(caseId, docId, options), { responseType: 'blob' })).data;

export const listKycReviewQueue = async (status) => data(await api.get(`${BASE}/review/cases`, { params: status ? { status } : {} }));
export const getKycReviewCase = async (caseId) => data(await api.get(`${BASE}/review/cases/${caseId}`));
export const takeKycCase = async (caseId) => data(await api.post(`${BASE}/review/cases/${caseId}/take`));
export const requestKycInformation = async (caseId, message, items = []) => data(await api.post(`${BASE}/review/cases/${caseId}/request-information`, { message, items }));
export const checkKycDocument = async (caseId, docId, result, notes) => data(await api.post(`${BASE}/review/cases/${caseId}/documents/${docId}/check`, { result, notes }));
export const approveKycCase = async (caseId, reason) => data(await api.post(`${BASE}/review/cases/${caseId}/approve`, { reason }));
export const rejectKycCase = async (caseId, reason) => data(await api.post(`${BASE}/review/cases/${caseId}/reject`, { reason }));
export const suspendKycAttestation = async (caseId, reason) => data(await api.post(`${BASE}/review/cases/${caseId}/attestation/suspend`, { reason }));
export const revokeKycAttestation = async (caseId, reason) => data(await api.post(`${BASE}/review/cases/${caseId}/attestation/revoke`, { reason }));
