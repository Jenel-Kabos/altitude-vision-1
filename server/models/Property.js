const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema(
  {
    // TENANT-DATA-REGULARIZATION-EXEC-1 — frontière SaaS explicite,
    // additive et sans effet sur la publication ou le cycle métier.
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', default: null, index: true },
    title: {
      type: String,
      required: [true, 'Un titre est requis pour la propriété'],
      trim: true,
      maxlength: [100, 'Le titre ne doit pas dépasser 100 caractères'],
    },

    pole: {
      type: String,
      required: [true, 'Un pôle est requis (Altimmo, MilaEvents, Altcom)'],
      enum: ['Altimmo', 'MilaEvents', 'Altcom'],
    },

    description: {
      type: String,
      required: [true, 'Une description est requise pour la propriété'],
      trim: true,
    },

    type: {
      type: String,
      enum: {
        values: [
          'Appartement', 'Appartement meublé', 'Maison', 'Villa',
          'Terrain', 'Bureau', 'Commerce', 'Studio', 'Entrepôt',
        ],
        message: 'Type de propriété invalide : {VALUE}. Valeurs acceptées : Appartement, Appartement meublé, Maison, Villa, Terrain, Bureau, Commerce, Studio, Entrepôt.',
      },
      required: [true, 'Veuillez spécifier le type de propriété'],
    },

    // 'hebergement' = occupation par réservation (séjour meublé), jamais par
    // bail — voir server/models/Accommodation.js. Ne jamais traiter
    // 'hebergement' comme un synonyme de 'location' : toute logique propre au
    // bail (Contrat, RentalManagement, Paiement locatif) doit continuer à
    // tester `status === 'location'` explicitement.
    status: {
      type: String,
      required: true,
      enum: ['vente', 'location', 'hebergement'],
    },

    price: {
      type: Number,
      required: [true, 'Un prix est requis pour la propriété'],
    },

    honoraires: {
      type: Number,
      min: [0, 'Les honoraires ne peuvent pas être négatifs'],
      default: null, // null = pas encore saisi manuellement
    },
    fraisVisite: {
      type: Number,
      min: [0, 'Les frais de visite ne peuvent pas être négatifs'],
      default: 0, // 0 = visite gratuite par défaut
    },

    address: {
      street: { type: String, trim: true, default: '' },
      neighborhood: { type: String, trim: true, default: '' },
      arrondissement: {
        type: String,
        required: [true, "Veuillez fournir l'arrondissement"],
        trim: true,
      },
      city: { type: String, default: 'Brazzaville', trim: true },
    },

    latitude: {
      type: Number,
      required: [true, 'La latitude est requise pour la géolocalisation'],
    },

    longitude: {
      type: Number,
      required: [true, 'La longitude est requise pour la géolocalisation'],
    },

    location: {
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: function (val) {
            return val.length === 2;
          },
          message: 'Les coordonnées doivent être un tableau [longitude, latitude]',
        },
      },
    },

    images: {
      type: [String],
      validate: [
            // 🔑 CORRECTION CLÉ : Rendre les images obligatoires
            {
        validator: function (val) { return this.internalManagedOnly || val.length > 0; },
                message: 'Au moins une image est requise pour la propriété.',
            },
            // Le validateur existant pour la limite maximale
            {
                validator: (val) => val.length <= 10, 
                message: 'Maximum 10 images par propriété',
            }
        ],
      default: [],
    },

    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    
    // Modification: Ajout de 'required' à surface (si c'est une donnée clé)
    surface: { 
        type: Number,
        required: [true, 'La surface est requise'],
        min: [1, 'La surface doit être positive'],
    },
    
    livingRooms: { type: Number, default: 0 },
    kitchens: { type: Number, default: 0 },
    
    // 🆕 AJOUT DU TYPE DE CONSTRUCTION
    constructionType: {
        type: String,
        trim: true,
        // Exemple d'énumération que vous pourriez vouloir utiliser
        // enum: ['Béton', 'Bois', 'Mixte', 'Non spécifié'],
        default: 'Non spécifié',
    },
    
    amenities: { type: [String], default: [] },

    availability: {
      type: String,
      enum: ['Disponible', 'Réservé', 'Loué', 'Indisponible', 'En maintenance', 'Retiré', 'Vendu'],
      default: 'Disponible',
    },

    // GL-ASSET-1 — cycle de vie patrimonial du bien, indépendant du bail
    // et indépendant de `availability` : `availability` reste écrit
    // exactement comme avant par les sous-systèmes existants (rental sync,
    // réservation, finalisation de vente) — aucune régression, aucune
    // nouvelle source de vérité. `assetCycle` est optionnel (absent sur tout
    // bien créé avant ce sprint — aucune migration) et dérivé depuis
    // `availability` pour les biens legacy (voir propertyAssetLifecycleService.js).
    assetCycle: {
      type: String,
      enum: ['disponible', 'reserve', 'en_location', 'preavis', 'inspection', 'travaux', 'vendu', 'archive'],
      default: null,
    },
    assetCycleHistory: {
      type: [{
        from: String,
        to: { type: String, required: true },
        action: { type: String, required: true },
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        comment: { type: String, trim: true, maxlength: 1000 },
        at: { type: Date, default: Date.now },
      }],
      default: [],
    },

    // ─── Champs spécifiques location (status: 'location') ─────────
    // Validation conditionnelle déléguée au contrôleur.

    cautionMultiplicateur: {
      type: Number,
      min: 0,
      max: 6,
      default: 2,
    },
    // Stocke le multiplicateur (ex: 2 = 2x le loyer mensuel).
    // Le montant réel se calcule à l'affichage : price * cautionMultiplicateur

    profilsLocataireRecherches: {
      type: [String],
      enum: ['Salarié', 'Étudiant', 'Indépendant/Affairiste', 'Fonctionnaire', 'Retraité'],
      default: [],
    },

    documentsRequis: {
      type: [String],
      enum: [
        'CNI',
        'Justificatif de revenus',
        '2 derniers bulletins de salaire',
        'Caution bancaire',
        'Attestation de travail',
        'Quittance de loyer précédente',
      ],
      default: [],
    },

    isPublished: { type: Boolean, default: false },
    // Bien privé créé volontairement depuis la Gestion locative. Il peut
    // être complété (notamment en images) avant un futur workflow public.
    internalManagedOnly: { type: Boolean, default: false, index: true },
    reservationLock: {
      reservation: { type: mongoose.Schema.ObjectId, ref: 'RealEstateReservation', default: null },
      lockedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
    },
    hasReservationHistory: { type: Boolean, default: false },
    hasSpecialCommission: { type: Boolean, default: false },
    recommande: { type: Boolean, default: false },

    views:          { type: Number, default: 0, min: 0 },
    likes:          [{ type: mongoose.Schema.ObjectId, ref: "User" }],
    shares:         { type: Number, default: 0, min: 0 },
    commissionRate: { type: Number, default: 5, min: 0, max: 100 },

    /** 💬 Avis laissés par les utilisateurs sur ce bien (mobile) */
    reviews: [
      {
        user: { type: mongoose.Schema.ObjectId, ref: 'User', required: true },
        comment: { type: String, trim: true, required: true },
        rating: { type: Number, min: 1, max: 5, default: 5 },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    /** 🔗 Propriétaire de la propriété */
    owner: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'La propriété doit appartenir à un propriétaire'],
      index: true 
    },

    /** 🔗 Agent associé (facultatif) */
    agent: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },

    /** 🛡️ Statut de modération par l'admin */
    statusAdmin: {
      type: String,
      enum: ['En attente', 'Validée', 'Rejetée'],
      default: 'En attente',
      index: true 
    },

    /** 📅 Date de validation / rejet */
    reviewedAt: { type: Date },

    // GL-ARCH-1.1 : tracabilite + dedoublonnage d une Property creee depuis
    // Proprietaire.biensPropres[] (import staff vers la Gestion locative,
    // voir proprietaireGestionImportService.js). sourceOwnerAssetId est une
    // cle composite stable <proprietaireId>:<bienId> - jamais le titre seul -
    // index unique sparse pour qu un double import concurrent (double clic)
    // echoue en base plutot que de creer un doublon.
    sourceType: { type: String, enum: ['proprietaire_bien_propre'] },
    sourceOwnerAssetId: { type: String, unique: true, sparse: true, index: true },
    // GL-ASSET-UX-1.1 — empreinte stable des créations internes afin que
    // deux requêtes concurrentes plausiblement identiques ne puissent pas
    // créer deux Property. Champ additif, absent des documents historiques.
    onboardingFingerprint: { type: String, unique: true, sparse: true, index: true },

    documents: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index géospatial
propertySchema.index({ location: '2dsphere' });

// Index composés pour les requêtes de listing les plus fréquentes
propertySchema.index({ pole: 1, status: 1, createdAt: -1 });       // listing public filtré par pôle
propertySchema.index({ statusAdmin: 1, createdAt: -1 });            // file d'approbation admin
propertySchema.index({ owner: 1, createdAt: -1 });                  // "mes annonces"
propertySchema.index({ status: 1, price: 1 });                      // tri par prix

// Middleware : synchronisation automatique de la location
propertySchema.pre('save', function (next) {
  // Pour s'assurer que l'index 2dsphere est toujours à jour si lat/long sont modifiés
  if (this.isModified('latitude') || this.isModified('longitude')) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude],
    };
  }
  next();
});

const Property = mongoose.model('Property', propertySchema);
module.exports = Property;
