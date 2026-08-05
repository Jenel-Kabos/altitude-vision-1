const mongoose = require('mongoose');
const crypto = require('crypto');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const User = require('../models/User');
const Proprietaire = require('../models/Proprietaire');
const Contrat = require('../models/Contrat');
const sync = require('./rentalListingSyncService');
const { logAction, buildAuteur } = require('./actionLogService');

class OnboardingError extends Error {
  constructor(message, statusCode = 422, code = 'ONBOARDING_ERROR', missingFields = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.missingFields = missingFields;
  }
}

const serializeCreatedRental = (rental, property) => ({
  ...rental.toObject(),
  property: property.toObject ? property.toObject() : property,
  displayStatus: 'Vacant',
  allowedActions: sync.allowedActionsFor(rental),
});

const normalize = value => String(value || '').trim().toLocaleLowerCase('fr');
const optionBase = ({ id, sourceType, proprietaire, ownerUserId, title, address, city, type, eligibility, reason }) => ({
  id: String(id), sourceType, proprietaireId: String(proprietaire._id),
  ownerUserId: ownerUserId ? String(ownerUserId) : null, title, address, city, type, eligibility, reason,
  proprietaireName: `${proprietaire.prenom} ${proprietaire.nom}`.trim(),
});

async function getOptions() {
  // La fiche métier Proprietaire est le point de départ. Un User portant
  // simplement le rôle Proprietaire n'accorde aucune éligibilité.
  const proprietaires = await Proprietaire.find({}).select('nom prenom email telephone ville user biensPropres').sort({ nom: 1, prenom: 1 }).lean();
  const linkedUserIds = proprietaires.map(p => p.user).filter(Boolean);
  const properties = linkedUserIds.length
    ? await Property.find({ owner: { $in: linkedUserIds } }).sort({ createdAt: -1 }).lean()
    : [];
  const propertyIds = properties.map(p => p._id);
  const [rentals, contracts, imported] = await Promise.all([
    RentalManagement.find({ property: { $in: propertyIds }, managementActivated: true }).select('property').lean(),
    Contrat.find({ bien: { $in: propertyIds }, type: 'location', statut: { $in: ['en_attente', 'actif'] } }).select('bien statut').lean(),
    Property.find({ sourceOwnerAssetId: { $exists: true, $ne: null } }).select('sourceOwnerAssetId owner title address').lean(),
  ]);
  const activeRentalIds = new Set(rentals.map(r => String(r.property)));
  const activeContractIds = new Set(contracts.map(c => String(c.bien)));
  const importedSourceKeys = new Set(imported.map(p => p.sourceOwnerAssetId));
  const byUser = new Map(proprietaires.filter(p => p.user).map(p => [String(p.user), p]));
  const existingEligibleProperties = [];
  const ineligibleProperties = [];

  for (const property of properties) {
    const proprietaire = byUser.get(String(property.owner));
    if (!proprietaire) continue;
    let reason = null;
    if (activeRentalIds.has(String(property._id))) reason = 'déjà sous gestion';
    else if (activeContractIds.has(String(property._id))) reason = 'contrat actif';
    else if (property.availability === 'Vendu' || property.assetCycle === 'vendu') reason = 'vendu';
    else if (property.availability === 'Retiré') reason = 'retiré';
    else if (property.assetCycle === 'archive') reason = 'archivé';
    else if (property.status !== 'location') reason = 'type incompatible';
    const row = {
      ...optionBase({ id: property._id, sourceType: 'property', proprietaire, ownerUserId: property.owner,
        title: property.title, address: property.address?.street || '', city: property.address?.city || '',
        type: property.type, eligibility: !reason, reason }),
      propertyId: String(property._id), price: property.price, availability: property.availability,
      isPublished: !!property.isPublished, statusAdmin: property.statusAdmin,
    };
    (reason ? ineligibleProperties : existingEligibleProperties).push(row);
  }

  const declaredOwnerAssets = [];
  for (const proprietaire of proprietaires) {
    for (const [bienIndex, bien] of (proprietaire.biensPropres || []).entries()) {
      const sourceKey = `${proprietaire._id}:${bien._id}`;
      if (importedSourceKeys.has(sourceKey)) continue;
      const reliableDuplicate = properties.some(p => String(p.owner) === String(proprietaire.user)
        && normalize(p.title) === normalize(bien.titre)
        && normalize(p.address?.street) === normalize(bien.adresse)
        && normalize(p.address?.city) === normalize(bien.ville));
      const reason = bien.typeBien !== 'location' ? 'type incompatible' : reliableDuplicate ? 'doublon probable' : null;
      const row = {
        ...optionBase({ id: bien._id, sourceType: 'proprietaire_bien_propre', proprietaire,
          ownerUserId: proprietaire.user, title: bien.titre, address: bien.adresse, city: bien.ville,
          type: bien.type, eligibility: !reason, reason }),
        bienIndex, sourceOwnerAssetId: sourceKey, neighborhood: bien.quartier || '',
        description: bien.description || '', photos: bien.photos || [], surface: bien.superficie,
        price: bien.prixLoyer, bedrooms: bien.nombreChambres, bathrooms: bien.nombreSDB,
      };
      if (reason) ineligibleProperties.push(row); else declaredOwnerAssets.push(row);
    }
  }

  const owners = proprietaires.filter(p => p.user).map(p => ({
    _id: String(p.user), proprietaireId: String(p._id), name: `${p.prenom} ${p.nom}`.trim(), email: p.email, phone: p.telephone,
  }));
  return { existingEligibleProperties, declaredOwnerAssets, ineligibleProperties, owners };
}

