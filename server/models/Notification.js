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
  // ── Transactions ──
  'transaction_created',  // client : une transaction le concernant a été ouverte
  'transaction_finalized',// client : transaction réussie (vente/location validée)
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
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    title: { type: String, required: true, maxlength: 100 },
    body:  { type: String, required: true, maxlength: 300 },
    // Payload pour la navigation deep-link côté app mobile
    // ex: { screen: 'Transactions', params: { id: '...' } }
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// Index composite pour paginer rapidement les notifs d'un user
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

// TTL : les notifications lues de plus de 90 jours sont supprimées auto
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90, partialFilterExpression: { read: true } },
);

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
