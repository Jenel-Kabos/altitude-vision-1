// GL-ARCH-1.1 — Import staff d'un Proprietaire.biensPropres[] (fiche interne
// historique, sans document Property réel) vers un vrai Property + un
// RentalManagement actif, pour permettre au staff de créer un bail dessus.
// Règle métier validée explicitement pour cette mission :
//   1. Si la fiche Proprietaire a déjà un User lié (Proprietaire.user), on
//      l'utilise comme Property.owner — sans jamais transformer ses autres
//      annonces personnelles en biens gérés.
//   2. Sinon, on crée un User technique minimal et inactif (isTechnical:true,
//      isActive:false, mot de passe aléatoire jamais communiqué), lié
//      explicitement à la fiche Proprietaire (Proprietaire.user). Jamais de
//      doublon : idempotent par construction (voir resolveOwnerUser).
//   3. Aucune donnée métier n'est devinée : les champs Property obligatoires
//      absents de biensPropres[] (arrondissement, latitude/longitude, prix,
//      surface, images, description) doivent être fournis explicitement par
//      le staff via `overrides` ; sinon 422 avec la liste précise.
const crypto = require('crypto');
const mongoose = require('mongoose');
const Proprietaire = require('../models/Proprietaire');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const User = require('../models/User');
const { logAction, buildAuteur } = require('./actionLogService');

class ImportError extends Error {
  constructor(message, statusCode, code, extra = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.assign(this, extra);
  }
}

const AVAILABILITY_MAP = { Disponible: 'Disponible', Loué: 'Loué', Réservé: 'Réservé' };

const buildSourceKey = (proprietaireId, bienId) => `${proprietaireId}:${bienId}`;

/**
 * Étape 1 (règle validée) : résout le User qui deviendra Property.owner.
 * Jamais le compte du staff qui importe, jamais un User choisi
 * arbitrairement — uniquement celui déjà lié à la fiche Proprietaire, ou un
 * User technique créé et lié pour l'occasion. Idempotent sous concurrence :
 * l'email synthétique déterministe fait échouer (E11000) toute création
 * concurrente en double, et la liaison `Proprietaire.user` se fait par
 * compare-and-swap (`user: null` dans le filtre).
 */
async function resolveOwnerUser(proprietaire) {
  if (proprietaire.user) {
    const existing = await User.findById(proprietaire.user);
    if (!existing) {
      throw new ImportError('Le compte lié à ce propriétaire est introuvable.', 409, 'ANOMALY_LINKED_USER_MISSING');
    }
    return { user: existing, created: false };
  }

  const technicalEmail = `proprietaire-${proprietaire._id}@technique.interne.altitudevision.local`;
  let technicalUser;
  const randomPassword = crypto.randomBytes(32).toString('hex');
  try {
    technicalUser = await User.create({
      name: `${proprietaire.prenom} ${proprietaire.nom}`.trim(),
      email: technicalEmail,
      phone: proprietaire.telephone || null,
      role: 'Proprietaire',
      password: randomPassword,
      passwordConfirm: randomPassword,
      isActive: false,
      isTechnical: true,
    });
  } catch (error) {
    if (error?.code === 11000) {
      technicalUser = await User.findOne({ email: technicalEmail });
      if (!technicalUser) throw error;
    } else {
      throw error;
    }
  }

  const linked = await Proprietaire.findOneAndUpdate(
    { _id: proprietaire._id, user: null },
    { $set: { user: technicalUser._id } },
    { new: true },
  );

  if (!linked) {
    // Un import concurrent a gagné la course entre-temps : on abandonne
    // notre User technique (jamais référencé nulle part) et on réutilise
    // celui déjà lié — aucun doublon ne survit.
    const winner = await Proprietaire.findById(proprietaire._id).select('user');
    if (String(winner.user) !== String(technicalUser._id)) {
      await User.deleteOne({ _id: technicalUser._id, isTechnical: true, isActive: false });
      const winnerUser = await User.findById(winner.user);
      return { user: winnerUser, created: false };
    }
  }

  return { user: technicalUser, created: true };
}

