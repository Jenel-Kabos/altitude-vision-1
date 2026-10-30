// server/controllers/propertyController.js
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Property = require('../models/Property');
const User = require('../models/User');
const APIFeatures = require('../utils/apiFeatures');
const { uploadToCloudinary } = require('../config/cloudinary');
const { logAction, buildAuteur } = require('../services/actionLogService');
const logger = require('../utils/logger');
const { notify, notifyMany } = require('../services/notificationService');
const Accommodation = require('../models/Accommodation');
const Hotel = require('../models/Hotel');
const RatePlan = require('../models/RatePlan');
const { isPubliclyVisible } = require('../services/accommodationService');
const { buildPropertyMongoFilter } = require('../services/propertyFilterService');
const { updateOwnerPropertyAndQueueLinkedHotel } = require('../services/hotelRepublishModerationService');
// Sprint A (séparation Vente/Location) — fiches satellites embarquées dans
// GET /api/properties/:id pour le préremplissage d'édition
// (SalePropertyForm/RentalPropertyForm), même convention que `accommodation`.
const SaleManagement = require('../models/SaleManagement');
const RentalManagement = require('../models/RentalManagement');
const Transaction = require('../models/Transaction');
const Contrat = require('../models/Contrat');
const { STAFF_IMMO } = require('../utils/roles');
// TENANT-CERT-2 — Property n'appelait jusqu'ici jamais la couche canonique
// d'attribution tenant (tenantResourceAttributionService), déjà utilisée par
// Hotel/Accommodation/Finance/Documents/Conversations : un Admin de
// n'importe quel tenant pouvait modifier/supprimer/modérer/désigner comme
// recommandé n'importe quel bien d'un AUTRE tenant, uniquement parce que
// `req.user.role === 'Admin'` (vulnérabilité confirmée par test adversarial,
// voir __tests__/tenantCert2.property.adversarial.mongo.integration.test.js).
// Un propriétaire agissant sur SON bien reste protégé par l'égalité
// `property.owner === req.user.id`, qui ne nécessite aucune vérification
// supplémentaire — seul le contournement par rôle Admin manquait de preuve
// tenant.
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { resolveTenantForUser, resolveTenantScope } = require('../services/platformTenant/tenantContextService');
const { normalizePropertyRegistryQuery, projectPropertyRegistryRows } = require('../services/propertyRegistryQueryService');
const { ADMINISTRATION_SCOPE_MODE } = require('../services/administrationScopeService');
const CommercialPublicationRevision = require('../models/CommercialPublicationRevision');
const {
  SUBSTANTIVE_PUBLIC_FIELDS, publicSnapshot, projectApprovedPublicResource, classifySubstantiveChanges,
  createPendingRevision, decideRevision, CommercialPublicationError,
} = require('../services/commercialPublicationService');
const {
  ownerWithdrawProperty,
  ownerRequestReactivation,
  ownerRequestSuspensionReview,
  adminSuspendProperty,
  adminLiftSuspension,
  isPropertyCommerciallyAvailable,
  commerciallyPublishedMongoFilter,
} = require('../services/propertyPublicationLifecycleService');
const { notifyPropertyLifecycleEvent } = require('../services/propertyPublicationNotificationService');

const emitPropertyLifecycleNotification = (payload) => {
  notifyPropertyLifecycleEvent(payload).then((result) => {
    if (result.failed) logger.warn('property_lifecycle_notification.partial_failure', { ...result, event: payload.event, propertyId: String(payload.property?._id || '') });
  }).catch((error) => logger.error('property_lifecycle_notification.failed', { event: payload.event, propertyId: String(payload.property?._id || ''), error: error.message }));
};

// TENANT-SCOPE-AUDIT-2A — `assertResourceTenant` (STRICTE) traitait un
// `Property.owner` sans OrgMembership (Proprietaire public-signup, cas
// fréquent) comme un échec, bloquant à tort le staff légitime du tenant
// unique sur ses propres actions de modération/mise à jour — reproduit par
// test (voir __tests__/tenantScopeAudit2aAttribution.mongo.integration.test.js).
// Réutilise la même primitive fail-open déjà certifiée ailleurs (Accommodation,
// Contrat, RentalManagement…) : `unresolved` (aucune frontière traçable) est
// laissé passer, `resolved` vers un AUTRE tenant reste refusé à l'identique.
// Le catalogue PUBLIC (publicPropertyService.js) n'est jamais concerné par
// cette fonction — code path staff-only, strictement séparé.

// Pure prédicat, ne touche jamais `res` — utilisé par getProperty pour
// calculer `isAdmin` sans risquer de laisser un `res.statusCode` erroné
// derrière soi sur le chemin où la propriété est finalement bien visible
// (bien public, ou propriétaire légitime).
async function isPropertyInActorTenant(req, property) {
  // PLATFORM-ADMIN-CERT-1 — voir accommodationController.js pour la même justification.
  const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
  const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
  if (!tenant) return false;
  return assertResourceTenantOrUnattributed({ resourceType: 'Property', resource: property, tenantId: tenant._id })
    .then(() => true).catch(() => false);
}

// `res` est explicitement positionné AVANT le throw (même convention que le
// reste de ce fichier, ex. updateProperty ci-dessous) : errorMiddleware.js
// dérive son statusCode de `res.statusCode`, jamais de `err.statusCode`.
async function assertPropertyTenantAccess(req, res, property) {
  // PLATFORM-ADMIN-CERT-1 — voir accommodationController.js pour la même justification.
  const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
  const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
  if (!tenant) {
    res.status(403);
    throw new Error('Contexte tenant requis ou ambigu pour cette action.');
  }
  try {
    await assertResourceTenantOrUnattributed({ resourceType: 'Property', resource: property, tenantId: tenant._id });
    return tenant;
  } catch (error) {
    res.status(error.statusCode || 403);
    throw error;
  }
}

async function decoratePublicHotelProperties(properties, { requirePublishedAccommodation = true } = {}) {
  const propertyIds = properties.filter((property) => property?.status === 'hebergement').map((property) => property._id);
  if (propertyIds.length === 0) return properties;
  const accommodations = await Accommodation.find({
    property: { $in: propertyIds },
    ...(requirePublishedAccommodation ? { publicationStatus: 'publie' } : {}),
  }).select('property accommodationType hotel').lean();
  const hotelIds = accommodations
    .filter((accommodation) => accommodation.accommodationType === 'hotel' && accommodation.hotel)
    .map((accommodation) => accommodation.hotel);
  const hotels = hotelIds.length
    ? await Hotel.find({ _id: { $in: hotelIds } }).select('_id hotelServices').lean()
    : [];
  const hotelById = new Map(hotels.map((hotel) => [String(hotel._id), hotel]));
  const byProperty = new Map(accommodations.map((accommodation) => [String(accommodation.property), accommodation]));
  return properties
    .filter((property) => property.status !== 'hebergement' || byProperty.has(String(property._id)))
    .map((property) => {
      if (property.status !== 'hebergement') return property;
      const accommodation = byProperty.get(String(property._id));
      const hotel = accommodation?.hotel ? hotelById.get(String(accommodation.hotel)) : null;
      const plain = property.toObject ? property.toObject() : property;
      return {
        ...plain,
        accommodationType: accommodation?.accommodationType || null,
        hotel: accommodation?.hotel || null,
        hotelServices: accommodation?.accommodationType === 'hotel' ? (hotel?.hotelServices || {}) : undefined,
      };
    });
}

/**
 * Projection publique de SaleManagement — jamais le document complet côté
 * public (GET /api/properties/:id utilise `optionalAuth`, donc accessible
 * sans authentification). Exclut `manager`/`createdBy`/`updatedBy` (identifiants
 * internes), `agencyCommission`/`sellerConditions` (négociation interne),
 * `publicationStatus` (workflow interne), `ownershipDocumentType`/
 * `ownershipDocumentAvailable` (situation juridique détaillée, réservée au
 * staff/propriétaire). Seules les informations commerciales de vente
 * réellement nécessaires à l'annonce sont exposées.
 */
