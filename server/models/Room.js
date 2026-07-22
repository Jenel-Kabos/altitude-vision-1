// server/models/Room.js — Sprint D (opérations hôtelières)
//
// Une Room représente une CHAMBRE PHYSIQUE, contrairement à RoomCategory
// (Sprint B2, un type commercialisé : "Deluxe", "Suite"…) et RoomInventory
// (Sprint C, un compteur de stock ABSTRAIT par nuit). Les trois entités
// restent volontairement DÉCOUPLÉES dans ce sprint : créer des `Room` ne
// modifie ni ne resynchronise `RoomCategory.unitsAvailable` ni
// `RoomInventory` — voir HOTEL_OPERATIONS_V1.md ("Room vs RoomInventory :
// deux comptages distincts, non réconciliés automatiquement dans ce
// sprint"). Une Room appartient à EXACTEMENT une RoomCategory.

const mongoose = require('mongoose');

const ROOM_STATUSES = ['available', 'occupied', 'reserved', 'out_of_service', 'cleaning', 'inspection'];

// Transitions autorisées (Sprint D §7, complétées Sprint E §9) — centralisées
// ici, jamais dupliquées dans un contrôleur/service. `occupied → available`
// est volontairement ABSENT : un check-out (checkOutService) est le seul
// chemin qui libère une chambre occupée, et il la fait toujours transiter
// par 'cleaning' d'abord.
//
// Sprint E : `out_of_service → available` directement est désormais
// INTERDIT (mission §9 — "interdire out_of_service → available sans
// inspection réussie") ; seule `out_of_service → inspection` est permise,
// suivie d'une inspection réussie (RoomInspection.result === 'passed',
// voir inspectionService.approveInspection) pour rejoindre 'available'.
const ROOM_STATUS_TRANSITIONS = {
  available: ['reserved', 'occupied', 'out_of_service'],
  reserved: ['occupied', 'available', 'out_of_service'],
  occupied: ['cleaning', 'out_of_service'],
  cleaning: ['inspection', 'available', 'out_of_service'],
  inspection: ['available', 'cleaning', 'out_of_service'],
  out_of_service: ['inspection'],
};

const roomSchema = new mongoose.Schema(
  {
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    roomCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomCategory', required: true },

    roomNumber: { type: String, required: [true, 'Le numéro de chambre est requis.'], trim: true },
    floor: { type: Number, default: 0 },
    wing: { type: String, trim: true, default: '' },

    status: { type: String, enum: ROOM_STATUSES, default: 'available' },
    notes: { type: String, trim: true, default: '' },
    // Équipements/particularités simples de la chambre (ex: "Vue mer",
    // "Balcon") — texte libre, volontairement non structuré par catégorie
    // (contrairement à Accommodation/RoomCategory.amenities) : une Room n'a
    // pas besoin de la même granularité, juste des mentions ponctuelles.
    features: { type: [String], default: [] },

    active: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// Un numéro de chambre est unique PAR HÔTEL (la numérotation est propre à
// l'établissement, jamais à une catégorie — deux catégories du même hôtel
// ne peuvent pas revendiquer le même numéro).
roomSchema.index({ hotel: 1, roomNumber: 1 }, { unique: true });
roomSchema.index({ status: 1 });

const Room = mongoose.model('Room', roomSchema);
Room.ROOM_STATUSES = ROOM_STATUSES;
Room.ROOM_STATUS_TRANSITIONS = ROOM_STATUS_TRANSITIONS;

module.exports = Room;
