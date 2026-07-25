const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const { OFFER_TYPES, PROPERTY_TYPES, ACCOMMODATION_TYPES } = require('../constants/propertyFilterConstants');

describe('propertyFilterConstants — parité avec le schéma Property (anti-dérive)', () => {
  test('OFFER_TYPES == Property.schema.path(\'status\').enumValues', () => {
    expect(OFFER_TYPES.sort()).toEqual(Property.schema.path('status').enumValues.sort());
  });

  test('PROPERTY_TYPES == Property.schema.path(\'type\').enumValues', () => {
    expect(PROPERTY_TYPES.sort()).toEqual(Property.schema.path('type').enumValues.sort());
  });

  test('ACCOMMODATION_TYPES == Accommodation.ACCOMMODATION_TYPES (schéma)', () => {
    expect(ACCOMMODATION_TYPES.sort()).toEqual([...Accommodation.ACCOMMODATION_TYPES].sort());
  });
});