const REQUIRED_FIELDS = ['title', 'description', 'type', 'arrondissement', 'city', 'latitude', 'longitude', 'images', 'surface', 'price'];

function buildCandidateFields(bien, overrides = {}) {
  const images = overrides.images && overrides.images.length ? overrides.images
    : (bien.photos || []).filter(Boolean);
  return {
    title: overrides.title || bien.titre || '',
    description: overrides.description || bien.description || '',
    type: overrides.type || bien.type || '',
    arrondissement: overrides.address?.arrondissement || overrides.arrondissement || '',
    neighborhood: overrides.address?.neighborhood || bien.quartier || '',
    city: overrides.address?.city || bien.ville || '',
    street: bien.adresse || '',
    latitude: overrides.latitude ?? null,
    longitude: overrides.longitude ?? null,
    images,
    surface: overrides.surface ?? bien.superficie ?? null,
    price: overrides.price ?? bien.prixLoyer ?? null,
    bedrooms: overrides.bedrooms ?? bien.nombreChambres ?? 0,
    bathrooms: overrides.bathrooms ?? bien.nombreSDB ?? 0,
    availability: AVAILABILITY_MAP[bien.statut] || 'Disponible',
  };
}

// `latitude`/`longitude` sont des coordonnées géographiques : négatives et
// légitimement présentes (Brazzaville ≈ -4.26 / 15.28) — seule leur absence
// est une anomalie, jamais leur signe. `surface`/`price` doivent en revanche
// être strictement positifs (une valeur ≤ 0 n'a aucun sens métier).
const STRICTLY_POSITIVE_FIELDS = new Set(['surface', 'price']);
const FINITE_NUMBER_FIELDS = new Set(['latitude', 'longitude']);

function findMissingFields(candidate) {
  return REQUIRED_FIELDS.filter((field) => {
    const value = candidate[field];
    if (field === 'images') return !Array.isArray(value) || value.length === 0;
    if (FINITE_NUMBER_FIELDS.has(field)) return typeof value !== 'number' || !Number.isFinite(value);
    if (STRICTLY_POSITIVE_FIELDS.has(field)) return !(typeof value === 'number' && value > 0);
    return value === null || value === undefined || value === '';
  });
}

async function findExistingImport(sourceOwnerAssetId) {
  const property = await Property.findOne({ sourceOwnerAssetId });
  if (!property) return null;
  const rental = await RentalManagement.findOneAndUpdate(
    { property: property._id },
    { $setOnInsert: { property: property._id, owner: property.owner }, $set: { managementActivated: true } },
    { new: true, upsert: true, runValidators: true },
  );
  return { property, rentalManagement: rental, alreadyImported: true };
}

/**
 * Point d'entrée. `bienIndex` suit la même convention que le reste de
 * proprietaireController.js (addBienPhotos, updateBien, deleteBien : index
 * dans le tableau, pas `_id`) et que GestionLocativePage.jsx côté frontend
 * (`propBiens.map((b, i) => ...)`). La clé de dédoublonnage stable
 * (sourceOwnerAssetId) utilise en interne le vrai `_id` du sous-document
 * (bienSchema a `_id: true`), jamais l'index — robuste même si le tableau
 * est réordonné après import. `overrides` complète les champs Property
 * obligatoires absents de la fiche biensPropres[] (jamais devinés
 * silencieusement).
 */