async function validateOwner(ownerId) {
  if (!mongoose.isValidObjectId(ownerId)) throw new OnboardingError('Le propriétaire métier est obligatoire.', 422, 'OWNER_REQUIRED', ['owner']);
  const owner = await User.findOne({ _id: ownerId, role: 'Proprietaire' });
  if (!owner) throw new OnboardingError('Le propriétaire métier sélectionné est invalide.', 422, 'OWNER_INVALID', ['owner']);
  return owner;
}

async function validateManagementOwner(ownerId) {
  const owner = await validateOwner(ownerId);
  const proprietaire = await Proprietaire.findOne({ user: owner._id }).select('_id');
  if (!proprietaire) throw new OnboardingError('Ce compte ne correspond pas à un propriétaire de la Gestion locative.', 422, 'MANAGEMENT_OWNER_REQUIRED', ['owner']);
  return owner;
}

function assertEligible(property) {
  if (!property) throw new OnboardingError('Bien introuvable.', 404, 'PROPERTY_NOT_FOUND');
  if (property.status !== 'location') throw new OnboardingError('Seul un bien en location peut être ajouté à la Gestion locative.', 422, 'PROPERTY_INCOMPATIBLE');
  if (property.availability === 'Vendu' || property.assetCycle === 'vendu') throw new OnboardingError('Un bien vendu ne peut pas être ajouté à la Gestion locative.', 422, 'PROPERTY_SOLD');
  if (property.availability === 'Retiré' || property.assetCycle === 'archive') throw new OnboardingError('Un bien archivé définitivement ne peut pas être ajouté à la Gestion locative.', 422, 'PROPERTY_ARCHIVED');
  if (!property.owner) throw new OnboardingError('Le propriétaire métier du bien est introuvable.', 422, 'OWNER_REQUIRED', ['owner']);
}

async function activateExisting({ propertyId, actor }) {
  if (!mongoose.isValidObjectId(propertyId)) throw new OnboardingError('Un Property valide est obligatoire.', 422, 'PROPERTY_REQUIRED', ['property']);
  const property = await Property.findById(propertyId);
  assertEligible(property);
  await validateManagementOwner(property.owner);

  const existing = await RentalManagement.findOne({ property: property._id });
  if (existing?.managementActivated) throw new OnboardingError('Ce bien est déjà sous gestion.', 409, 'ALREADY_MANAGED');

  let rental;
  try { rental = await RentalManagement.findOneAndUpdate(
    { property: property._id, managementActivated: { $ne: true } },
    {
      $setOnInsert: { property: property._id },
      $set: {
        owner: property.owner, manager: actor.id || actor._id, managementActivated: true, active: true,
        monthlyRent: property.price, occupancyStatus: 'vacant', publicationStatus: 'brouillon',
        publicationAuthorized: false,
      },
      $push: { workflowHistory: { action: 'rental_management_onboarded', actor: actor.id || actor._id, source: 'staff', to: 'vacant' } },
    },
    { new: true, upsert: !existing, runValidators: true },
  ); } catch (error) {
    if (error?.code === 11000) throw new OnboardingError('Ce bien est déjà sous gestion.', 409, 'ALREADY_MANAGED');
    throw error;
  }
  if (!rental) throw new OnboardingError('Ce bien est déjà sous gestion.', 409, 'ALREADY_MANAGED');
  sync.refreshReadiness(rental, property);
  await rental.save();
  await logAction({ action: 'Bien ajouté à la Gestion locative', description: `Activation explicite de « ${property.title} »`, module: 'GestionLocative', typeAction: 'CRÉATION', auteur: buildAuteur(actor), cible: { id: String(property._id), type: 'Property', nom: property.title } }).catch(() => {});
  return { property, rental: serializeCreatedRental(rental, property) };
}

