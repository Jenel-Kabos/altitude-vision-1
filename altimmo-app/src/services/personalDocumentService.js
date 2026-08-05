import api from './api';
import { cache } from './cacheService';
import { downloadTenantDocument } from './tenantPortalService';
import { downloadFinancialDocument } from './accommodationReservationService';

const CACHE_KEY = 'personal-documents:list';
const TTL = 3 * 60 * 1000;

const rentalCategory = (type) => ({
  bail: 'Contrats', quittance: 'Quittances', etat_entree: 'États des lieux',
  etat_sortie: 'États des lieux', etat_des_lieux: 'États des lieux', preavis: 'Préavis',
  piece_identite: "Pièces d'identité autorisées",
}[type] || 'Documents de réservation');

const financialRow = (document, source, context = {}) => document ? ({
  id: `financial:${document.id || document._id}`,
  documentId: String(document.id || document._id),
  source,
  category: document.documentType === 'receipt' ? 'Reçus' : 'Factures',
  title: document.documentNumber ? `Facture ${document.documentNumber}` : 'Facture du séjour',
  type: document.documentType || 'invoice',
  status: document.status,
  paymentStatus: document.paymentStatus,
  date: document.issueDate || context.date,
  amountMinor: document.totalMinor,
  currency: document.currency,
  subjectId: String(document.subjectId || context.reservationId || ''),
  contextLabel: context.label,
  preview: document,
  downloadable: true,
}) : null;

async function optional(request) {
  try { return await request(); }
  catch (error) {
    if ([403, 404].includes(error.response?.status)) return null;
    throw error;
  }
}

async function loadRentalDocuments() {
  const response = await optional(() => api.get('/tenant-portal/documents', { params: { page: 1, limit: 50 } }));
  return (response?.data?.data?.documents || []).map((document) => ({
    id: `rental:${document._id}`,
    documentId: String(document._id),
    source: 'rental',
    category: rentalCategory(document.type),
    title: document.nom || 'Document locatif',
    type: document.type,
    date: document.dateGeneration,
    subjectId: String(document.leaseId || ''),
    contextLabel: 'Gestion locative',
    preview: document,
    downloadable: true,
  }));
}

async function loadAccommodationDocuments() {
  const response = await optional(() => api.get('/accommodation-reservations', { params: { page: 1, limit: 50 } }));
  const reservations = response?.data?.data?.reservations || [];
  const rows = await Promise.all(reservations.filter((item) => item.financialDocument).map(async (reservation) => {
    const id = reservation.financialDocument?._id || reservation.financialDocument;
    const detail = await optional(() => api.get(`/financial/documents/${id}`));
    return financialRow(detail?.data?.data?.document, 'accommodation', {
      reservationId: reservation._id,
      date: reservation.createdAt,
      label: reservation.accommodation?.property?.title || 'Hébergement indépendant',
    });
  }));
  return rows.filter(Boolean);
}

async function loadHotelDocuments() {
  const [mine, owner] = await Promise.all([
    optional(() => api.get('/hotel-reservations/mine')),
    optional(() => api.get('/hotel-reservations/owner', { params: { page: 1, limit: 50 } })),
  ]);
  const reservations = [
    ...(mine?.data?.data?.reservations || []),
    ...(owner?.data?.data?.reservations || []),
  ].filter((item, index, rows) => rows.findIndex((other) => String(other._id) === String(item._id)) === index);
  const rows = await Promise.all(reservations.map(async (reservation) => {
    const response = await optional(() => api.get(`/financial/hotel/reservations/${reservation._id}/document`));
    return financialRow(response?.data?.data?.document, 'hotel', {
      reservationId: reservation._id,
      date: reservation.createdAt,
      label: reservation.hotel?.name || 'Séjour hôtelier',
    });
  }));
  return rows.filter(Boolean);
}

export async function getPersonalDocuments({ refresh = false } = {}) {
  if (!refresh) {
    const saved = cache.get(CACHE_KEY);
    if (saved) return { documents: saved, offline: false, cached: true };
  }
  try {
    const settled = await Promise.allSettled([
      loadRentalDocuments(), loadAccommodationDocuments(), loadHotelDocuments(),
    ]);
    const networkFailure = settled.find((result) => result.status === 'rejected' && result.reason?.normalized?.isNetworkError);
    const documents = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    if (!documents.length && networkFailure) throw networkFailure.reason;
    cache.set(CACHE_KEY, documents, TTL);
    return { documents, offline: false, cached: false };
  } catch (error) {
    const saved = cache.get(CACHE_KEY);
    if (error.normalized?.isNetworkError && saved) return { documents: saved, offline: true, cached: true };
    throw error;
  }
}

export async function getPersonalDocument(id, options) {
  const result = await getPersonalDocuments(options);
  return { document: result.documents.find((item) => item.id === id || item.documentId === id) || null, offline: result.offline };
}

export async function openPersonalDocument(document) {
  if (document.source === 'rental') return downloadTenantDocument(document.documentId, document.title);
  return downloadFinancialDocument(document.documentId, document.title);
}

export const PERSONAL_DOCUMENT_CATEGORIES = [
  'Contrats', 'Quittances', 'Factures', 'Reçus', 'États des lieux', 'Préavis',
  "Pièces d'identité autorisées", 'Documents de réservation', "Documents d'hébergement",
];
