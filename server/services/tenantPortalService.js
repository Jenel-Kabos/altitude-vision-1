const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const RentalManagement = require('../models/RentalManagement');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const TenantLinkRequest = require('../models/TenantLinkRequest');
const Notification = require('../models/Notification');
const rentalMaintenanceService = require('./rentalMaintenanceService');
const { resolveLocataireForUser } = require('./tenantLinkService');
const { aggregatePaymentSummary, publicPayment } = require('./rentalPaymentProjectionService');

function fail(message, statusCode) { const error = new Error(message); error.statusCode = statusCode; return error; }
const asId = (value) => value?._id || value;
const daysUntil = (value) => value ? Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)) : null;
const pageOptions = (query = {}) => ({ page: Math.max(Number.parseInt(query.page, 10) || 1, 1), limit: Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 50) });

async function requireLocataire(userId) {
  const locataire = await resolveLocataireForUser(userId);
  if (!locataire) throw fail('Aucun dossier locataire rattaché à ce compte.', 404);
  return locataire;
}

async function getLeases(locataireId) {
  return Contrat.find({ locataire: locataireId, type: 'location' })
    .sort({ createdAt: -1 })
    .populate([
      { path: 'bien', select: 'title address city owner' },
      { path: 'proprietaire', select: 'nom prenom telephone email' },
    ]);
}
async function getActiveLease(locataireId) {
  const leases = await getLeases(locataireId);
  return leases.find((lease) => lease.statut === 'actif') || leases[0] || null;
}
const publicLease = (lease) => lease && ({
  _id: lease._id, bien: lease.bien, statut: lease.statut, adresseBien: lease.adresseBien, villeBien: lease.villeBien,
  proprietaire: lease.proprietaire ? { _id: lease.proprietaire._id, nom: lease.proprietaire.nom, prenom: lease.proprietaire.prenom, telephone: lease.proprietaire.telephone, email: lease.proprietaire.email } : null,
  dateEntree: lease.dateEntree, dateSortie: lease.dateSortie, dateFinBail: lease.dateFinBail,
  montantLoyer: lease.montantLoyer, montantCaution: lease.montantCaution, cautionVersee: lease.cautionVersee,
  dureePreavis: lease.dureePreavis, chargesIncluses: lease.chargesIncluses, montantCharges: lease.montantCharges,
  cycleVie: lease.cycleVie, cycleHistory: lease.cycleHistory || [], avenants: lease.avenants || [], caution: lease.caution,
  etatsDesLieux: (lease.etatsDesLieux || []).map(({ type, date, validatedByStaff, validatedAt, degradationReported, maintenanceRequired, blockingReason }) => ({ type, date, validatedByStaff, validatedAt, degradationReported, maintenanceRequired, blockingReason })),
  renouvelleDe: lease.renouvelleDe, renouvelePar: lease.renouvelePar,
  joursRestants: daysUntil(lease.dateFinBail),
});

async function getMyProfile(userId) {
  const l = await requireLocataire(userId);
  const { nom, prenom, email, telephone, adresse, ville, profession, revenuMensuel, _id } = l;
  return { _id, nom, prenom, email, telephone, adresse, ville, profession, revenuMensuel,
    identityDocument: (l.pieceIdentiteAsset || l.pieceIdentite) ? { canPreview: true, canDownload: true, legacy: !l.pieceIdentiteAsset, previewEndpoint: '/api/tenant-portal/me/identity-document', downloadEndpoint: '/api/tenant-portal/me/identity-document?download=1' } : null };
}
async function getMyLease(userId) { const l = await requireLocataire(userId); return publicLease(await getActiveLease(l._id)); }
async function getMyLeases(userId) { const l = await requireLocataire(userId); return (await getLeases(l._id)).map(publicLease); }