function serializeSalePublic(sale) {
  const { negotiable, legalStatus, financingAccepted } = sale.toObject ? sale.toObject() : sale;
  return { negotiable, legalStatus, financingAccepted };
}

/**
 * Projection publique de RentalManagement — jamais le document complet côté
 * public. Exclut tout ce qui relève du dossier locatif opérationnel :
 * `currentTenant`, `activeLease`, `occupancyStatus`, `availabilityStatus`,
 * `publicationStatus`/`publicationPolicy`/`publicationAuthorized`, `manager`,
 * `managementFee` (frais internes d'agence), `mandateStartAt`/`mandateEndAt`,
 * `maintenanceStatus`/`maintenanceReason`, `noticeStartedAt`/`plannedExitAt`/
 * `exitInspectionClearedAt`, `publicationReadiness`, `workflowHistory`
 * (acteurs + commentaires internes), `actionRequests`. Seules les
 * informations utiles à un locataire potentiel sont exposées.
 */
// Champs présents à la fois sur Property (historique, Sprint 2 et avant) et
// RentalManagement (Sprint A) — voir server/docs/PROPERTY_TRANSACTION_ARCHITECTURE.md
// ("Compatibilité legacy"). Property n'a volontairement PAS d'équivalent pour
// les champs 100% nouveaux (furnished, chargesIncluded, minimumLeaseMonths…).
const LEGACY_RENTAL_FALLBACK_FIELDS = ['cautionMultiplicateur', 'profilsLocataireRecherches', 'documentsRequis'];

/**
 * Priorité explicite au chargement d'édition : RentalManagement (si
 * réellement activé/curaté) → Property legacy → valeur par défaut du schéma
 * RentalManagement (déjà appliquée par Mongoose à l'hydratation). Un
 * RentalManagement `managementActivated: false` (créé par le simple flux
 * d'annonce, jamais retouché) n'a que des valeurs par défaut pour ces champs
 * — ne doit jamais masquer une vraie valeur historique saisie sur Property.
 */
function applyLegacyRentalFallback(rentalObj, property, rentalDoc) {
  if (rentalDoc.managementActivated) return rentalObj; // dossier réellement activé : RentalManagement fait foi
  LEGACY_RENTAL_FALLBACK_FIELDS.forEach((field) => {
    const legacyValue = property[field];
    const hasLegacyValue = Array.isArray(legacyValue) ? legacyValue.length > 0 : legacyValue !== undefined && legacyValue !== null;
    if (hasLegacyValue) rentalObj[field] = legacyValue;
  });
  return rentalObj;
}

function serializeRentalPublic(rental) {
  const {
    furnished, chargesIncluded, minimumLeaseMonths, availableFrom,
    petsAllowed, rentalConditions,
  } = rental.toObject ? rental.toObject() : rental;
  return { furnished, chargesIncluded, minimumLeaseMonths, availableFrom, petsAllowed, rentalConditions };
}

// ============================================================
// 🛠️ UTILITAIRES
// ============================================================

/**
 * Upload tous les fichiers en mémoire (multer.memoryStorage) vers Cloudinary.
 * ✅ OPTIMISATION IMAGES :
 *   - quality:'auto'      → Cloudinary choisit la compression optimale
 *   - fetch_format:'auto' → WebP si le navigateur le supporte, sinon JPEG
 *   - width:1200          → redimensionne si l'image dépasse 1200px
 *   - crop:'limit'        → ne redimensionne PAS si déjà < 1200px
 *
 * Résultat : une photo de 3 Mo devient ~150-300 Ko selon le contenu.
 * Économie estimée par PageSpeed : 101 Ko sur la page d'accueil.
 */
const uploadFilesToCloudinary = async (files = [], folder = 'altitude-vision/properties') => {
  if (!files || files.length === 0) return [];
  const uploads = await Promise.all(
    files.map(file =>
      uploadToCloudinary(file.buffer, {
        folder,
        resource_type: 'image',
        quality:        'auto',   // ✅ compression intelligente
        fetch_format:   'auto',   // ✅ WebP si supporté par le navigateur
        width:          1200,     // ✅ largeur max en pixels
        crop:           'limit',  // ✅ ne redimensionne pas les petites images
      })
    )
  );
  return uploads.map(result => result.secure_url).filter(Boolean);
};

/**
 * Nettoie le champ amenities (tableau ou string)
 */
const parseAmenities = (amenities) => {
  if (Array.isArray(amenities)) {
    return amenities.map(a => (typeof a === 'string' ? a.trim() : a)).filter(Boolean);
  }
  if (typeof amenities === 'string') {
    try {
      const parsed = JSON.parse(amenities);
      if (Array.isArray(parsed)) {
        return parsed.map(a => (typeof a === 'string' ? a.trim() : a)).filter(Boolean);
      }
    } catch (e) {
      return amenities.split(',').map(a => a.trim()).filter(Boolean);
    }
  }
  return [];
};

const parseStringArray = (value) => {
  if (Array.isArray(value)) {
    return value.map(item => (typeof item === 'string' ? item.trim() : item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(item => (typeof item === 'string' ? item.trim() : item)).filter(Boolean);
      }
    } catch (e) {
      return value.split(',').map(item => item.trim()).filter(Boolean);
    }
    return value.trim() ? [value.trim()] : [];
  }
  return [];
};

const parseNonNegativeAmount = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

/**
 * Convertit vers un nombre fini, ou lève une erreur 422 explicite si la
 * valeur fournie n'est pas vide mais n'est pas un nombre valide — jamais de
 * NaN silencieux propagé jusqu'au schéma Mongoose. Une valeur vide/absente
 * retourne `undefined` (champ non fourni). Partagé par
 * accommodationController.js, salePropertyController.js et
 * rentalPropertyController.js (Sprint A).
 */
const parseNumericField = (value, label) => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    const err = new Error(`${label} doit être un nombre valide.`);
    err.statusCode = 422;
    throw err;
  }
  return n;
};

/**
 * Reconstruit l'adresse à partir du body — supporte à la fois un champ
 * `address` JSON (string ou objet déjà parsé) et les champs à plat
 * `address[street]`, `address[arrondissement]`… (FormData multipart).
 * Extrait de createProperty pour être réutilisable (ex : création admin
 * d'un hébergement complet — voir accommodationController.createFull).
 */
const parseAddress = (req) => {
  const { address } = req.body;
  let addressData = {};
  if (typeof address === 'string') {
    try { addressData = JSON.parse(address); }
    catch (e) { addressData = address || {}; }
  } else {
    addressData = address || {};
  }
  return {
    arrondissement: addressData.arrondissement || req.body['address[arrondissement]'],
    neighborhood:   addressData.neighborhood || req.body['address[neighborhood]'],
    street:         addressData.street || req.body['address[street]'],
    city:           addressData.city || req.body['address[city]'] || 'Brazzaville',
  };
};

/**
 * Parse le champ `location` (GeoJSON, string ou objet) — retourne `undefined`
 * si absent/invalide plutôt que de faire planter la création.
 */
const parseGeoLocation = (location) => {
  if (!location) return undefined;
  if (typeof location === 'string') {
    try { return JSON.parse(location); } catch (e) { return undefined; }
  }
  return location;
};

/**
 * Construit le payload Property commun à tous les flux de création admin
 * complète (hébergement, vente, location — voir accommodationController.js,
 * salePropertyController.js, rentalPropertyController.js). `status` est
 * TOUJOURS fourni par l'appelant, jamais lu depuis `req.body` — le choix
 * métier (via l'endpoint appelé) détermine le statut, jamais un champ
 * technique du formulaire (Sprint A, séparation Vente/Location/Hébergement).
 */
