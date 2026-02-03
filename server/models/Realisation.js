const mongoose = require('mongoose');

const realisationSchema = new mongoose.Schema({
  // 1. Informations Générales sur le Client
  clientName: { type: String, required: true },
  sector: String,
  address: String,
  website: String,
  contactPerson: String,
  contactFunction: String,
  phone: String,
  email: String,

  // 2. Présentation du Projet
  projectTitle: { type: String, required: true },
  shortDescription: String,
  projectContext: String,
  mainObjective: [String],
  mainObjective_other: String,

  // 3. Publics Cibles
  targetAudience: String,
  socioAge: String,
  geoTarget: String,
  mediaHabits: String,

  // 4. Message et Positionnement
  mainMessage: String,
  secondaryMessages: String,
  slogan: String,
  communicationStyle: [String],
  communicationStyle_other: String,
  brandValues: String,

  // 5. Moyens et Supports de Communication
  desiredSupports: [String],
  desiredSupports_other: String,
  existingSupports: String,

  // 6. Contraintes et Attentes
  desiredTimeline: String,
  budget: String,
  technicalConstraints: String,
  kpis: [String],
  kpis_other: String,

  // 7. Documents Complémentaires
  additionalDocs: [String],

  // 8. Validation
  validatorName: String,
  validationDate: Date,

  // 9. Observations
  observations: String,
}, {
  timestamps: true // Ajoute automatiquement createdAt et updatedAt
});

module.exports = mongoose.model('Realisation', realisationSchema);