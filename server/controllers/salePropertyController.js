// server/controllers/salePropertyController.js — Sprint A (séparation Vente/Location).
//
// POST/PUT /api/admin/properties/sales(/:propertyId) — staff (ROLES_ALTIMMO)
// crée/édite une annonce Vente complète : Property (status='vente') +
// SaleManagement, en un seul appel. Même convention que
// accommodationController.createFull/updateFull (Sprint Hébergement/Hôtel) :
// validation AVANT toute mutation, compensation explicite, jamais de champ
// hôtelier/hébergement/location accepté ici.

const mongoose = require('mongoose');
const Property = require('../models/Property');
const SaleManagement = require('../models/SaleManagement');
const { createFullSaleProperty, updateFullSaleProperty } = require('../services/salePropertyService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const {
  uploadFilesToCloudinary, parseAmenities, parseAddress, parseGeoLocation,
  parseNonNegativeAmount, buildBasePropertyData, parseNumericField, parseStringArray,
} = require('./propertyController');
const { destroyFromCloudinary } = require('../config/cloudinary');

const fail = (res, statusCode, message, extra = {}) =>
  res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message, ...extra });

/** Best-effort : n'interrompt jamais la réponse d'erreur en cours. */
const cleanupUploadedImages = (images = []) =>
  Promise.all(images.map((url) => destroyFromCloudinary(url))).catch(() => {});

const LEGAL_STATUSES = ['regularise', 'en_cours_regularisation', 'litigieux', 'non_renseigne'];

/** Construit le payload SaleManagement (champs ALLOWED) à partir du body admin. */
function buildSaleData(req) {
  const {
    negotiable, ownershipDocumentType, ownershipDocumentAvailable,
    legalStatus, financingAccepted, agencyCommission, sellerConditions,
  } = req.body;

  const data = {};
  if (negotiable !== undefined) data.negotiable = negotiable === 'true' || negotiable === true;
  if (ownershipDocumentType !== undefined) data.ownershipDocumentType = ownershipDocumentType;
  if (ownershipDocumentAvailable !== undefined) {
    data.ownershipDocumentAvailable = ownershipDocumentAvailable === 'true' || ownershipDocumentAvailable === true;
  }
  if (legalStatus !== undefined) {
    if (!LEGAL_STATUSES.includes(legalStatus)) {
      const err = new Error('Statut juridique invalide.');
      err.statusCode = 422;
      throw err;
    }
    data.legalStatus = legalStatus;
  }
  if (financingAccepted !== undefined) data.financingAccepted = financingAccepted === 'true' || financingAccepted === true;
  const parsedCommission = parseNumericField(agencyCommission, "La commission d'agence");
  if (parsedCommission !== undefined) {
    if (parsedCommission < 0 || parsedCommission > 100) {
      const err = new Error("La commission d'agence doit être comprise entre 0 et 100.");
      err.statusCode = 422;
      throw err;
    }
    data.agencyCommission = parsedCommission;
  }
  if (sellerConditions !== undefined) data.sellerConditions = sellerConditions;
  return data;
}

// ─────────────────────────────────────────────
// POST /api/admin/properties/sales
// ─────────────────────────────────────────────
exports.createFull = async (req, res) => {
  try {
    const { owner } = req.body;
    const ownerId = mongoose.isValidObjectId(owner) ? owner : req.user.id;

    let propertyData;
    try {
      propertyData = await buildBasePropertyData(req, ownerId, 'vente');
    } catch (error) {
      return fail(res, error.statusCode || 422, error.message);
    }
    if (!propertyData.title || !propertyData.description || !Number.isFinite(propertyData.price)) {
      return fail(res, 422, 'Titre, description et prix sont obligatoires.');
    }
    if (propertyData.price <= 0) {
      await cleanupUploadedImages(propertyData.images);
      return fail(res, 422, 'Le prix de vente doit être strictement positif.');
    }

    let saleData;
    try {
      saleData = buildSaleData(req);
    } catch (error) {
      await cleanupUploadedImages(propertyData.images);
      return fail(res, error.statusCode || 422, error.message);
    }

    let result;
    try {
      result = await createFullSaleProperty({ propertyData, saleData, actingUser: req.user });
    } catch (error) {
      return fail(res, error.statusCode || 500, error.message);
    }

    logAction({
      action: 'Annonce vente créée (admin)',
      description: `"${result.property.title}" créé depuis le dashboard admin`,
      module: 'Altimmo',
      typeAction: 'CRÉATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(result.property._id), type: 'Property', nom: result.property.title },
      req,
    });

    res.status(201).json({ status: 'success', data: { property: result.property, sale: result.sale } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PUT /api/admin/properties/sales/:propertyId
// ─────────────────────────────────────────────
exports.updateFull = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.propertyId)) return fail(res, 400, 'Identifiant invalide.');
    const property = await Property.findById(req.params.propertyId);
    if (!property) return fail(res, 404, 'Bien introuvable.');
    if (property.status !== 'vente') {
      return fail(res, 422, "Ce bien n'est pas une annonce de vente.");
    }

    // Validé AVANT toute mutation de `property`, même convention que
    // accommodationController.updateFull (Sprint Hébergement).
    let saleData;
    try {
      saleData = buildSaleData(req);
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
        return fail(res, 422, 'Le prix de vente doit être strictement positif.');
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

    const result = await updateFullSaleProperty({ property, saleData, actingUser: req.user });

    logAction({
      action: 'Annonce vente modifiée (admin)',
      description: `"${property.title}" modifié depuis le dashboard admin`,
      module: 'Altimmo',
      typeAction: 'MODIFICATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(property._id), type: 'Property', nom: property.title },
      req,
    });

    res.json({ status: 'success', data: { property, sale: result.sale } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};