async function buildBasePropertyData(req, ownerId, status) {
  const {
    title, description, price, pole, availability, type,
    surface, bedrooms, bathrooms, amenities,
    livingRooms, kitchens, constructionType,
    location, honoraires, fraisVisite, longitude, latitude,
  } = req.body;

  const parsedHonoraires = parseNonNegativeAmount(honoraires, null);
  const parsedFraisVisite = parseNonNegativeAmount(fraisVisite, 0);
  if ((honoraires !== undefined && honoraires !== '' && parsedHonoraires === null)
    || (fraisVisite !== undefined && fraisVisite !== '' && parsedFraisVisite === null)) {
    const err = new Error('Les honoraires et frais de visite doivent être des montants positifs ou nuls.');
    err.statusCode = 422;
    throw err;
  }

  const imagePaths = await uploadFilesToCloudinary(req.files);

  return {
    owner: ownerId,
    title,
    description,
    price: parseFloat(price),
    honoraires: parsedHonoraires,
    fraisVisite: parsedFraisVisite,
    pole: pole || 'Altimmo',
    status,
    availability: availability || 'Disponible',
    type,
    address: parseAddress(req),
    surface: parseFloat(surface),
    bedrooms: parseInt(bedrooms || 0),
    bathrooms: parseInt(bathrooms || 0),
    livingRooms: parseInt(livingRooms || 0),
    kitchens: parseInt(kitchens || 0),
    constructionType,
    amenities: parseAmenities(amenities),
    longitude,
    latitude,
    location: parseGeoLocation(location),
    images: imagePaths,
    statusAdmin: 'En attente',
  };
}

// ============================================================
// 🎮 CONTRÔLEURS PRINCIPAUX
// ============================================================

/**
 * @description Créer un bien immobilier
 * @route POST /api/properties
 */
const createProperty = asyncHandler(async (req, res, next) => {
  logger.info('--- 🆕 Création de propriété ---');

  // 1. Upload des images vers Cloudinary (avec optimisation WebP)
  const imagePaths = await uploadFilesToCloudinary(req.files);
  logger.info('📸 Images Cloudinary:', imagePaths);

  // 2. Préparation des données
  const {
    title, description, price, pole, status, availability, type,
    surface, bedrooms, bathrooms, amenities,
    livingRooms, kitchens, constructionType, cautionMultiplicateur,
    profilsLocataireRecherches, documentsRequis,
    location, honoraires, fraisVisite
  } = req.body;

  const parsedHonoraires = parseNonNegativeAmount(honoraires, null);
  const parsedFraisVisite = parseNonNegativeAmount(fraisVisite, 0);
  if ((honoraires !== undefined && honoraires !== '' && parsedHonoraires === null)
    || (fraisVisite !== undefined && fraisVisite !== '' && parsedFraisVisite === null)) {
    res.status(400);
    throw new Error('Les honoraires et frais de visite doivent être des montants positifs ou nuls.');
  }

  // 3. Parsing de l'adresse
  const finalAddress = parseAddress(req);

  // 4. Parsing de la Location (GeoJSON)
  const finalLocation = parseGeoLocation(location);
  const { longitude, latitude } = req.body;

  // 5. Création en base
  // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-G — tenant attribution
  // vient EXCLUSIVEMENT du contexte tenant canonique. Sur la route
  // OWNERSHIP `POST /`, aucun `attachTenantContext` n'est composé →
  // `req.platformTenant` reste undefined → `tenant: null` (bien personnel).
  // Sur la route TENANT `POST /portfolio`, la chaîne canonique pose
  // `req.platformTenant` → `tenant: req.platformTenant._id`. Aucun body,
  // query ou header custom n'est lu ici.
  const newProperty = await Property.create({
    owner:           req.user.id,
    tenant:          req.propertyCreationTenantId || req.platformTenant?._id || null,
    title,
    description,
    price:           parseFloat(price),
    honoraires:      parsedHonoraires,
    fraisVisite:     parsedFraisVisite,
    pole,
    status,
    availability,
    type,
    address:         finalAddress,
    surface:         parseFloat(surface),
    bedrooms:        parseInt(bedrooms    || 0),
    bathrooms:       parseInt(bathrooms   || 0),
    livingRooms:     parseInt(livingRooms || 0),
    kitchens:        parseInt(kitchens    || 0),
    constructionType,
    cautionMultiplicateur: cautionMultiplicateur !== undefined ? parseFloat(cautionMultiplicateur) : 2,
    profilsLocataireRecherches: parseStringArray(profilsLocataireRecherches),
    documentsRequis: parseStringArray(documentsRequis),
    amenities:       parseAmenities(amenities),
    longitude,
    latitude,
    location:        finalLocation,
    images:          imagePaths,
    statusAdmin:     'En attente'
  });
  const initialRevision = await createPendingRevision({ resourceType: 'Property', resource: newProperty, proposedSnapshot: publicSnapshot(newProperty), actor: req.user });
  emitPropertyLifecycleNotification({ event: 'submitted', property: newProperty, actor: req.user, transitionKey: String(initialRevision._id) });

  logger.success('✅ Propriété créée :', newProperty._id);

  res.status(201).json({
    status: 'success',
    data: { property: newProperty },
  });

  logAction({
    action: 'Bien immobilier ajouté',
    description: `"${newProperty.title}" (${newProperty.type || ''}) ajouté dans Altimmo`,
    module: 'Altimmo',
    typeAction: 'CRÉATION',
    auteur: buildAuteur(req.user),
    cible: { id: String(newProperty._id), type: 'Property', nom: newProperty.title },
    req,
  });
});

/**
 * Cœur de la recherche publique de biens (Vente/Location/Tous — jamais Hébergement seul avec
 * catégorie réelle, voir `accommodationSearchService.searchPublicAccommodations` pour ça).
 * Extrait de `getAllProperties` pour être réutilisé par le endpoint unifié
 * `GET /api/altimmo/search` (`altimmoSearchController.js`) sans dupliquer la logique de filtre
 * (audit filtrage Altimmo, correctif architecture du 2026-07-25).
 *
 * @returns {Promise<{properties: object[], total: number}>}
 */
async function runPropertySearch({ query, isAdmin, tenantId = null }) {
  const workingQuery = { ...query };

  // ── 1. Filtre de base passé directement à Property.find() ───────────────
  //    Ces champs NE passent PAS par APIFeatures.filter() (JSON.stringify
  //    détruit les objets RegExp et les opérateurs $-préfixés non-standards).
  // GL-ARCH-1 : pour le staff (Admin/Gestionnaire Immobilier/Collaborateur),
  // aucun filtre de publication (statusAdmin) ni de disponibilité n'est
  // imposé ici — la Gestion Locative doit pouvoir proposer tous les biens
  // déjà gérés ET tous les biens pouvant être pris en gestion, publiés ou
  // non, disponibles ou non. Seul le public (non-staff) reste restreint aux
  // annonces validées/disponibles/Altimmo.
  const baseFilter = tenantId ? { tenant: tenantId } : {};
  if (!isAdmin) {
    Object.assign(baseFilter, commerciallyPublishedMongoFilter());
    baseFilter.pole         = 'Altimmo';
  }

  // ── 2. Nomenclature canonique (offerType/propertyType/city/arrondissement/minPrice/
  //    maxPrice) + alias legacy (status/transaction/listingType, type, ville, price[gte/lte])
  //    → filtre Mongo sûr (regex ancrée/échappée pour city/arrondissement), voir
  //    propertyFilterService.js. Le reste (search, sort, page, limit, fields, et tout
  //    passthrough) continue d'être géré par APIFeatures exactement comme avant.
  delete workingQuery.statusAdmin;
  delete workingQuery.isPublished;
  delete workingQuery.availability;
  delete workingQuery.pole;
  // Le tenant est une frontière serveur, jamais un filtre contrôlé par la query HTTP.
  delete workingQuery.tenant;
  // `accommodationType` n'a aucun sens sur Property (catégorie propre à Accommodation) —
  // silencieusement ignoré ici si un client le fournit avec offerType=vente/location/tous.
  delete workingQuery.accommodationType;
  const { mongoFilter, remainingQuery } = buildPropertyMongoFilter(workingQuery);
  Object.assign(baseFilter, mongoFilter);

  const countFeatures = new APIFeatures(Property.find(baseFilter), { ...remainingQuery }).filter();

  const features = new APIFeatures(Property.find(baseFilter), remainingQuery)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  let [properties, total] = await Promise.all([
    features.query,
    countFeatures.query.countDocuments(),
  ]);

  // Hébergement (cas `offerType` absent/'tous', mélangé avec Vente/Location) : filtre
  // post-fetch — un hébergement non publié (Accommodation absente ou publicationStatus ≠
  // 'publie') n'apparaît jamais dans le listing public, même si Property est déjà
  // 'Validée'/'Disponible'.
  //
  // ⚠️ LIMITATION CONNUE (Sprint 2, TODO Sprint 3) — deux effets de bord :
  //   1. `total` (countDocuments, ligne ~243) compte TOUS les Property
  //      correspondant aux filtres, y compris les hébergements non publiés
  //      qui seront retirés juste après → `total` peut être légèrement
  //      surestimé pour une recherche qui inclut des hébergements.
  //   2. Ce filtre s'applique APRÈS skip/limit (pagination Mongo), donc une
  //      page peut légitimement contenir moins de `limit` résultats si elle
  //      incluait des hébergements non publiés avant filtrage.
  //   Aucun impact sur Vente/Location : l'exclusion ne s'applique jamais à
  //   ces statuts (vérifié par la suite de tests existante, inchangée).
  //   Correction non appliquée ce sprint : la réécrire proprement nécessite
  //   soit une agrégation $lookup Property↔Accommodation, soit de dupliquer
  //   la logique de filtre() d'APIFeatures pour précalculer l'exclusion
  //   AVANT paginate() — dans les deux cas un risque de régression sur un
  //   endpoint public que le périmètre du Sprint 2 ne justifie pas. À
  //   traiter au Sprint 3 si le volume d'hébergements le justifie. Note
  //   (2026-07-25) : `offerType=hebergement` seul passe désormais par
  //   `accommodationSearchService.searchPublicAccommodations` (pagination
  //   correcte, post-filtre) — cette limitation ne concerne plus que le cas
  //   `offerType` absent/'tous' mélangeant Vente/Location/Hébergement.
  if (!isAdmin) {
    const hebergementIds = properties.filter((p) => p.status === 'hebergement').map((p) => p._id);
    if (hebergementIds.length > 0) {
      properties = await decoratePublicHotelProperties(properties);
    }
    properties = properties.map(projectApprovedPublicResource);
  }

  logger.info(`📦 [runPropertySearch] total=${total} results=${properties.length} baseFilter=${JSON.stringify(Object.keys(baseFilter))}`);

  return { properties, total };
}

