const Property = require('../models/Property');
const { OFFER_TYPES, PROPERTY_TYPES } = require('../constants/propertyFilterConstants');

describe('propertyFilterConstants — parité avec le schéma Property (anti-dérive)', () => {
  test('OFFER_TYPES == Property.schema.path(\'status\').enumValues', () => {
    expect(OFFER_TYPES.sort()).toEqual(Property.schema.path('status').enumValues.sort());
  });

  test('PROPERTY_TYPES == Property.schema.path(\'type\').enumValues', () => {
    expect(PROPERTY_TYPES.sort()).toEqual(Property.schema.path('type').enumValues.sort());
  });
});
