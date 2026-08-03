const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const itemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  unitPrice: { type: Number, required: true },
  total: { type: Number, required: true },
});

const documentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['Devis', 'Facture', 'Contrat', 'Etat des Lieux', "Pièce d'identité"],
    },
    status: {
      type: String,
      required: true,
      enum: ['Brouillon', 'Envoyé', 'Accepté', 'Refusé', 'Payé', 'En retard'],
      default: 'Brouillon',
    },
    client: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    // Pour les pièces d'identité liées à un propriétaire ou locataire (hors User)
    refType: {
      type: String,
      enum: ['Proprietaire', 'Locataire'],
    },
    refId: {
      type: mongoose.Schema.ObjectId,
    },
    refNom: {
      type: String,
    },
    relatedProperty: { // Link to a property for a rental contract, etc.
      type: mongoose.Schema.ObjectId,
      ref: 'Property',
    },
    // Used for Devis and Facture
    items: [itemSchema],
    subTotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    
    // Used for Contrat and Etat des Lieux
    content: {
      type: String,
    },

    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date }, // Relevant for invoices
    notes: String,
    businessOperationKey: { type: String, trim: true, maxlength: 200 },

    // DOC-ARCH-1 — métadonnées de classement pour le Centre documentaire
    // unifié (navigation Pôle → Service → Catégorie). Purement additif :
    // tous optionnels, aucune valeur par défaut devinée pour les documents
    // existants (ils restent visibles, simplement non classés tant qu'ils
    // ne sont pas explicitement tagués). Un dossier n'est jamais une copie —
    // uniquement une vue filtrée sur ces champs.
    pole: { type: String, enum: ['Altimmo', 'Altcom', 'MilaEvents', 'Administration'] },
    service: { type: String, trim: true, maxlength: 100 },
    categorie: { type: String, trim: true, maxlength: 100 },
    // Polymorphisme léger pour rattacher un document à une entité métier
    // sans dupliquer sa référence typée existante (relatedProperty, refId…) :
    // entityType nomme le modèle, entityId son ObjectId. Aucun `ref` déclaré
    // (le modèle cible varie), jamais populate automatiquement.
    entityType: { type: String, trim: true, maxlength: 60 },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    visibility: { type: String, enum: ['staff', 'owner', 'tenant', 'client'], default: 'staff' },
  },
  {
    timestamps: true,
  }
);

// This plugin will add a 'docNumber' field that auto-increments
documentSchema.plugin(AutoIncrement, { inc_field: 'docNumber' });
documentSchema.index({ businessOperationKey: 1 }, { unique: true, partialFilterExpression: { businessOperationKey: { $type: 'string' } } });
documentSchema.index({ pole: 1, service: 1, categorie: 1 });
documentSchema.index({ entityType: 1, entityId: 1 });

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;
