// Construction des payloads envoyés au backend pour les 3 parcours de publication
// mobile (Vente / Location / Hébergement). Chaque fonction n'envoie que les champs
// réellement acceptés par la route backend correspondante (voir audit mission),
// normalise nombres/booléens et supprime les valeurs vides — jamais de champ cascade
// depuis une valeur d'affichage libre.

import {
  ACCOMMODATION_PROPERTY_TYPE_BY_CATEGORY, HOTEL_PROPERTY_TYPE,
} from '../constants/accommodation';
import { getHotelCategoryTotals } from '../utils/hotelPublication';

const toNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const stripEmpty = (obj) => Object.fromEntries(
  Object.entries(obj).filter(([, v]) => {
    if (v === null || v === undefined || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  }),
);

const isBlank = (v) => v === null || v === undefined || v === '';
const numberOrUndefined = (v) => (isBlank(v) ? undefined : toNumber(v));

// ─────────────────────────────────────────────────────────────────────────
// Vente / Location — POST /properties/mobile (propertyMobileController.js).
// `categorie` impose le status créé côté backend, jamais laissé au choix libre
// de l'utilisateur au-delà du parcours emprunté.
// ─────────────────────────────────────────────────────────────────────────
function buildBasePropertyPayload(form, photoUrls, categorie) {
  return stripEmpty({
    titre: form.titre?.trim(),
    description: form.description?.trim(),
    type: form.type,
    categorie,
    prix: toNumber(form.prix),
    ville: form.ville,
    arrondissement: form.arrondissement,
    rue: form.rue?.trim() || undefined,
    superficie: toNumber(form.surface),
    chambres: toNumber(form.bedrooms, 0),
    bathrooms: toNumber(form.bathrooms, 0),
    livingRooms: toNumber(form.livingRooms, 0),
    kitchens: toNumber(form.kitchens, 0),
    amenities: Array.isArray(form.amenities) ? form.amenities : [],
    photos: photoUrls,
    latitude: form.latitude ?? undefined,
    longitude: form.longitude ?? undefined,
    honoraires: numberOrUndefined(form.honoraires),
    fraisVisite: numberOrUndefined(form.fraisVisite),
  });
}

export function buildSalePropertyPayload(form, photoUrls) {
  return buildBasePropertyPayload(form, photoUrls, 'vente');
}

export function buildRentalPropertyPayload(form, photoUrls) {
  const base = buildBasePropertyPayload(form, photoUrls, 'location');
  return stripEmpty({
    ...base,
    cautionMultiplicateur: toNumber(form.cautionMultiplicateur, 2),
    profilsLocataireRecherches: Array.isArray(form.profilsLocataireRecherches) ? form.profilsLocataireRecherches : [],
    documentsRequis: Array.isArray(form.documentsRequis) ? form.documentsRequis : [],
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Hébergement — 3 payloads distincts pour les 3 appels API successifs
// (POST /properties/mobile → POST /accommodations → POST /accommodations/:id/rate-plans).
// ─────────────────────────────────────────────────────────────────────────
export function buildFurnishedAccommodationPropertyPayload(form, photoUrls) {
  return buildBasePropertyPayload({
    ...form,
    type: ACCOMMODATION_PROPERTY_TYPE_BY_CATEGORY[form.accommodationType],
    prix: form.tarifNuit,
  }, photoUrls, 'hebergement');
}

export function buildFurnishedAccommodationProfilePayload(form) {
  return stripEmpty({
    accommodationType: form.accommodationType,
    furnished: form.furnished !== false,
    capacity: { maxAdults: toNumber(form.capaciteAdultes, 1), maxChildren: toNumber(form.capaciteEnfants, 0) },
    beds: numberOrUndefined(form.beds),
    checkInTime: form.checkInTime || undefined,
    checkOutTime: form.checkOutTime || undefined,
    houseRules: Array.isArray(form.houseRules) ? form.houseRules : [],
    securityDeposit: numberOrUndefined(form.securityDeposit),
    cleaningFee: numberOrUndefined(form.cleaningFee),
    amenities: form.accommodationAmenities && typeof form.accommodationAmenities === 'object'
      ? form.accommodationAmenities
      : undefined,
  });
}

export function buildHotelPropertyPayload(form, photoUrls) {
  const totals = getHotelCategoryTotals(form.roomCategories);
  return buildBasePropertyPayload({
    ...form,
    titre: form.establishmentName,
    type: HOTEL_PROPERTY_TYPE,
    prix: totals.minNightlyRate,
    surface: form.surface || 1,
    bedrooms: 0,
    bathrooms: 0,
  }, photoUrls, 'hebergement');
}

export function buildHotelProfilePayload(form) {
  return stripEmpty({
    accommodationType: form.accommodationType,
    furnished: true,
    capacity: { maxAdults: Math.max(1, getHotelCategoryTotals(form.roomCategories).totalCapacity), maxChildren: 0 },
    checkInTime: form.checkInTime || undefined,
    checkOutTime: form.checkOutTime || undefined,
    hotel: stripEmpty({
      name: form.establishmentName?.trim(),
      description: form.description?.trim(),
      starRating: numberOrUndefined(form.starRating),
      phone: form.hotelPhone?.trim(),
      email: form.hotelEmail?.trim(),
      website: form.hotelWebsite?.trim(),
      gallery: Array.isArray(form.hotelGallery)
        ? form.hotelGallery.map((url, index) => ({ url, type: 'photo', isCover: index === 0, order: index }))
        : undefined,
      hasReception: Boolean(form.hasReception),
      hotelServices: form.hotelServices && typeof form.hotelServices === 'object'
        ? form.hotelServices : undefined,
    }),
  });
}

export function buildHotelRoomCategoriesPayload(form) {
  return (form.roomCategories || []).map((category, index) => ({
    clientKey: category.clientKey,
    name: category.name?.trim(), code: category.code?.trim().toUpperCase(),
    categoryType: category.categoryType, quantity: toNumber(category.quantity),
    adultCapacity: toNumber(category.adultCapacity), childCapacity: toNumber(category.childCapacity),
    beds: toNumber(category.beds), surface: numberOrUndefined(category.surface),
    amenities: category.amenities || {}, gallery: category.gallery || [], displayOrder: index,
    ratePlans: (category.ratePlans || []).map((rate) => ({
      rateType: rate.rateType, amount: toNumber(rate.amount), currency: 'XAF',
    })),
  }));
}

// Alias rétro-compatible pour les imports existants hors du nouveau formulaire.
export const buildAccommodationPropertyPayload = buildFurnishedAccommodationPropertyPayload;
export const buildAccommodationProfilePayload = buildFurnishedAccommodationProfilePayload;

export function buildAccommodationRatePayload(form) {
  return {
    mode: 'nightly',
    amount: toNumber(form.tarifNuit),
    currency: 'XAF',
  };
}

export { stripEmpty, toNumber };
