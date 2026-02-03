const mongoose = require('mongoose');

const altcomProjectSchema = new mongoose.Schema({
  // Informations générales
  projectName: {
    type: String,
    required: [true, 'Le nom du projet est requis'],
    trim: true,
  },
  companyName: {
    type: String,
    trim: true,
  },
  contactName: {
    type: String,
    required: [true, 'Le nom du contact est requis'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "L'email est requis"],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email invalide'],
  },
  phone: {
    type: String,
    trim: true,
  },
  
  // Détails du projet
  projectType: {
    type: String,
    enum: [
      'Communication Digitale',
      'Branding & Design',
      'Stratégie de Contenu',
      'Campagne Publicitaire',
      'Relations Publiques',
      'Événementiel',
      'Refonte Site Web',
      'Production Audiovisuelle',
      'Autre'
    ],
    required: true,
  },
  projectCategory: {
    type: String,
    enum: ['Stratégie', 'Création', 'Production', 'Diffusion', 'Conseil'],
    default: 'Stratégie',
  },
  targetAudience: {
    type: String,
    required: true,
  },
  objectives: {
    type: String,
    required: true,
  },
  
  // Budget et timing
  budget: {
    type: String,
    enum: [
      'Moins de 500K',
      '500K-1M',
      '1M-3M',
      '3M-5M',
      '5M-10M',
      'Plus de 10M',
      'À définir'
    ],
    required: true,
  },
  startDate: {
    type: Date,
  },
  deadline: {
    type: Date,
  },
  
  // Description détaillée
  detailedDescription: {
    type: String,
    required: [true, 'La description du projet est requise'],
    maxlength: 2000,
  },
  currentSituation: {
    type: String,
    maxlength: 1000,
  },
  expectedResults: {
    type: String,
    maxlength: 1000,
  },
  
  // Matériaux existants
  hasExistingMaterials: {
    type: Boolean,
    default: false,
  },
  materialsDescription: {
    type: String,
    maxlength: 500,
  },
  
  // Statut du projet
  status: {
    type: String,
    enum: ['En attente', 'En cours d\'analyse', 'Accepté', 'Refusé', 'En cours', 'Terminé'],
    default: 'En attente',
  },
  
  // Métadonnées
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index pour recherche rapide
altcomProjectSchema.index({ email: 1, submittedAt: -1 });
altcomProjectSchema.index({ status: 1 });

module.exports = mongoose.model('AltcomProject', altcomProjectSchema);