// server/models/QuoteRequest.js
const mongoose = require('mongoose');

// ======================================================
// 🧩 SCHEMA DE DEMANDE DE DEVIS AMÉLIORÉ
// Supporte à la fois les devis simples ET les projets complets
// ======================================================
const quoteRequestSchema = new mongoose.Schema(
    {
        // 🔹 NOUVEAU: Source du formulaire (pour la validation conditionnelle)
        source: {
            type: String,
            enum: ['MilaEvents', 'Altcom'],
            default: 'MilaEvents',
        },

        // 🔹 Type de demande (peut être utilisé par le front MilaEvents)
        requestType: {
            type: String,
            enum: ['Simple', 'Projet Complet'],
            default: 'Simple',
        },

        // ======================================================
        // 📋 INFORMATIONS DE BASE (communes aux deux types)
        // ======================================================
        service: {
            type: String,
            required: [true, 'Le nom du service est requis.'],
            trim: true,
        },
        
        // ⭐ CORRECTION 1: eventType n'est requis que si la source est MilaEvents
        eventType: {
            type: String,
            required: function() {
                // Requis uniquement si ce n'est PAS Altcom
                return this.source !== 'Altcom';
            },
            enum: {
                values: ['Mariage', 'Anniversaire', 'Gala', 'Conférence', 'Lancement', 'Soirée d\'entreprise', 'Autre', 'Projet Altcom'], // Ajout de Projet Altcom ici
                message: '`{VALUE}` n\'est pas un type d\'événement valide.'
            },
        },

        // ⭐ CORRECTION 2: date n'est requise que si la source est MilaEvents
        date: {
            type: Date, 
            required: function() {
                // Requis uniquement si ce n'est PAS Altcom
                return this.source !== 'Altcom';
            },
        },

        // ⭐ CORRECTION 3: guests n'est requis que si la source est MilaEvents
        guests: {
            type: Number,
            required: function() {
                // Requis uniquement si ce n'est PAS Altcom
                return this.source !== 'Altcom';
            },
            min: [1, "Le nombre d'invités doit être au moins 1."],
        },
        // Fin des corrections Mongoose ⭐
        
        budget: {
            type: String,
            enum: ['Moins de 1M', '1M-5M', '5M-10M', 'Plus de 10M', null, ''],
            default: '',
        },
        description: {
            type: String,
            required: [true, 'Une description du projet est requise.'],
            trim: true,
            maxlength: [5000, 'La description ne doit pas dépasser 5000 caractères.'],
        },

        // 🔹 Coordonnées de contact
        name: {
            type: String,
            required: [true, 'Le nom du contact est requis.'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Un email de contact est requis.'],
            lowercase: true,
            match: [
                /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                'Veuillez fournir un email valide.',
            ],
        },
        phone: {
            type: String,
            trim: true,
        },

        // ======================================================
        // 📝 PROJET COMPLET - Données structurées supplémentaires
        // ======================================================
        projectDetails: {
            // 1. Informations client étendues
            clientInfo: {
                company: String,
                address: String,
                referralSource: String,
                referralOther: String,
            },

            // 2. Objectif détaillé
            objective: {
                eventTypeOther: String,
                eventGoal: String,
                eventAmbiance: String,
            },

            // 3. Détails pratiques
            practicalDetails: {
                startTime: String,
                endTime: String,
                venueStatus: String,
                venueDetails: String,
            },

            // 4. Thème & Style
            theme: {
                theme: String,
                colors: String,
                styleType: String,
                styleOther: String,
                essentialElements: String,
            },

            // 5. Prestations (array de services)
            services: {
                type: [String],
                default: [],
            },
            servicesOther: String,

            // 6. Budget détaillé
            budgetDetails: {
                budgetAdaptation: String,
                budgetPriority: String,
            },

            // 7. Communication
            communication: {
                communicationManagement: String,
                musicalAmbiance: String,
            },

            // 8. Inspirations
            inspirations: {
                hasMoodboard: String,
                moodboardLink: String,
            },

            // 9. Prochaines étapes
            nextSteps: {
                meetingDate: Date,
                meetingType: String,
            },
        },

        // ======================================================
        // 🔹 Champs de suivi administratif
        // ======================================================
        status: {
            type: String,
            enum: ['Nouveau', 'En cours', 'Devis Envoyé', 'Converti', 'Archivé'],
            default: 'Nouveau',
        },

        // Notes internes de l'équipe
        internalNotes: {
            type: String,
            trim: true,
        },

        // Montant du devis envoyé
        quotedAmount: {
            type: Number,
            min: 0,
        },

        // Date d'envoi du devis
        quoteSentDate: {
            type: Date,
        },

        // Date de conversion
        convertedDate: {
            type: Date,
        },
        
        // 🔹 Référence à l'utilisateur (si authentifié)
        user: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true, // createdAt & updatedAt automatiques
    }
);

// ======================================================
// 📊 Index pour améliorer les performances
// ======================================================
quoteRequestSchema.index({ status: 1, createdAt: -1 });
quoteRequestSchema.index({ email: 1 });
quoteRequestSchema.index({ source: 1 }); // Index sur la nouvelle source
quoteRequestSchema.index({ requestType: 1 });
quoteRequestSchema.index({ date: 1 });

// ======================================================
// 🎨 Méthodes virtuelles
// ======================================================
quoteRequestSchema.virtual('isProjectComplete').get(function() {
    return this.requestType === 'Projet Complet';
});

quoteRequestSchema.virtual('daysUntilEvent').get(function() {
    // S'assure que la date est définie avant de calculer
    if (!this.date) return null; 
    const now = new Date();
    const eventDate = new Date(this.date);
    const diffTime = eventDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
});

// ======================================================
// 🔧 Méthodes d'instance
// ======================================================
quoteRequestSchema.methods.markAsConverted = function() {
    this.status = 'Converti';
    this.convertedDate = Date.now();
    return this.save();
};

quoteRequestSchema.methods.sendQuote = function(amount) {
    this.status = 'Devis Envoyé';
    this.quotedAmount = amount;
    this.quoteSentDate = Date.now();
    return this.save();
};

// ======================================================
// 📋 Méthodes statiques
// ======================================================
quoteRequestSchema.statics.getStatsByStatus = function() {
    return this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
            },
        },
    ]);
};

quoteRequestSchema.statics.getConversionRate = async function() {
    const total = await this.countDocuments();
    const converted = await this.countDocuments({ status: 'Converti' });
    return total > 0 ? ((converted / total) * 100).toFixed(2) : 0;
};

quoteRequestSchema.statics.getRecentQuotes = function(limit = 10) {
    return this.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('user', 'name email');
};

// ======================================================
// 🚀 Export du modèle
// ======================================================
const QuoteRequest = mongoose.model('QuoteRequest', quoteRequestSchema);
module.exports = QuoteRequest;