async function importBienPropreVersGestion({ proprietaireId, bienIndex, overrides = {}, actor }) {
  if (!mongoose.isValidObjectId(proprietaireId)) {
    throw new ImportError('Identifiant invalide.', 400, 'INVALID_ID');
  }
  const actorId = actor?._id || actor?.id || actor;

  const proprietaire = await Proprietaire.findById(proprietaireId);
  if (!proprietaire) throw new ImportError('Propriétaire introuvable.', 404, 'PROPRIETAIRE_NOT_FOUND');
  const idx = Number.parseInt(bienIndex, 10);
  const bien = Number.isInteger(idx) ? proprietaire.biensPropres[idx] : null;
  if (!bien) throw new ImportError('Bien introuvable pour ce propriétaire.', 404, 'BIEN_NOT_FOUND');

  const sourceOwnerAssetId = buildSourceKey(proprietaireId, bien._id);
  const existing = await findExistingImport(sourceOwnerAssetId);
  if (existing) return existing;

  if (bien.typeBien !== 'location') {
    throw new ImportError(
      'Ce bien est déclaré à la vente : son import direct en Gestion locative (location) n’est pas pris en charge.',
      422, 'WRONG_TRANSACTION_TYPE',
    );
  }

  const candidate = buildCandidateFields(bien, overrides);
  const missingFields = findMissingFields(candidate);
  if (missingFields.length) {
    throw new ImportError('Des champs obligatoires sont manquants pour créer ce bien.', 422, 'INCOMPLETE_SOURCE_BIEN', { missingFields });
  }

  const { user: ownerUser, created: ownerUserCreated } = await resolveOwnerUser(proprietaire);

  let property;
  try {
    property = await Property.create({
      title: candidate.title,
      pole: 'Altimmo',
      description: candidate.description,
      type: candidate.type,
      status: 'location',
      price: candidate.price,
      address: { street: candidate.street, neighborhood: candidate.neighborhood, arrondissement: candidate.arrondissement, city: candidate.city },
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      images: candidate.images,
      surface: candidate.surface,
      bedrooms: candidate.bedrooms,
      bathrooms: candidate.bathrooms,
      availability: candidate.availability,
      owner: ownerUser._id,
      statusAdmin: 'En attente',
      isPublished: false,
      sourceType: 'proprietaire_bien_propre',
      sourceOwnerAssetId,
    });
  } catch (error) {
    if (error?.code === 11000) {
      // Import concurrent (double clic) ayant gagné la course entre notre
      // vérification initiale et cette écriture — jamais de doublon.
      const winner = await findExistingImport(sourceOwnerAssetId);
      if (winner) return winner;
    }
    throw error;
  }

  let rentalManagement;
  try {
    rentalManagement = await RentalManagement.create({
      property: property._id,
      owner: ownerUser._id,
      manager: actorId,
      managementActivated: true,
      monthlyRent: candidate.price,
      occupancyStatus: 'vacant',
      availabilityStatus: 'disponible',
    });
  } catch (error) {
    // Compensation (pattern déjà utilisé par propertyTransactionService) :
    // ne jamais laisser un Property orphelin sans RentalManagement si
    // l'activation échoue. Le User (technique ou existant) n'est jamais
    // supprimé : il peut légitimement être réutilisé pour un futur import.
    await Property.deleteOne({ _id: property._id });
    throw error;
  }

  logAction({
    action: 'Bien propre importé en Gestion locative',
    description: `Bien "${property.title}" importé depuis la fiche propriétaire ${proprietaire.prenom} ${proprietaire.nom} vers la Gestion locative`,
    module: 'GestionLocative',
    typeAction: 'CRÉATION',
    auteur: buildAuteur(actor),
    cible: { id: String(property._id), type: 'Property', nom: property.title },
    metadata: {
      proprietaireId: String(proprietaireId), bienId: String(bien._id), bienIndex: idx, rentalManagementId: String(rentalManagement._id),
      ownerUserId: String(ownerUser._id), ownerUserCreated, ownerUserActive: ownerUser.isActive,
    },
  }).catch(() => {});

  return { property, rentalManagement, ownerUser, ownerUserCreated, alreadyImported: false };
}

module.exports = { importBienPropreVersGestion, ImportError };
