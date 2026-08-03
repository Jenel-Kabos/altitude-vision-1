// DOC-EVO-1 — Adaptateurs "dossier métier" légers pour Hébergements
// indépendants et Hôtellerie. Pure lecture : `FinancialDocument` reste
// l'unique source de vérité (ADR-FIN-003/007), retrouvé via
// subjectType/subjectId (déjà posé par accommodationBillingService.js /
// hotelBillingAdapter.js) — jamais copié dans `Document`.
const mongoose = require('mongoose');
const AccommodationReservation = require('../../models/AccommodationReservation');
const HotelReservation = require('../../models/HotelReservation');
const FinancialDocument = require('../../models/FinancialDocument');
// Requis pour que Mongoose résolve les `ref` utilisés par .populate()
// ci-dessous, même si aucun autre module de ce process ne les a encore
// chargés (cas des tests qui insèrent ces fixtures via .collection.insertOne).
require('../../models/Accommodation');
require('../../models/Hotel');
const { STAFF_IMMO } = require('../../utils/roles');
const { buildTimeline } = require('./dossierRegistry');
const { DossierError } = require('./gestionLocativeDossierAdapter');

const invoiceToItem = (doc) => ({
  id: String(doc._id), label: `Facture ${doc.documentNumber || '(brouillon)'}`, date: doc.issueDate || doc.createdAt,
  meta: { status: doc.status, totalMinor: doc.totalMinor, currency: doc.currency },
});

async function loadHebergementDossier({ entityId, user }) {
  if (!mongoose.isValidObjectId(entityId)) throw new DossierError('Identifiant de dossier invalide.', 400);
  const reservation = await AccommodationReservation.findById(entityId)
    .populate('accommodation', 'property').populate('guest', 'name email');
  if (!reservation) throw new DossierError('Dossier introuvable.', 404);

  const userId = String(user._id || user.id);
  const isStaff = STAFF_IMMO.includes(user.role);
  const isGuestMatch = String(reservation.guest?._id || reservation.guest) === userId;
  if (!isStaff && !isGuestMatch) throw new DossierError('Accès refusé à ce dossier.', 403);

  const invoices = await FinancialDocument.find({ domain: 'real_estate', subjectType: 'AccommodationReservation', subjectId: reservation._id }).sort({ createdAt: 1 }).lean();

  return {
    domain: 'hebergement',
    entityId: String(reservation._id),
    status: ['cancelled', 'no_show'].includes(reservation.status) ? 'Archivé' : ['checked_out', 'completed'].includes(reservation.status) ? 'Terminé' : 'Actif',
    summary: {
      title: `Réservation hébergement — ${reservation.guest?.name || 'Client'}`,
      subtitle: `${new Date(reservation.checkInDate).toLocaleDateString('fr-FR')} → ${new Date(reservation.checkOutDate).toLocaleDateString('fr-FR')}`,
      badges: [reservation.status],
      fields: { totalAmount: reservation.totalAmount, remainingAmount: reservation.remainingAmount },
    },
    relatedLinks: [
      reservation.accommodation && { label: 'Hébergement', domain: 'accommodation', entityType: 'Accommodation', entityId: String(reservation.accommodation._id || reservation.accommodation) },
      reservation.guest && { label: reservation.guest.name, domain: 'client', entityType: 'User', entityId: String(reservation.guest._id) },
    ].filter(Boolean),
    sections: [{ key: 'documents', label: 'Factures', items: invoices.map(invoiceToItem) }],
    timeline: buildTimeline([
      { date: reservation.createdAt, label: 'Réservation créée', type: 'reservation' },
      ...invoices.map((doc) => ({ date: doc.issueDate || doc.createdAt, label: `Facture ${doc.documentNumber || '(brouillon)'}`, type: 'document' })),
    ]),
    actions: [],
  };
}

async function loadHotelDossier({ entityId, user }) {
  if (!mongoose.isValidObjectId(entityId)) throw new DossierError('Identifiant de dossier invalide.', 400);
  // Aucun lien User côté HotelReservation.guest (snapshot embarqué, voir
  // audit DOC-ARCH-2) — dossier réservé au staff, pas de vue self-service.
  if (!STAFF_IMMO.includes(user.role)) throw new DossierError('Accès refusé à ce dossier.', 403);
  const reservation = await HotelReservation.findById(entityId).populate('hotel', 'name');
  if (!reservation) throw new DossierError('Dossier introuvable.', 404);

  const invoices = await FinancialDocument.find({ domain: 'hotel', subjectType: 'HotelReservation', subjectId: reservation._id }).sort({ createdAt: 1 }).lean();

  return {
    domain: 'hotellerie',
    entityId: String(reservation._id),
    status: ['cancelled', 'no_show'].includes(reservation.status) ? 'Archivé' : reservation.status === 'checked_out' ? 'Terminé' : 'Actif',
    summary: {
      title: `Réservation hôtel — ${reservation.guest?.firstName || ''} ${reservation.guest?.lastName || ''}`.trim(),
      subtitle: reservation.hotel?.name || null,
      badges: [reservation.status],
      fields: { checkInDate: reservation.checkInDate, checkOutDate: reservation.checkOutDate, roomsCount: reservation.roomsCount },
    },
    relatedLinks: [
      reservation.hotel && { label: reservation.hotel.name, domain: 'hotel', entityType: 'Hotel', entityId: String(reservation.hotel._id) },
    ].filter(Boolean),
    sections: [{ key: 'documents', label: 'Factures', items: invoices.map(invoiceToItem) }],
    timeline: buildTimeline([
      { date: reservation.createdAt, label: 'Réservation créée', type: 'reservation' },
      ...invoices.map((doc) => ({ date: doc.issueDate || doc.createdAt, label: `Facture ${doc.documentNumber || '(brouillon)'}`, type: 'document' })),
    ]),
    actions: [],
  };
}

module.exports = { loadHebergementDossier, loadHotelDossier };
