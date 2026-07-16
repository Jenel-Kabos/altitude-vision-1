const mongoose = require('mongoose');

const visiteSchema = new mongoose.Schema({
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    default: null,
  },
  dateProposee: { type: Date, default: null },   // proposée par le staff
  dateConfirmee: { type: Date, default: null },  // validée finale
  datePreferee:  { type: String, default: '' },  // saisie libre du client (JJ/MM/AAAA)
  heurePreferee: { type: String, default: '' },  // saisie libre du client (HH:MM)
  requestedDate: { type: Date, default: null },
  requestedTime: { type: String, default: '' },
  scheduledStartAt: { type: Date, default: null, index: true },
  scheduledEndAt: { type: Date, default: null },
  timezone: { type: String, default: 'Africa/Brazzaville' },
  telephone:     { type: String, default: '' },  // contact du client pour cette demande
  message:       { type: String, default: '' },  // précisions du client
  statut: {
    type: String,
    enum: ['En attente', 'Confirmée', 'En cours', 'Terminée', 'Annulée'],
    default: 'En attente',
  },
  status: { type: String, default: null, index: true },
  clientNameSnapshot: { type: String, default: '' },
  clientPhoneSnapshot: { type: String, default: '' },
  clientWhatsAppSnapshot: { type: String, default: '' },
  preferredContactMethod: { type: String, enum: ['', 'phone', 'whatsapp', 'email'], default: '' },
  visitorCount: { type: Number, min: 1, max: 20, default: 1 },
  clientContactConsent: { type: Boolean, default: false },
  ownerContactConsent: { type: Boolean, default: false },
  ownerNameSnapshot: { type: String, default: '' },
  ownerPhoneSnapshot: { type: String, default: '' },
  propertySnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  meetingAddressSnapshot: { type: String, default: '' },
  coordinatesSnapshot: { lat: { type: Number, default: null }, lng: { type: Number, default: null } },
  visitFeeAmount: { type: Number, min: 0, default: null },
  visitFeeCurrency: { type: String, default: 'XAF' },
  visitFeeStatus: { type: String, enum: ['non_defini', 'a_reconnaitre', 'accepte', 'paye', 'exempte'], default: 'non_defini' },
  visitFeePaymentMethod: { type: String, default: '' },
  visitFeePaidAt: { type: Date, default: null },
  agencyCommissionType: { type: String, enum: ['', 'pourcentage', 'montant_fixe', 'information_contractuelle', 'non_applicable'], default: '' },
  agencyCommissionValue: { type: Number, min: 0, default: null },
  commissionNotes: { type: String, default: '' },
  clientNotes: { type: String, default: '' },
  staffNotes: { type: String, default: '' },
  ownerNotes: { type: String, default: '' },
  cancellationReason: { type: String, default: '' },
  cancellationActor: { type: String, enum: ['', 'client', 'owner', 'staff', 'cron'], default: '' },
  cancellationRequestedAt: { type: Date, default: null },
  cancellationRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cancellationRequestReason: { type: String, default: '' },
  confirmedAt: { type: Date, default: null },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rescheduledAt: { type: Date, default: null },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  ownerViewedAt: { type: Date, default: null, index: true },
  clientViewedAt: { type: Date, default: null },
  reminderStates: {
    twentyFourHours: { type: Boolean, default: false },
    twoHours: { type: Boolean, default: false },
    thirtyMinutes: { type: Boolean, default: false },
    scheduleVersion: { type: Number, default: 0 },
  },
  workflowHistory: [{
    from: String, to: String, action: String,
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    role: String, at: { type: Date, default: Date.now }, comment: String,
    source: { type: String, enum: ['web', 'mobile', 'cron', 'system'], default: 'web' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  }],
  notes: { type: String, default: '' },          // notes internes staff
  paiementStatus: {
    type: String,
    enum: ['non_requis', 'en_attente', 'payé', 'exempté'],
    default: 'non_requis',
  },
  paiementRef: { type: String, default: null },  // référence YabetooPay intent ID
  traitePar: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  staffViewedAt: { type: Date, default: null, index: true },
}, { timestamps: true });

module.exports = mongoose.model('Visite', visiteSchema);
