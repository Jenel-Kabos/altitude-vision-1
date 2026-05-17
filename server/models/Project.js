const mongoose = require('mongoose');

// Schéma pour les Avis
const reviewSchema = mongoose.Schema({
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
}, { timestamps: true });

// Schéma pour les Projets du Portfolio
const projectSchema = mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, enum: ['Branding', 'Digital', 'Média'], required: true },
  description: { type: String, required: true },
  images: [String],
  videoUrl: String,
  reviews: [reviewSchema], // Avis intégrés directement
}, { timestamps: true });

const Project = mongoose.model('Project', projectSchema);
// Pas besoin de modèle séparé pour Review si c'est un sous-document
module.exports = Project;