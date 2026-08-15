// server/models/HotelReservation.js — Sprint C (moteur de réservation hôtelière)
//
// Une HotelReservation représente une demande/réservation d'une
// RoomCategory (jamais une chambre physique identifiée — voir
// RoomCategory.js, HOTEL_V2.md) sur une période donnée. Le stock est
// gouverné séparément par RoomInventory (voir ce fichier) — HotelReservation
// ne fait QUE consommer/libérer ce stock via hotelAvailabilityService,
// jamais de logique d'inventaire dupliquée ici.
//
// Hors périmètre (Sprint C, volontaire — voir HOTEL_RESERVATIONS_V1.md) :
// pas de chambre physique, pas de check-in/check-out, pas de facture, pas de
// paiement en ligne. `checked_in`/`checked_out`/`no_show` sont VOLONTAIREMENT
// absents de l'enum de statuts — un sprint ultérieur les ajoutera.

const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

// Sprint D — 'checked_in'/'checked_out' ajoutés (annoncés dès le Sprint C
// comme réservés à "un sprint ultérieur", c'est celui-ci). 'no_show' reste
// volontairement absent — toujours hors périmètre, pas encore justifié.
const RESERVATION_STATUSES = ['pending', 'confirmed', 'cancelled', 'expired', 'rejected', 'checked_in', 'checked_out'];
const RESERVATION_SOURCES = ['public_web', 'owner_dashboard', 'admin_dashboard'];

// Transitions autorisées — centralisées ici (source de vérité unique pour le
// schéma ET pour hotelReservationService, qui importe cette même constante
// plutôt que de dupliquer la règle). Sprint D : confirmed → checked_in →
// checked_out, appliquées exclusivement par checkInService/checkOutService
// (jamais par transitionStatus générique — voir HOTEL_OPERATIONS_V1.md).
// Une fois checked_in, l'annulation n'est plus une transition valide (un
// client physiquement présent ne s'"annule" pas) — seul checked_out est permis.
const ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'rejected', 'cancelled', 'expired'],
  confirmed: ['cancelled', 'checked_in'],
  checked_in: ['checked_out'],
  checked_out: [],
  cancelled: [],
  expired: [],
  rejected: [],
};