/**
 * @description Obtenir tous les biens (Public)
 * @route GET /api/properties
 */
const getAllProperties = asyncHandler(async (req, res) => {
  // GL-ARCH-1 : le staff Gestion Locative (Admin/Gestionnaire Immobilier/
  // Collaborateur) a besoin de voir tous les biens gérables, pas seulement
  // ceux déjà publiés/validés — pas uniquement `Admin`.
  const isAdmin = Boolean(req.isPlatformOperatorContext) || (req.user && STAFF_IMMO.includes(req.user.role));
  const includeDashboardRegistry = req.query.dashboardRegistry === '1';
  const includeDashboardClassification = req.query.dashboardClassification === '1';
  let query = { ...req.query };
  let registryPage = null;
  let registryLimit = null;
  if (includeDashboardRegistry) {
    // PA-03 — le registre est une surface administrative explicite. La
    // capability plateforme reste vérifiée par le middleware canonique ; ce
    // garde empêche seulement qu'un opérateur suspendu/non reconnu ou un
    // Admin historique non rattaché tombe sur le catalogue public.
    if (!req.user || req.adminScope?.mode === ADMINISTRATION_SCOPE_MODE.UNRESOLVED) {
      res.status(403);
      throw new Error('Contexte administratif immobilier requis.');
    }
    try {
      const normalized = normalizePropertyRegistryQuery(req.query);
      query = normalized.query;
      registryPage = normalized.page;
      registryLimit = normalized.limit;
    } catch (error) {
      res.status(error.statusCode || 400);
      throw error;
    }
  }
  delete query.dashboardRegistry;
  delete query.dashboardClassification;
  const tenantId = isAdmin && req.adminScope?.mode === ADMINISTRATION_SCOPE_MODE.TENANT
    ? req.adminScope.tenantId
    : null;
  let { properties, total } = await runPropertySearch({ query, isAdmin, tenantId });

  // PA-03 — enrichissement purement informatif, exécuté après l'autorité et
  // le filtre tenant. Les documents projetés ne participent jamais au scope.
  if (includeDashboardRegistry) {
    properties = await projectPropertyRegistryRows(properties);
  }

  if (includeDashboardClassification && properties.length) {
    const { classifyDashboardListing } = require('../services/moderationClassificationService');
    const propertyIds = properties.map(({ _id }) => _id);
    const accommodations = await Accommodation.find({ property: { $in: propertyIds } })
      .select('_id property accommodationType hotel').lean();
    const accommodationByProperty = new Map(accommodations.map((item) => [String(item.property), item]));
    const referencedHotelIds = accommodations.map((item) => item.hotel).filter(Boolean);
    const hotels = await Hotel.find({
      $or: [{ _id: { $in: referencedHotelIds } }, { property: { $in: propertyIds } }],
    }).select('_id property').lean();
    const hotelById = new Map(hotels.map((item) => [String(item._id), item]));
    const hotelByProperty = new Map(hotels.filter((item) => item.property).map((item) => [String(item.property), item]));

    properties = properties.map((property) => {
      const plain = property.toObject ? property.toObject() : property;
      const accommodation = accommodationByProperty.get(String(property._id)) || null;
      const hotel = (accommodation?.hotel && hotelById.get(String(accommodation.hotel)))
        || hotelByProperty.get(String(property._id)) || null;
      return { ...plain, dashboardClassification: classifyDashboardListing({ property, accommodation, hotel }) };
    });
  }

  res.status(200).json({
    status:  'success',
    results: properties.length,
    total,
    data: {
      properties,
      total,
      ...(includeDashboardRegistry && {
        page: registryPage,
        limit: registryLimit,
        totalPages: total === 0 ? 0 : Math.ceil(total / registryLimit),
      }),
    },
  });
});

/**
 * @description Obtenir les biens en attente (ADMIN)
 * @route GET /api/properties/status/pending
 */
const getPendingProperties = asyncHandler(async (req, res) => {
  logger.info('📡 [Admin] Récupération des annonces en attente...');

  const { classicPropertyModerationFilter } = require('../services/moderationClassificationService');
  const tenantId = req.platformTenant?._id || req.platformTenant || null;
  const properties = await Property.find(classicPropertyModerationFilter({
    statusAdmin: 'En attente',
    ...(tenantId ? { tenant: tenantId } : {}),
  }))
    .populate('owner', 'name email photo role phone')
    .sort('-createdAt');

  logger.success('✅', properties.length, 'annonces en attente.');

  res.status(200).json({
    status: 'success',
    results: properties.length,
    data: { properties },
  });
});

const getPendingPropertiesCount = asyncHandler(async (req, res) => {
  const { classicPropertyModerationFilter } = require('../services/moderationClassificationService');
  const tenantId = req.platformTenant?._id || req.platformTenant || null;
  const unreadCount = await Property.countDocuments(classicPropertyModerationFilter({
    statusAdmin: 'En attente',
    ...(tenantId ? { tenant: tenantId } : {}),
  }));
  res.status(200).json({ status: 'success', data: { unreadCount } });
});

/**
 * @description Middleware pour les dernières propriétés
 */
const getLatestProperties = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort  = '-createdAt';
  // Pas de `req.query.statusAdmin` ici : `getAllProperties` l'impose déjà lui-même pour tout
  // non-admin (baseFilter.statusAdmin) et le retire systématiquement de req.query — une
  // affectation ici était sans effet et trompeuse (audit filtrage Altimmo).
  next();
};

/**
 * @description Obtenir un bien par ID
 * @route GET /api/properties/:id
 */