async function getMyPayments(userId) {
  const l = await requireLocataire(userId); const lease = await getActiveLease(l._id); if (!lease) return [];
  return Paiement.find({ contrat: lease._id }).select('contrat mois annee montant montantTotal montantRecu statut modePaiement reference datePaiement penaliteAppliquee penaliteMontant retardJours jourEcheance').sort({ annee: -1, mois: -1 });
}
async function getMyPaymentPage(userId, query = {}) {
  const l = await requireLocataire(userId); const leases = await getLeases(l._id); const leaseIds = leases.map(asId);
  const { page, limit } = pageOptions(query); const match = { contrat: { $in: leaseIds } };
  const [payments, total, summary] = await Promise.all([
    Paiement.find(match).select('contrat mois annee montant montantTotal montantRecu statut modePaiement reference datePaiement penaliteAppliquee penaliteMontant retardJours jourEcheance').sort({ annee: -1, mois: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Paiement.countDocuments(match),
    aggregatePaymentSummary(Paiement, match),
  ]);
  return { payments: payments.map(publicPayment), summary, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

function documentRows(leases) {
  return leases.flatMap((lease) => [
    ...(lease.documents || []).filter((d) => d.asset || d.url).map((d) => ({ _id: d._id, leaseId: lease._id, nom: d.nom, type: d.type || 'autre', dateGeneration: d.dateGeneration, downloadPath: `/tenant-portal/documents/${d._id}/download` })),
    ...(lease.etatsDesLieux || []).filter((e) => e.documentAsset || e.documentUrl).map((e, index) => ({ _id: `edl-${lease._id}-${index}`, leaseId: lease._id, nom: `État des lieux ${e.type}`, type: 'etat_des_lieux', dateGeneration: e.date, downloadPath: `/tenant-portal/documents/edl-${lease._id}-${index}/download` })),
  ]).sort((a, b) => new Date(b.dateGeneration || 0) - new Date(a.dateGeneration || 0));
}
async function getMyDocuments(userId) { const l = await requireLocataire(userId); return documentRows(await getLeases(l._id)); }
async function getMyDocumentPage(userId, query = {}) {
  const l = await requireLocataire(userId); const rows = documentRows(await getLeases(l._id)); const { page, limit } = pageOptions(query);
  return { documents: rows.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: rows.length, pages: Math.ceil(rows.length / limit) } };
}
async function getMyDocumentDownload(userId, documentId) {
  const l = await requireLocataire(userId); const leases = await getLeases(l._id);
  const leaseIds = leases.map(asId);
  if (!documentId.startsWith('edl-')) {
    const lease = await Contrat.findOne({ _id: { $in: leaseIds }, 'documents._id': documentId })
      .select('+documents.asset.publicId +documents.asset.resourceType +documents.asset.deliveryType +documents.asset.version +documents.asset.format');
    const document = lease?.documents?.id(documentId);
    if (document?.asset) return { asset: document.asset.toObject(), name: document.nom || 'document' };
    if (document?.url) return { url: document.url, name: document.nom || 'document' };
  }
  for (const leaseSummary of leases) {
    const lease = await Contrat.findById(leaseSummary._id)
      .select('+etatsDesLieux.documentAsset.publicId +etatsDesLieux.documentAsset.resourceType +etatsDesLieux.documentAsset.deliveryType +etatsDesLieux.documentAsset.version +etatsDesLieux.documentAsset.format');
    const prefix = `edl-${lease._id}-`;
    if (documentId.startsWith(prefix)) {
      const item = lease.etatsDesLieux?.[Number(documentId.slice(prefix.length))];
      if (item?.documentAsset) return { asset: item.documentAsset.toObject(), name: `etat-des-lieux-${item.type}` };
      if (item?.documentUrl) return { url: item.documentUrl, name: `etat-des-lieux-${item.type}` };
    }
  }
  throw fail('Document introuvable.', 404);
}

async function getMyNotice(userId) {
  const l = await requireLocataire(userId); const lease = await getActiveLease(l._id); if (!lease) return null;
  const rental = await RentalManagement.findOne({ activeLease: lease._id }).select('occupancyStatus noticeStartedAt noticeAcknowledgedAt plannedExitAt workflowHistory');
  if (!rental || (!rental.noticeStartedAt && rental.occupancyStatus !== 'sortie_programmee')) return null;
  return { noticeStartedAt: rental.noticeStartedAt, noticeAcknowledgedAt: rental.noticeAcknowledgedAt, plannedExitAt: rental.plannedExitAt, dateDepot: rental.noticeStartedAt, dateValidation: rental.noticeAcknowledgedAt, dateDepartPrevue: rental.plannedExitAt, joursRestants: daysUntil(rental.plannedExitAt), statut: rental.noticeAcknowledgedAt ? 'valide' : 'depose', verrouille: Boolean(rental.noticeAcknowledgedAt), historique: (rental.workflowHistory || []).filter((h) => String(h.action || '').includes('notice') || String(h.action || '').includes('préavis')).map(({ action, at, comment }) => ({ action, at, comment })) };
}

async function getMyMaintenance(userId, query = {}) {
  const l = await requireLocataire(userId); const { page, limit } = pageOptions(query); const match = { tenant: l._id };
  if (query.status === 'open') match.status = { $in: RentalMaintenanceTicket.OPEN_RENTAL_MAINTENANCE_STATUSES }; else if (query.status === 'completed') match.status = { $in: ['resolu', 'cloture'] };
  const [tickets, total] = await Promise.all([RentalMaintenanceTicket.find(match).select('property lease category priority status description scheduledFor attachments resolvedAt createdAt updatedAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), RentalMaintenanceTicket.countDocuments(match)]);
  const safeTickets = tickets.map((ticket) => ({ ...ticket, attachments: (ticket.attachments || []).map((attachment, index) => ({
    nom: attachment.nom, mimeType: attachment.asset?.mimeType, size: attachment.asset?.size,
    canPreview: Boolean(attachment.asset || attachment.url), canDownload: Boolean(attachment.asset || attachment.url),
    previewEndpoint: `/api/tenant-portal/maintenance/${ticket._id}/attachments/${index}`,
    downloadEndpoint: `/api/tenant-portal/maintenance/${ticket._id}/attachments/${index}?download=1`,
    legacy: !attachment.asset,
  })) }));
  return { tickets: safeTickets, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
async function createMyMaintenanceRequest(userId, { category, description, attachments = [] }) {
  const l = await requireLocataire(userId); const lease = await getActiveLease(l._id);
  if (!lease) throw fail('Aucun bail actif — impossible de créer une demande de maintenance.', 409);
  if (!RentalMaintenanceTicket.RENTAL_MAINTENANCE_CATEGORIES.includes(category)) throw fail('Catégorie invalide.', 422);
  if (!description || !String(description).trim()) throw fail('La description du problème est requise.', 422);
  const property = lease.bien; const propertyId = asId(property); if (!propertyId) throw fail('Bien introuvable pour ce bail.', 409);
  return rentalMaintenanceService.createTicket({ propertyId, leaseId: lease._id, tenantId: l._id, tenantUserId: userId, ownerId: property?.owner || null, category, priority: 'normale', description: String(description).trim(), attachments, actingUser: { id: userId } });
}

async function getLinkStatus(userId) {
  const linked = await resolveLocataireForUser(userId);
  const request = await TenantLinkRequest.findOne({ user: userId }).sort({ createdAt: -1 }).select('type status tokenExpiresAt acceptedAt reviewedAt reviewComment createdAt').lean();
  return { linked: Boolean(linked), locataire: linked ? { _id: linked._id, nom: linked.nom, prenom: linked.prenom } : null, request };
}
async function getDashboard(userId) {
  const l = await requireLocataire(userId); const lease = await getActiveLease(l._id);
  const [paymentData, notice, maintenanceOpen, documents, notifications] = await Promise.all([getMyPaymentPage(userId, { page: 1, limit: 50 }), getMyNotice(userId), RentalMaintenanceTicket.countDocuments({ tenant: l._id, status: { $in: RentalMaintenanceTicket.OPEN_RENTAL_MAINTENANCE_STATUSES } }), getMyDocumentPage(userId, { page: 1, limit: 5 }), Notification.find({ recipient: userId }).sort({ createdAt: -1 }).limit(5).select('type title body link read createdAt').lean()]);
  const upcoming = paymentData.payments.filter((p) => p.statut !== 'payé').sort((a, b) => (a.annee * 12 + a.mois) - (b.annee * 12 + b.mois))[0] || null;
  return { prochainPaiement: upcoming, montantRestant: paymentData.summary.restant, bailActif: publicLease(lease), dureeRestanteJours: daysUntil(lease?.dateFinBail), prochainRenouvellement: lease?.dateFinBail || null, preavisActif: notice, maintenanceOuverte: maintenanceOpen, documentsRecents: documents.documents, notifications };
}

module.exports = { requireLocataire, getActiveLease, getMyProfile, getMyLease, getMyLeases, getMyPayments, getMyPaymentPage, getMyDocuments, getMyDocumentPage, getMyDocumentDownload, getMyNotice, getMyMaintenance, createMyMaintenanceRequest, getLinkStatus, getDashboard };
