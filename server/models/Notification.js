const mongoose = require('mongoose');

// Tous les types d'événements business qui génèrent une notification
const NOTIFICATION_TYPES = [
  // ── Messagerie ──
  'new_message',
  'new_staff_message',
  // ── Visites ──
  'visite_new',           // staff : nouveau client demande une visite
  'visite_status',        // client : sa visite a été confirmée/refusée/replanifiée
  'visite_cancelled',     // staff : un client a annulé une visite
  'visite_auto_cancelled',       // client : visite annulée automatiquement
  'visite_auto_cancelled_owner', // propriétaire : visite de son bien annulée automatiquement
  'visite_confirmee',            // client : paiement de visite confirmé par le staff
  'visite_demandee',
  'visite_a_confirmer',
  'visite_reprogrammee',
  'visite_rappel',
  'visite_en_cours',
  'visite_terminee',
  'visite_annulation_demandee',
  'visite_client_absent',
  'visite_incident',
  // ── Transactions ──
  'transaction_created',  // client : une transaction le concernant a été ouverte
  'transaction_finalized',// client : transaction réussie (vente/location validée)
  'real_estate_application_submitted',
  'real_estate_application_under_review',
  'real_estate_application_accepted',
  'real_estate_application_rejected',
  'real_estate_application_withdrawn',
  'real_estate_reservation_created',
  'real_estate_reservation_expiring',
  'real_estate_reservation_expired',
  'real_estate_reservation_cancelled',
  'real_estate_reservation_converted',
  // ── Devis ──
  'quote_received',       // staff : nouveau devis (Quote) soumis
  'quote_status',         // client : statut de son devis a changé
  'quote_response',       // client : devis chiffré envoyé
  // ── Paiements ──
  'payment_success',      // client : paiement CinetPay confirmé
  'payment_failed',       // client : paiement échoué
  // ── Contrats ──
  'contrat_new',          // locataire + propriétaire : nouveau contrat
  'contrat_updated',      // locataire + propriétaire : contrat modifié
  'loyer_paye',           // propriétaire : loyer encaissé
  'loyer_en_retard',      // locataire : loyer en retard (alerte cron)
  'rental_ready_to_publish',
  'rental_listing_submitted',
  'rental_listing_published',
  'rental_listing_suspended',
  'rental_property_occupied',
  'rental_notice_started',
  'rental_exit_scheduled',
  'rental_inspection_required',
  'rental_maintenance',
  'rental_maintenance_started',
  'rental_maintenance_completed',
  'rental_property_available',
  'rental_payment_overdue',
  'rental_contract_expiring',
  'rental_owner_request',
  // ── Cycle de vie du bail (GL-LIFE-1) ──
  'rental_lease_renewed',
  'rental_amendment_created',
  'rental_deposit_encashed',
  'rental_deposit_blocked',
  'rental_deposit_withheld',
  'rental_deposit_returned',
  'rental_exit_inspection_cleared',
  'rental_lease_archived',
  // ── Portail locataire GL-B3 ──
  'tenant_invitation_received', 'tenant_invitation_accepted', 'tenant_invitation_rejected',
  'tenant_link_requested', 'tenant_link_approved', 'tenant_link_rejected',
  'tenant_document_added', 'tenant_receipt_added', 'tenant_payment_recorded',
  'tenant_maintenance_created', 'tenant_maintenance_scheduled', 'tenant_maintenance_resolved',
  'tenant_notice_recorded', 'tenant_notice_acknowledged', 'tenant_notice_cancelled', 'tenant_notice_closed',
  // ── Séjours en hébergement indépendant (ACC-1) ──
  'accommodation_reservation_pending', 'accommodation_reservation_confirmed',
  'accommodation_reservation_cancelled', 'accommodation_reservation_checked_in',
  'accommodation_reservation_checked_out', 'accommodation_reservation_no_show',
  'accommodation_arrival_reminder', 'accommodation_checkin_today', 'accommodation_checkout_today',
  'accommodation_payment_received', 'accommodation_payment_due', 'accommodation_payment_completed',
  // ── Biens immobiliers ──
  'new_property',                 // tous les utilisateurs : nouveau bien validé et publié
  'property_pending_moderation',  // staff : nouveau bien mobile en attente de modération
  // ── Compte ──
  'account_verified',     // client : compte propriétaire validé par admin
  'account_suspended',    // utilisateur : compte suspendu
  // ── Formulaires publics ──
  'estimation_received',  // staff : nouvelle demande d'estimation
  'devis_received',       // staff : nouvelle demande de devis (gestion locative — modèle Devis)
  'contact_received',     // staff : nouveau message du formulaire de contact
  // ── Biens immobiliers (propriétaire) ──
  'bien_valide',           // propriétaire : son bien a été validé
  'bien_rejete',           // propriétaire : son bien a été rejeté
  'visite_sur_mon_bien',   // propriétaire : visite demandée sur son bien
  // ── Messagerie ──
  'message_staff',         // client/propriétaire : le staff a répondu
  // ── Paiements de visite ──
  'paiement_confirme',     // client : paiement YabetooPay confirmé
  'paiement_echoue',       // client : paiement YabetooPay échoué
  'visite_payee',          // staff : client a payé les honoraires de visite
  // ── Modération ──
  'nouveau_signalement',   // admin : nouveau signalement reçu
];

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    title: { type: String, required: true, maxlength: 100 },
    body:  { type: String, required: true, maxlength: 300 },
    link: { type: String, default: null, maxlength: 500 },
    destination: { type: String, default: null, maxlength: 100, index: true },
    entityType: { type: String, default: null, maxlength: 80 },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Payload pour la navigation deep-link côté app mobile
    // ex: { screen: 'Transactions', params: { id: '...' } }
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    dedupeKey: { type: String, default: null, maxlength: 200 },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// Index composite pour paginer rapidement les notifs d'un user
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index(
  { recipient: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
);

// TTL : les notifications lues de plus de 90 jours sont supprimées auto
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90, partialFilterExpression: { read: true } },
);

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
