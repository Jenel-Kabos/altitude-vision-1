// server/models/RoomInventory.js — Sprint C (moteur de réservation hôtelière)
//
// Stock disponible d'une RoomCategory pour UNE date (une nuit) donnée.
// `date` est toujours normalisée à minuit UTC par hotelAvailabilityService
// (jamais saisie brute) pour que l'index unique {roomCategory, date} identifie
// sans ambiguïté une nuit, indépendamment du fuseau horaire de l'appelant.
//
// `totalUnits` provient PAR DÉFAUT de RoomCategory.unitsAvailable au moment
// de la création du document (voir hotelAvailabilityService.ensureInventoryExists)
// — jamais dupliqué/recalculé ailleurs : si aucun document n'existe encore
// pour une nuit, la disponibilité "virtuelle" retombe directement sur
// RoomCategory.unitsAvailable (voir getAvailability).

const mongoose = require('mongoose');

const roomInventorySchema = new mongoose.Schema(
  {
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    roomCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomCategory', required: true },
    date: { type: Date, required: true },

    totalUnits: { type: Number, required: true, min: 0 },
    blockedUnits: { type: Number, default: 0, min: 0 },
    physicalBlockedUnits: { type: Number, default: 0, min: 0 },
    reservedUnits: { type: Number, default: 0, min: 0 },

    isClosed: { type: Boolean, default: false },
    stopSell: { type: Boolean, default: false },

    reason: { type: String, trim: true, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

// Contrainte centrale (mission §3) : un seul document par (catégorie, nuit).
// Sert aussi de garde-fou contre la double création concurrente (upsert
// atomique — voir hotelAvailabilityService.ensureInventoryExists).
roomInventorySchema.index({ roomCategory: 1, date: 1 }, { unique: true });
// Vue "toutes les nuits d'un hôtel" (dashboards) — jamais utilisée seule
// pour la contrainte d'unicité, qui reste scopée par catégorie ci-dessus.
roomInventorySchema.index({ hotel: 1, date: 1 });

// availableUnits n'est JAMAIS persisté : toujours dérivé, jamais désynchro
// possible avec totalUnits/blockedUnits/reservedUnits. Jamais négatif
// (mission §3).
roomInventorySchema.virtual('availableUnits').get(function computeAvailableUnits() {
  return Math.max(0, this.totalUnits - this.blockedUnits - this.physicalBlockedUnits - this.reservedUnits);
});

const RoomInventory = mongoose.model('RoomInventory', roomInventorySchema);

module.exports = RoomInventory;
