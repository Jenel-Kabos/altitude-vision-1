const mongoose = require('mongoose');

const bienSchema = new mongoose.Schema({
  typeBien: {
    type: String,
    enum: ['location', 'vente'],
    required: [true, 'Le type du bien est requis (location ou vente)'],
  },
  titre:          { type: String, required: [true, 'Le titre du bien est requis'], trim: true },
  type: {
    type: String,
    enum: ['Appartement','Maison','Villa','Terrain','Bureau','Commerce','Entrepôt','Studio'],
    default: 'Appartement',
  },
  adresse:        { type: String, required: [true, "L'adresse est requise"], trim: true },
  ville:          { type: String, required: [true, 'La ville est requise'], trim: true },
  quartier:       { type: String, trim: true },
  superficie:     { type: Number, min: 0 },
  nombrePieces:   { type: Number, min: 0 },
  nombreChambres: { type: Number, min: 0 },
  nombreSDB:      { type: Number, min: 0 },
  etage:          { type: Number },
  description:    { type: String, trim: true },
  photos:         [{ type: String }],
  statut: {
    type: String,
    enum: ['Disponible','Loué','Vendu','En travaux','Réservé'],
    default: 'Disponible',
  },
  disponibleDes:  { type: Date },
  // Champs location
  prixLoyer:  { type: Number, min: 0 },
  charges:    { type: Number, min: 0 },
  caution:    { type: Number, min: 0 },
  meuble:     { type: Boolean, default: false },
  // Champs vente
  prixVente:         { type: Number, min: 0 },
  prixNegociable:    { type: Boolean, default: false },
  anneeConstruction: { type: Number },
  etatGeneral: {
    type: String,
    enum: ['Neuf','Très bon état','Bon état','À rénover'],
  },
  titreFoncier: { type: Boolean, default: false },
  // Commodités (location)
  commodites: {
    // Eau & Énergie
    eauCourante:       { type: Boolean, default: false },
    eauChaude:         { type: Boolean, default: false },
    electricite:       { type: Boolean, default: false },
    groupeElectrogene: { type: Boolean, default: false },
    panneauxSolaires:  { type: Boolean, default: false },
    // Climatisation
    climatisation:     { type: Boolean, default: false },
    brasseurAir:       { type: Boolean, default: false },
    // Cuisine
    cuisineEquipee:    { type: Boolean, default: false },
    refrigerateur:     { type: Boolean, default: false },
    cuisiniere:        { type: Boolean, default: false },
    // Sécurité
    gardien:           { type: Boolean, default: false },
    videosurveillance: { type: Boolean, default: false },
    portailElectrique: { type: Boolean, default: false },
    interphone:        { type: Boolean, default: false },
    alarme:            { type: Boolean, default: false },
    // Connectivité
    wifi:              { type: Boolean, default: false },
    fibreOptique:      { type: Boolean, default: false },
    cableTv:           { type: Boolean, default: false },
    // Extérieur
    parking:           { type: Boolean, default: false },
    garage:            { type: Boolean, default: false },
    jardin:            { type: Boolean, default: false },
    piscine:           { type: Boolean, default: false },
    terrasse:          { type: Boolean, default: false },
    balcon:            { type: Boolean, default: false },
    // Intérieur
    ascenseur:         { type: Boolean, default: false },
    cave:              { type: Boolean, default: false },
    buanderie:         { type: Boolean, default: false },
    // Autres
    animauxAcceptes:   { type: Boolean, default: false },
    fumeurAccepte:     { type: Boolean, default: false },
    autres:            { type: String,  default: '' },
  },
  dateAjout:  { type: Date, default: Date.now },
}, { _id: true });

const proprietaireSchema = new mongoose.Schema({
  nom:            { type: String, required: [true, 'Le nom est requis'], trim: true },
  prenom:         { type: String, required: [true, 'Le prénom est requis'], trim: true },
  email:          { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  telephone:      { type: String, required: [true, 'Le téléphone est requis'], trim: true },
  adresse:        { type: String, trim: true },
  ville:          { type: String, trim: true },
  pieceIdentite:  { type: String },
  notes:          { type: String, trim: true },
  biensPropres:   [bienSchema],
}, { timestamps: true });

module.exports = mongoose.model('Proprietaire', proprietaireSchema);
