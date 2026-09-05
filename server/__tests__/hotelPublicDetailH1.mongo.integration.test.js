// PHASE-H1 — preuve RED→GREEN de la projection normalisée `detail` sur
// GET /api/hotels/public/:id, canonique pour HotelDetailScreen (mobile).
const express = require('express');
const request = require('supertest');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const RatePlan = require('../models/RatePlan');
const hotelRoutes = require('../routes/hotelRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);
const app = express(); app.use(express.json()); app.use('/api/hotels', hotelRoutes); app.use(errorHandler);

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'H1 Owner', email: `h1-owner-${Date.now()}-${counter}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', ...overrides });
};
const makeProperty = (owner, overrides = {}) => Property.create({
  title: 'Hôtel Test H1', description: 'Description suffisamment longue pour la validation du modèle Property.',
  pole: 'Altimmo', type: 'Bureau', status: 'location', price: 0,
  address: { street: 'Avenue de la Paix', neighborhood: 'Centre', arrondissement: 'Bacongo', city: 'Brazzaville' },
  latitude: -4.26, longitude: 15.24,
  images: ['https://placehold.co/1200x800/png?text=H1'], surface: 500,
  statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', owner: owner._id, ...overrides,
});
const makeHotel = async (property, owner, overrides = {}) => Hotel.create({
  name: `Hôtel H1 ${Date.now()}-${++counter}`, manager: owner._id, createdBy: owner._id, property: property._id,
  publicationStatus: 'publie', active: true, description: 'Un hôtel confortable en plein centre-ville.',
  starRating: 4, hotelType: 'hotel', brand: 'Altimmo Collection',
  hotelServices: { restaurant: true, wifi: true, piscine: false, parking: true },
  gallery: [{ url: 'https://placehold.co/800x600/png?text=Hall', type: 'photo', isCover: true, order: 0 }],
  policies: { checkInTime: '14:00', checkOutTime: '11:00', cancellation: 'Annulation gratuite jusqu’à 48h avant', pets: 'Non admis', children: 'Bienvenus' },
  taxInformation: { taxIdentifier: 'NIU-SECRET-12345', taxRegime: 'regime_reel', vatRate: 18 },
  legalName: 'Altimmo Hôtellerie SARL',
  administrativeDocuments: [{ label: 'Registre de commerce', url: 'https://storage.example.test/private/rccm.pdf', documentType: 'rccm' }],
  contact: { horaires: '24h/24', languesParlees: ['Français', 'Lingala'], responsable: 'Jean Mabiala' },
  ...overrides,
});
const makeCategory = (hotel, owner, overrides = {}) => RoomCategory.create({
  hotel: hotel._id, name: 'Chambre Deluxe', createdBy: owner._id, status: 'actif',
  capacity: { maxAdults: 2, maxChildren: 1 }, beds: 2, surface: 28,
  amenities: { cuisine: [], salon: ['Climatisation'], internet: ['Wifi'], exterieur: [], parking: [], securite: [] },
  gallery: [{ url: 'https://placehold.co/800x600/png?text=Chambre', type: 'photo', isCover: true, order: 0 }],
  ...overrides,
});
const makeRate = (category, owner, overrides = {}) => RatePlan.create({
  roomCategory: category._id, rateType: 'public', amount: 45000, currency: 'XAF', active: true, createdBy: owner._id, ...overrides,
});

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('GET /api/hotels/public/:id — projection normalisée H1', () => {
  test('un hôtel publié renvoie une projection `detail` complète et sûre', async () => {
    const owner = await makeUser();
    const property = await makeProperty(owner);
    const hotel = await makeHotel(property, owner);
    const category = await makeCategory(hotel, owner);
    await makeRate(category, owner);

    const response = await request(app).get(`/api/hotels/public/${hotel._id}`);
    expect(response.status).toBe(200);
    const { detail } = response.body.data;
    expect(detail).toBeTruthy();

    expect(detail.id).toBe(String(hotel._id));
    expect(detail.name).toBe(hotel.name);
    expect(detail.hotelType).toBe('hotel');
    expect(detail.starRating).toBe(4);
    expect(detail.description).toBe('Un hôtel confortable en plein centre-ville.');
  });

  test('la galerie de l’hôtel est renvoyée', async () => {
    const owner = await makeUser();
    const property = await makeProperty(owner);
    const hotel = await makeHotel(property, owner);
    const response = await request(app).get(`/api/hotels/public/${hotel._id}`);
    expect(response.body.data.detail.gallery).toHaveLength(1);
    expect(response.body.data.detail.gallery[0].url).toBe('https://placehold.co/800x600/png?text=Hall');
  });

  test('la localisation est jointe depuis Property (adresse + coordonnées)', async () => {
    const owner = await makeUser();
    const property = await makeProperty(owner);
    const hotel = await makeHotel(property, owner);
    const response = await request(app).get(`/api/hotels/public/${hotel._id}`);
    const { location } = response.body.data.detail;
    expect(location.city).toBe('Brazzaville');
    expect(location.district).toBe('Bacongo');
    expect(location.address).toBe('Avenue de la Paix');
    expect(location.coordinates).toEqual([15.24, -4.26]);
    expect(location.country).toBeNull();
  });

  test('les catégories de chambres et leurs tarifs sont joints', async () => {
    const owner = await makeUser();
    const property = await makeProperty(owner);
    const hotel = await makeHotel(property, owner);
    const category = await makeCategory(hotel, owner);
    await makeRate(category, owner);

    const response = await request(app).get(`/api/hotels/public/${hotel._id}`);
    const { roomCategories } = response.body.data.detail;
    expect(roomCategories).toHaveLength(1);
    expect(roomCategories[0].name).toBe('Chambre Deluxe');
    expect(roomCategories[0].capacity).toEqual(expect.objectContaining({ maxAdults: 2, maxChildren: 1 }));
    expect(roomCategories[0].bedCount).toBe(2);
    expect(roomCategories[0].size).toBe(28);
    expect(roomCategories[0].rates).toHaveLength(1);
    expect(roomCategories[0].rates[0]).toEqual(expect.objectContaining({ rateType: 'public', amount: 45000, currency: 'XAF' }));
  });

  test('seules les politiques publiques-sûres sont exposées', async () => {
    const owner = await makeUser();
    const property = await makeProperty(owner);
    const hotel = await makeHotel(property, owner);
    const response = await request(app).get(`/api/hotels/public/${hotel._id}`);
    // PHASE-H3 — clés normalisées par buildNormalizedPolicies (checkIn/checkOut,
    // plus smoking/deposit/paymentMethods/minimumAge, absents ici faute d'Accommodation liée).
    expect(response.body.data.detail.policies).toEqual({
      checkIn: '14:00', checkOut: '11:00',
      cancellation: 'Annulation gratuite jusqu’à 48h avant', pets: 'Non admis', children: 'Bienvenus',
      visitors: null, accessibility: null, smoking: null, deposit: null, paymentMethods: null, minimumAge: null,
    });
  });

  test('aucune donnée légale/administrative privée n’est exposée', async () => {
    const owner = await makeUser();
    const property = await makeProperty(owner);
    const hotel = await makeHotel(property, owner);
    const response = await request(app).get(`/api/hotels/public/${hotel._id}`);
    const payload = JSON.stringify(response.body);
    expect(response.body.data.detail.legal).toBeNull();
    expect(payload).not.toMatch(/NIU-SECRET-12345|regime_reel|Altimmo Hôtellerie SARL|rccm\.pdf|taxIdentifier|administrativeDocuments|legalName/);
  });

  test('aucune donnée interne de tenant/modération n’est exposée', async () => {
    const owner = await makeUser();
    const property = await makeProperty(owner);
    const hotel = await makeHotel(property, owner);
    const response = await request(app).get(`/api/hotels/public/${hotel._id}`);
    const payload = JSON.stringify(response.body);
    expect(payload).not.toMatch(/manager|createdBy|updatedBy|reviewedBy|moderationHistory|versionHistory|proposedVersion/);
  });

  test('champs optionnels absents → null/tableau vide, jamais inventés', async () => {
    const owner = await makeUser();
    const property = await makeProperty(owner);
    const hotel = await makeHotel(property, owner, { gallery: [], policies: undefined, contact: undefined, brand: undefined });
    const response = await request(app).get(`/api/hotels/public/${hotel._id}`);
    const { detail } = response.body.data;
    expect(detail.gallery).toEqual([]);
    // policies conserve ses valeurs par défaut de schéma (checkIn/checkOut) ;
    // les champs libres non renseignés (default: '') sont normalisés en null.
    expect(detail.policies).toEqual({ checkIn: '14:00', checkOut: '11:00', cancellation: null, pets: null, children: null, visitors: null, accessibility: null, smoking: null, deposit: null, paymentMethods: null, minimumAge: null });
    expect(detail.contact).toEqual({ horaires: null, languesParlees: [] });
    expect(detail.brand).toBeNull();
    expect(detail.roomCategories).toEqual([]);
  });

  test('un hôtel en attente de modération (soumis) n’est pas accessible publiquement', async () => {
    const owner = await makeUser();
    const property = await makeProperty(owner);
    const hotel = await makeHotel(property, owner, { publicationStatus: 'soumis' });
    const response = await request(app).get(`/api/hotels/public/${hotel._id}`);
    expect(response.status).toBe(404);
  });

  test('un hôtel rejeté n’est pas accessible publiquement', async () => {
    const owner = await makeUser();
    const property = await makeProperty(owner);
    const hotel = await makeHotel(property, owner, { publicationStatus: 'rejete' });
    const response = await request(app).get(`/api/hotels/public/${hotel._id}`);
    expect(response.status).toBe(404);
  });

  test('un hôtel inactif n’est pas accessible publiquement', async () => {
    const owner = await makeUser();
    const property = await makeProperty(owner);
    const hotel = await makeHotel(property, owner, { active: false });
    const response = await request(app).get(`/api/hotels/public/${hotel._id}`);
    expect(response.status).toBe(404);
  });

  test('un en-tête tenant forgé n’altère pas la visibilité publique', async () => {
    const owner = await makeUser();
    const property = await makeProperty(owner);
    const hotel = await makeHotel(property, owner);
    const response = await request(app).get(`/api/hotels/public/${hotel._id}`).set('X-Platform-Tenant-Id', 'forged-tenant-id');
    expect(response.status).toBe(200);
    expect(response.body.data.detail.id).toBe(String(hotel._id));
  });
});
