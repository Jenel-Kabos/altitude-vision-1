// server/models/HousekeepingTask.js — Sprint E (housekeeping/inspection/maintenance)
//
// Une HousekeepingTask représente une intervention de nettoyage sur une
// Room physique (Sprint D). Générée automatiquement au check-out
// (checkOutService → housekeepingService.createTask, type
// 'checkout_cleaning') ou créée manuellement par le staff (refresh,
// deep_cleaning). Une chambre ne peut avoir qu'UNE SEULE tâche "ouverte"
// (pending/assigned/in_progress) à la fois — voir l'index unique partiel
// `{room, open:true}` ci-dessous, même stratégie que RoomAssignment
// (Sprint D) : anti-concurrence par contrainte DB, pas seulement
// applicative.

const mongoose = require('mongoose');

const HOUSEKEEPING_TYPES = ['checkout_cleaning', 'refresh', 'deep_cleaning'];
const HOUSEKEEPING_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const HOUSEKEEPING_STATUSES = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];

// Transitions autorisées — centralisées ici (source de vérité unique pour
// housekeepingService, jamais dupliquée dans un contrôleur).
const HOUSEKEEPING_STATUS_TRANSITIONS = {
  pending: ['assigned', 'in_progress', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// Statuts "ouverts" — une chambre ne peut en avoir qu'un à la fois.
const OPEN_HOUSEKEEPING_STATUSES = ['pending', 'assigned', 'in_progress'];

const housekeepingTaskSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    // Réservation à l'origine de la tâche (checkout_cleaning) — `null` pour
    // une tâche manuelle (refresh/deep_cleaning) non liée à un départ.
    reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'HotelReservation', default: null },

    type: { type: String, enum: HOUSEKEEPING_TYPES, required: true },
    priority: { type: String, enum: HOUSEKEEPING_PRIORITIES, default: 'normal' },
    status: { type: String, enum: HOUSEKEEPING_STATUSES, default: 'pending' },
    // Miroir dérivé de `status` (voir OPEN_HOUSEKEEPING_STATUSES) —
    // maintenu par housekeepingService à chaque transition, jamais modifié
    // directement. Existe uniquement pour permettre l'index unique partiel
    // ci-dessous (une contrainte DB ne peut pas exprimer `$in` sur
    // plusieurs valeurs de statut dans un partialFilterExpression, qui ne
    // supporte que $eq/$exists/$gt/$gte/$lt/$lte/$type/$and).
    open: { type: Boolean, default: true },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, trim: true, default: '' },

    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// Anti double-tâche ouverte (mission §3) — contrainte DB, pas seulement
// applicative : une seule tâche `open:true` par chambre à la fois.
housekeepingTaskSchema.index({ room: 1 }, { unique: true, partialFilterExpression: { open: true } });
housekeepingTaskSchema.index({ status: 1 });
housekeepingTaskSchema.index({ hotel: 1, status: 1 });

const HousekeepingTask = mongoose.model('HousekeepingTask', housekeepingTaskSchema);
HousekeepingTask.HOUSEKEEPING_TYPES = HOUSEKEEPING_TYPES;
HousekeepingTask.HOUSEKEEPING_PRIORITIES = HOUSEKEEPING_PRIORITIES;
HousekeepingTask.HOUSEKEEPING_STATUSES = HOUSEKEEPING_STATUSES;
HousekeepingTask.HOUSEKEEPING_STATUS_TRANSITIONS = HOUSEKEEPING_STATUS_TRANSITIONS;
HousekeepingTask.OPEN_HOUSEKEEPING_STATUSES = OPEN_HOUSEKEEPING_STATUSES;

module.exports = HousekeepingTask;