const getProperty = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error('Identifiant de bien invalide.');
  }
  const property = await Property.findByIdAndUpdate(
    req.params.id,
    { $inc: { views: 1 } },
    { new: true }
  ).populate('owner', 'name photo');

  if (!property) {
    res.status(404);
    throw new Error('Bien immobilier non trouvé.');
  }

  const isOwner = req.user && property.owner &&
    property.owner._id.toString() === req.user.id.toString();
  // Le rôle Admin n'accorde la visibilité privilégiée (bien non publié) qu'à
  // l'intérieur du tenant de l'Admin — jamais un catalogue interne global.
  // Résolu une seule fois pour tout le reste de la fonction (y compris la
  // branche hébergement plus bas), afin qu'aucune combinaison d'état ne
  // retombe silencieusement sur l'ancien bypass non vérifié.
  const isAdmin = (req.user && req.user.role === 'Admin' && !isOwner)
    ? await isPropertyInActorTenant(req, property)
    : Boolean(req.user && req.user.role === 'Admin');

  // Les documents historiques hydratés par Mongoose reçoivent la valeur par
  // défaut "Disponible" ; le test explicite conserve néanmoins la lecture
  // de rares projections legacy où le champ est absent.
  if (!isPropertyCommerciallyAvailable(property) && !isAdmin && !isOwner) {
    res.status(403);
    throw new Error('Cette propriété n’est pas disponible publiquement.');
  }

  // Hébergement : gate additionnel — voir accommodationService.isPubliclyVisible.
  // Vente/Location ne passent jamais par cette branche, comportement inchangé.
  let accommodation = null;
  if (property.status === 'hebergement') {
    accommodation = await Accommodation.findOne({ property: property._id });
    if (!isAdmin && !isOwner && !isPubliclyVisible(property, accommodation)) {
      res.status(403);
      throw new Error("Cet hébergement est en attente de validation.");
    }
  }

  // Sprint A : fiches Vente/Location embarquées pour le préremplissage
  // d'édition côté dashboard admin (SalePropertyForm/RentalPropertyForm) —
  // aucun gate de visibilité additionnel (déjà couvert par statusAdmin
  // ci-dessus, comme pour Vente/Location avant ce sprint).
  let sale = null;
  let rental = null;
  if (property.status === 'vente') {
    sale = await SaleManagement.findOne({ property: property._id });
  } else if (property.status === 'location') {
    rental = await RentalManagement.findOne({ property: property._id });
  }

  let responseProperty = property.toObject();
  if (!isAdmin && !isOwner) {
    responseProperty = projectApprovedPublicResource(responseProperty);
    delete responseProperty.documents;
    delete responseProperty.latitude;
    delete responseProperty.longitude;
    delete responseProperty.location;
    if (responseProperty.address) delete responseProperty.address.street;
    if (responseProperty.owner) {
      responseProperty.owner = {
        _id: responseProperty.owner._id,
        name: responseProperty.owner.name || 'Propriétaire vérifié',
        photo: responseProperty.owner.photo || '',
      };
    }
  }

  if (accommodation) {
    const rates = await RatePlan.find({ accommodation: accommodation._id, active: true });
    responseProperty.accommodation = { ...accommodation.toObject(), rates };
  }
  // Document complet réservé au staff/propriétaire (préremplissage édition
  // dashboard) — projection restreinte sinon, quel que soit le statut de
  // modération (cette route est publique via `optionalAuth`).
  if (sale) responseProperty.sale = (isAdmin || isOwner) ? sale.toObject() : serializeSalePublic(sale);
  if (rental) {
    responseProperty.rental = (isAdmin || isOwner)
      ? applyLegacyRentalFallback(rental.toObject(), property, rental)
      : serializeRentalPublic(rental);
  }

  res.status(200).json({
    status: 'success',
    data: { property: responseProperty },
  });
});

/**
 * @description Liker / unliker un bien (toggle)
 * @route POST /api/properties/:id/like
 */
const toggleLike = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) { res.status(404); throw new Error('Bien introuvable.'); }

  const userId  = req.user._id;
  const hasLiked = property.likes.some(id => id.toString() === userId.toString());
  const update  = hasLiked
    ? { $pull: { likes: userId } }
    : { $addToSet: { likes: userId } };

  const updated = await Property.findByIdAndUpdate(req.params.id, update, { new: true });
  res.status(200).json({
    status:  'success',
    liked:   !hasLiked,
    likes:   updated.likes.length,
  });
});

/**
 * @description Incrémenter le compteur de partages
 * @route POST /api/properties/:id/share
 */
const incrementShare = asyncHandler(async (req, res) => {
  const updated = await Property.findByIdAndUpdate(
    req.params.id,
    { $inc: { shares: 1 } },
    { new: true }
  );
  if (!updated) { res.status(404); throw new Error('Bien introuvable.'); }
  res.status(200).json({ status: 'success', shares: updated.shares });
});

/**
 * @description Laisser un avis (commentaire) sur un bien
 * @route POST /api/properties/:id/reviews
 */
const addPropertyReview = asyncHandler(async (req, res) => {
  const { comment, rating } = req.body;
  if (!comment || !comment.trim()) {
    res.status(400);
    throw new Error('Un commentaire est requis.');
  }

  const property = await Property.findById(req.params.id);
  if (!property) { res.status(404); throw new Error('Bien introuvable.'); }

  property.reviews.push({
    user: req.user._id,
    comment: comment.trim(),
    rating: rating || 5,
  });
  await property.save();
  await property.populate('reviews.user', 'name photo');

  res.status(201).json({
    status: 'success',
    data: { reviews: property.reviews },
  });
});

/**
 * @description Obtenir les biens de l'utilisateur connecté
 * @route GET /api/properties/my-properties
 */
const getMyProperties = asyncHandler(async (req, res) => {
  const properties = await Property.find({ owner: req.user.id }).sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: properties.length,
    data: { properties },
  });
});

/**
 * @description Mettre à jour une propriété
 * @route PUT /api/properties/:id
 */