const statusHistoryEntrySchema = new mongoose.Schema(
  {
    from: { type: String, enum: RESERVATION_STATUSES, default: null },
    to: { type: String, enum: RESERVATION_STATUSES, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changedAt: { type: Date, default: Date.now },
    reason: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const hotelReservationSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', default: null, index: true },
    // Généré par le plugin mongoose-sequence (même convention que
    // Document.js/docNumber — seule bibliothèque de numérotation atomique
    // déjà éprouvée dans ce codebase, aucune réinvention). `reference`
    // (RES-AAAA-NNNNNN) est dérivée de ce compteur en pre('save') — voir
    // buildReservationReference ci-dessous, exportée pure pour être testée
    // sans dépendre d'une connexion DB.
    sequenceNumber: { type: Number },
    // sparse: sans lui, un index unique non-sparse traite tout document où
    // `reference` est absent (jamais défini par le pre('save') faute de
    // sequenceNumber) comme ayant la valeur `null`, et un deuxième document
    // dans le même cas provoque un E11000 sur `reference: null`.
    reference: { type: String, unique: true, sparse: true, index: true },

    // C/D.1 — clé fournie par le client et empreinte métier associée. Les
    // anciennes réservations restent valides grâce à l'index partiel.
    reservationRequestId: { type: String, trim: true, maxlength: 128, default: null },
    reservationRequestHash: { type: String, select: false, default: null },

    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    roomCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomCategory', required: true },
    ratePlan: { type: mongoose.Schema.Types.ObjectId, ref: 'RatePlan', default: null },

    // Compte client s'il existe (réservation via un compte connecté) — reste
    // `null` pour une demande "invité" (mission : le formulaire public ne
    // force pas la création de compte dans ce sprint).
    guestUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    guest: {
      firstName: { type: String, required: [true, 'Le prénom du client est requis.'], trim: true },
      lastName: { type: String, required: [true, 'Le nom du client est requis.'], trim: true },
      email: {
        type: String,
        required: [true, "L'email du client est requis."],
        trim: true,
        lowercase: true,
        validate: { validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), message: 'Email client invalide.' },
      },
      phone: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: '' },
    },

    checkInDate: { type: Date, required: [true, "La date d'arrivée est requise."] },
    checkOutDate: { type: Date, required: [true, 'La date de départ est requise.'] },
    // Dérivé de checkIn/checkOut (pre-validate ci-dessous) — jamais saisi
    // directement, pour ne jamais diverger du nombre réel de nuits facturées.
    nights: { type: Number, min: 1 },

    roomsCount: { type: Number, required: true, min: [1, 'Au moins une chambre est requise.'], default: 1 },
    adults: { type: Number, required: true, min: [1, 'Au moins un adulte est requis.'], default: 1 },
    children: { type: Number, min: 0, default: 0 },

    // Instantané tarifaire (mission §6) — figé à la création, jamais
    // recalculé si le RatePlan change ensuite.
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    taxes: { type: Number, default: 0, min: 0 },
    fees: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'XAF' },
    rateSnapshot: {
      rateType: { type: String, default: null },
      amount: { type: Number, default: null },
      currency: { type: String, default: null },
      nightlyRates: [{
        date: { type: Date, required: true },
        amount: { type: Number, required: true, min: 0 },
        periodId: { type: mongoose.Schema.Types.ObjectId, default: null },
        periodLabel: { type: String, trim: true, default: '' },
        priority: { type: Number, default: null },
      }],
    },

    status: { type: String, enum: RESERVATION_STATUSES, default: 'pending' },
    source: { type: String, enum: RESERVATION_SOURCES, required: true },

    specialRequests: { type: String, trim: true, default: '' },
    cancellationReason: { type: String, trim: true, default: '' },
    rejectionReason: { type: String, trim: true, default: '' },

    // Sprint C §11 — expiration simple des demandes en attente.
    pendingExpiresAt: { type: Date, default: null },
    actualCheckInAt: { type: Date, default: null },
    actualCheckOutAt: { type: Date, default: null },
    assignmentVersion: { type: Number, default: 0, select: false },
    requiresRoomReassignment: { type: Boolean, default: false, index: true },
    reassignmentReason: { type: String, trim: true, maxlength: 300, default: '' },

    // PAS `required` : une demande publique peut venir d'un visiteur sans
    // compte (mission §8, "Un visiteur... peut... soumettre une demande") —
    // `guest.{firstName,email,...}` reste la seule identité obligatoire dans
    // ce cas. `createdBy` est renseigné dès qu'un acteur authentifié existe
    // (compte client connecté, propriétaire, staff).
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    statusHistory: { type: [statusHistoryEntrySchema], default: [] },
  },
  { timestamps: true },
);

// ─────────────────────────────────────────────
// Index (audit performances §20) — un seul par besoin de requête réel,
// aucun doublon avec un champ déjà unique/indexé seul.
// ─────────────────────────────────────────────
hotelReservationSchema.index({ hotel: 1, status: 1 });
hotelReservationSchema.index({ roomCategory: 1, checkInDate: 1, checkOutDate: 1 });
hotelReservationSchema.index({ guestUser: 1, createdAt: -1 });
hotelReservationSchema.index({ status: 1, pendingExpiresAt: 1 }); // utilisé par le job d'expiration (voir hotelReservationExpiryService)
hotelReservationSchema.index(
  { hotel: 1, reservationRequestId: 1 },
  { unique: true, partialFilterExpression: { reservationRequestId: { $type: 'string' } } },
);

