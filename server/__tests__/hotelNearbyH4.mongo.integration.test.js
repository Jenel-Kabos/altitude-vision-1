// PHASE-H4 — hôtels à proximité, distance géospatiale réelle (Mongo
// $geoNear), jamais un calcul JS post-hoc ni une recommandation inventée.
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Hotel = require('../models/Hotel');
const Property = require('../models/Property');
const RoomCategory = require('../models/RoomCategory');
const RatePlan = require('../models/RatePlan');
const hotelRoutes = require('../routes/hotelRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const { findNearbyPublishedHotels } = require('../services/hotelService');

jest.setTimeout(120000);
const app = express(); app.use(express.json()); app.use('/api/hotels', hotelRoutes); app.use(errorHandler);
const id = () => new mongoose.Types.ObjectId();

// Repère de référence : Avenue de la Paix, Bacongo (Brazzaville) — les
// offsets ci-dessous produisent des distances croissantes déterministes.
const BASE = { lng: 15.2429, lat: -4.2634 };
const offset = (deltaLng, deltaLat) => [BASE.lng + deltaLng, BASE.lat + deltaLat];

async function makeProperty(owner, coordinates, overrides = {}) {
  return Property.create({
    title: 'Hôtel H4 Test', description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Commerce', status: 'hebergement', price: 0,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' },
    latitude: coordinates[1], longitude: coordinates[0],
    images: ['https://placehold.co/1200x800/png?text=H4'], surface: 100,
    statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', owner: owner.id || owner,
    ...overrides,
  });
}

// PHASE-H4 — `coordinates: null` simule le seul chemin structurel réel vers
// un hôtel sans coordonnées valides : Hotel.property est nullable (Property,
// elle, exige toujours latitude/longitude — voir audit §1), donc un hôtel
// "sans coordonnées" est un hôtel sans Property liée du tout.
async function makeHotel({ owner = { id: id() }, coordinates = offset(0, 0), propertyOverrides = {}, hotelOverrides = {} } = {}) {
  const property = coordinates ? await makeProperty(owner, coordinates, propertyOverrides) : null;
  const hotel = await Hotel.create({
    name: `Hôtel H4 ${Math.random().toString(36).slice(2)}`, manager: owner.id || owner, createdBy: owner.id || owner,
    publicationStatus: 'publie', active: true, property: property?._id || null, starRating: 4,
    ...hotelOverrides,
  });
  return { hotel, property, owner };
}

