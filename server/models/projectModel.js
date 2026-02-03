// models/projectModel.js
import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    // --- Référence du créateur du projet (admin ou chef de projet)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Le créateur du projet est requis.'],
    },
    // --- Catégorie métier
    category: {
      type: String,
      enum: ['Immobilier', 'Communication', 'Événementiel'],
      required: [true, 'Veuillez préciser la catégorie du projet.'],
    },
    // --- Informations générales
    title: {
      type: String,
      required: [true, 'Le titre du projet est requis.'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'La description du projet est requise.'],
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    location: { type: String, default: '' },
    // --- État d'avancement
    status: {
      type: String,
      enum: ['Planifié', 'En cours', 'Terminé', 'Annulé'],
      default: 'Planifié',
    },
    // --- Liens vers d'autres modèles de l'application
    relatedProperty: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    relatedEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    // --- Données financières
    budget: { type: Number, required: true, min: 0 },
    actualCost: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ['En attente', 'Partiel', 'Payé'],
      default: 'En attente',
    },
    // --- Équipe assignée au projet
    teamMembers: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, default: 'Collaborateur' },
    }],
    // --- Documents liés (devis, factures, plans)
    attachments: [{
        name: { type: String },
        url: { type: String }, // Chemin vers le fichier uploadé
    }],
    // --- Suivi pour le dashboard
    progress: { type: Number, min: 0, max: 100, default: 0 },
  },
  { timestamps: true }
);

const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);

export default Project;









