const mongoose = require('mongoose');
const privateAssetSchema = require('./schemas/privateAssetSchema');

const documentSchema = new mongoose.Schema({
  nom:            { type: String },
  url:            { type: String },
  asset:          { type: privateAssetSchema },
  type:           { type: String },
  dateGeneration: { type: Date, default: Date.now },
  envoiEmail:     { type: Boolean, default: false },
  dateEnvoi:      { type: Date },
  // GL-DEBT-1 (Phase 9) — champs optionnels, absents sur tous les documents
  // existants (rétrocompatibles sans migration). sourcePaiement permet de
  // retrouver et invalider une quittance si l'encaissement qui l'a produite
  // est ensuite annulé (Phase 8) — le document original n'est JAMAIS
  // modifié ni supprimé, seul son statut de validité change.
  sourcePaiement: { type: mongoose.Schema.Types.ObjectId, ref: 'Paiement', default: null },
  invalidated:     { type: Boolean, default: false },
  invalidatedAt:   { type: Date, default: null },
  invalidatedReason: { type: String, trim: true, default: '' },
});

const pieceEdlSchema = new mongoose.Schema({
  nom:          { type: String, trim: true },
  etat:         { type: String, enum: ['Neuf', 'Très bon', 'Bon', 'Moyen', 'Mauvais', 'Très mauvais'] },
  observations: { type: String, trim: true },
}, { _id: false });

const etatDesLieuxSchema = new mongoose.Schema({
  type:        { type: String, enum: ['entree', 'sortie'], required: true },
  date:        { type: Date, default: Date.now },
  pieces:      [pieceEdlSchema],
  documentUrl: { type: String },
  documentAsset: { type: privateAssetSchema },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  validatedByStaff: { type: Boolean, default: false },
  validatedAt: Date,
  validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  degradationReported: { type: Boolean, default: false },
  maintenanceRequired: { type: Boolean, default: false },
  blockingReason: { type: String, trim: true, maxlength: 1000 },
}, { _id: false });

