// Correctif crash mobile DetailAnnonceScreen (2026-07) — GET /api/accommodations/public/:id
// est la première route de détail Accommodation accessible publiquement (aucune sans auth
// n'existait auparavant). Lecture seule, mêmes règles de visibilité que la recherche publique.

const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const { getPublic } = require('../controllers/accommodationController');

jest.setTimeout(60000);
const ownerId = () => new mongoose.Types.ObjectId();

const baseProperty = (overrides = {}) => ({
  title: 'Villa Meublée Détail', description: 'Description suffisamment longue pour la validation du modèle.',
  pole: 'Altimmo', type: 'Villa', status: 'hebergement', price: 25000,
  address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: 4.26, longitude: 15.28,
  images: ['https://example.test/image.jpg'], surface: 150, statusAdmin: 'Validée', isPublished: true, availability: 'Disponible',
  owner: ownerId(), ...overrides,
});

const callGetPublic = async (id) => {
  const req = { params: { id: String(id) } };
  let statusCode = 200;
  let payload;
  const res = { status: (code) => { statusCode = code; return res; }, json: (body) => { payload = body; statusCode = statusCode || 200; return res; } };
  await getPublic(req, res);
  return { statusCode, payload };
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('GET /api/accommodations/public/:id', () => {
  test('renvoie le détail normalisé pour un hébergement publié et disponible', async () => {
    const property = await Property.create(baseProperty());
    const accommodation = await Accommodation.create({
      property: property._id, accommodationType: 'villa_meublee', publicationStatus: 'publie', createdBy: ownerId(),
    });

    const { payload } = await callGetPublic(accommodation._id);
    expect(payload.status).toBe('success');
    expect(payload.data.property.title).toBe('Villa Meublée Détail');
    expect(payload.data.property.accommodationType).toBe('villa_meublee');
    expect(String(payload.data.property.accommodationId)).toBe(String(accommodation._id));
  });

  test('404 si l’hébergement n’est pas publié', async () => {
    const property = await Property.create(baseProperty());
    const accommodation = await Accommodation.create({
      property: property._id, accommodationType: 'villa_meublee', publicationStatus: 'brouillon', createdBy: ownerId(),
    });
    const { statusCode } = await callGetPublic(accommodation._id);
    expect(statusCode).toBe(404);
  });

  test('404 si la Property liée n’est pas validée/disponible', async () => {
    const property = await Property.create(baseProperty({ statusAdmin: 'En attente' }));
    const accommodation = await Accommodation.create({
      property: property._id, accommodationType: 'villa_meublee', publicationStatus: 'publie', createdBy: ownerId(),
    });
    const { statusCode } = await callGetPublic(accommodation._id);
    expect(statusCode).toBe(404);
  });

  test('404 si l’identifiant n’existe pas', async () => {
    const { statusCode } = await callGetPublic(new mongoose.Types.ObjectId());
    expect(statusCode).toBe(404);
  });

  test('400 si l’identifiant est invalide', async () => {
    const { statusCode } = await callGetPublic('not-an-id');
    expect(statusCode).toBe(400);
  });
});
