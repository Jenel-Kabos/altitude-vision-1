import api from './api';

export const getReservationFinancialDocument = async (reservationId) => {
  const res = await api.get(`/financial/hotel/reservations/${reservationId}/document`);
  return res.data.data.document;
};
export const createReservationInvoiceDraft = async (reservationId) => {
  const res = await api.post(`/financial/hotel/reservations/${reservationId}/invoice-draft`);
  return res.data.data;
};
export const updateInvoiceDraftLines = async (documentId, lines) => {
  const res = await api.patch(`/financial/documents/${documentId}/draft`, { lines });
  return res.data.data.document;
};
export const finalizeInvoiceLines = async (documentId) => {
  const res = await api.post(`/financial/documents/${documentId}/finalize-lines`);
  return res.data.data.document;
};
export const refreshInvoiceFromReservation = async (documentId) => {
  const res = await api.post(`/financial/documents/${documentId}/refresh-from-reservation`);
  return res.data.data.document;
};
export const issueInvoice = async (documentId) => {
  const res = await api.post(`/financial/documents/${documentId}/issue`);
  return res.data.data.document;
};
export const listHotelFinancialDocuments = async (hotelId, params = {}) => {
  const res = await api.get(`/financial/hotel/${hotelId}/documents`, { params });
  return res.data.data;
};
// DOC-ARCH-2 — Centre documentaire, dossier Altimmo → Hébergements →
// Factures : lecture seule, aucun établissement précis requis (contrairement
// à listHotelFinancialDocuments), voir financialController.listAccommodationDocuments.
export const listAccommodationFinancialDocuments = async (params = {}) => {
  const res = await api.get('/financial/accommodations/documents', { params });
  return res.data.data;
};
const mutationConfig = () => ({ headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` } });
export const listDocumentPayments = async (documentId) => { const res = await api.get(`/financial/documents/${documentId}/payments`); return res.data.data; };
export const createHotelPayment = async (data) => { const res = await api.post('/financial/hotel/payments', data, mutationConfig()); return res.data.data.payment; };
export const confirmHotelPayment = async (paymentId) => { const res = await api.post(`/financial/payments/${paymentId}/confirm`, {}, mutationConfig()); return res.data.data.payment; };
export const allocateHotelPayment = async (paymentId, documentId, amountMinor) => { const res = await api.post(`/financial/payments/${paymentId}/allocations`, { documentId, amountMinor }, mutationConfig()); return res.data.data.allocation; };
export const reverseHotelAllocation = async (allocationId, reason) => { const res = await api.post(`/financial/hotel/allocations/${allocationId}/reverse`, { reason }, mutationConfig()); return res.data.data.allocation; };
export const getInvoicePdfStatus = async (documentId) => { const res = await api.get(`/financial/documents/${documentId}/pdf`); return res.data.data.artifact; };
export const generateInvoicePdf = async (documentId, idempotencyKey) => { const res = await api.post(`/financial/documents/${documentId}/pdf`, {}, { headers: { 'Idempotency-Key': idempotencyKey } }); return res.data.data.artifact; };
export const downloadInvoicePdf = async (documentId) => { const res = await api.get(`/financial/documents/${documentId}/pdf/download`, { responseType: 'blob' }); return res.data; };
export const sendInvoiceEmail = async (documentId, data, idempotencyKey) => { const res = await api.post(`/financial/documents/${documentId}/email`, data, { headers: { 'Idempotency-Key': idempotencyKey } }); return res.data.data.delivery; };
export const listInvoiceDeliveries = async (documentId) => { const res = await api.get(`/financial/documents/${documentId}/deliveries`); return res.data.data.deliveries; };
