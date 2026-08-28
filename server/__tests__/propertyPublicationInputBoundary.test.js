jest.mock('../config/cloudinary', () => ({
  uploadToCloudinary: jest.fn(),
  destroyFromCloudinary: jest.fn(),
}));

const { uploadToCloudinary } = require('../config/cloudinary');
const boundary = require('../services/propertyPublicationInputService');

describe('Property publication input — contrat de parité', () => {
  beforeEach(() => jest.clearAllMocks());

  test('normalise tableaux, montants, nombres et GeoJSON sans règle métier implicite', () => {
    expect(boundary.parseAmenities('[" Piscine ",""]')).toEqual(['Piscine']);
    expect(boundary.parseStringArray('CNI, Justificatif')).toEqual(['CNI', 'Justificatif']);
    expect(boundary.parseNonNegativeAmount('', 7)).toBe(7);
    expect(boundary.parseNonNegativeAmount('-1', null)).toBeNull();
    expect(boundary.parseNumericField('12.5', 'Valeur')).toBe(12.5);
    expect(boundary.parseGeoLocation('{"type":"Point","coordinates":[15,-4]}'))
      .toEqual({ type: 'Point', coordinates: [15, -4] });
    expect(boundary.parseGeoLocation('{')).toBeUndefined();
  });

  test('préserve l’erreur 422 et son message pour un nombre invalide', () => {
    expect(() => boundary.parseNumericField('abc', 'Le prix')).toThrow('Le prix doit être un nombre valide.');
    try { boundary.parseNumericField('abc', 'Le prix'); } catch (error) { expect(error.statusCode).toBe(422); }
  });

  test('reconstruit exactement une adresse multipart avec Brazzaville par défaut', () => {
    expect(boundary.parseAddress({ body: {
      'address[arrondissement]': 'Bacongo', 'address[street]': 'Rue 1',
    } })).toEqual({ arrondissement: 'Bacongo', neighborhood: undefined, street: 'Rue 1', city: 'Brazzaville' });
  });

  test('upload conserve options Cloudinary, ordre et suppression des URLs vides', async () => {
    uploadToCloudinary
      .mockResolvedValueOnce({ secure_url: 'https://cdn/one.webp' })
      .mockResolvedValueOnce({ secure_url: '' });
    await expect(boundary.uploadFilesToCloudinary([{ buffer: 'a' }, { buffer: 'b' }]))
      .resolves.toEqual(['https://cdn/one.webp']);
    expect(uploadToCloudinary).toHaveBeenCalledWith('a', {
      folder: 'altitude-vision/properties', resource_type: 'image', quality: 'auto',
      fetch_format: 'auto', width: 1200, crop: 'limit',
    });
  });

  test.each([
    ['vente'], ['location'], ['hebergement'],
  ])('buildBasePropertyData force le status appelant %s et statusAdmin En attente', async (status) => {
    uploadToCloudinary.mockResolvedValue({ secure_url: 'https://cdn/property.webp' });
    const req = { files: [{ buffer: 'image' }], body: {
      title: 'Parcelle test', description: 'Description', price: '100', type: 'Parcelle',
      surface: '250', bedrooms: '', bathrooms: '', livingRooms: '', kitchens: '',
      amenities: 'Clôture', honoraires: '10', fraisVisite: '0',
      'address[city]': 'Pointe-Noire', longitude: '11.8', latitude: '-4.8',
    } };
    await expect(boundary.buildBasePropertyData(req, 'owner-1', status)).resolves.toEqual(expect.objectContaining({
      owner: 'owner-1', type: 'Parcelle', status, statusAdmin: 'En attente',
      pole: 'Altimmo', availability: 'Disponible', price: 100, images: ['https://cdn/property.webp'],
    }));
  });
});
