const corpus = require('../services/altimmoAssistant/evaluation/corpusIA03A');
const { parseRealEstateRequest } = require('../services/altimmoAssistant/ruleParser');

describe(`corpus déterministe ${corpus.version}`, () => {
  test.each(corpus.cases)('%s', (_name, input, expected) => {
    const c = parseRealEstateRequest(input).criteria;
    if (expected.transaction) expect(c.transaction).toBe(expected.transaction);
    if (expected.city) expect(c.location.city).toBe(expected.city);
    if (expected.district) expect(c.location.districts).toContain(expected.district);
    if (expected.type) expect(c.propertyTypes).toContain(expected.type);
    if (expected.accommodation) expect(c.accommodationTypes).toContain(expected.accommodation);
    if (expected.budgetMin) expect(c.budget.min).toBe(expected.budgetMin);
    if (expected.budgetMax) expect(c.budget.max).toBe(expected.budgetMax);
    if (expected.bedrooms) expect(c.bedrooms.min).toBe(expected.bedrooms);
    if (expected.bathrooms) expect(c.bathrooms.min).toBe(expected.bathrooms);
    if (expected.surface) expect(c.surface.min).toBe(expected.surface);
    if (expected.requiredAmenity) expect(c.amenities.required).toContain(expected.requiredAmenity);
    if (expected.preferredAmenity) expect(c.amenities.preferred).toContain(expected.preferredAmenity);
    if (expected.excludedAmenity) expect(c.amenities.excluded).toContain(expected.excludedAmenity);
    if (expected.proximity) expect([...c.proximity.required, ...c.proximity.preferred].map((x) => x.category)).toContain(expected.proximity);
    if (expected.radius) expect(c.location.radiusMeters).toBe(expected.radius);
    if (expected.adults) expect(c.stay.adults).toBe(expected.adults);
    if (expected.children) expect(c.stay.children).toBe(expected.children);
    if (expected.nights) expect(c.stay.nights).toBe(expected.nights);
  });
});
