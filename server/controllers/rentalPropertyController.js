// server/controllers/rentalPropertyController.js — Sprint A (séparation Vente/Location).
//
// POST/PUT /api/admin/properties/rentals(/:propertyId) — staff (ROLES_ALTIMMO)
// crée/édite une annonce Location complète : Property (status='location') +
// RentalManagement (fiche d'annonce), en un seul appel. Le module "Gestion
// Locative" existant (rentalManagementController.js, RentalManagement en
// upsert par `property`) reste inchangé et peut ensuite activer un suivi de
// bail actif sur le MÊME document — jamais de doublon.

const mongoose = require('mongoose');
const Property = require('../models/Property');
const { createFullRentalProperty, updateFullRentalProperty } = require('../services/rentalPropertyService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const {
  uploadFilesToCloudinary, parseAmenities, parseAddress, parseGeoLocation, parseStringArray,
  parseNonNegativeAmount, buildBasePropertyData, parseNumericField,
} = require('./propertyController');
const { destroyFromCloudinary } = require('../config/cloudinary');

const fail = (res, statusCode, message, extra = {}) =>
  res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message, ...extra });

/** Best-effort : n'interrompt jamais la réponse d'erreur en cours. */
const cleanupUploadedImages = (images = []) =>
  Promise.all(images.map((url) => destroyFromCloudinary(url))).catch(() => {});

const TENANT_PROFILES = ['Salarié', 'Étudiant', 'Indépendant/Affairiste', 'Fonctionnaire', 'Retraité'];
const REQUIRED_DOCUMENTS = [
  'CNI', 'Justificatif de revenus', '2 derniers bulletins de salaire',
  'Caution bancaire', 'Attestation de travail', 'Quittance de loyer précédente',
];

/** Construit le payload RentalManagement (fiche d'annonce) à partir du body admin. */
function buildRentalData(req) {
  const {
    monthlyRent, charges, depositAmount, managementFee,
    chargesIncluded, furnished, minimumLeaseMonths, availableFrom,
    petsAllowed, rentalConditions, cautionMultiplicateur,
    profilsLocataireRecherches, documentsRequis,
  } = req.body;

  const data = {};
  const parsedRent = parseNumericField(monthlyRent, 'Le loyer mensuel');
  if (parsedRent !== undefined) data.monthlyRent = parsedRent;
  const parsedCharges = parseNumericField(charges, 'Les charges');
  if (parsedCharges !== undefined) data.charges = parsedCharges;
  const parsedDeposit = parseNumericField(depositAmount, 'La caution');
  if (parsedDeposit !== undefined) data.depositAmount = parsedDeposit;
  const parsedFee = parseNumericField(managementFee, 'Les frais de gestion');
  if (parsedFee !== undefined) data.managementFee = parsedFee;

  if (chargesIncluded !== undefined) data.chargesIncluded = chargesIncluded === 'true' || chargesIncluded === true;
  if (furnished !== undefined) data.furnished = furnished === 'true' || furnished === true;

  const parsedMinLease = parseNumericField(minimumLeaseMonths, 'La durée minimale du bail');
  if (parsedMinLease !== undefined) {
    if (!Number.isInteger(parsedMinLease) || parsedMinLease < 1) {
      const err = new Error('La durée minimale du bail doit être un nombre entier de mois (≥ 1).');
      err.statusCode = 422;
      throw err;
    }
    data.minimumLeaseMonths = parsedMinLease;
  }

  if (availableFrom) {
    const parsedDate = new Date(availableFrom);
    if (Number.isNaN(parsedDate.getTime())) {
      const err = new Error('Date de disponibilité invalide.');
      err.statusCode = 422;
      throw err;
    }
    data.availableFrom = parsedDate;
  }

  if (petsAllowed !== undefined) data.petsAllowed = petsAllowed === 'true' || petsAllowed === true;
  if (rentalConditions !== undefined) data.rentalConditions = rentalConditions;

  const parsedCaution = parseNumericField(cautionMultiplicateur, 'Le multiplicateur de caution');
  if (parsedCaution !== undefined) {
    if (parsedCaution < 0 || parsedCaution > 6) {
      const err = new Error('Le multiplicateur de caution doit être compris entre 0 et 6.');
      err.statusCode = 422;
      throw err;
    }
    data.cautionMultiplicateur = parsedCaution;
  }

  if (profilsLocataireRecherches !== undefined) {
    const parsed = parseStringArray(profilsLocataireRecherches);
    const invalid = parsed.filter((p) => !TENANT_PROFILES.includes(p));
    if (invalid.length > 0) {
      const err = new Error(`Profil(s) de locataire invalide(s) : ${invalid.join(', ')}.`);
      err.statusCode = 422;
      throw err;
    }
    data.profilsLocataireRecherches = parsed;
  }
  if (documentsRequis !== undefined) {
    const parsed = parseStringArray(documentsRequis);
    const invalid = parsed.filter((d) => !REQUIRED_DOCUMENTS.includes(d));
    if (invalid.length > 0) {
      const err = new Error(`Document(s) requis invalide(s) : ${invalid.join(', ')}.`);
      err.statusCode = 422;
      throw err;
    }
    data.documentsRequis = parsed;
  }

  return data;
}

