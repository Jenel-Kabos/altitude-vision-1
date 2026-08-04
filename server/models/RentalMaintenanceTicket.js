// server/models/RentalMaintenanceTicket.js — Sprint GL-B2
//
// Maintenance LOCATIVE — domaine dédié, distinct de MaintenanceTicket.js
// (Sprint E, exclusivement hôtelier). Un ticket ici est lié à un bien en
// gestion locative (Property), éventuellement à un bail (Contrat) et un
// locataire (Locataire) en cours. Volontairement DÉCOUPLÉ du champ
// `RentalManagement.maintenanceStatus` (statut sommaire déjà existant,
// utilisé pour la publication/disponibilité) — ce ticket est le détail
// opérationnel (assignation, planification, coûts), jamais synchronisé
// automatiquement avec le workflow de publication pour ne pas complexifier
// un cycle déjà en place (voir RENTAL_MANAGEMENT_V2.md, §décisions).

const mongoose = require('mongoose');

const RENTAL_MAINTENANCE_CATEGORIES = ['plomberie', 'electricite', 'structure', 'equipement', 'nuisible', 'serrurerie', 'peinture', 'autre'];
const RENTAL_MAINTENANCE_PRIORITIES = ['basse', 'normale', 'haute', 'urgente'];
const RENTAL_MAINTENANCE_STATUSES = ['ouvert', 'assigne', 'planifie', 'en_cours', 'resolu', 'cloture'];
const OPEN_RENTAL_MAINTENANCE_STATUSES = ['ouvert', 'assigne', 'planifie', 'en_cours'];

const RENTAL_MAINTENANCE_STATUS_TRANSITIONS = {
  ouvert: ['assigne', 'planifie', 'en_cours', 'resolu'],
  assigne: ['planifie', 'en_cours', 'resolu'],
  planifie: ['en_cours', 'resolu'],
  en_cours: ['resolu'],
  resolu: ['cloture'],
  cloture: [],
};

const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  nom: { type: String, trim: true, default: '' },
}, { _id: false });

const rentalMaintenanceTicketSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    lease: { type: mongoose.Schema.Types.ObjectId, ref: 'Contrat', default: null },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Locataire', default: null },
    // Propriétaire "compte" (User, self-service — voir RentalManagement.owner),
    // pas la fiche `Proprietaire` legacy (sans compte, voir audit GL-B2).
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    category: { type: String, enum: RENTAL_MAINTENANCE_CATEGORIES, required: true },
    priority: { type: String, enum: RENTAL_MAINTENANCE_PRIORITIES, default: 'normale' },
    status: { type: String, enum: RENTAL_MAINTENANCE_STATUSES, default: 'ouvert' },
    description: { type: String, trim: true, required: [true, 'La description du problème est requise.'] },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    scheduledFor: { type: Date, default: null },
    estimatedCost: { type: Number, min: 0, default: null },
    actualCost: { type: Number, min: 0, default: null },
    attachments: { type: [attachmentSchema], default: [] },
    resolvedAt: { type: Date, default: null },

    // GL-ASSET-1 — Phase 3 (carnet d'entretien) : champs optionnels, absents
    // sur tout ticket existant (rétrocompatibles sans migration). Enrichit
    // CE modèle plutôt que d'en créer un second — même ticket, deux
    // informations administratives de plus.
    entrepriseIntervenante: { type: String, trim: true, default: '' },
    garantieJusquau: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

rentalMaintenanceTicketSchema.index({ property: 1 });
rentalMaintenanceTicketSchema.index({ status: 1 });
rentalMaintenanceTicketSchema.index({ owner: 1, status: 1 });

const RentalMaintenanceTicket = mongoose.model('RentalMaintenanceTicket', rentalMaintenanceTicketSchema);
RentalMaintenanceTicket.RENTAL_MAINTENANCE_CATEGORIES = RENTAL_MAINTENANCE_CATEGORIES;
RentalMaintenanceTicket.RENTAL_MAINTENANCE_PRIORITIES = RENTAL_MAINTENANCE_PRIORITIES;
RentalMaintenanceTicket.RENTAL_MAINTENANCE_STATUSES = RENTAL_MAINTENANCE_STATUSES;
RentalMaintenanceTicket.RENTAL_MAINTENANCE_STATUS_TRANSITIONS = RENTAL_MAINTENANCE_STATUS_TRANSITIONS;
RentalMaintenanceTicket.OPEN_RENTAL_MAINTENANCE_STATUSES = OPEN_RENTAL_MAINTENANCE_STATUSES;

module.exports = RentalMaintenanceTicket;
