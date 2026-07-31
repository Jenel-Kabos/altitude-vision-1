// server/models/RoomInspection.js — Sprint E (housekeeping/inspection/maintenance)
//
// Une inspection est créée après qu'une HousekeepingTask est terminée
// (Room.status passe de 'cleaning' à 'inspection', voir
// housekeepingService.completeTask). `result` reste `null` tant que
// l'inspection n'a pas été tranchée — inspectionService.approveInspection/
// rejectInspection sont les deux seuls chemins qui le renseignent (jamais
// une écriture directe ailleurs), cohérent avec l'API REST (POST crée
// l'inspection, PATCH /:id/approve|reject la tranche).

const mongoose = require('mongoose');

const ROOM_INSPECTION_RESULTS = ['passed', 'failed'];

const roomInspectionSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    // Cycle de nettoyage à l'origine de cette inspection. Réutilisé pour une
    // ré-inspection post-maintenance (out_of_service → inspection, mission
    // §9) — pas de nouvelle HousekeepingTask dans ce cas, la dernière tâche
    // liée à la chambre reste la référence.
    housekeepingTask: { type: mongoose.Schema.Types.ObjectId, ref: 'HousekeepingTask', required: true },
    inspector: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // `null` = inspection créée, décision pas encore rendue.
    result: { type: String, enum: ROOM_INSPECTION_RESULTS, default: null },
    notes: { type: String, trim: true, default: '' },
    inspectedAt: { type: Date, default: null },
    fromOutOfService: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Anti double-inspection ouverte (mission §6/§13) — contrainte DB, même
// stratégie que HousekeepingTask.js : createInspectionCore ne fait que lire
// room.status === 'inspection' sans le réclamer atomiquement, donc deux
// créations concurrentes pouvaient chacune passer ce contrôle et produire
// deux RoomInspection ouvertes (result: null) pour la même chambre.
roomInspectionSchema.index({ room: 1 }, { unique: true, partialFilterExpression: { result: null } });
roomInspectionSchema.index({ housekeepingTask: 1 });

const RoomInspection = mongoose.model('RoomInspection', roomInspectionSchema);
RoomInspection.ROOM_INSPECTION_RESULTS = ROOM_INSPECTION_RESULTS;

module.exports = RoomInspection;
