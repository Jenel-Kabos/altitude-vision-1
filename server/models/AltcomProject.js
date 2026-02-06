// server/models/AltcomProject.js
const mongoose = require('mongoose');

const altcomProjectSchema = new mongoose.Schema({
  // ======================================================
  // 👤 Informations Contact
  // ======================================================
  contactName: {
    type: String,
    required: [true, 'Le nom du contact est requis'],
    trim: true,
  },
  companyName: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    required: [true, "L'email est requis"],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Veuillez fournir une adresse email valide'],
  },
  phone: {
    type: String,
    trim: true,
  },

  // ======================================================
  // 📂 Informations Projet
  // ======================================================
  projectName: {
    type: String,
    required: [true, 'Le nom du projet est requis'],
    trim: true,
  },
  
  // Type de prestation
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
    required: [true, 'Le type de projet est requis'],
  },

  // Catégorie (Interne)
  projectCategory: {
    type: String,
    enum: ['Stratégie', 'Création', 'Production', 'Diffusion', 'Conseil'],
    default: 'Stratégie',
  },

  // ======================================================
  // 🎯 Objectifs & Cible
  // ======================================================
  targetAudience: {
    type: String,
    required: [true, 'Le public cible est requis'],
  },
  objectives: {
    type: String,
    required: [true, 'Les objectifs sont requis'],
  },

  // ======================================================
  // 💰 Budget & Planning
  // ======================================================
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
    required: [true, 'Le budget est requis'],
  },
  startDate: {
    type: Date,
  },
  deadline: {
    type: Date,
  },

  // ======================================================
  // 📝 Description Détaillée
  // ======================================================
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

  // ======================================================
  // 📦 Matériaux
  // ======================================================
  hasExistingMaterials: {
    type: Boolean,
    default: false,
  },
  materialsDescription: {
    type: String,
    maxlength: 500,
  },

  // ======================================================
  // ⚙️ Gestion (Admin)
  // ======================================================
  status: {
    type: String,
    enum: ['En attente', 'En cours d\'analyse', 'Accepté', 'Refusé', 'En cours', 'Terminé'],
    default: 'En attente',
  },

  // Date de soumission (Utilisée pour le tri dans le contrôleur)
  submittedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  // Crée automatiquement createdAt et updatedAt
  timestamps: true, 
});

// ======================================================
// 📊 Index
// ======================================================
altcomProjectSchema.index({ email: 1, submittedAt: -1 });
altcomProjectSchema.index({ status: 1 });

module.exports = mongoose.model('AltcomProject', altcomProjectSchema);