// DOC-EVO-1 — Adaptateur "dossier métier" léger pour une transaction de
// vente ou de location publique (Altimmo → Vente / Location). Pure lecture :
// `Transaction` reste l'unique source de vérité, `Document` (facture de
// finalisation, taguée entityType='Transaction' depuis DOC-ARCH-2) est
// seulement lu, jamais copié.
const mongoose = require('mongoose');
const Transaction = require('../../models/Transaction');
const Document = require('../../models/Document');
const RealEstateReservation = require('../../models/RealEstateReservation');
const { STAFF_IMMO } = require('../../utils/roles');
const { buildTimeline } = require('./dossierRegistry');
const { DossierError } = require('./gestionLocativeDossierAdapter');

function computeStatus(transaction) {
  if (transaction.status === 'Réussie') return 'Terminé';
  if (transaction.status === 'Annulée') return 'Archivé';
  if (transaction.status === 'Litigée') return 'En cours';
  return transaction.status === 'Paiement en attente' ? 'En cours' : 'Actif';
}

async function load({ entityId, user }) {
  if (!mongoose.isValidObjectId(entityId)) throw new DossierError('Identifiant de dossier invalide.', 400);
  const transaction = await Transaction.findById(entityId)
    .populate('property', 'title address')
    .populate('client', 'name email')
    .populate('agent', 'name');
  if (!transaction) throw new DossierError('Dossier introuvable.', 404);

  const userId = String(user._id || user.id);
  const isStaff = STAFF_IMMO.includes(user.role);
  const isClientMatch = String(transaction.client?._id || transaction.client) === userId;
  if (!isStaff && !isClientMatch) throw new DossierError('Accès refusé à ce dossier.', 403);

  const [invoice, reservation] = await Promise.all([
    transaction.linkedInvoice ? Document.findById(transaction.linkedInvoice).lean() : null,
    RealEstateReservation.findById(transaction.reservation).lean(),
  ]);

  const documentsSection = invoice ? [{
    id: String(invoice._id), label: `Facture ${invoice.docNumber ? `#${invoice.docNumber}` : ''}`.trim(), date: invoice.issueDate || invoice.createdAt,
    meta: { type: invoice.type, status: invoice.status, totalAmount: invoice.totalAmount },
  }] : [];

  const timeline = buildTimeline([
    reservation && { date: reservation.createdAt, label: 'Réservation créée', type: 'reservation' },
    { date: transaction.createdAt, label: 'Transaction ouverte', type: 'transaction' },
    invoice && { date: invoice.issueDate || invoice.createdAt, label: 'Facture de finalisation générée', type: 'document' },
    transaction.finalization?.completedAt && { date: transaction.finalization.completedAt, label: 'Transaction finalisée', type: 'transaction' },
  ].filter(Boolean));

  return {
    domain: 'vente_location',
    entityId: String(transaction._id),
    status: computeStatus(transaction),
    summary: {
      title: `${transaction.transactionType === 'vente' ? 'Vente' : 'Location'} — ${transaction.property?.title || 'Bien'}`,
      subtitle: transaction.client?.name ? `Client : ${transaction.client.name}` : null,
      badges: [transaction.transactionType, transaction.status],
      fields: { montant: transaction.finalAmount, commission: transaction.commission?.total, paymentStatus: transaction.paymentStatus },
    },
    relatedLinks: [
      transaction.property && { label: transaction.property.title, domain: 'property', entityType: 'Property', entityId: String(transaction.property._id) },
      transaction.client && { label: transaction.client.name, domain: 'client', entityType: 'User', entityId: String(transaction.client._id) },
    ].filter(Boolean),
    sections: [{ key: 'documents', label: 'Documents', items: documentsSection }],
    timeline,
    actions: [],
  };
}

module.exports = { load };
