// server/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
            // ✅ CORRECTION ICI : 
            // 1. 'Proprietaire' (sans accent) pour matcher ton Frontend
            // 2. 'User' ajouté pour la compatibilité avec les anciens comptes
            enum: ['User', 'Client', 'Proprietaire', 'Collaborateur', 'Admin', 'Prestataire'],
            default: 'User',
        },

        password: {
            type: String,
            required: [true, 'Un mot de passe est requis.'],
            minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères.'],
            select: false,
        },

        // ✅ AJOUT SÉCURITÉ : Validation de la confirmation du mot de passe
        passwordConfirm: {
            type: String,
            required: [true, 'Veuillez confirmer votre mot de passe'],
            validate: {
                // Fonctionne uniquement lors de CREATE et SAVE
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

        // 🔹 Indique si le propriétaire est vérifié par un administrateur
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

        // 🔹 Version du token JWT (pour forcer la déconnexion)
        tokenVersion: {
            type: Number,
            default: 0,
        },

        // 🔹 Logs d’activité
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
// 🔒 Middleware: Hashage du mot de passe avant sauvegarde
// ======================================================
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    
    // Hashage du mot de passe avec un coût de 12
    this.password = await bcrypt.hash(this.password, 12);
    
    // Suppression du champ passwordConfirm (on ne le stocke pas en base)
    this.passwordConfirm = undefined;
    next();
});

// ======================================================
// ⏰ Middleware: Mise à jour du champ passwordChangedAt
// ======================================================
userSchema.pre('save', function (next) {
    if (!this.isModified('password') || this.isNew) return next();
    
    // On retire 1 seconde pour s'assurer que le token soit créé après le changement
    this.passwordChangedAt = Date.now() - 1000;
    next();
});

// ======================================================
// 🔐 Vérification du mot de passe
// ======================================================
userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

// ======================================================
// 🔁 Vérifie si le mot de passe a été changé après émission du JWT
// ======================================================
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

// ======================================================
// ⚙️ MÉTHODES ADMINISTRATIVES PERSONNALISÉES
// ======================================================

// 🔹 Invalider tous les tokens (déconnexion forcée)
userSchema.methods.invalidateTokens = async function () {
    this.tokenVersion += 1;
    await this.save({ validateBeforeSave: false });
};

// 🔹 Bannir un utilisateur
userSchema.methods.ban = async function () {
    if (this.role === 'Admin') throw new Error('Impossible de bannir un administrateur.');
    this.status = 'Banni';
    this.isActive = false;
    await this.invalidateTokens();
};

// 🔹 Suspendre un utilisateur
userSchema.methods.suspend = async function () {
    if (this.role === 'Admin') throw new Error('Impossible de suspendre un administrateur.');
    this.status = 'Suspendu';
    this.isActive = false;
    await this.save({ validateBeforeSave: false });
};

// 🔹 Réactiver un utilisateur
userSchema.methods.activate = async function () {
    this.status = 'Actif';
    this.isActive = true;
    await this.save({ validateBeforeSave: false });
};

// 🔹 Vérifier un propriétaire
userSchema.methods.verifyOwner = async function () {
    if (this.role === 'Proprietaire') { // Note: sans accent ici aussi pour matcher l'enum
        this.isVerified = true;
        await this.save({ validateBeforeSave: false });
    }
};

// ======================================================
// 🚀 EXPORT DU MODÈLE
// ======================================================
const User = mongoose.model('User', userSchema);
module.exports = User;