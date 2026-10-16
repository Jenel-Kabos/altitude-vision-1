import api from './api';

// F-U2 — facturation unifiée. Le serveur résout le contexte (organisation /
// Altitude Vision) et décide des autorisations ; aucun tenant n'est envoyé.
const data = (response) => response.data.data;
const BASE = '/v1/billing';
const key = (prefix) => `${prefix}:${globalThis.crypto?.randomUUID?.() || Date.now()}`;

export const getOwnerBilling = async () => data(await api.get(`${BASE}/owner/dashboard`));
export const getAdministrationBilling = async () => data(await api.get(`${BASE}/dashboard`));
export const getIssuerReadiness = async () => data(await api.get(`${BASE}/issuer-readiness`));
export const getBillingDocument = async (documentId) => data(await api.get(`${BASE}/documents/${documentId}`));
export const generateRentInvoice = async ({ leaseId, period, prorataClauseReference }) => data(await api.post(`${BASE}/rent-invoices`, { leaseId, period, ...(prorataClauseReference ? { prorataClauseReference } : {}) }));
export const generateCommissionInvoice = async (mandateId) => data(await api.post(`${BASE}/commission-invoices`, { mandateId }));
export const issueBillingDocument = async (documentId) => data(await api.post(`${BASE}/documents/${documentId}/issue`));
export const cancelBillingDraft = async (documentId, reason) => data(await api.post(`${BASE}/documents/${documentId}/cancel`, { reason }));
export const creditBillingDocument = async (documentId, amountMinor, reason) => data(await api.post(`${BASE}/documents/${documentId}/credit-notes`, { amountMinor, reason }, { headers: { 'Idempotency-Key': key('credit') } }));
// F-U2.9 — Gestion autonome Altimmo (abonnement + 1 % des loyers encaissés et confirmés).
export const getAutonomousPricing = async () => data(await api.get(`${BASE}/autonomous/pricing`));
export const getAutonomousSummary = async () => data(await api.get(`${BASE}/autonomous/summary`));
export const generateAutonomousInvoice = async ({ subscriptionType, subscriptionId, period }) => data(await api.post(`${BASE}/autonomous-invoices`, { subscriptionType, subscriptionId, period }));
export const acceptPortfolioQuote = async (quoteId) => data(await api.post(`${BASE}/portfolio-quotes/${quoteId}/accept`));
export const rejectPortfolioQuote = async (quoteId) => data(await api.post(`${BASE}/portfolio-quotes/${quoteId}/reject`));
// F-U2.10 — Recouvrement locatif (pénalités prévisionnelles, signalements, dossiers).
export const getCollectionOverview = async () => data(await api.get(`${BASE}/collection`));
export const getOwnerCollection = async () => data(await api.get(`${BASE}/owner/collection`));
export const decideDifficultyReport = async (reportId, { decision, reason, approvedPaymentDate }) => data(await api.post(`${BASE}/difficulty-reports/${reportId}/decision`, { decision, reason, approvedPaymentDate }));
// F-U2.11 — bailleur sans organisation : échéance de suivi (jamais une facture
// légale) et loyer reçu directement (idempotent).
export const generateOwnerTrackingDue = async ({ leaseId, period, prorataClauseReference }) => data(await api.post(`${BASE}/owner/tracking-dues`, { leaseId, period, ...(prorataClauseReference ? { prorataClauseReference } : {}) }));
export const recordOwnerRentReceipt = async (documentId, { amountMinor, receivedAt, method }) => data(await api.post(`${BASE}/owner/tracking-dues/${documentId}/receipts`, { amountMinor, receivedAt, method }, { headers: { 'Idempotency-Key': key('owner-receipt') } }));
// F-U2.12 — preuves d'encaissement direct (références uniquement) et revue plateforme.
export const submitDirectReceiptEvidence = async (receiptId, { kind, reference }) => data(await api.post(`${BASE}/direct-receipts/${receiptId}/evidence`, { kind, reference }));
export const cancelDirectReceipt = async (receiptId, reason) => data(await api.post(`${BASE}/direct-receipts/${receiptId}/cancel`, { reason }));
export const getDirectReceiptReviewQueue = async () => data(await api.get(`${BASE}/direct-receipts/review-queue`));
export const reviewDirectReceipt = async (receiptId, { decision, note }) => data(await api.post(`${BASE}/direct-receipts/${receiptId}/review`, { decision, note }));
// F-U2.13 — conditions propres au bail (gestion autonome) : aucune valeur présumée.
export const createLeasePolicy = async ({ leaseId, type, terms, effectiveFrom, documentReference }) => data(await api.post(`${BASE}/lease-policies`, { leaseId, type, terms, effectiveFrom, documentReference }));
export const getLeasePolicies = async (leaseId) => data(await api.get(`${BASE}/leases/${leaseId}/policies`));