async function makeRoomCategoryWithPublicRate(hotel, amount = 30000) {
  const category = await RoomCategory.create({ hotel: hotel._id, name: 'Standard', code: `C-${Date.now()}-${Math.random()}`, status: 'actif', createdBy: hotel.manager });
  await RatePlan.create({ roomCategory: category._id, rateType: 'public', amount, currency: 'XAF', active: true, createdBy: hotel.manager });
  return category;
}

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([Hotel, Property, RoomCategory, RatePlan].map((m) => m.syncIndexes()));
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('findNearbyPublishedHotels — invariants (PHASE-H4)', () => {
  test('hôtel courant exclu du résultat', async () => {
    const { hotel: current } = await makeHotel({ coordinates: offset(0, 0) });
    const { hotel: other } = await makeHotel({ coordinates: offset(0.01, 0) });
    const result = await findNearbyPublishedHotels({ hotelId: current._id });
    expect(result.map((r) => String(r.hotelId))).toEqual([String(other._id)]);
    expect(result.map((r) => String(r.hotelId))).not.toContain(String(current._id));
  });

  test('le plus proche est renvoyé en premier', async () => {
    const { hotel: current } = await makeHotel({ coordinates: offset(0, 0) });
    const { hotel: far } = await makeHotel({ coordinates: offset(0.05, 0) });
    const { hotel: near } = await makeHotel({ coordinates: offset(0.01, 0) });
    const result = await findNearbyPublishedHotels({ hotelId: current._id });
    expect(result.map((r) => String(r.hotelId))).toEqual([String(near._id), String(far._id)]);
    expect(result[0].distanceMeters).toBeLessThan(result[1].distanceMeters);
  });

  test('un candidat publié est inclus', async () => {
    const { hotel: current } = await makeHotel({ coordinates: offset(0, 0) });
    const { hotel: candidate } = await makeHotel({ coordinates: offset(0.01, 0), hotelOverrides: { publicationStatus: 'publie' } });
    const result = await findNearbyPublishedHotels({ hotelId: current._id });
    expect(result.map((r) => String(r.hotelId))).toContain(String(candidate._id));
  });

  test('un candidat "soumis" est exclu', async () => {
    const { hotel: current } = await makeHotel({ coordinates: offset(0, 0) });
    await makeHotel({ coordinates: offset(0.01, 0), hotelOverrides: { publicationStatus: 'soumis' } });
    const result = await findNearbyPublishedHotels({ hotelId: current._id });
    expect(result).toEqual([]);
  });

  test('un candidat "rejeté" est exclu', async () => {
    const { hotel: current } = await makeHotel({ coordinates: offset(0, 0) });
    await makeHotel({ coordinates: offset(0.01, 0), hotelOverrides: { publicationStatus: 'rejete' } });
    const result = await findNearbyPublishedHotels({ hotelId: current._id });
    expect(result).toEqual([]);
  });

  test('un candidat inactif (active:false) est exclu', async () => {
    const { hotel: current } = await makeHotel({ coordinates: offset(0, 0) });
    await makeHotel({ coordinates: offset(0.01, 0), hotelOverrides: { active: false } });
    const result = await findNearbyPublishedHotels({ hotelId: current._id });
    expect(result).toEqual([]);
  });

  test('un candidat sans coordonnées (aucune Property liée) est exclu', async () => {
    const { hotel: current } = await makeHotel({ coordinates: offset(0, 0) });
    await makeHotel({ coordinates: null });
    const result = await findNearbyPublishedHotels({ hotelId: current._id });
    expect(result).toEqual([]);
  });

  test('hôtel courant sans coordonnées → liste vide, jamais une erreur', async () => {
    const { hotel: current } = await makeHotel({ coordinates: null });
    await makeHotel({ coordinates: offset(0.01, 0) });
    const result = await findNearbyPublishedHotels({ hotelId: current._id });
    expect(result).toEqual([]);
  });

  test('des hôtels publiés cross-tenant (managers différents) sont inclus', async () => {
    const { hotel: current } = await makeHotel({ owner: { id: id() }, coordinates: offset(0, 0) });
    const { hotel: otherTenant } = await makeHotel({ owner: { id: id() }, coordinates: offset(0.01, 0) });
    const result = await findNearbyPublishedHotels({ hotelId: current._id });
    expect(result.map((r) => String(r.hotelId))).toContain(String(otherTenant._id));
  });

  test('la distance est renvoyée en mètres, cohérente avec l’écart géographique', async () => {
    const { hotel: current } = await makeHotel({ coordinates: offset(0, 0) });
    await makeHotel({ coordinates: offset(0.01, 0) });
    const result = await findNearbyPublishedHotels({ hotelId: current._id });
    expect(typeof result[0].distanceMeters).toBe('number');
    expect(result[0].distanceMeters).toBeGreaterThan(500); // ~0.01° ≈ 1.1km à cette latitude
    expect(result[0].distanceMeters).toBeLessThan(2000);
  });

  test('la limite est respectée', async () => {
    const { hotel: current } = await makeHotel({ coordinates: offset(0, 0) });
    for (let i = 1; i <= 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await makeHotel({ coordinates: offset(0.001 * i, 0) });
    }
    const result = await findNearbyPublishedHotels({ hotelId: current._id, limit: 3 });
    expect(result).toHaveLength(3);
  });

  test('aucune donnée privée de tenant (manager/createdBy) n’est exposée', async () => {
    const { hotel: current } = await makeHotel({ coordinates: offset(0, 0) });
    await makeHotel({ coordinates: offset(0.01, 0) });
    const result = await findNearbyPublishedHotels({ hotelId: current._id });
    const payload = JSON.stringify(result);
    expect(payload).not.toMatch(/manager|createdBy|reviewedBy|rejectionReason|suspensionReason/);
  });

  test('le tarif de départ est correct quand un tarif public actif existe', async () => {
    const { hotel: current } = await makeHotel({ coordinates: offset(0, 0) });
    const { hotel: candidate } = await makeHotel({ coordinates: offset(0.01, 0) });
    await makeRoomCategoryWithPublicRate(candidate, 45000);
    const result = await findNearbyPublishedHotels({ hotelId: current._id });
    expect(result[0].startingPrice).toBe(45000);
    expect(result[0].currency).toBe('XAF');
  });

  test('le tarif de départ est null (jamais inventé) en l’absence de tarif public actif', async () => {
    const { hotel: current } = await makeHotel({ coordinates: offset(0, 0) });
    await makeHotel({ coordinates: offset(0.01, 0) });
    const result = await findNearbyPublishedHotels({ hotelId: current._id });
    expect(result[0].startingPrice).toBeNull();
    expect(result[0].currency).toBeNull();
  });
});

describe('GET /api/hotels/public/:hotelId/nearby (PHASE-H4)', () => {
  test('200 — retourne les hôtels à proximité pour un hôtel publié', async () => {
    const { hotel: current } = await makeHotel({ coordinates: offset(0, 0) });
    const { hotel: near } = await makeHotel({ coordinates: offset(0.01, 0) });
    const response = await request(app).get(`/api/hotels/public/${current._id}/nearby`);
    expect(response.status).toBe(200);
    expect(response.body.data.hotels.map((h) => h.hotelId)).toContain(String(near._id));
  });

  test('404 — hôtel courant non publié (jamais un endpoint de proximité pour un brouillon)', async () => {
    const { hotel: current } = await makeHotel({ coordinates: offset(0, 0), hotelOverrides: { publicationStatus: 'brouillon' } });
    const response = await request(app).get(`/api/hotels/public/${current._id}/nearby`);
    expect(response.status).toBe(404);
  });

  test('limit respecté via la query string', async () => {
    const { hotel: current } = await makeHotel({ coordinates: offset(0, 0) });
    for (let i = 1; i <= 4; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await makeHotel({ coordinates: offset(0.001 * i, 0) });
    }
    const response = await request(app).get(`/api/hotels/public/${current._id}/nearby?limit=2`);
    expect(response.body.data.hotels).toHaveLength(2);
  });
});
