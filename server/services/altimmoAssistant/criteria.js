const C = require('./catalog');

const unique = (values) => [...new Set(values)];
const emptyCriteria = () => ({
  transaction: null, propertyTypes: [], accommodationTypes: [],
  location: { country: null, city: null, districts: [], preferredDistricts: [], neighborhood: null, zone: null, radiusMeters: null },
  budget: { min: null, max: null, currency: null, period: null },
  bedrooms: { min: null, max: null }, bathrooms: { min: null, max: null }, surface: { min: null, max: null }, floors: { min: null, max: null },
  amenities: { required: [], preferred: [], excluded: [] }, proximity: { required: [], preferred: [] },
  stay: { checkIn: null, checkOut: null, nights: null, adults: null, children: null, rooms: null, stayType: null },
});

function normalizeCriteria(criteria) {
  const out = criteria;
  out.propertyTypes = unique(out.propertyTypes).filter((x) => C.PROPERTY_TYPES.includes(x));
  out.accommodationTypes = unique(out.accommodationTypes).filter((x) => C.ACCOMMODATION_TYPES.includes(x));
  for (const key of ['required', 'preferred', 'excluded']) out.amenities[key] = unique(out.amenities[key]);
  for (const key of ['required', 'preferred']) {
    const seen = new Set();
    out.proximity[key] = out.proximity[key].filter((x) => !seen.has(x.category) && seen.add(x.category));
  }
  return out;
}

function validateParsedRequest(parsed) {
  const errors = [];
  const c = parsed && parsed.criteria;
  if (!c) return { valid: false, errors: ['criteria is required'] };
  if (c.transaction && !C.TRANSACTIONS.includes(c.transaction)) errors.push('invalid transaction');
  if (c.propertyTypes.some((x) => !C.PROPERTY_TYPES.includes(x))) errors.push('invalid property type');
  if (c.accommodationTypes.some((x) => !C.ACCOMMODATION_TYPES.includes(x))) errors.push('invalid accommodation type');
  for (const key of ['min', 'max']) {
    const amount = c.budget[key];
    if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0 || amount > C.MAX_AMOUNT)) errors.push(`invalid budget.${key}`);
  }
  return { valid: errors.length === 0, errors };
}

module.exports = { emptyCriteria, normalizeCriteria, validateParsedRequest };
