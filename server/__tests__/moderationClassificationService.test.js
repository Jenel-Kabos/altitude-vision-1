const {
  classicPropertyModerationFilter, accommodationModerationFilter, getModerationCategory, classifyDashboardListing,
} = require('../services/moderationClassificationService');

describe('moderationClassificationService', () => {
  test('Vente et Location classiques partagent un filtre exclusif des hébergements', () => {
    expect(classicPropertyModerationFilter({ statusAdmin: 'En attente' })).toEqual({
      statusAdmin: 'En attente', status: { $in: ['vente', 'location'] },
    });
  });

  test('le flux Hébergement exclut tout Accommodation rattaché à un Hotel', () => {
    expect(accommodationModerationFilter({ publicationStatus: 'soumis' })).toEqual({
      publicationStatus: 'soumis',
      $and: [{ $or: [{ hotel: null }, { hotel: { $exists: false } }] }],
    });
  });

  test.each([
    [{ status: 'vente' }, 'vente'], [{ status: 'location' }, 'location'],
    [{ accommodationType: 'villa_meublee' }, 'accommodation'], [{ hotel: 'HOTEL-1' }, 'hotel'],
    [{ status: 'hebergement' }, 'ambiguous'],
  ])('classe une entité dans une seule famille', (entity, expected) => {
    expect(getModerationCategory(entity)).toBe(expected);
  });

  test.each([
    [{ property: { _id: 'P1', status: 'vente' } }, 'vente'],
    [{ property: { _id: 'P2', status: 'location' } }, 'location'],
    [{ property: { _id: 'P3', status: 'hebergement' }, accommodation: { _id: 'A3', accommodationType: 'villa_meublee' } }, 'accommodation'],
    [{ property: { _id: 'P4', status: 'hebergement' }, accommodation: { _id: 'A4', accommodationType: 'hotel', hotel: 'H4' }, hotel: { _id: 'H4' } }, 'hotel'],
    [{ property: { _id: 'P5', status: 'hebergement' } }, 'ambiguous'],
    [{ property: { _id: 'P6', status: 'hebergement' }, accommodation: { _id: 'A6' } }, 'ambiguous'],
    [{ property: { _id: 'P7', status: 'hebergement' }, accommodation: { _id: 'A7', accommodationType: 'hotel', hotel: 'MISSING' } }, 'ambiguous'],
    [{ property: { _id: 'P8' } }, 'ambiguous'],
  ])('classifie le flux dashboard depuis ses relations réelles', (input, expected) => {
    expect(classifyDashboardListing(input).family).toBe(expected);
  });
});
