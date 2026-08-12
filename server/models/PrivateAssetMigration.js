// STORAGE-LEGACY-1 — journal de migration des documents privés Cloudinary
// legacy. Un modèle dédié est nécessaire : ActionLog n'a ni checkpoint de
// reprise, ni verrou logique de concurrence, ni avant/après structuré, et
// n'est pas indexé pour l'idempotence par ressource. Ce modèle n'enregistre
// JAMAIS de secret Cloudinary, de signature ni d'URL signée temporaire —
// seulement des identifiants et des métadonnées non sensibles.
const mongoose = require('mongoose');

const STATUSES = Object.freeze([
  'pending',            // créé, aucune étape exécutée
  'private_asset_ready', // étape 6-7 : nouvel asset authenticated créé et vérifié
  'db_switched',         // étape 9-10 : référence Mongo basculée et vérifiée
  'old_revoked',         // étape 11-12 : ancien asset public révoqué et OLD URL vérifiée inaccessible
  'completed',           // étape 13-14 : journal écrit, migration marquée terminée
  'failed',              // une étape a échoué ; voir errorCode/checkpoint pour la reprise
  'rolled_back',         // rollback explicite (jamais republication automatique)
]);

const snapshotSchema = new mongoose.Schema({
  publicId: { type: String, default: null },
  deliveryType: { type: String, default: null },
  resourceType: { type: String, default: null },
  field: { type: String, default: null },
  capturedAt: { type: Date, default: null },
}, { _id: false });

const privateAssetMigrationSchema = new mongoose.Schema({
  resource: { type: String, required: true, index: true }, // ex. 'Contrat', 'Locataire'
  resourceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  field: { type: String, required: true }, // chemin du champ migré, ex. 'documents[2].url'
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', default: null, index: true },

  oldPublicId: { type: String, default: null },
  newPublicId: { type: String, default: null },
  oldDeliveryType: { type: String, default: 'upload' },
  newDeliveryType: { type: String, default: 'authenticated' },

  status: { type: String, enum: STATUSES, default: 'pending', index: true },
  checkpoint: { type: String, default: 'resolved' }, // étape atteinte du protocole en 14 étapes
  attempt: { type: Number, default: 0 },

  startedAt: { type: Date, default: () => new Date() },
  completedAt: { type: Date, default: null },
  errorCode: { type: String, default: null },

  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  beforeSnapshot: { type: snapshotSchema, default: null },
  afterSnapshot: { type: snapshotSchema, default: null },

  // Verrou logique : évite que deux workers migrent la même ressource/champ
  // simultanément (§19 idempotence, §20 concurrence). Libéré (null) dès que
  // le run se termine (succès ou échec), jamais laissé indéfiniment.
  lockedAt: { type: Date, default: null },
  lockOwner: { type: String, default: null },

  oldUrlVerifiedInaccessible: { type: Boolean, default: false },
}, { timestamps: true });

// Idempotence : une seule migration "active/terminée avec succès" par
// ressource+champ. Un `failed` peut être retenté (nouvelle tentative avec
// `attempt` incrémenté sur le même document, pas un nouveau document).
privateAssetMigrationSchema.index({ resource: 1, resourceId: 1, field: 1 }, { unique: true });

privateAssetMigrationSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('PrivateAssetMigration', privateAssetMigrationSchema);
