// server/models/InternalMail.js
const mongoose = require('mongoose');
const privateAssetSchema = require('./schemas/privateAssetSchema');

const internalMailSchema = new mongoose.Schema({

  // ── Expéditeur interne (ObjectId) OU externe (nom/email brut)
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // ✅ Plus required:true — les emails Zoho entrants n'ont pas de sender ObjectId
    required: false,
  },

  // ── Nouveaux champs pour les emails externes (Zoho webhook) ──
  senderName:     { type: String,  default: null },   // "Jean Dupont"
  senderEmail:    { type: String,  default: null },   // "jean@gmail.com"
  receiverEmail:  { type: String,  default: null },   // email brut du destinataire
  isExternalMail: { type: Boolean, default: false },  // true = vient de Zoho
  zohoMessageId:  {                                   // pour éviter les doublons
    type:   String,
    unique: true,
    sparse: true,  // sparse = ignore les documents où le champ est null
  },

  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function () {
      return !this.isDraft && !this.isExternalMail;
    },
  },

  subject: {
    type:     String,
    default:  'Sans objet',
    maxlength: 200,
  },

  content: {
    type:     String,
    required: [true, 'Le contenu du message est requis'],
    maxlength: 10000,
  },

  priority: {
    type:    String,
    enum:    ['Basse', 'Normale', 'Haute', 'Urgente'],
    default: 'Normale',
  },

  // ── Statuts ──────────────────────────────────────────────────
  isRead:    { type: Boolean, default: false },
  readAt:    { type: Date },
  isStarred: { type: Boolean, default: false },
  isDraft:   { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },

  // ── Pièces jointes ───────────────────────────────────────────
  attachments: [
    {
      filename: { type: String, required: true },
      url:      { type: String, default: null }, // Cloudinary URL (emails IMAP entrants)
      filepath: { type: String, default: null }, // Chemin local (messages internes)
      asset:    { type: privateAssetSchema },
      mimetype: { type: String },
      size:     { type: Number },
    },
  ],

  // ── Métadonnées ──────────────────────────────────────────────
  messageType: { type: String, default: 'Email' },

}, {
  timestamps: true,
});

// ── Index ─────────────────────────────────────────────────────
internalMailSchema.index({ sender:   1, createdAt: -1 });
internalMailSchema.index({ receiver: 1, createdAt: -1 });
internalMailSchema.index({ receiver: 1, isRead:    1  });
internalMailSchema.index({ receiver: 1, isStarred: 1  });
internalMailSchema.index({ sender:   1, isDraft:   1  });
internalMailSchema.index({ receiver: 1, isDeleted: 1  });
// ✅ Index sur les emails externes pour requêtes rapides
internalMailSchema.index({ isExternalMail: 1, createdAt: -1 });

internalMailSchema.set('toJSON', { transform: (_doc, ret) => {
  ret.attachments = (ret.attachments || []).map(({ url, filepath, asset, ...metadata }, index) => ({
    ...metadata,
    canPreview: Boolean(asset || url || filepath),
    canDownload: Boolean(asset || url || filepath),
    legacy: Boolean(!asset && (url || filepath)),
    previewEndpoint: `/api/internal-mails/${ret._id}/attachments/${index}`,
    downloadEndpoint: `/api/internal-mails/${ret._id}/attachments/${index}?download=1`,
  }));
  return ret;
} });

// ── Méthodes statiques ────────────────────────────────────────

internalMailSchema.statics.getInbox = function (userId, options = {}) {
  const { page = 1, limit = 20 } = options;
  return this.find({ receiver: userId, isDraft: false, isDeleted: false })
    .populate('sender', 'name email photo')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((page - 1) * limit);
};

internalMailSchema.statics.getSent = function (userId, options = {}) {
  const { page = 1, limit = 20 } = options;
  return this.find({ sender: userId, isDraft: false, isDeleted: false })
    .populate('receiver', 'name email photo')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((page - 1) * limit);
};

internalMailSchema.statics.getUnread = function (userId, options = {}) {
  const { page = 1, limit = 20 } = options;
  return this.find({ receiver: userId, isRead: false, isDraft: false, isDeleted: false })
    .populate('sender', 'name email photo')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((page - 1) * limit);
};

internalMailSchema.statics.getStarred = function (userId, options = {}) {
  const { page = 1, limit = 20 } = options;
  return this.find({
    $or: [{ receiver: userId, isStarred: true }, { sender: userId, isStarred: true }],
    isDraft: false, isDeleted: false,
  })
    .populate('sender',   'name email photo')
    .populate('receiver', 'name email photo')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((page - 1) * limit);
};

internalMailSchema.statics.getDrafts = function (userId, options = {}) {
  const { page = 1, limit = 20 } = options;
  return this.find({ sender: userId, isDraft: true, isDeleted: false })
    .populate('receiver', 'name email photo')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((page - 1) * limit);
};

internalMailSchema.statics.getTrash = function (userId, options = {}) {
  const { page = 1, limit = 20 } = options;
  return this.find({
    $or: [{ receiver: userId, isDeleted: true }, { sender: userId, isDeleted: true }],
  })
    .populate('sender',   'name email photo')
    .populate('receiver', 'name email photo')
    .sort({ deletedAt: -1 })
    .limit(parseInt(limit))
    .skip((page - 1) * limit);
};

internalMailSchema.statics.countUnread = function (userId) {
  return this.countDocuments({
    receiver: userId, isRead: false, isDraft: false, isDeleted: false,
  });
};

module.exports = mongoose.model('InternalMail', internalMailSchema);
