// __tests__/hotelModel.test.js — invariants du schéma Hotel réel (non mocké).

const Hotel = require('../models/Hotel');

const USER_ID = '507f1f77bcf86cd799439012';

const base = (overrides = {}) => new Hotel({
  name: 'Hôtel Le Panorama',
  createdBy: USER_ID,
  ...overrides,
});

describe('Hotel model — TEST DATA', () => {
  test('un nom est requis', async () => {
    const hotel = base({ name: '' });
    await expect(hotel.validate()).rejects.toThrow();
  });

  test('starRating hors 1-5 est rejeté', async () => {
    await expect(base({ starRating: 0 }).validate()).rejects.toThrow();
    await expect(base({ starRating: 6 }).validate()).rejects.toThrow();
  });

  test('starRating entre 1 et 5 est accepté', async () => {
    await expect(base({ starRating: 4 }).validate()).resolves.toBeUndefined();
  });

  test('un email manifestement invalide est rejeté', async () => {
    await expect(base({ email: 'pas-un-email' }).validate()).rejects.toThrow();
  });

  test('un email valide est normalisé en minuscules', async () => {
    const hotel = base({ email: 'CONTACT@Panorama.CG' });
    await expect(hotel.validate()).resolves.toBeUndefined();
    expect(hotel.email).toBe('contact@panorama.cg');
  });

  test('un site web manifestement invalide est rejeté', async () => {
    await expect(base({ website: 'ceci n\'est pas une url' }).validate()).rejects.toThrow();
  });

  test.each(['hotel-panorama.cg', 'https://hotel-panorama.cg', 'http://www.panorama.cg/fr'])(
    'un site web plausible (%s) est accepté',
    async (website) => {
      await expect(base({ website }).validate()).resolves.toBeUndefined();
    },
  );

  test('site web et email vides (non renseignés) sont acceptés', async () => {
    await expect(base({}).validate()).resolves.toBeUndefined();
  });

  test('status par défaut est "actif" et reste une enum contrôlée', async () => {
    const hotel = base();
    await expect(hotel.validate()).resolves.toBeUndefined();
    expect(hotel.status).toBe('actif');
    hotel.status = 'archive'; // valeur hors enum
    await expect(hotel.validate()).rejects.toThrow();
  });

  test('property est optionnel (aucun Property forcé à la création)', async () => {
    const hotel = base();
    await expect(hotel.validate()).resolves.toBeUndefined();
    expect(hotel.property).toBeNull();
  });

  test("aucune contrainte d'unicité métier sur le nom (deux hôtels peuvent partager un nom/une enseigne)", () => {
    const indexes = Hotel.schema.indexes();
    const nameUniqueIndex = indexes.find(([fields]) => fields.name !== undefined);
    expect(nameUniqueIndex).toBeUndefined();
  });

  test('timestamps activés (createdAt/updatedAt gérés par le schéma)', () => {
    expect(Hotel.schema.options.timestamps).toBe(true);
  });
});
