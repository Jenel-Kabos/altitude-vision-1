// server/models/MaintenanceTicket.js — Sprint E (housekeeping/inspection/maintenance)
//
// Un ticket de maintenance est ouvert manuellement par le staff (jamais
// auto-généré) après une inspection échouée (RoomInspection.result ===
// 'failed', Room.status === 'out_of_service') — l'entité `inspection` fait
// le lien, mais la catégorie/description exactes du problème ne sont pas
// déductibles automatiquement d'un simple échec d'inspection.

const mongoose = require('mongoose');

const MAINTENANCE_CATEGORIES = ['plumbing', 'electricity', 'furniture', 'cleanliness', 'security', 'other'];
const MAINTENANCE_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const MAINTENANCE_STATUSES = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];

// Statuts "ouverts" — mission §8 : "une chambre ne peut redevenir
// disponible tant qu'un ticket ouvert existe" (voir
// inspectionService.approveInspection).
const OPEN_MAINTENANCE_STATUSES = ['open', 'assigned', 'in_progress'];

const MAINTENANCE_STATUS_TRANSITIONS = {
  open: ['assigned', 'in_progress', 'resolved'],
  assigned: ['in_progress', 'resolved'],
  in_progress: ['resolved'],
  resolved: ['closed'],
  closed: [],
};

const maintenanceTicketSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    inspection: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomInspection', default: null },

    category: { type: String, enum: MAINTENANCE_CATEGORIES, required: true },
    priority: { type: String, enum: MAINTENANCE_PRIORITIES, default: 'normal' },
    status: { type: String, enum: MAINTENANCE_STATUSES, default: 'open' },
    description: { type: String, trim: true, required: [true, 'La description du problème est requise.'] },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

maintenanceTicketSchema.index({ room: 1 });
maintenanceTicketSchema.index({ status: 1 });
maintenanceTicketSchema.index({ hotel: 1, status: 1 });

const MaintenanceTicket = mongoose.model('MaintenanceTicket', maintenanceTicketSchema);
MaintenanceTicket.MAINTENANCE_CATEGORIES = MAINTENANCE_CATEGORIES;
MaintenanceTicket.MAINTENANCE_PRIORITIES = MAINTENANCE_PRIORITIES;
MaintenanceTicket.MAINTENANCE_STATUSES = MAINTENANCE_STATUSES;
MaintenanceTicket.MAINTENANCE_STATUS_TRANSITIONS = MAINTENANCE_STATUS_TRANSITIONS;
MaintenanceTicket.OPEN_MAINTENANCE_STATUSES = OPEN_MAINTENANCE_STATUSES;

module.exports = MaintenanceTicket;
