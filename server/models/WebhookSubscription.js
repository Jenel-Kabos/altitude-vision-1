// API-PUBLIC-1 (Phase 8) — Abonnement webhook d'un partenaire externe.
// Diffusion UNIQUEMENT : ne produit jamais un événement, se contente de
// relayer ceux déjà émis par notify() (voir services/webhookDispatchService.js
// et le hook additif dans notificationService.js) — jamais un second moteur
// d'événements.
const mongoose = require('mongoose');

// Sous-ensemble volontairement restreint de NOTIFICATION_TYPES
// (models/Notification.js) — uniquement des événements pertinents pour les
// ressources publiques exposées Phase 5 (jamais un événement interne staff/
// finance/CRM).
const ALLOWED_WEBHOOK_EVENTS = [
  'bien_valide', 'bien_rejete',
  'hotel_reservation_confirmed', 'hotel_reservation_cancelled', 'hotel_reservation_rejected',
  'accommodation_reservation_confirmed', 'accommodation_reservation_cancelled',
];

const schema = new mongoose.Schema({
  apiKey: { type: mongoose.Schema.Types.ObjectId, ref: 'ApiKey', required: true, index: true },
  url: { type: String, required: true, trim: true, maxlength: 500 },
  events: { type: [String], enum: ALLOWED_WEBHOOK_EVENTS, required: true, validate: (v) => v.length > 0 },
  secret: { type: String, required: true }, // signature HMAC SHA-256 du payload
  status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
  failureCount: { type: Number, default: 0 },
  lastTriggeredAt: { type: Date, default: null },
  lastStatus: { type: String, enum: ['success', 'failure', null], default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('WebhookSubscription', schema);
module.exports.ALLOWED_WEBHOOK_EVENTS = ALLOWED_WEBHOOK_EVENTS;
