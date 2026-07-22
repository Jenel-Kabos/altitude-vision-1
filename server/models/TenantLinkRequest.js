// server/models/TenantLinkRequest.js — Dette technique GL-B2 (Mission 3)
//
// Trace et sécurise le rattachement User ↔ Locataire. Deux workflows,
// un seul modèle (évite de dupliquer deux entités quasi identiques) :
//
//   - type 'invitation'   : le gestionnaire invite un Locataire existant
//                            (Locataire.user === null) à activer son espace.
//                            Un token à usage unique est envoyé par email ;
//                            `user` reste null jusqu'à l'activation.
//   - type 'self_request'  : un compte User déjà existant demande à être
//                            rattaché à un dossier Locataire. Validation
//                            OBLIGATOIRE par un gestionnaire — jamais de
//                            rattachement automatique sur simple email.
//
// Aucun rattachement n'a lieu tant que `status !== 'accepted'|'approved'` —
// voir tenantLinkService.js pour la logique centralisée.

const mongoose = require('mongoose');

const TENANT_LINK_TYPES = ['invitation', 'self_request'];
const TENANT_LINK_STATUSES = ['pending', 'accepted', 'approved', 'rejected', 'expired', 'cancelled'];

const tenantLinkRequestSchema = new mongoose.Schema(
  {
    locataire: { type: mongoose.Schema.Types.ObjectId, ref: 'Locataire', required: true },
    // 'invitation' : null jusqu'à l'activation (le compte peut ne pas
    // encore exister). 'self_request' : le compte demandeur, dès la création.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    type: { type: String, enum: TENANT_LINK_TYPES, required: true },
    status: { type: String, enum: TENANT_LINK_STATUSES, default: 'pending' },

    // Invitation uniquement — jamais le token en clair stocké (même
    // convention que User.emailVerificationToken/passwordResetToken :
    // sha256, comparé au token brut reçu par email).
    tokenHash: { type: String, default: null },
    tokenExpiresAt: { type: Date, default: null },

    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewComment: { type: String, trim: true, maxlength: 1000, default: '' },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Un seul rattachement "ouvert" (pending) à la fois par dossier locataire —
// évite d'empiler des invitations/demandes concurrentes sur le même
// Locataire (index unique partiel, même stratégie que HousekeepingTask.open).
tenantLinkRequestSchema.index(
  { locataire: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);
tenantLinkRequestSchema.index({ user: 1 });
tenantLinkRequestSchema.index({ status: 1 });

const TenantLinkRequest = mongoose.model('TenantLinkRequest', tenantLinkRequestSchema);
TenantLinkRequest.TENANT_LINK_TYPES = TENANT_LINK_TYPES;
TenantLinkRequest.TENANT_LINK_STATUSES = TENANT_LINK_STATUSES;

module.exports = TenantLinkRequest;
