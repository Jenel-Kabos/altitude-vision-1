// server/models/RoomAssignment.js — Sprint D (opérations hôtelières)
//
// Relie une HotelReservation à une Room physique. Une réservation ne
// peut posséder plusieurs affectations actives (une par chambre réservée).
// L'historique complet (affectations passées, changements de
// chambre) est conservé : `releasedAt` marque la fin d'une affectation,
// jamais une suppression physique du document.

const mongoose = require('mongoose');

const roomAssignmentSchema = new mongoose.Schema(
  {
    reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'HotelReservation', required: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },

    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt: { type: Date, default: Date.now },
    releasedAt: { type: Date, default: null },

    reason: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

// Contrôle central anti-double-affectation (mission §4) : au niveau BASE DE
// DONNÉES, pas seulement applicatif — une Room ne peut avoir qu'UNE
// affectation active (releasedAt: null) à la fois. Une réservation peut en
// posséder plusieurs, jusqu'à `roomsCount`. Les affectations libérées ne
// sont jamais concernées par cette contrainte — l'historique s'accumule
// librement. Index partiel : `$type` (et non `$exists`) car `releasedAt` a
// une valeur par défaut `null` toujours présente (voir le même choix pour
// RatePlan, Sprint B2/audit final).
roomAssignmentSchema.index(
  { room: 1 },
  { unique: true, partialFilterExpression: { releasedAt: { $type: 'null' } } },
);
roomAssignmentSchema.index({ reservation: 1, releasedAt: 1, assignedAt: 1 });

const RoomAssignment = mongoose.model('RoomAssignment', roomAssignmentSchema);

module.exports = RoomAssignment;
