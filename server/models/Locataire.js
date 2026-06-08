const mongoose = require('mongoose');

const locataireSchema = new mongoose.Schema({
  nom:            { type: String, required: [true, 'Le nom est requis'], trim: true },
  prenom:         { type: String, required: [true, 'Le prénom est requis'], trim: true },
  email:          { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  telephone:      { type: String, required: [true, 'Le téléphone est requis'], trim: true },
  adresse:        { type: String, trim: true },
  ville:          { type: String, trim: true },
  pieceIdentite:  { type: String }, // URL Cloudinary
  profession:     { type: String, trim: true },
  revenuMensuel:  { type: Number, min: 0 },
  notes:          { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Locataire', locataireSchema);
