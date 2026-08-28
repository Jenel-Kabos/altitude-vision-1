const { buildMobilePropertyData } = require('../services/propertyPublicationInputService');

const validPayload = {
  titre: 'Villa test', description: 'Description', prix: 100000,
  superficie: 120, ville: 'Brazzaville', arrondissement: 'Bacongo',
  rue: '  Rue des tests  ', type: 'Villa', categorie: 'vente',
  photos: ['https://res.cloudinary.com/test/photo.jpg'],
  latitude: -4.27, longitude: 15.28,
};

describe('contrat Property mobile', () => {
  test('conserve la rue dans address.street comme le formulaire web', () => {
    const property = buildMobilePropertyData(validPayload, '507f191e810c19729de860ea');
    expect(property.address).toEqual({
      city: 'Brazzaville', arrondissement: 'Bacongo', street: 'Rue des tests',
    });
  });

  test('normalise les valeurs canoniques sans libellé de présentation', () => {
    const property = buildMobilePropertyData(validPayload, '507f191e810c19729de860ea');
    expect(property).toMatchObject({ pole: 'Altimmo', status: 'vente', type: 'Villa' });
  });
});