// Nuits dérivées + validation stricte de l'ordre des dates (mission §4).
hotelReservationSchema.pre('validate', function computeNights(next) {
  if (this.checkInDate && this.checkOutDate) {
    const ms = new Date(this.checkOutDate).getTime() - new Date(this.checkInDate).getTime();
    const nights = Math.round(ms / 86400000);
    if (nights < 1) {
      this.invalidate('checkOutDate', "La date de départ doit être strictement postérieure à la date d'arrivée.");
    } else {
      this.nights = nights;
    }
  }
  next();
});

/** Pure, sans dépendance DB — testable directement (voir __tests__). */
function buildReservationReference(sequenceNumber, year = new Date().getUTCFullYear()) {
  return `RES-${year}-${String(sequenceNumber).padStart(6, '0')}`;
}

hotelReservationSchema.plugin(AutoIncrement, { inc_field: 'sequenceNumber' });

// E2E-1 — bug réel démontré par le scénario PMS navigateur : `reference`
// restait `undefined` sur TOUTE réservation créée (confirmé par reproduction
// isolée hors HTTP). Cause exacte : `mongoose-sequence` enregistre son hook
// `sequenceNumber` avec `pre('save', true, fn)` — le second argument `true`
// active le mode "parallèle" historique de Mongoose (fonctions `fn(next,
// done)`), où `next()` est appelé immédiatement pour laisser la CHAÎNE de
// hooks continuer, `done()` seulement une fois l'incrément terminé. L'ordre
// d'enregistrement ne garantit donc PAS que `sequenceNumber` soit déjà
// renseigné quand un hook `pre('save')` SÉRIE suivant s'exécute — seul un
// hook `post('save')` a la garantie que tous les hooks parallèles (et
// l'écriture elle-même) sont terminés. Jamais un second appel à `.save()`
// ici (ré-déclencherait tous les hooks) : une écriture directe et ciblée
// sur le seul champ `reference`, plus une mise à jour en mémoire pour que
// l'appelant de `.save()`/`.create()` reçoive immédiatement la valeur.
hotelReservationSchema.post('save', async function setReferenceAfterSequence(doc) {
  // `isNew` est déjà retombé à `false` ici (Mongoose le fait avant
  // d'exécuter les hooks `post('save')`) — jamais un critère fiable à ce
  // stade. `!doc.reference` seul suffit : `reference` est sparse+unique et
  // n'est jamais réinitialisé une fois posé, donc son absence ne signale
  // QUE la toute première sauvegarde réussie (ou un document plus ancien
  // créé avant ce correctif, qu'un futur `.save()` répare alors au passage).
  if (doc.reference || !doc.sequenceNumber) return;
  const reference = buildReservationReference(doc.sequenceNumber);
  // `createReservation` (hotelReservationService.js) appelle `.create([data],
  // { session })` dans son chemin transactionnel : ce hook `post('save')`
  // s'exécute alors AVANT que la transaction n'ait commité. Une écriture
  // hors session ici entrerait en conflit avec la transaction en cours (ou
  // serait tout simplement écrasée/ignorée par le commit final) — d'où
  // `reference` réapparaissant vide sur une lecture fraîche après coup,
  // malgré une valeur en mémoire correcte sur le document juste créé. Il
  // faut impérativement rejoindre la même session que le document.
  await doc.constructor.updateOne({ _id: doc._id, reference: { $exists: false } }, { $set: { reference } }, { session: doc.$session() });
  doc.reference = reference;
});

const HotelReservation = mongoose.model('HotelReservation', hotelReservationSchema);
HotelReservation.RESERVATION_STATUSES = RESERVATION_STATUSES;
HotelReservation.RESERVATION_SOURCES = RESERVATION_SOURCES;
HotelReservation.ALLOWED_TRANSITIONS = ALLOWED_TRANSITIONS;
HotelReservation.buildReservationReference = buildReservationReference;

module.exports = HotelReservation;
