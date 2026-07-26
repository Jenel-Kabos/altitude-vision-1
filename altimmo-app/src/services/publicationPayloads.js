// Construction des payloads envoyés au backend pour les 3 parcours de publication
// mobile (Vente / Location / Hébergement). Chaque fonction n'envoie que les champs
// réellement acceptés par la route backend correspondante (voir audit mission),
// normalise nombres/booléens et supprime les valeurs vides — jamais de champ cascade
// depuis une valeur d'affichage libre.

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
export function buildAccommodationPropertyPayload(form, photoUrls) {
  return buildBasePropertyPayload(form, photoUrls, 'hebergement');
}

export function buildAccommodationProfilePayload(form) {
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

export function buildAccommodationRatePayload(form) {
  return {
    mode: 'nightly',
    amount: toNumber(form.tarifNuit),
    currency: 'XAF',
  };
}

export { stripEmpty, toNumber };
