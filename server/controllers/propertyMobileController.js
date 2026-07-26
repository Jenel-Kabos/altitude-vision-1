const Property = require('../models/Property');
const User = require('../models/User');
const { notify } = require('../services/notificationService');

/**
 * Construit le document Property depuis le payload JSON envoyé par l'app mobile
 * (photos déjà uploadées sur Cloudinary côté client — jamais de FormData ici).
 * Extrait de `createPropertyMobile` pour être réutilisée telle quelle par
 * `mobileAccommodationPublicationService.js` (parcours Hébergement atomique,
 * correctif robustesse 2026-07) — même mapping de champs, même validation,
 * jamais deux implémentations divergentes de "comment un Property mobile se
 * construit". Lève une erreur `.statusCode` en cas de payload invalide ; ne
 * touche jamais la base (aucun `Property.create` ici).
 */
function buildMobilePropertyData(body, ownerId) {
  const {
    titre,
    description,
    prix,
    superficie,
    chambres,
    bathrooms,
    livingRooms,
    kitchens,
    ville,
    arrondissement,
    rue,
    type,
    categorie,
    photos,
    amenities,
    latitude,
    longitude,
    cautionMultiplicateur,
    profilsLocataireRecherches,
    documentsRequis,
    honoraires,
    fraisVisite,
  } = body;

  const parsedHonoraires = honoraires === undefined || honoraires === null || honoraires === ''
    ? null : Number(honoraires);
  const parsedFraisVisite = fraisVisite === undefined || fraisVisite === null || fraisVisite === ''
    ? 0 : Number(fraisVisite);
  if ((parsedHonoraires !== null && (!Number.isFinite(parsedHonoraires) || parsedHonoraires < 0))
    || !Number.isFinite(parsedFraisVisite) || parsedFraisVisite < 0) {
    const err = new Error('Les honoraires et frais de visite doivent être des montants positifs ou nuls.');
    err.statusCode = 400;
    throw err;
  }

  if (!photos || photos.length === 0) {
    const err = new Error('Au moins une photo requise');
    err.statusCode = 400;
    throw err;
  }
  if (!arrondissement) {
    const err = new Error('Arrondissement requis');
    err.statusCode = 400;
    throw err;
  }

  return {
    title: titre,
    description,
    price: prix,
    honoraires: parsedHonoraires,
    fraisVisite: parsedFraisVisite,
    surface: superficie,
    bedrooms: chambres || 0,
    bathrooms: bathrooms || 0,
    livingRooms: livingRooms || 0,
    kitchens: kitchens || 0,
    amenities: Array.isArray(amenities) ? amenities : [],
    cautionMultiplicateur: cautionMultiplicateur !== undefined ? Number(cautionMultiplicateur) : 2,
    profilsLocataireRecherches: Array.isArray(profilsLocataireRecherches) ? profilsLocataireRecherches : [],
    documentsRequis: Array.isArray(documentsRequis) ? documentsRequis : [],
    address: {
      city: ville,
      arrondissement,
      street: typeof rue === 'string' ? rue.trim() : '',
    },
    type,
    status:
      typeof categorie === 'string' ? categorie.toLowerCase() : categorie,
    images: photos,
    pole: 'Altimmo',
    statusAdmin: 'En attente',
    owner: ownerId,
    latitude: latitude || -4.2661,
    longitude: longitude || 15.2832,
  };
}

const createPropertyMobile = async (req, res) => {
  try {
    const propertyData = buildMobilePropertyData(req.body, req.user.id);
    const property = await Property.create(propertyData);

    // Notifier les Admin (modération réservée à ce rôle, cf. AdminDashboard
    // NAV_SECTIONS "Modération Biens" → roles: ['Admin']) — best-effort
    User.find({ role: 'Admin' }).select('_id').lean()
      .then((admins) => Promise.allSettled(admins.map((a) => notify({ recipient: a._id,
        type:  'property_pending_moderation',
        title: `Nouveau bien à modérer : ${req.body.titre}`,
        body:  `${req.body.ville || ''} ${req.body.arrondissement || ''}`.trim(),
        link:  '/dashboard/moderation/properties',
        data:  { screen: 'ModerationProperties', propertyId: property._id.toString() },
      }))))
      .catch(() => {});

    return res.status(201).json({
      status: 'success',
      data: { property },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        status: 'error',
        message: err.message,
      });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        status: 'error',
        message: err.message,
      });
    }
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
};

module.exports = { createPropertyMobile, buildMobilePropertyData };
