const { uploadToCloudinary } = require('../config/cloudinary');

const uploadFilesToCloudinary = async (files = [], folder = 'altitude-vision/properties') => {
  if (!files || files.length === 0) return [];
  const uploads = await Promise.all(files.map((file) => uploadToCloudinary(file.buffer, {
    folder, resource_type: 'image', quality: 'auto', fetch_format: 'auto', width: 1200, crop: 'limit',
  })));
  return uploads.map((result) => result.secure_url).filter(Boolean);
};

const parseAmenities = (amenities) => {
  if (Array.isArray(amenities)) return amenities.map((a) => (typeof a === 'string' ? a.trim() : a)).filter(Boolean);
  if (typeof amenities === 'string') {
    try { const parsed = JSON.parse(amenities); if (Array.isArray(parsed)) return parsed.map((a) => (typeof a === 'string' ? a.trim() : a)).filter(Boolean); }
    catch { return amenities.split(',').map((a) => a.trim()).filter(Boolean); }
  }
  return [];
};

const parseStringArray = (value) => {
  if (Array.isArray(value)) return value.map((item) => (typeof item === 'string' ? item.trim() : item)).filter(Boolean);
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map((item) => (typeof item === 'string' ? item.trim() : item)).filter(Boolean); }
    catch { return value.split(',').map((item) => item.trim()).filter(Boolean); }
    return value.trim() ? [value.trim()] : [];
  }
  return [];
};

const parseNonNegativeAmount = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

const parseNumericField = (value, label) => {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) { const error = new Error(`${label} doit être un nombre valide.`); error.statusCode = 422; throw error; }
  return number;
};

const parseAddress = (req) => {
  const { address } = req.body;
  let addressData = {};
  if (typeof address === 'string') { try { addressData = JSON.parse(address); } catch { addressData = address || {}; } }
  else addressData = address || {};
  return {
    arrondissement: addressData.arrondissement || req.body['address[arrondissement]'],
    neighborhood: addressData.neighborhood || req.body['address[neighborhood]'],
    street: addressData.street || req.body['address[street]'],
    city: addressData.city || req.body['address[city]'] || 'Brazzaville',
  };
};

const parseGeoLocation = (location) => {
  if (!location) return undefined;
  if (typeof location === 'string') { try { return JSON.parse(location); } catch { return undefined; } }
  return location;
};

// Construit le document Property depuis le payload JSON de l'app mobile.
// Les photos sont déjà uploadées côté client ; ce helper est sans I/O.
function buildMobilePropertyData(body, ownerId) {
  const {
    titre, description, prix, superficie, chambres, bathrooms, livingRooms, kitchens,
    ville, arrondissement, rue, type, categorie, photos, amenities, latitude, longitude,
    cautionMultiplicateur, profilsLocataireRecherches, documentsRequis, honoraires, fraisVisite,
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
    title: titre, description, price: prix, honoraires: parsedHonoraires,
    fraisVisite: parsedFraisVisite, surface: superficie, bedrooms: chambres || 0,
    bathrooms: bathrooms || 0, livingRooms: livingRooms || 0, kitchens: kitchens || 0,
    amenities: Array.isArray(amenities) ? amenities : [],
    cautionMultiplicateur: cautionMultiplicateur !== undefined ? Number(cautionMultiplicateur) : 2,
    profilsLocataireRecherches: Array.isArray(profilsLocataireRecherches) ? profilsLocataireRecherches : [],
    documentsRequis: Array.isArray(documentsRequis) ? documentsRequis : [],
    address: { city: ville, arrondissement, street: typeof rue === 'string' ? rue.trim() : '' },
    type, status: typeof categorie === 'string' ? categorie.toLowerCase() : categorie,
    images: photos, pole: 'Altimmo', statusAdmin: 'En attente', owner: ownerId,
    latitude: latitude || -4.2661, longitude: longitude || 15.2832,
  };
}

async function buildBasePropertyData(req, ownerId, status) {
  const { title, description, price, pole, availability, type, surface, bedrooms, bathrooms, amenities,
    livingRooms, kitchens, constructionType, location, honoraires, fraisVisite, longitude, latitude } = req.body;
  const parsedHonoraires = parseNonNegativeAmount(honoraires, null);
  const parsedFraisVisite = parseNonNegativeAmount(fraisVisite, 0);
  if ((honoraires !== undefined && honoraires !== '' && parsedHonoraires === null)
    || (fraisVisite !== undefined && fraisVisite !== '' && parsedFraisVisite === null)) {
    const error = new Error('Les honoraires et frais de visite doivent être des montants positifs ou nuls.'); error.statusCode = 422; throw error;
  }
  const imagePaths = await uploadFilesToCloudinary(req.files);
  return {
    owner: ownerId, title, description, price: parseFloat(price), honoraires: parsedHonoraires,
    fraisVisite: parsedFraisVisite, pole: pole || 'Altimmo', status, availability: availability || 'Disponible',
    type, address: parseAddress(req), surface: parseFloat(surface), bedrooms: parseInt(bedrooms || 0),
    bathrooms: parseInt(bathrooms || 0), livingRooms: parseInt(livingRooms || 0), kitchens: parseInt(kitchens || 0),
    constructionType, amenities: parseAmenities(amenities), longitude, latitude, location: parseGeoLocation(location),
    images: imagePaths, statusAdmin: 'En attente',
  };
}

module.exports = { uploadFilesToCloudinary, parseAmenities, parseStringArray, parseNonNegativeAmount,
  parseAddress, parseGeoLocation, buildBasePropertyData, buildMobilePropertyData, parseNumericField };