// ─────────────────────────────────────────────
// POST /api/admin/properties/rentals
// ─────────────────────────────────────────────
exports.createFull = async (req, res) => {
  try {
    const { owner } = req.body;
    const ownerId = mongoose.isValidObjectId(owner) ? owner : req.user.id;

    let propertyData;
    try {
      propertyData = await buildBasePropertyData(req, ownerId, 'location');
    } catch (error) {
      return fail(res, error.statusCode || 422, error.message);
    }
    if (!propertyData.title || !propertyData.description || !Number.isFinite(propertyData.price)) {
      return fail(res, 422, 'Titre, description et prix (loyer) sont obligatoires.');
    }
    if (propertyData.price <= 0) {
      await cleanupUploadedImages(propertyData.images);
      return fail(res, 422, 'Le loyer mensuel doit être strictement positif.');
    }

    let rentalData;
    try {
      rentalData = buildRentalData(req);
    } catch (error) {
      await cleanupUploadedImages(propertyData.images);
      return fail(res, error.statusCode || 422, error.message);
    }

    let result;
    try {
      result = await createFullRentalProperty({ propertyData, rentalData, actingUser: req.user });
    } catch (error) {
      return fail(res, error.statusCode || 500, error.message);
    }

    logAction({
      action: 'Annonce location créée (admin)',
      description: `"${result.property.title}" créé depuis le dashboard admin`,
      module: 'Altimmo',
      typeAction: 'CRÉATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(result.property._id), type: 'Property', nom: result.property.title },
      req,
    });

    res.status(201).json({ status: 'success', data: { property: result.property, rental: result.rental } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PUT /api/admin/properties/rentals/:propertyId
// ─────────────────────────────────────────────
exports.updateFull = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.propertyId)) return fail(res, 400, 'Identifiant invalide.');
    const property = await Property.findById(req.params.propertyId);
    if (!property) return fail(res, 404, 'Bien introuvable.');
    if (property.status !== 'location') {
      return fail(res, 422, "Ce bien n'est pas une annonce de location.");
    }

    let rentalData;
    try {
      rentalData = buildRentalData(req);
    } catch (error) {
      return fail(res, error.statusCode || 422, error.message);
    }

    const {
      title, description, price, availability, type,
      surface, bedrooms, bathrooms, amenities,
      livingRooms, kitchens, constructionType,
      location, honoraires, fraisVisite, longitude, latitude, existingImages,
    } = req.body;

    if (title !== undefined) property.title = title;
    if (description !== undefined) property.description = description;
    if (price !== undefined && price !== '') {
      const parsedPrice = parseFloat(price);
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        return fail(res, 422, 'Le loyer mensuel doit être strictement positif.');
      }
      property.price = parsedPrice;
    }
    if (availability) property.availability = availability;
    if (type) property.type = type;
    if (surface !== undefined && surface !== '') property.surface = parseFloat(surface);
    if (bedrooms !== undefined && bedrooms !== '') property.bedrooms = parseInt(bedrooms);
    if (bathrooms !== undefined && bathrooms !== '') property.bathrooms = parseInt(bathrooms);
    if (livingRooms !== undefined && livingRooms !== '') property.livingRooms = parseInt(livingRooms);
    if (kitchens !== undefined && kitchens !== '') property.kitchens = parseInt(kitchens);
    if (constructionType) property.constructionType = constructionType;
    if (amenities !== undefined) property.amenities = parseAmenities(amenities);
    if (longitude !== undefined) property.longitude = longitude;
    if (latitude !== undefined) property.latitude = latitude;
    if (location) property.location = parseGeoLocation(location);
    if (req.body.address) property.address = parseAddress(req);
    if (honoraires !== undefined) {
      const parsed = parseNonNegativeAmount(honoraires, null);
      if (honoraires !== '' && parsed === null) return fail(res, 422, 'Honoraires invalides.');
      property.honoraires = parsed;
    }
    if (fraisVisite !== undefined) {
      const parsed = parseNonNegativeAmount(fraisVisite, 0);
      if (fraisVisite !== '' && parsed === null) return fail(res, 422, 'Frais de visite invalides.');
      property.fraisVisite = parsed;
    }

    const newImages = await uploadFilesToCloudinary(req.files);
    if (newImages.length > 0) {
      const kept = existingImages ? parseStringArray(existingImages) : [];
      property.images = [...kept, ...newImages];
    } else if (existingImages !== undefined) {
      property.images = parseStringArray(existingImages);
    }

    await property.save();

    const result = await updateFullRentalProperty({ property, rentalData, actingUser: req.user });

    logAction({
      action: 'Annonce location modifiée (admin)',
      description: `"${property.title}" modifié depuis le dashboard admin`,
      module: 'Altimmo',
      typeAction: 'MODIFICATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(property._id), type: 'Property', nom: property.title },
      req,
    });

    res.json({ status: 'success', data: { property, rental: result.rental } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};