const updateProperty = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);

  if (!property) {
    res.status(404);
    throw new Error('Propriété non trouvée.');
  }

  const isOwner = property.owner && property.owner.toString() === req.user.id.toString();
  // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-G — le bypass historique
  // `req.user.role === 'Admin'` a été retiré (Décision 2 de la phase 2E.1.X-G).
  // L'autorité TENANT dérive désormais EXCLUSIVEMENT d'une OrgMembership
  // active + `businessRole` canonique, résolue en amont par le middleware
  // `resolveTenantMembershipIfPresent`. Un Admin global sans membership ne
  // peut plus muter le bien personnel d'un tiers.
  const TENANT_STAFF_MUTATE_ROLES = new Set(['Admin', 'GestionnaireImmobilier']);
  const isTenantStaff = Boolean(
    req.tenantBusinessRole
    && TENANT_STAFF_MUTATE_ROLES.has(req.tenantBusinessRole)
    && req.platformTenant?._id,
  );

  if (!isOwner && !isTenantStaff) {
    res.status(403);
    throw new Error('Vous ne pouvez modifier que vos propres biens.');
  }
  // Sur le chemin TENANT STAFF, la frontière tenant est autoritaire :
  // `Property.tenant === req.platformTenant._id`. La primitive canonique
  // (`assertResourceTenantOrUnattributed`) refuse une ressource attribuée à
  // un AUTRE tenant. Sur un bien `tenant=null` (personnel), l'attribution
  // reste `unresolved` — la garde `!isOwner && !isTenantStaff` a déjà
  // repoussé les callers non-owner qui ne sont pas non plus tenant staff,
  // donc un tenant Admin ne peut jamais muter un bien personnel d'un tiers
  // (parce que sa membership canonique n'attribue pas ce bien à son tenant).
  if (isTenantStaff && !isOwner) {
    // Décision 2 (2E.1.X-G) : le tenant staff ne peut muter QUE des biens
    // strictement attribués à son tenant. La règle « unresolved = allow »
    // du helper canonique s'applique à d'autres surfaces ; ici on veut la
    // frontière STRICTE. Un bien `Property.tenant=null` (personnel) reste
    // hors périmètre tenant staff.
    if (!property.tenant || String(property.tenant) !== String(req.platformTenant._id)) {
      res.status(403);
      throw new Error('Ce bien n\'appartient pas au tenant sélectionné.');
    }
    await assertPropertyTenantAccess(req, res, property);
  }
  // Pour maintenir la compat des drapeaux internes (moderation flags,
  // status/pole/...), `isAdmin` reste dérivé, mais désormais uniquement de
  // l'autorité tenant staff canonique. Aucun `User.role='Admin'` global.
  const isAdmin = isTenantStaff;

  // Champs interdits à la modification directe
  // PLATFORM-ADMIN-04B0 — `tenant` est une donnée de PROVENANCE protégée : une
  // mutation ordinaire (owner, staff tenant, opérateur ; web ou mobile) n'est
  // jamais un transfert organisationnel. La valeur client est ignorée, comme
  // les autres champs exclus ; `tenant:null` reste une provenance valide. Une
  // réattribution éventuelle relèvera d'un workflow dédié (hors de ce
  // contrôleur). Les clés opérateur (`$set`, `$unset`…) et les chemins pointés
  // sont également retirés : défense en profondeur, indépendante du
  // `express-mongo-sanitize` global de server.js.
  const excludedFields = ['_id', 'owner', 'createdAt', 'reviewedAt', 'images', 'tenant'];
  const updateData = { ...req.body };
  excludedFields.forEach(field => delete updateData[field]);
  Object.keys(updateData)
    .filter((key) => key.startsWith('$') || key.includes('.'))
    .forEach((key) => delete updateData[key]);
  delete updateData.statusAdmin; // toujours exclu du body
  // Les champs de cycle de vie sont pilotés par la modération, la gestion
  // locative ou la finalisation financière. Un propriétaire ne peut jamais
  // les forcer via le formulaire générique.
  if (!isAdmin) {
    ['status', 'isPublished', 'pole', 'agent', 'recommande']
      .forEach((field) => delete updateData[field]);

    // GL-ARCH-1 : un bien "pris en gestion" (RentalManagement.managementActivated)
    // suit désormais exclusivement les règles de l'agence — le propriétaire du
    // portail perd tout contrôle sur `availability` dès qu'il est géré. Sur son
    // propre bien non géré, il garde le droit contractuel de signaler
    // Loué/Retiré/Vendu (portail propriétaire, univers 1) : ce cycle est
    // indépendant de toute décision de prise en gestion par le staff.
    if (updateData.availability !== undefined) {
      const managedRental = await RentalManagement.findOne({ property: property._id, managementActivated: true }).select('_id');
      const ALLOWED_OWNER_AVAILABILITY = ['Disponible', 'Loué', 'Retiré', 'Vendu'];
      if (managedRental || !ALLOWED_OWNER_AVAILABILITY.includes(updateData.availability)) {
        delete updateData.availability;
      }
    }
  }

  if (updateData.honoraires !== undefined) {
    const amount = parseNonNegativeAmount(updateData.honoraires, null);
    if (updateData.honoraires !== '' && amount === null) {
      res.status(400);
      throw new Error('Les honoraires doivent être un montant positif ou nul.');
    }
    updateData.honoraires = amount;
  }
  if (updateData.fraisVisite !== undefined) {
    const amount = parseNonNegativeAmount(updateData.fraisVisite, 0);
    if (updateData.fraisVisite !== '' && amount === null) {
      res.status(400);
      throw new Error('Les frais de visite doivent être un montant positif ou nul.');
    }
    updateData.fraisVisite = amount;
  }
  // 1. Upload des nouvelles images vers Cloudinary (avec optimisation WebP)
  const newImages = await uploadFilesToCloudinary(req.files);
  logger.info('📸 Nouvelles images Cloudinary:', newImages);

  // 2. Récupérer les images existantes envoyées par le frontend
  let existingImages = req.body.existingImages || [];
  if (typeof existingImages === 'string') {
    try { existingImages = JSON.parse(existingImages); }
    catch (e) { existingImages = [existingImages]; }
  }
  if (!Array.isArray(existingImages)) existingImages = [];

  // 3. Combiner images existantes + nouvelles
  if (newImages.length > 0 || existingImages.length > 0) {
    updateData.images = [...existingImages, ...newImages];
  }

  // 4. Parsing Adresse
  if (typeof updateData.address === 'string') {
    try { updateData.address = JSON.parse(updateData.address); }
    catch (e) { delete updateData.address; }
  }

  const addressFromFields = {
    street: req.body['address[street]'],
    neighborhood: req.body['address[neighborhood]'],
    arrondissement: req.body['address[arrondissement]'],
    city: req.body['address[city]'],
  };
  const hasAddressFromFields = Object.values(addressFromFields).some(value => value !== undefined);

  if (hasAddressFromFields) {
    updateData.address = {
      ...(updateData.address || {}),
      ...Object.fromEntries(Object.entries(addressFromFields).filter(([, value]) => value !== undefined)),
    };
    delete updateData['address[street]'];
    delete updateData['address[neighborhood]'];
    delete updateData['address[arrondissement]'];
    delete updateData['address[city]'];
  }

  if (updateData.amenities !== undefined) {
    updateData.amenities = parseAmenities(updateData.amenities);
  }

  if (updateData.profilsLocataireRecherches !== undefined) {
    updateData.profilsLocataireRecherches = parseStringArray(updateData.profilsLocataireRecherches);
  }

  if (updateData.documentsRequis !== undefined) {
    updateData.documentsRequis = parseStringArray(updateData.documentsRequis);
  }

  if (updateData.cautionMultiplicateur !== undefined) {
    updateData.cautionMultiplicateur = parseFloat(updateData.cautionMultiplicateur);
  }

  // 5. Parsing Location (GPS)
  if (updateData.longitude && updateData.latitude) {
    updateData.location = {
      type:        'Point',
      coordinates: [parseFloat(updateData.longitude), parseFloat(updateData.latitude)]
    };
  }

  const approvedBaseline = publicSnapshot(property.approvedPublicSnapshot || property);
  const proposedPatch = publicSnapshot(updateData);
  const proposedPublicSnapshot = {
    ...approvedBaseline,
    ...proposedPatch,
    ...(proposedPatch.address ? { address: { ...(approvedBaseline.address || {}), ...proposedPatch.address } } : {}),
  };
  const substantiveChanges = classifySubstantiveChanges(
    approvedBaseline,
    proposedPublicSnapshot,
  );
  const alreadyPublic = property.statusAdmin === 'Validée' && property.isPublished === true;
  let submittedRevision = null;
  if (substantiveChanges.length && alreadyPublic) {
    const revision = await createPendingRevision({ resourceType: 'Property', resource: property, proposedSnapshot: proposedPublicSnapshot, actor: req.user });
    submittedRevision = revision;
    updateData.statusAdmin = 'En attente';
    updateData.isPublished = false;
    updateData.publicationLifecycleState = 'change_pending';
    updateData.currentPublicationRevision = revision._id;
    updateData.publicationLifecycleHistory = [
      ...(property.publicationLifecycleHistory || []).map((entry) => entry.toObject ? entry.toObject() : entry),
      {
        from: 'published', to: 'change_pending', action: 'content_change_submitted',
        actor: req.user._id || req.user.id, reason: 'Modification substantielle soumise à une nouvelle approbation.',
      },
    ];
  } else if (!alreadyPublic) {
    updateData.statusAdmin = 'En attente';
    updateData.isPublished = false;
  }

  const linkedPublishedHotel = !isAdmin
    ? await Hotel.exists({ property: property._id, publicationStatus: 'publie' })
    : null;
  const updatedProperty = isAdmin || !linkedPublishedHotel
    ? await Property.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true },
    )
    : (await updateOwnerPropertyAndQueueLinkedHotel({
      propertyId: property._id,
      updateData,
      actorId: req.user.id,
    })).property;

  if (substantiveChanges.length && !alreadyPublic) {
    submittedRevision = await createPendingRevision({ resourceType: 'Property', resource: updatedProperty, proposedSnapshot: publicSnapshot(updatedProperty), actor: req.user });
  }

  if (submittedRevision) emitPropertyLifecycleNotification({ event: 'changed', property: updatedProperty, actor: req.user, transitionKey: String(submittedRevision._id) });

  res.status(200).json({
    status: 'success',
    data: { property: updatedProperty },
  });

  logAction({
    action: 'Bien immobilier modifié',
    description: `Bien "${updatedProperty?.title}" mis à jour`,
    module: 'Altimmo',
    typeAction: 'MODIFICATION',
    auteur: buildAuteur(req.user),
    cible: { id: String(req.params.id), type: 'Property', nom: updatedProperty?.title },
    req,
  });
});

