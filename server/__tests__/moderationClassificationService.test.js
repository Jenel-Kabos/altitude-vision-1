const {
  classicPropertyModerationFilter, accommodationModerationFilter, getModerationCategory,
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
});
