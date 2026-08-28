const { buildMobilePropertyData } = require('../services/propertyPublicationInputService');

const validPayload = {
  titre: 'Villa test', description: 'Description', prix: 100000, superficie: 120,
  chambres: 3, bathrooms: 2, livingRooms: 1, kitchens: 1,
  ville: 'Brazzaville', arrondissement: 'Bacongo', rue: '  Rue 1  ',
  type: 'Villa', categorie: 'VENTE', photos: ['https://cdn/photo.jpg'],
};

describe('buildMobilePropertyData — contrat ARCH-2D2 avant extraction', () => {
  test('préserve exactement le mapping, les valeurs par défaut et les normalisations historiques', () => {
    expect(buildMobilePropertyData(validPayload, 'owner-1')).toEqual({
      title: 'Villa test', description: 'Description', price: 100000,
      honoraires: null, fraisVisite: 0, surface: 120, bedrooms: 3,
      bathrooms: 2, livingRooms: 1, kitchens: 1, amenities: [],
      cautionMultiplicateur: 2, profilsLocataireRecherches: [], documentsRequis: [],
      address: { city: 'Brazzaville', arrondissement: 'Bacongo', street: 'Rue 1' },
      type: 'Villa', status: 'vente', images: ['https://cdn/photo.jpg'],
      pole: 'Altimmo', statusAdmin: 'En attente', owner: 'owner-1',
      latitude: -4.2661, longitude: 15.2832,
    });
  });

  test('préserve les champs explicites, tableaux et coordonnées, y compris zéro', () => {
    expect(buildMobilePropertyData({
      ...validPayload, honoraires: '0', fraisVisite: '25', cautionMultiplicateur: '3',
      amenities: ['Piscine'], profilsLocataireRecherches: ['Salarié'],
      documentsRequis: ['CNI'], latitude: 0, longitude: 0,
    }, 'owner-2')).toMatchObject({
      honoraires: 0, fraisVisite: 25, cautionMultiplicateur: 3,
      amenities: ['Piscine'], profilsLocataireRecherches: ['Salarié'],
      documentsRequis: ['CNI'], latitude: -4.2661, longitude: 15.2832,
    });
  });

  test.each([
    [{ ...validPayload, honoraires: '-1' }, 'Les honoraires et frais de visite doivent être des montants positifs ou nuls.'],
    [{ ...validPayload, fraisVisite: 'abc' }, 'Les honoraires et frais de visite doivent être des montants positifs ou nuls.'],
    [{ ...validPayload, photos: [] }, 'Au moins une photo requise'],
    [{ ...validPayload, arrondissement: '' }, 'Arrondissement requis'],
  ])('préserve erreur 400 et message historique', (payload, message) => {
    expect.assertions(2);
    try { buildMobilePropertyData(payload, 'owner-1'); } catch (error) {
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe(message);
    }
  });
});
