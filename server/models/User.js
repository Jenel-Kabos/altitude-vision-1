// server/models/User.js
const mongoose = require('mongoose');
const privateAssetSchema = require('./schemas/privateAssetSchema');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const { isSimpleValidEmail, EMAIL_MAX_LENGTH } = require('../utils/emailValidation');

// ======================================================
// 🧩 SCHÉMA UTILISATEUR
// ======================================================
const userSchema = new mongoose.Schema(
    {
        name: {
            type:      String,
            required:  [true, 'Un nom est requis.'],
            trim:      true,
            minlength: [2,  'Le nom doit contenir au moins 2 caractères.'],
            maxlength: [50, 'Le nom ne doit pas dépasser 50 caractères.'],
        },

        email: {
            type:      String,
            required:  [true, 'Un email est requis.'],
            unique:    true,
            lowercase: true,
            trim:      true,
            // F2.6.3 : l'ancien regex (`/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/`) est
            // vulnérable à un ReDoS catastrophique (backtracking exponentiel) — remplacé par une
            // validation bornée en temps linéaire (server/utils/emailValidation.js).
            maxlength: [EMAIL_MAX_LENGTH, 'Email trop long.'],
            validate: {
                validator: isSimpleValidEmail,
                message: 'Veuillez fournir un email valide.',
            },
        },

        // 🔧 default null (plus de 'default.jpg' incompatible avec Cloudinary)
        photo: {
            type:    String,
            default: null,
        },

        role: {
            type: String,
            // 'Proprietaire' sans accent pour compatibilité frontend
            enum:    ['User', 'Client', 'Proprietaire', 'Collaborateur', 'Secretaire', 'GestionnaireImmobilier', 'CommunityManager', 'Communicant', 'Admin', 'Prestataire'],
            default: 'Client',
        },

        password: {
            type:      String,
            required:  [true, 'Un mot de passe est requis.'],
            minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères.'],
            select:    false,
        },

        passwordConfirm: {
            type:     String,
            required: [true, 'Veuillez confirmer votre mot de passe'],
            validate: {
                validator: function (el) {
                    return el === this.password; // Fonctionne uniquement au CREATE et SAVE
                },
                message: 'Les mots de passe ne sont pas identiques !',
            },
        },

        // 🔧 Numéro de téléphone avec indicatif (ex: "+242 06 123 4567")
        phone: {
            type:    String,
            trim:    true,
            default: null,
        },

        bio: {
            type:      String,
            trim:      true,
            maxlength: [300, 'La biographie ne peut pas dépasser 300 caractères.'],
            default:   null,
        },

        // 🔹 Statut général du compte
        isActive: {
            type:    Boolean,
            default: true,
            select:  true,
        },

        // 🔹 Vérification Email
        isEmailVerified:          { type: Boolean, default: false },
        emailVerificationToken:   String,
        emailVerificationExpires: Date,

        // 🔹 OAuth Google
        googleId:     { type: String, sparse: true },
        avatar:       { type: String },
        authProvider: { type: String, enum: ['local', 'google', 'phone'], default: 'local' },

        // 🔹 Vérification Propriétaire (KYC Admin)
        isVerified: { type: Boolean, default: false },

        // 🔹 GL-ARCH-1.1 — compte technique créé automatiquement pour
        // satisfaire Property.owner (obligatoire) lorsqu'une fiche
        // Proprietaire (staff, sans compte) n'a aucun User lié et qu'un de
        // ses biensPropres[] est importé en Gestion locative. Ne représente
        // jamais un utilisateur réel du portail : `isActive: false` dès la
        // création (bloque authMiddleware.protect) + mot de passe aléatoire
        // jamais communiqué. Une procédure d'invitation séparée (hors
        // périmètre de cette mission) devra explicitement activer ce compte
        // si ce propriétaire doit un jour recevoir un accès self-service.
        isTechnical: { type: Boolean, default: false },

        // 🔹 Statut de contrôle global
        status: {
            type:    String,
            enum:    ['Actif', 'Suspendu', 'Banni', 'Supprimé'],
            default: 'Actif',
        },

        // 🔹 Notifications push Expo
        pushToken: { type: String, default: null },

        // 🔹 Sécurité & Sessions
        tokenVersion:    { type: Number, default: 0 },
        lastLoginAt:     Date,
        lastActivityAt:  { type: Date, default: Date.now },

        passwordChangedAt:  Date,
        passwordResetToken: String,
        passwordResetExpires: Date,

        // 🔹 Contrat d'hébergement (Propriétaire)
        contratAccepte:    { type: Boolean, default: false },
        contratAccepteLe:  { type: Date },
        contratVersion:    { type: String, default: 'v1.0' },
        certifications: {
            informationsVraies:   { type: Boolean, default: false },
            estProprietaireLegal: { type: Boolean, default: false },
            engagementHonnetete:  { type: Boolean, default: false },
            commissionAcceptee:   { type: Boolean, default: false },
            dateCertification:    { type: Date },
        },
        ipInscription: { type: String },
        contratPdfUrl: { type: String, select: false },
        contratPdfAsset: { type: privateAssetSchema, select: false },

        // 🔹 Historique des changements de rôle
        historiqueRoles: [{
            ancienRole:  { type: String },
            nouveauRole: { type: String },
            changedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            date:        { type: Date, default: Date.now },
            note:        { type: String },
        }],
    },
    { timestamps: true }
);

// ======================================================
// 🔒 Middleware: Hashage du mot de passe
// ======================================================
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password        = await bcrypt.hash(this.password, 12);
    this.passwordConfirm = undefined;
    next();
});

// ======================================================
// ⏰ Middleware: timestamp passwordChangedAt
// ======================================================
userSchema.pre('save', function (next) {
    if (!this.isModified('password') || this.isNew) return next();
    this.passwordChangedAt = Date.now() - 1000;
    next();
});

// ======================================================
// 🔐 Méthodes d'Instance
// ======================================================

// Vérification du mot de passe
userSchema.methods.matchPassword = async function (candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

// Vérifie si le mot de passe a changé après l'émission du token
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

// Génération du token de vérification email
userSchema.methods.createEmailVerificationToken = function () {
    const resetToken = crypto.randomBytes(32).toString('hex');

    this.emailVerificationToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24h

    return resetToken;
};

// ======================================================
// ⚙️ Méthodes Administratives
// ======================================================

// Force la déconnexion de toutes les sessions
userSchema.methods.invalidateTokens = async function () {
    this.tokenVersion += 1;
    await this.save({ validateBeforeSave: false });
};

userSchema.methods.ban = async function () {
    if (this.role === 'Admin') throw new Error('Impossible de bannir un administrateur.');
    this.status   = 'Banni';
    this.isActive = false;
    await this.invalidateTokens();
};

userSchema.methods.suspend = async function () {
    if (this.role === 'Admin') throw new Error('Impossible de suspendre un administrateur.');
    this.status   = 'Suspendu';
    this.isActive = false;
    await this.invalidateTokens(); // déconnecte immédiatement toutes les sessions
};

userSchema.methods.activate = async function () {
    this.status   = 'Actif';
    this.isActive = true;
    await this.save({ validateBeforeSave: false });
};

// ======================================================
// 🚀 EXPORT
// ======================================================
const User = mongoose.model('User', userSchema);
module.exports = User;
