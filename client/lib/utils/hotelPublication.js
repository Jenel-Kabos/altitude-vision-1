export const ROOM_CATEGORY_TYPES = [
  'standard', 'superieure', 'deluxe', 'premium', 'suite_junior', 'suite',
  'suite_presidentielle', 'familiale', 'twin', 'double', 'simple', 'autre',
];

export const createHotelRoomCategory = (index = 0) => ({
  clientKey: globalThis.crypto?.randomUUID?.() || `category-${Date.now()}-${index}`,
  name: '', code: '', categoryType: 'standard', quantity: 1,
  adultCapacity: 2, childCapacity: 0, beds: 1, surface: '', amenities: {},
  ratePlans: [{ rateType: 'public', amount: '', currency: 'XAF' }],
});

export function getHotelCategoryTotals(categories = []) {
  const publicRates = categories.flatMap((category) => (category.ratePlans || [])
    .filter((rate) => rate.rateType === 'public' && Number(rate.amount) > 0)
    .map((rate) => Number(rate.amount)));
  return {
    totalRooms: categories.reduce((sum, category) => sum + (Number(category.quantity) || 0), 0),
    totalCapacity: categories.reduce((sum, category) => sum + (Number(category.quantity) || 0)
      * ((Number(category.adultCapacity) || 0) + (Number(category.childCapacity) || 0)), 0),
    totalBeds: categories.reduce((sum, category) => sum + (Number(category.quantity) || 0) * (Number(category.beds) || 0), 0),
    minNightlyRate: publicRates.length ? Math.min(...publicRates) : 0,
    maxNightlyRate: publicRates.length ? Math.max(...publicRates) : 0,
    currency: 'XAF',
  };
}

export function validateHotelRoomCategories(categories = []) {
  const errors = {};
  if (!categories.length) return { roomCategories: 'Ajoutez au moins une catégorie de chambre.' };
  const codes = new Map();
  categories.forEach((category, index) => {
    const prefix = `roomCategories.${index}`;
    const code = String(category.code || '').trim().toUpperCase();
    if (!String(category.name || '').trim()) errors[`${prefix}.name`] = 'Nom requis';
    if (!code) errors[`${prefix}.code`] = 'Code requis';
    else if (codes.has(code)) {
      errors[`roomCategories.${codes.get(code)}.code`] = 'Le code doit être unique.';
      errors[`${prefix}.code`] = 'Le code doit être unique.';
    } else codes.set(code, index);
    if (!ROOM_CATEGORY_TYPES.includes(category.categoryType)) errors[`${prefix}.categoryType`] = 'Type requis';
    if (!Number.isInteger(Number(category.quantity)) || Number(category.quantity) < 1) errors[`${prefix}.quantity`] = 'Minimum 1 unité';
    if (!Number.isInteger(Number(category.adultCapacity)) || Number(category.adultCapacity) < 1) errors[`${prefix}.adultCapacity`] = 'Minimum 1 adulte';
    if (!Number.isInteger(Number(category.beds)) || Number(category.beds) < 1) errors[`${prefix}.beds`] = 'Minimum 1 lit';
    if (String(category.surface ?? '').trim() && !(Number(category.surface) > 0)) errors[`${prefix}.surface`] = 'Surface positive requise';
  });
  return errors;
}

export function validateHotelRates(categories = []) {
  const errors = {};
  categories.forEach((category, index) => {
    const rates = category.ratePlans || [];
    const publicRate = rates.find((rate) => rate.rateType === 'public');
    if (!publicRate || !(Number(publicRate.amount) > 0)) errors[`roomCategories.${index}.ratePlans`] = 'Tarif public requis';
    if (rates.some((rate) => !(Number(rate.amount) > 0))) errors[`roomCategories.${index}.ratePlans`] = 'Tous les tarifs doivent être positifs';
    if (new Set(rates.map((rate) => rate.rateType)).size !== rates.length) errors[`roomCategories.${index}.ratePlans`] = 'Chaque type de tarif doit être unique';
  });
  return errors;
}

export const validateHotelCategories = (categories = []) => ({
  ...validateHotelRoomCategories(categories), ...validateHotelRates(categories),
});

export function buildHotelPublicationPayload(form) {
  const totals = getHotelCategoryTotals(form.roomCategories);
  const roomCategories = form.roomCategories.map((category, index) => ({
    clientKey: category.clientKey, name: category.name.trim(), code: category.code.trim().toUpperCase(),
    categoryType: category.categoryType, quantity: Number(category.quantity),
    adultCapacity: Number(category.adultCapacity), childCapacity: Number(category.childCapacity) || 0,
    beds: Number(category.beds), surface: category.surface === '' ? undefined : Number(category.surface),
    amenities: category.amenities || {}, gallery: category.gallery || [], displayOrder: index,
    ratePlans: category.ratePlans.map((rate) => ({ rateType: rate.rateType, amount: Number(rate.amount), currency: 'XAF' })),
  }));
  return {
    publicationRequestId: form.publicationRequestId,
    publicationKind: 'hotel_establishment',
    property: {
      titre: form.name.trim(), description: form.description.trim(), type: 'Commerce', categorie: 'hebergement',
      prix: totals.minNightlyRate, ville: form.address.city, arrondissement: form.address.arrondissement,
      rue: form.address.street?.trim() || undefined, superficie: Number(form.surface) || 1,
      chambres: 0, bathrooms: 0, livingRooms: 0, kitchens: 0, amenities: [], photos: [],
      latitude: Number(form.latitude), longitude: Number(form.longitude),
    },
    accommodation: {
      accommodationType: form.accommodationType, furnished: true,
      capacity: { maxAdults: Math.max(1, totals.totalCapacity), maxChildren: 0 },
      checkInTime: form.checkInTime, checkOutTime: form.checkOutTime,
      houseRules: form.houseRules || [],
      hotel: {
        name: form.name.trim(), description: form.description.trim(),
        starRating: form.starRating === '' ? undefined : Number(form.starRating),
        phone: form.phone.trim(), email: form.email.trim() || undefined, website: form.website.trim() || undefined,
        hasReception: Boolean(form.hotelServices.reception24h), hotelServices: form.hotelServices,
      },
    },
    roomCategories,
  };
}
