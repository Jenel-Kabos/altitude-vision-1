// server/models/HotelFaq.js — PHASE-H3
//
// FAQ RÉDIGÉE PAR L'HÔTEL (mission §13 : "pas du Q&A communautaire").
// Modèle dédié, jamais embarqué dans Hotel — même convention que
// RoomCategory/RatePlan (Hotel → entité satellite référencée, jamais un
// tableau embarqué pour une donnée structurée gérée indépendamment,
// ordonnée, avec son propre cycle actif/inactif et son propre audit
// created/updatedBy). `Hotel.gallery` est la seule exception embarquée du
// domaine (médias, pas une donnée métier structurée) — non reproduite ici.
const mongoose = require('mongoose');

const hotelFaqSchema = new mongoose.Schema(
  {
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    question: { type: String, required: [true, 'La question est requise.'], trim: true, maxlength: 300 },
    answer: { type: String, required: [true, 'La réponse est requise.'], trim: true, maxlength: 2000 },
    order: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

hotelFaqSchema.index({ hotel: 1, active: 1, order: 1 });

const HotelFaq = mongoose.model('HotelFaq', hotelFaqSchema);

module.exports = HotelFaq;
