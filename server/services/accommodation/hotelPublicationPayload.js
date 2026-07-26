const CATEGORY_TYPES = ['standard', 'superieure', 'deluxe', 'premium', 'suite_junior', 'suite', 'suite_presidentielle', 'familiale', 'twin', 'double', 'simple', 'autre'];

const asNumber = (value) => Number(value);

function analyzeHotelRoomCategories(roomCategories) {
  const errors = [];
  if (!Array.isArray(roomCategories) || roomCategories.length === 0) {
    return { errors: ['roomCategories'], categories: [], totals: null };
  }
  const codes = new Set();
  const categories = roomCategories.map((raw, index) => {
    const code = String(raw?.code || '').trim().toUpperCase();
    const name = String(raw?.name || '').trim();
    const quantity = asNumber(raw?.quantity ?? raw?.unitsAvailable);
    const maxAdults = asNumber(raw?.adultCapacity ?? raw?.capacity?.maxAdults);
    const maxChildren = asNumber(raw?.childCapacity ?? raw?.capacity?.maxChildren ?? 0);
    const beds = asNumber(raw?.beds ?? 0);
    const ratePlans = Array.isArray(raw?.ratePlans) ? raw.ratePlans : [];
    const normalizedRates = ratePlans.map((rate) => ({
      rateType: rate?.rateType || 'public', amount: asNumber(rate?.amount), currency: rate?.currency || 'XAF',
    }));
    const prefix = `roomCategories.${index}`;
    if (!name) errors.push(`${prefix}.name`);
    if (!code) errors.push(`${prefix}.code`);
    if (code && codes.has(code)) errors.push(`${prefix}.code`);
    codes.add(code);
    if (!Number.isInteger(quantity) || quantity < 1) errors.push(`${prefix}.quantity`);
    if (!Number.isInteger(maxAdults) || maxAdults < 1) errors.push(`${prefix}.adultCapacity`);
    if (!Number.isInteger(maxChildren) || maxChildren < 0) errors.push(`${prefix}.childCapacity`);
    if (!Number.isInteger(beds) || beds < 1) errors.push(`${prefix}.beds`);
    if (!normalizedRates.length || !normalizedRates.some((rate) => rate.rateType === 'public')) errors.push(`${prefix}.ratePlans`);
    if (normalizedRates.some((rate) => !Number.isFinite(rate.amount) || rate.amount <= 0)) errors.push(`${prefix}.ratePlans.amount`);
    const rateTypes = normalizedRates.map((rate) => rate.rateType);
    if (new Set(rateTypes).size !== rateTypes.length) errors.push(`${prefix}.ratePlans.rateType`);
    return {
      clientKey: String(raw?.clientKey || code || index), name, code,
      categoryType: CATEGORY_TYPES.includes(raw?.categoryType) ? raw.categoryType : 'autre',
      description: String(raw?.description || '').trim(), quantity, maxAdults, maxChildren, beds,
      surface: raw?.surface === '' || raw?.surface == null ? null : asNumber(raw.surface),
      amenities: raw?.amenities || {}, gallery: raw?.gallery || [], displayOrder: index,
      ratePlans: normalizedRates,
    };
  });
  const publicRates = categories.flatMap((category) => category.ratePlans.filter((rate) => rate.rateType === 'public').map((rate) => rate.amount));
  const totals = {
    totalRooms: categories.reduce((sum, category) => sum + category.quantity, 0),
    totalCapacity: categories.reduce((sum, category) => sum + category.quantity * (category.maxAdults + category.maxChildren), 0),
    totalBeds: categories.reduce((sum, category) => sum + category.quantity * category.beds, 0),
    minNightlyRate: publicRates.length ? Math.min(...publicRates) : 0,
    maxNightlyRate: publicRates.length ? Math.max(...publicRates) : 0,
    currency: 'XAF',
  };
  return { errors, categories, totals };
}

module.exports = { analyzeHotelRoomCategories, CATEGORY_TYPES };
