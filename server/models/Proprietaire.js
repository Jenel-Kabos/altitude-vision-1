const mongoose = require('mongoose');
const privateAssetSchema = require('./schemas/privateAssetSchema');

const bienSchema = new mongoose.Schema({
  typeBien: {
    type: String,
    enum: ['location', 'vente'],
    required: [true, 'Le type du bien est requis (location ou vente)'],
  },
  titre:          { type: String, required: [true, 'Le titre du bien est requis'], trim: true },
  type: {
    type: String,
    enum: ['Appartement', 'Appartement meublé', 'Maison', 'Villa',
           'Terrain', 'Parcelle', 'Bureau', 'Commerce', 'Studio', 'Entrepôt'],
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
  pieceIdentite:     { type: String },
  pieceIdentiteAsset: { type: privateAssetSchema },
  pieceIdentiteType: { type: String }, // 'pdf', 'jpeg', 'png'
  pieceIdentiteNom:  { type: String }, // nom original du fichier
  notes:             { type: String, trim: true },
  biensPropres:   [bienSchema],
  // GL-ARCH-1.1 : lien optionnel vers un compte User représentant ce
  // propriétaire — jamais renseigné automatiquement à la création d'une
  // fiche Proprietaire (décision historique, voir RENTAL_MANAGEMENT_V2.md
  // §11 : Proprietaire et User de rôle Proprietaire restent deux notions
  // distinctes). Renseigné uniquement lorsqu'un bien de biensPropres[] est
  // importé en Gestion locative (server/services/proprietaireGestionImportService.js) :
  // soit un User existant est explicitement lié par le staff, soit un User
  // technique minimal (inactif, sans mot de passe utilisable) est créé pour
  // satisfaire la relation obligatoire Property.owner → User.
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });
proprietaireSchema.set('toJSON', { transform: (_doc, ret) => {
  const available = Boolean(ret.pieceIdentiteAsset || ret.pieceIdentite); delete ret.pieceIdentite; delete ret.pieceIdentiteAsset;
  if (available) ret.identityDocument = { canPreview: true, canDownload: true, previewEndpoint: `/api/proprietaires/${ret._id}/identity-document`, downloadEndpoint: `/api/proprietaires/${ret._id}/identity-document?download=1` };
  return ret;
} });

module.exports = mongoose.model('Proprietaire', proprietaireSchema);