/**
 * @description Valider ou Rejeter une propriété (ADMIN)
 * @route PATCH /api/properties/:id/:action
 */
const updatePropertyStatus = asyncHandler(async (req, res) => {
  const { id, action } = req.params;
  let newStatusAdmin;

  if (action === 'validate')    newStatusAdmin = 'Validée';
  else if (action === 'reject') newStatusAdmin = 'Rejetée';
  else {
    res.status(400);
    throw new Error('Action invalide (validate ou reject attendu).');
  }

  const target = await Property.findById(id);
  if (!target) {
    res.status(404);
    throw new Error('Propriété non trouvée.');
  }
  // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-G — modération TENANT stricte :
  // Property.tenant === req.platformTenant._id. La règle canonique refuse
  // toute ressource attribuée à un AUTRE tenant. La règle "unresolved =
  // allow" du helper canonique reste utile ailleurs, mais la modération
  // exige une attribution positive.
  const platformModeration = req.isPlatformOperatorContext === true;
  if (!platformModeration && (!target.tenant || !req.platformTenant?._id
      || String(target.tenant) !== String(req.platformTenant._id))) {
    res.status(403);
    throw new Error('Cette propriété n\'appartient pas au tenant sélectionné.');
  }
  const tenant = req.platformTenant || (target.tenant ? { _id: target.tenant } : null);

  // GIT-INTEGRATION-03A — la décision passe par une révision commerciale
  // versionnée (autorité `platform.commercial.manage` revérifiée dans la
  // transaction de décision). La garde tenant ci-dessus reste une seconde barrière.
  // Seules les annonces classiques (vente/location) sont publiées par cette
  // décision : les hébergements gardent leur cycle spécialisé (règle de main).
  const classicListing = ['vente', 'location'].includes(target.status);
  let revision = await CommercialPublicationRevision.findOne({ resourceType: 'Property', resource: target._id, status: 'pending' }).sort('-createdAt');
  if (!revision) {
    const freshTarget = await Property.findById(id);
    const initialSubmission = freshTarget
      && freshTarget.availability === 'Disponible'
      && ['pending', null].includes(freshTarget.publicationLifecycleState ?? null)
      && !freshTarget.currentPublicationRevision;
    if (!initialSubmission) {
      throw new CommercialPublicationError('PUBLICATION_REVISION_STALE', 'Aucune révision courante admissible à décider.', 409);
    }
    revision = await createPendingRevision({ resourceType: 'Property', resource: freshTarget, proposedSnapshot: publicSnapshot(freshTarget), actor: freshTarget.owner });
    const linked = await Property.updateOne({
      _id: freshTarget._id,
      availability: 'Disponible',
      currentPublicationRevision: null,
      $or: [{ publicationLifecycleState: 'pending' }, { publicationLifecycleState: null }, { publicationLifecycleState: { $exists: false } }],
    }, {
      $set: { currentPublicationRevision: revision._id, publicationLifecycleState: 'pending', isPublished: false },
    });
    if (linked.modifiedCount !== 1) {
      await CommercialPublicationRevision.updateOne({ _id: revision._id, status: 'pending' }, { $set: { status: 'superseded' } });
      throw new CommercialPublicationError('PUBLICATION_REVISION_STALE', 'Le cycle de publication a changé pendant la décision.', 409);
    }
  }
  const reason = String(req.body.reason || (action === 'validate' ? 'Approbation commerciale Altitude Vision' : '')).trim();
  await decideRevision({
    revisionId: revision._id,
    decision: action === 'validate' ? 'approve' : 'reject',
    actor: req.user,
    reason,
    adapter: {
      model: Property,
      buildPromotionFilter: (decidedRevision) => ({
        currentPublicationRevision: decidedRevision._id,
        publicationLifecycleState: { $in: ['pending', 'change_pending'] },
        availability: 'Disponible',
      }),
      buildPromotionUpdate: (approved, decidedRevision) => ({
        $set: { approvedPublicSnapshot: approved, currentPublicationRevision: decidedRevision._id, statusAdmin: 'Validée', reviewedAt: new Date(), publicationLifecycleState: 'published', ...(classicListing ? { isPublished: true } : {}) },
        $push: { publicationLifecycleHistory: { from: target.publicationLifecycleState || 'pending', to: 'published', action: 'commercial_revision_approved', actor: req.user._id || req.user.id, reason } },
        $inc: { commercialPublicationVersion: 1 },
      }),
    },
  });
  if (action === 'reject') {
    await Property.updateOne({ _id: id }, {
      $set: { statusAdmin: 'Rejetée', reviewedAt: new Date(), publicationLifecycleState: 'rejected', isPublished: false },
      $push: { publicationLifecycleHistory: { from: target.publicationLifecycleState || 'pending', to: 'rejected', action: 'commercial_revision_rejected', actor: req.user._id || req.user.id, reason } },
    });
  }
  const updatedProperty = await Property.findById(id);

  if (!updatedProperty) {
    res.status(404);
    throw new Error('Propriété non trouvée.');
  }

  res.status(200).json({
    status: 'success',
    message: `Propriété ${newStatusAdmin.toLowerCase()}.`,
    data: { property: updatedProperty },
  });

  emitPropertyLifecycleNotification({
    event: action === 'validate' ? 'approved' : 'rejected',
    property: updatedProperty,
    actor: req.user,
    reason,
    transitionKey: String(revision._id),
  });

  // Broadcast uniquement si le bien est réellement public. Validation et
  // publication sont deux états distincts dans le modèle Property.
  if (newStatusAdmin === 'Validée' && updatedProperty.isPublished === true && tenant) {
    try {
      const { scopeUserIds } = await resolveTenantScope(tenant._id);
      const allUsers = await User.find({
        _id: { $in: Array.from(scopeUserIds || []) },
        status: { $nin: ['Suspendu', 'Banni'] },
      }).select('_id').lean();

      const propertyTitle = updatedProperty.title || 'Nouveau bien disponible';
      const ville = updatedProperty.address?.city || '';
      const prix  = updatedProperty.price
        ? `${updatedProperty.price.toLocaleString('fr-FR')} FCFA`
        : '';

      notifyMany(
        allUsers.map(u => u._id),
        {
          type:  'new_property',
          title: '🏠 Nouveau bien disponible !',
          body:  [propertyTitle, ville, prix].filter(Boolean).join(' · '),
          data:  { screen: 'DetailAnnonce', params: { id: updatedProperty._id.toString() } },
          platformTenantId: tenant._id,
        },
      ).catch(() => {});
    } catch (err) {
      logger.error('❌ [notify] Broadcast new_property échoué:', err.message);
    }
  }

  logAction({
    action: action === 'validate' ? 'Bien validé' : 'Bien rejeté',
    description: `Bien "${updatedProperty.title}" ${newStatusAdmin.toLowerCase()} par l'admin`,
    module: 'Altimmo',
    typeAction: action === 'validate' ? 'VALIDATION' : 'REJET',
    auteur: buildAuteur(req.user),
    cible: { id: String(id), type: 'Property', nom: updatedProperty.title },
    req,
  });
});

const updatePropertyLifecycle = asyncHandler(async (req, res) => {
  const property = await ownerWithdrawProperty({
    propertyId: req.params.id,
    actor: req.user,
    availability: req.body.availability,
    reason: req.body.reason,
  });
  const event = ({ Loué: 'rented', Vendu: 'sold', Indisponible: 'unavailable', Retiré: 'withdrawn' })[property.availability];
  const transition = property.publicationLifecycleHistory?.at(-1);
  emitPropertyLifecycleNotification({ event, property, actor: req.user, reason: req.body.reason, transitionKey: String(transition?._id || property.updatedAt) });
  res.status(200).json({ status: 'success', data: { property } });
});

