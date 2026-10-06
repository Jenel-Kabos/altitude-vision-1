const mongoose = require('mongoose');
const privateAssetSchema = require('./schemas/privateAssetSchema');

const locataireSchema = new mongoose.Schema({
  nom:            { type: String, required: [true, 'Le nom est requis'], trim: true },
  prenom:         { type: String, required: [true, 'Le prénom est requis'], trim: true },
  email:          { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  telephone:      { type: String, required: [true, 'Le téléphone est requis'], trim: true },
  adresse:        { type: String, trim: true },
  ville:          { type: String, trim: true },
  pieceIdentite:  { type: String }, // URL Cloudinary
  pieceIdentiteAsset: { type: privateAssetSchema },
  profession:     { type: String, trim: true },
  revenuMensuel:  { type: Number, min: 0 },
  notes:          { type: String, trim: true },

  // Dette technique GL-B2 — liaison OPTIONNELLE vers un compte User (portail
  // locataire). Un User n'est jamais automatiquement un Locataire (un
  // visiteur/prospect/propriétaire n'a pas de dossier locatif) — ce champ
  // n'est renseigné qu'après un rattachement explicite et validé (invitation
  // acceptée ou demande de rattachement approuvée par un gestionnaire, voir
  // TenantLinkRequest.js). Jamais rempli automatiquement sur simple
  // correspondance d'email — voir tenantLinkService.js.
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // C2.10A — espace de gestion locative (PlatformTenant) qui a créé cette
  // fiche. Posé UNIQUEMENT côté serveur à la création (jamais depuis le body,
  // jamais modifiable ensuite). Seule provenance tant qu'aucun bail ne relie
  // la fiche à un bien ; dès qu'un bail existe, Property.tenant de chaque bien
  // lié doit coïncider (voir rentalScopeService). null = fiche historique.
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', default: null, index: true },
  // C2.10B — provenance d'une fiche INDIVIDUAL avant son premier bail.
  // Posée côté serveur uniquement. Absente sur le legacy non prouvé.
  individualOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
}, { timestamps: true });

// Un compte User ne peut être rattaché qu'à UN SEUL dossier Locataire à la
// fois (index unique partiel — `$type` car `user` a une valeur par défaut
// `null` toujours présente, même convention que RoomAssignment/
// HousekeepingTask, Sprints D/E).
locataireSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } });
locataireSchema.set('toJSON', { transform: (_doc, ret) => {
  const available = Boolean(ret.pieceIdentiteAsset || ret.pieceIdentite); delete ret.pieceIdentite; delete ret.pieceIdentiteAsset;
  if (available) ret.identityDocument = { canPreview: true, canDownload: true, previewEndpoint: `/api/locataires/${ret._id}/identity-document`, downloadEndpoint: `/api/locataires/${ret._id}/identity-document?download=1` };
  return ret;
} });

module.exports = mongoose.model('Locataire', locataireSchema);
