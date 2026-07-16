const mongoose = require('mongoose');
const { PROPERTY_TYPES, ESTIMATION_STATUSES } = require('../utils/valuationConstants');

const estimationSchema = new mongoose.Schema({
  // Le bien
  typeBien:      { type: String, required: true, enum: PROPERTY_TYPES },
  transaction:   { type: String, enum: ['vente', 'location'], default: 'vente' },
  adresse:       { type: String, required: true },
  surface:       { type: Number, required: true },
  chambres:      { type: Number },
  etat:          { type: String },
  disponibilite: { type: String },
  description:   { type: String },
  // Contact
  nom:           { type: String, required: true },
  email:         { type: String, required: true },
  telephone:     { type: String },
  // Gestion
  statut: {
    type: String,
    enum: ESTIMATION_STATUSES,
    default: 'En attente',
  },
  noteInterne:   { type: String, default: '' },
  traitePar:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  staffViewedAt: { type: Date, default: null, index: true },
  // Les champs ci-dessous sont optionnels afin que les demandes historiques restent lisibles.
  referenceBien: { type: String, default: '' }, usage: { type: String, default: '' }, occupation: { type: String, default: '' },
  acquisitionYear: { type: Number, min: 1800, max: 2200 }, declaredValue: { type: Number, min: 0 },
  location: {
    country: { type: String, default: 'Congo' }, city: { type: String, default: '' }, district: { type: String, default: '' }, neighborhood: { type: String, default: '' },
    street: { type: String, default: '' }, landmark: { type: String, default: '' }, zoneType: { type: String, enum: ['', 'urbaine', 'périurbaine', 'rurale'], default: '' },
    roadAccessibility: { type: String, default: '' }, servicesProximity: { type: String, default: '' }, latitude: { type: Number, min: -90, max: 90 }, longitude: { type: Number, min: -180, max: 180 },
  },
  land: { surface: { type: Number, min: 0 }, unit: { type: String, default: 'm²' }, shape: String, streetFrontage: Number, depth: Number, facades: Number, topography: String, floodRisk: String, erosionRisk: String, fenced: Boolean, serviced: Boolean },
  construction: { builtSurface: { type: Number, min: 0 }, livingSurface: { type: Number, min: 0 }, floors: { type: Number, min: 0 }, buildings: { type: Number, min: 0 }, constructionYear: { type: Number, min: 1800, max: 2200 }, renovationYear: { type: Number, min: 1800, max: 2200 }, condition: String, quality: String, finishLevel: String, apparentCompliance: String, depreciationRate: { type: Number, min: 0, max: 100 }, residualLifeYears: { type: Number, min: 0 } },
  rooms: { bedrooms: Number, livingRooms: Number, kitchens: Number, bathrooms: Number, toilets: Number, offices: Number, shops: Number, apartments: Number, garages: Number, outbuildings: Number },
  equipment: { type: [String], default: [] }, documents: [{ name: String, provided: Boolean, verified: Boolean, note: String }], photos: [{ url: String, label: String }],
  comparables: [{ source: { type: String, required: true, trim: true }, sourceType: { type: String, enum: ['annonce_altimmo', 'transaction_altimmo', 'reference_manuelle', 'partenaire', 'autre'], default: 'reference_manuelle' }, internalReference: { type: String, default: '' }, sourceConfidence: { type: String, enum: ['faible', 'moyen', 'bon', 'élevé'], default: 'faible' }, propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' }, city: String, district: String, neighborhood: String, microZone: String, latitude: { type: Number, min: -90, max: 90 }, longitude: { type: Number, min: -180, max: 180 }, propertyType: { type: String, enum: PROPERTY_TYPES }, landSurface: { type: Number, min: 0 }, builtSurface: { type: Number, min: 0 }, priceType: { type: String, enum: ['demande', 'negocie', 'conclu'], default: 'demande' }, askingPrice: { type: Number, min: 0 }, negotiatedPrice: { type: Number, min: 0 }, concludedPrice: { type: Number, min: 0 }, pricePerSqm: { type: Number, min: 0 }, date: Date, condition: String, distance: { type: Number, min: 0 }, similarity: { type: Number, min: 0, max: 100 }, similarityDetails: { type: mongoose.Schema.Types.Mixed, default: {} }, weight: { type: Number, min: 0, max: 1 }, included: { type: Boolean, default: true }, exclusionReason: { type: String, default: '' }, notes: String }],
  expertAdjustments: [{ code: String, label: String, coefficient: { type: Number, min: 0.1, max: 3 }, justification: String, adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, adjustedAt: { type: Date, default: Date.now } }],
  currentCalculation: { type: mongoose.Schema.Types.ObjectId, ref: 'ValuationCalculation', default: null },
  calculationInputUpdatedAt: { type: Date, default: null },
  workflowHistory: [{ from: String, to: String, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, comment: String, at: { type: Date, default: Date.now } }],
  validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, validatedAt: { type: Date, default: null }, publishedAt: { type: Date, default: null }, reportDisclaimerAccepted: { type: Boolean, default: false },
  expertValueAdjustment: { automaticValue: { type: Number, min: 0 }, adjustedValue: { type: Number, min: 0 }, difference: Number, differencePercent: Number, justification: String, adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, adjustedAt: Date },
  expertValueAdjustmentHistory: [{ automaticValue: { type: Number, min: 0 }, adjustedValue: { type: Number, min: 0 }, difference: Number, differencePercent: Number, justification: { type: String, required: true }, adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, adjustedAt: { type: Date, default: Date.now } }],
  report: { verificationCode: { type: String, unique: true, sparse: true }, verificationHash: { type: String, select: false }, publishedCalculation: { type: mongoose.Schema.Types.ObjectId, ref: 'ValuationCalculation', default: null }, publishedAt: Date, revokedAt: Date, validUntil: Date },
}, { timestamps: true });

estimationSchema.index({ statut: 1, createdAt: -1 });
estimationSchema.index({ 'location.city': 1, typeBien: 1, createdAt: -1 });
estimationSchema.index({ 'location.district': 1, createdAt: -1 });

module.exports = mongoose.model('Estimation', estimationSchema);