const requiredNewFields = ['owner', 'title', 'type', 'street', 'city', 'arrondissement', 'monthlyRent', 'surface', 'latitude', 'longitude'];

async function createManaged({ data, actor }) {
  const missingFields = requiredNewFields.filter((field) => data[field] === undefined || data[field] === null || String(data[field]).trim() === '');
  if (missingFields.length) throw new OnboardingError('Des champs obligatoires sont manquants.', 422, 'VALIDATION_ERROR', missingFields);
  const owner = await validateManagementOwner(data.owner);
  const monthlyRent = Number(data.monthlyRent);
  const surface = Number(data.surface);
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  if (!(monthlyRent > 0)) throw new OnboardingError('Le loyer mensuel doit être supérieur à zéro.', 422, 'VALIDATION_ERROR', ['monthlyRent']);
  if (!(surface > 0) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new OnboardingError('La surface et les coordonnées sont invalides.', 422, 'VALIDATION_ERROR', ['surface', 'latitude', 'longitude']);

  const plausible = await Property.findOne({
    owner: owner._id, status: 'location',
    title: new RegExp(`^${String(data.title).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    'address.city': new RegExp(`^${String(data.city).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    'address.street': new RegExp(`^${String(data.street).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  }).select('_id');
  if (plausible) throw new OnboardingError('Un bien similaire existe déjà pour ce propriétaire.', 409, 'PLAUSIBLE_DUPLICATE');
  const onboardingFingerprint = crypto.createHash('sha256').update([
    owner._id, data.title, data.city, data.street,
  ].map(value => String(value).trim().toLocaleLowerCase('fr')).join('|')).digest('hex');

  let property;
  try {
    property = await Property.create({
      owner: owner._id, title: String(data.title).trim(), type: data.type, pole: 'Altimmo', status: 'location',
      description: String(data.description || data.internalNotes || 'Bien interne sous gestion locative').trim(),
      price: monthlyRent, surface, latitude, longitude,
      address: { street: String(data.street).trim(), city: String(data.city).trim(), arrondissement: String(data.arrondissement).trim(), neighborhood: String(data.neighborhood || '').trim() },
      images: [], bedrooms: Number(data.bedrooms) || 0, bathrooms: Number(data.bathrooms) || 0,
      amenities: Array.isArray(data.amenities) ? data.amenities : [], availability: data.initialAvailability || 'Disponible',
      statusAdmin: 'En attente', isPublished: false, recommande: false, internalManagedOnly: true,
      onboardingFingerprint,
    });
    const rental = await RentalManagement.create({
      property: property._id, owner: owner._id, manager: actor.id || actor._id, managementActivated: true,
      active: true, monthlyRent, occupancyStatus: 'vacant', availabilityStatus: 'disponible',
      publicationStatus: 'brouillon', publicationPolicy: 'manuelle', publicationAuthorized: false,
      availableFrom: data.availableFrom || null,
      workflowHistory: [{ action: 'managed_property_created', actor: actor.id || actor._id, source: 'staff', to: 'vacant', comment: String(data.internalNotes || '').slice(0, 1000) }],
    });
    sync.refreshReadiness(rental, property);
    await rental.save();
    await logAction({ action: 'Bien interne créé en Gestion locative', description: `Création privée de « ${property.title} »`, module: 'GestionLocative', typeAction: 'CRÉATION', auteur: buildAuteur(actor), cible: { id: String(property._id), type: 'Property', nom: property.title } }).catch(() => {});
    return { property, rental: serializeCreatedRental(rental, property) };
  } catch (error) {
    if (property?._id) await Property.deleteOne({ _id: property._id });
    if (error?.code === 11000) throw new OnboardingError('Un bien similaire existe déjà pour ce propriétaire.', 409, 'PLAUSIBLE_DUPLICATE');
    throw error;
  }
}

module.exports = { getOptions, activateExisting, createManaged, OnboardingError };