const requestPropertyReactivation = asyncHandler(async (req, res) => {
  const result = await ownerRequestReactivation({
    propertyId: req.params.id, actor: req.user, reason: req.body.reason,
  });
  emitPropertyLifecycleNotification({ event: 'reactivation_requested', property: result.property, actor: req.user, reason: req.body.reason, transitionKey: String(result.revision._id) });
  res.status(202).json({ status: 'success', data: result });
});

const requestPropertySuspensionReview = asyncHandler(async (req, res) => {
  const property = await ownerRequestSuspensionReview({
    propertyId: req.params.id, actor: req.user, reason: req.body.reason,
  });
  const transition = property.publicationLifecycleHistory?.at(-1);
  emitPropertyLifecycleNotification({ event: 'suspension_review_requested', property, actor: req.user, reason: req.body.reason, transitionKey: String(transition?._id || property.updatedAt) });
  res.status(202).json({ status: 'success', data: { property } });
});

const suspendPropertyPublication = asyncHandler(async (req, res) => {
  const property = await adminSuspendProperty({
    propertyId: req.params.id, actor: req.user, reason: req.body.reason,
  });
  const transition = property.publicationLifecycleHistory?.at(-1);
  emitPropertyLifecycleNotification({ event: 'admin_suspended', property, actor: req.user, reason: req.body.reason, transitionKey: String(transition?._id || property.updatedAt) });
  res.status(200).json({ status: 'success', data: { property } });
});

const liftPropertyPublicationSuspension = asyncHandler(async (req, res) => {
  const result = await adminLiftSuspension({
    propertyId: req.params.id, actor: req.user, reason: req.body.reason,
  });
  emitPropertyLifecycleNotification({ event: 'suspension_lifted', property: result.property, actor: req.user, reason: req.body.reason, transitionKey: String(result.revision._id) });
  res.status(202).json({ status: 'success', data: result });
});

/**
 * @description Supprimer une propriété
 * @route DELETE /api/properties/:id
 */
const deleteProperty = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) {
    res.status(404);
    throw new Error('Propriété non trouvée.');
  }

  // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-G — même contrat que
  // updateProperty (voir commentaire équivalent ci-dessus) : le bypass
  // `req.user.role === 'Admin'` est retiré. L'autorité TENANT vient
  // exclusivement d'une OrgMembership active + businessRole canonique.
  const isOwner = property.owner && property.owner.toString() === req.user.id.toString();
  const TENANT_STAFF_MUTATE_ROLES = new Set(['Admin', 'GestionnaireImmobilier']);
  const isTenantStaff = Boolean(
    req.tenantBusinessRole
    && TENANT_STAFF_MUTATE_ROLES.has(req.tenantBusinessRole)
    && req.platformTenant?._id,
  );
  if (!isOwner && !isTenantStaff) {
    res.status(403);
    throw new Error('Vous ne pouvez supprimer que vos propres biens.');
  }
  if (isTenantStaff && !isOwner) {
    if (!property.tenant || String(property.tenant) !== String(req.platformTenant._id)) {
      res.status(403);
      throw new Error('Ce bien n\'appartient pas au tenant sélectionné.');
    }
    await assertPropertyTenantAccess(req, res, property);
  }

  const [transaction, contract] = await Promise.all([
    Transaction.exists({ property: property._id }),
    Contrat.exists({ bien: property._id }),
  ]);
  if (transaction || contract || property.hasReservationHistory) {
    res.status(409);
    throw new Error('Ce bien possède un historique transactionnel ou contractuel et doit être archivé, pas supprimé.');
  }

  await Property.findByIdAndDelete(req.params.id);
  res.status(204).json({ status: 'success', data: null });

  logAction({
    action: 'Bien immobilier supprimé',
    description: `Bien "${property.title}" supprimé`,
    module: 'Altimmo',
    typeAction: 'SUPPRESSION',
    auteur: buildAuteur(req.user),
    cible: { id: String(property._id), type: 'Property', nom: property.title },
    req,
  });
});

/**
 * @description Supprimer une propriété (Admin)
 * @route DELETE /api/properties/admin/:id
 */
const adminDeleteProperty = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) {
    res.status(404);
    throw new Error('Propriété non trouvée.');
  }
  // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-G — same strict tenant
  // attribution as updatePropertyStatus. Personal properties (tenant=null)
  // are OUT of tenant admin moderation reach.
  if (!property.tenant || !req.platformTenant?._id
      || String(property.tenant) !== String(req.platformTenant._id)) {
    res.status(403);
    throw new Error('Cette propriété n\'appartient pas au tenant sélectionné.');
  }
  if (property.hasReservationHistory) {
    res.status(409);
    throw new Error('Ce bien possède un historique de réservation et ne peut pas être supprimé physiquement.');
  }
  await property.deleteOne();
  res.status(204).json({ status: 'success', data: null });

  logAction({
    action: 'Bien supprimé (admin)',
    description: `Bien "${property.title}" supprimé par un administrateur`,
    module: 'Altimmo',
    typeAction: 'SUPPRESSION',
    auteur: buildAuteur(req.user),
    cible: { id: String(property._id), type: 'Property', nom: property.title },
    req,
  });
});

/**
 * @description Marquer / démarquer un bien comme recommandé (Admin)
 * @route PATCH /api/properties/:id/recommande
 */
const setRecommande = asyncHandler(async (req, res) => {
  const target = await Property.findById(req.params.id);
  if (!target) {
    res.status(404);
    throw new Error('Propriété non trouvée.');
  }
  // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-G — la vitrine globale
  // Altimmo (GET /recommended, PUBLIC, cross-tenant) est une décision
  // PLATFORM, jamais tenant : le routeur exige désormais
  // `requirePlatformOperatorCapability('platform.properties.manage')`.
  // Aucun `assertPropertyTenantAccess` — l'opération porte volontairement
  // sur le catalogue global. `Property.tenant` et `Property.owner` restent
  // inchangés (patch limité à `recommande`).

  const property = await Property.findByIdAndUpdate(
    req.params.id,
    { recommande: !!req.body.recommande },
    { new: true, runValidators: true }
  );

  if (!property) {
    res.status(404);
    throw new Error('Propriété non trouvée.');
  }

  res.status(200).json({
    status: 'success',
    data: { property },
  });
});

/**
 * @description Liste des biens recommandés (validés uniquement)
 * @route GET /api/properties/recommended
 */
const getRecommendedProperties = asyncHandler(async (req, res) => {
  // `pole: 'Altimmo'` — cohérent avec `getAllProperties` (audit filtrage Altimmo) : sans ce
  // filtre, un bien MilaEvents/Altcom marqué `recommande:true` pourrait apparaître sur les
  // pages de recommandation Altimmo.
  const publicFilter = { ...commerciallyPublishedMongoFilter(), pole: 'Altimmo' };

  let properties = await Property.find({
    ...publicFilter,
    recommande: true,
  })
    .sort('-updatedAt')
    .limit(10);

  // Fallback : si aucun bien n'est marqué recommandé par l'admin,
  // affiche automatiquement les 10 biens les plus chers
  let isFallback = false;
  if (properties.length === 0) {
    properties = await Property.find(publicFilter)
      .sort('-price')
      .limit(10);
    isFallback = true;
  }

  properties = await decoratePublicHotelProperties(properties);
  properties = properties.map(projectApprovedPublicResource);

  res.status(200).json({
    status: 'success',
    results: properties.length,
    data: { properties, isFallback },
  });
});

// ============================================================
// 📤 EXPORTS
// ============================================================
module.exports = {
  createProperty,
  getAllProperties,
  runPropertySearch,
  getPendingProperties,
  getPendingPropertiesCount,
  getLatestProperties,
  getProperty,
  getMyProperties,
  updateProperty,
  updatePropertyStatus,
  updatePropertyLifecycle,
  requestPropertyReactivation,
  requestPropertySuspensionReview,
  suspendPropertyPublication,
  liftPropertyPublicationSuspension,
  deleteProperty,
  adminDeleteProperty,
  setRecommande,
  getRecommendedProperties,
  toggleLike,
  incrementShare,
  addPropertyReview,
  serializeSalePublic,
  serializeRentalPublic,
};