// GL-LIFE-1 — historique de cycle de vie du bail (même convention que
// RentalManagement.workflowHistory) : chaque transition de `cycleVie` est
// tracée ici par rentalLeaseLifecycleService.js, jamais écrite ailleurs.
const cycleHistorySchema = new mongoose.Schema({
  from: String,
  to: { type: String, required: true },
  action: { type: String, required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  comment: { type: String, trim: true, maxlength: 1000 },
  at: { type: Date, default: Date.now },
}, { _id: false });

// GL-LIFE-1 — un avenant modifie le bail SANS jamais écraser sa version
// précédente (append-only) : loyer, durée, clauses, dépôt de garantie,
// annexes. Un renouvellement par prolongation (règle métier validée) est un
// avenant de type 'renouvellement' — une seule chronologie continue pour le
// Centre documentaire (Phase 7), jamais deux tableaux distincts.
const avenantSchema = new mongoose.Schema({
  type: { type: String, enum: ['loyer', 'duree', 'clauses', 'depot_garantie', 'annexes', 'renouvellement', 'autre'], required: true },
  champsModifies: [{
    champ: { type: String, required: true },
    avant: mongoose.Schema.Types.Mixed,
    apres: mongoose.Schema.Types.Mixed,
    _id: false,
  }],
  motif: { type: String, trim: true, maxlength: 1000 },
  dateEffet: { type: Date, default: Date.now },
  creePar: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

// GL-LIFE-1 — traçabilité complète de la caution (Phase 6), en complément
// de `montantCaution`/`cautionVersee`/`dateCautionVersee` (jamais dupliqués,
// juste enrichis) : encaissement → blocage → retenue éventuelle →
// restitution partielle ou totale.
const cautionHistoriqueSchema = new mongoose.Schema({
  action: { type: String, enum: ['encaissement', 'blocage', 'retenue', 'restitution'], required: true },
  montant: { type: Number, min: 0 },
  motif: { type: String, trim: true, maxlength: 1000 },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  at: { type: Date, default: Date.now },
}, { _id: false });

const cautionSchema = new mongoose.Schema({
  statut: { type: String, enum: ['non_versee', 'versee', 'bloquee', 'partiellement_restituee', 'restituee', 'retenue_totale'], default: 'non_versee' },
  montantRetenu: { type: Number, min: 0, default: 0 },
  motifRetenue: { type: String, trim: true, maxlength: 1000, default: '' },
  montantRestitue: { type: Number, min: 0, default: 0 },
  dateRestitution: { type: Date, default: null },
  historique: { type: [cautionHistoriqueSchema], default: [] },
}, { _id: false });

const contratSchema = new mongoose.Schema({
  // ─── Communs ───────────────────────────────────────────────
  type: {
    type: String,
    enum: ['location', 'vente'],
    required: [true, 'Le type de contrat est requis'],
  },
  bien:         { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  reservation:  { type: mongoose.Schema.Types.ObjectId, ref: 'RealEstateReservation', default: null },
  proprietaire: { type: mongoose.Schema.Types.ObjectId, ref: 'Proprietaire' },
  statut: {
    type: String,
    enum: ['actif', 'résilié', 'expiré', 'en_attente'],
    default: 'en_attente',
  },
  adresseBien:  { type: String, trim: true },
  villeBien:    { type: String, trim: true },
  documents:      [documentSchema],
  etatsDesLieux:  [etatDesLieuxSchema],
  notes:          { type: String, trim: true },

  // ─── GL-LIFE-1 — cycle de vie du bail ──────────────────────
  // `cycleVie` est optionnel (absent sur tout contrat créé avant ce
  // sprint — aucune migration) : rentalLeaseLifecycleService.js le dérive
  // depuis `statut` pour les documents legacy, et devient la source de
  // vérité pour toute nouvelle transition. `statut` reste inchangé — c'est
  // le champ légal/contractuel déjà lu partout (index unique, portail
  // locataire, dossier DOC-EVO-2) ; `cycleVie` est la granularité
  // opérationnelle supplémentaire, toujours tenue synchronisée avec lui.
  cycleVie: {
    type: String,
    enum: ['projet', 'en_preparation', 'a_signer', 'actif', 'preavis', 'inspection_sortie', 'cloture_financiere', 'resilie', 'archive'],
    default: null,
  },
  cycleHistory: { type: [cycleHistorySchema], default: [] },
  avenants: { type: [avenantSchema], default: [] },
  caution: { type: cautionSchema, default: () => ({}) },
  // Renouvellement par prolongation (règle métier par défaut) ne crée
  // JAMAIS de nouveau Contrat — seul un changement majeur (locataire,
  // propriétaire, bien, type) déclenche un nouveau Contrat lié ici, dans
  // les deux sens, pour que le Centre documentaire reconstruise la chaîne
  // complète sans rupture (Contrat #1 → renouvelé par → Contrat #2 → ...).
  renouvelleDe: { type: mongoose.Schema.Types.ObjectId, ref: 'Contrat', default: null },
  renouvelePar: { type: mongoose.Schema.Types.ObjectId, ref: 'Contrat', default: null },

  // ─── Location ──────────────────────────────────────────────
  locataire:          { type: mongoose.Schema.Types.ObjectId, ref: 'Locataire' },
  dateEntree:         { type: Date },
  dateSortie:         { type: Date },
  dateFinBail:        { type: Date },
  montantLoyer:       { type: Number, min: 0 },
  montantCaution:     { type: Number, min: 0 },
  cautionVersee:      { type: Boolean, default: false },
  dateCautionVersee:  { type: Date },
  dureePreavis:       { type: Number, default: 1 }, // mois
  indexationAnnuelle: { type: Boolean, default: false },
  chargesIncluses:    { type: Boolean, default: false },
  montantCharges:     { type: Number, min: 0 },

  // ─── Vente ─────────────────────────────────────────────────
  acheteur: {
    nom:       { type: String, trim: true },
    prenom:    { type: String, trim: true },
    email:     { type: String, trim: true },
    telephone: { type: String, trim: true },
  },
  prixVente:               { type: Number, min: 0 },
  dateSignatureCompromis:  { type: Date },
  dateSignatureActe:       { type: Date },
  notaire: {
    nom:       { type: String, trim: true },
    telephone: { type: String, trim: true },
    email:     { type: String, trim: true },
  },
  commissionAgence:      { type: Number, min: 0 },
  conditionsSuspensives: { type: String, trim: true },
}, { timestamps: true });

// Verrou persistant contre deux engagements incompatibles sur le même bien.
// Les contrats clôturés restent conservés dans l'historique mais ne bloquent
// pas un futur cycle. L'index protège aussi les créations concurrentes.
contratSchema.index(
  { bien: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      bien: { $type: 'objectId' },
      statut: { $in: ['en_attente', 'actif'] },
    },
    name: 'one_open_contract_per_property_and_type',
  },
);
contratSchema.index(
  { reservation: 1 },
  { unique: true, partialFilterExpression: { reservation: { $type: 'objectId' } }, name: 'one_contract_per_real_estate_reservation' },
);

// Aucun sérialiseur API ne doit pouvoir réexposer accidentellement une URL
// Cloudinary permanente ou une clé de stockage privée imbriquée.
contratSchema.set('toJSON', { transform: (_doc, ret) => {
  ret.documents = (ret.documents || []).map((item) => {
    const { url, asset, ...safe } = item;
    const available = Boolean(url || asset);
    return { ...safe, canPreview: available, canDownload: available,
      ...(available && { previewEndpoint: `/api/rental-documents/${item._id}/download`, downloadEndpoint: `/api/rental-documents/${item._id}/download?download=1` }),
      legacy: Boolean(url && !asset) };
  });
  ret.etatsDesLieux = (ret.etatsDesLieux || []).map(({ documentUrl, documentAsset, ...safe }) => ({ ...safe, hasDocument: Boolean(documentUrl || documentAsset) }));
  return ret;
} });

module.exports = mongoose.model('Contrat', contratSchema);
