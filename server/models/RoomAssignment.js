// server/models/RoomAssignment.js — Sprint D (opérations hôtelières)
//
// Relie une HotelReservation à une Room physique. Une réservation ne
// possède au maximum qu'UNE SEULE affectation ACTIVE (releasedAt: null) à
// la fois dans ce sprint — le multi-room est explicitement hors périmètre
// (mission §3). L'historique complet (affectations passées, changements de
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
// affectation active (releasedAt: null) à la fois, et une réservation ne
// peut avoir qu'UNE affectation active à la fois (cohérent avec "au maximum
// une chambre" §3). Les affectations libérées (releasedAt renseigné) ne
// sont jamais concernées par cette contrainte — l'historique s'accumule
// librement. Index partiel : `$type` (et non `$exists`) car `releasedAt` a
// une valeur par défaut `null` toujours présente (voir le même choix pour
// RatePlan, Sprint B2/audit final).
roomAssignmentSchema.index(
  { room: 1 },
  { unique: true, partialFilterExpression: { releasedAt: { $type: 'null' } } },
);
roomAssignmentSchema.index(
  { reservation: 1 },
  { unique: true, partialFilterExpression: { releasedAt: { $type: 'null' } } },
);

const RoomAssignment = mongoose.model('RoomAssignment', roomAssignmentSchema);

module.exports = RoomAssignment;
