// server/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // ✅ AJOUT INDISPENSABLE POUR LES TOKENS

// ======================================================
// 🧩 SCHÉMA UTILISATEUR
// ======================================================
const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Un nom est requis.'],
            trim: true,
            minlength: [2, 'Le nom doit contenir au moins 2 caractères.'],
            maxlength: [50, 'Le nom ne doit pas dépasser 50 caractères.'],
        },

        email: {
            type: String,
            required: [true, 'Un email est requis.'],
            unique: true,
            lowercase: true,
            match: [
                /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                'Veuillez fournir un email valide.',
            ],
        },

        photo: {
            type: String,
            default: 'default.jpg',
        },

        role: {
            type: String,
            // 'Proprietaire' (sans accent) pour matcher le Frontend
            enum: ['User', 'Client', 'Proprietaire', 'Collaborateur', 'Admin', 'Prestataire'],
            default: 'User',
        },

        password: {
            type: String,
            required: [true, 'Un mot de passe est requis.'],
            minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères.'],
            select: false,
        },

        passwordConfirm: {
            type: String,
            required: [true, 'Veuillez confirmer votre mot de passe'],
            validate: {
                validator: function (el) {
                    return el === this.password;
                },
                message: 'Les mots de passe ne sont pas identiques !',
            },
        },

        phone: {
            type: String,
            trim: true,
            default: '',
        },

        bio: {
            type: String,
            trim: true,
            maxlength: [300, 'La biographie ne peut pas dépasser 300 caractères.'],
        },

        // 🔹 Statut général du compte
        isActive: {
            type: Boolean,
            default: true,
            select: false,
        },

        // ✅ AJOUT EMAIL VERIFICATION
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        emailVerificationToken: String,
        emailVerificationExpires: Date,

        // 🔹 Indique si le propriétaire est vérifié par un administrateur (KYC)
        isVerified: {
            type: Boolean,
            default: false,
        },

        // 🔹 Statut de contrôle global
        status: {
            type: String,
            enum: ['Actif', 'Suspendu', 'Banni', 'Supprimé'],
            default: 'Actif',
        },

        tokenVersion: {
            type: Number,
            default: 0,
        },

        lastLoginAt: Date,
        lastActivityAt: Date,

        passwordChangedAt: Date,
        passwordResetToken: String,
        passwordResetExpires: Date,
    },
    {
        timestamps: true,
    }
);

// ======================================================
// 🔒 Middleware: Hashage du mot de passe
// ======================================================
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    this.passwordConfirm = undefined;
    next();
});

// ======================================================
// ⏰ Middleware: Mise à jour du timestamp passwordChangedAt
// ======================================================
userSchema.pre('save', function (next) {
    if (!this.isModified('password') || this.isNew) return next();
    this.passwordChangedAt = Date.now() - 1000;
    next();
});

// ======================================================
// 🔐 Méthodes d'Instance
// ======================================================

userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

// ✅ AJOUT EMAIL VERIFICATION : Génération du token
userSchema.methods.createEmailVerificationToken = function () {
    const resetToken = crypto.randomBytes(32).toString('hex');

    // On hash le token pour la base de données (sécurité)
    this.emailVerificationToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // Le token expire dans 24 heures
    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    return resetToken; // On renvoie la version claire pour l'envoyer par email
};

// ======================================================
// ⚙️ Méthodes Administratives
// ======================================================

userSchema.methods.invalidateTokens = async function () {
    this.tokenVersion += 1;
    await this.save({ validateBeforeSave: false });
};

userSchema.methods.ban = async function () {
    if (this.role === 'Admin') throw new Error('Impossible de bannir un administrateur.');
    this.status = 'Banni';
    this.isActive = false;
    await this.invalidateTokens();
};

userSchema.methods.suspend = async function () {
    if (this.role === 'Admin') throw new Error('Impossible de suspendre un administrateur.');
    this.status = 'Suspendu';
    this.isActive = false;
    await this.save({ validateBeforeSave: false });
};

userSchema.methods.activate = async function () {
    this.status = 'Actif';
    this.isActive = true;
    await this.save({ validateBeforeSave: false });
};

userSchema.methods.verifyOwner = async function () {
    if (this.role === 'Proprietaire') {
        this.isVerified = true;
        await this.save({ validateBeforeSave: false });
    }
};

// ======================================================
// 🚀 EXPORT
// ======================================================
const User = mongoose.model('User', userSchema);
module.exports = User;