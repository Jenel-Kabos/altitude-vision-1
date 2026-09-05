// PHASE-HX1 — extranet professionnel : édition complète de RoomCategory,
// galerie de chambre (upload Cloudinary réutilisé), stock vendable par date
// (jamais un second champ persistant), synchronisation sûre de
// unitsAvailable, isolation tenant.
jest.mock('../config/cloudinary', () => {
  const actual = jest.requireActual('../config/cloudinary');
  let counter = 0;
  return {
    ...actual,
    uploadToCloudinary: jest.fn(async () => ({ secure_url: `https://cloudinary.test/room-${++counter}.jpg` })),
  };
});
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const RoomInventory = require('../models/RoomInventory');
const HotelReservation = require('../models/HotelReservation');
const hotelRoutes = require('../routes/hotelRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const { applySellableInventoryUpdates, syncFutureTotalUnits } = require('../services/hotel/hotelInventoryProfessionalService');
const { normalizeDate, ensureInventoryExists } = require('../services/hotelAvailabilityService');

jest.setTimeout(120000);
const app = express(); app.use(express.json()); app.use('/api/hotels', hotelRoutes); app.use(errorHandler);

let userCounter = 0;
async function makeUser(overrides = {}) {
  userCounter += 1;
  return User.create({ name: `HX1 User ${userCounter}`, email: `hx1-user-${Date.now()}-${userCounter}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true, ...overrides });
}
async function makeHotel(overrides = {}) {
  const manager = await makeUser();
  const hotel = await Hotel.create({ name: `Hôtel HX1 ${Math.random().toString(36).slice(2)}`, manager: manager._id, createdBy: manager._id, publicationStatus: 'publie', active: true, ...overrides });
  return { hotel, manager };
}
async function makeCategory(hotel, overrides = {}) {
  return RoomCategory.create({ hotel: hotel._id, name: 'Standard', code: `C-${Date.now()}-${Math.random()}`, status: 'actif', capacity: { maxAdults: 2, maxChildren: 1 }, unitsAvailable: 5, createdBy: hotel.manager, ...overrides });
}
const bearer = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });
const daysFromNow = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return normalizeDate(d); };

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([Hotel, RoomCategory, RoomInventory, HotelReservation].map((m) => m.syncIndexes()));
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('RoomCategory — édition complète (PHASE-HX1 §9)', () => {
  test('tous les champs canoniques mutables sont éditables via PATCH', async () => {
    const { hotel, manager } = await makeHotel();
    const category = await makeCategory(hotel);
    const owner = await User.findById(manager);
    const response = await request(app)
      .patch(`/api/hotels/room-categories/${category._id}`)
      .set(bearer(owner))
      .send({
        name: 'Deluxe', description: 'Vue mer', capacity: { maxAdults: 3, maxChildren: 2 },
        beds: 2, surface: 32, unitsAvailable: 8,
        amenities: { salon: ['Climatisation', 'TV'], internet: ['Wifi'] },
        gallery: [{ url: 'https://cloudinary.test/existing.jpg', order: 0 }],
      });
    expect(response.status).toBe(200);
    expect(response.body.data.category).toEqual(expect.objectContaining({
      name: 'Deluxe', description: 'Vue mer', beds: 2, surface: 32, unitsAvailable: 8,
    }));
    expect(response.body.data.category.capacity).toEqual(expect.objectContaining({ maxAdults: 3, maxChildren: 2 }));
    expect(response.body.data.category.amenities.salon).toEqual(['Climatisation', 'TV']);
    expect(response.body.data.category.gallery).toHaveLength(1);
  });

  test('un autre propriétaire ne peut pas éditer cette catégorie (isolation tenant)', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    const { manager: intruder } = await makeHotel();
    const response = await request(app)
      .patch(`/api/hotels/room-categories/${category._id}`)
      .set(bearer(await User.findById(intruder)))
      .send({ name: 'Piraté' });
    expect(response.status).toBe(403);
  });
});

describe('Room gallery upload (PHASE-HX1 §10)', () => {
  test('le propriétaire peut uploader des photos de catégorie (Cloudinary réutilisé)', async () => {
    const { hotel, manager } = await makeHotel();
    const category = await makeCategory(hotel);
    const response = await request(app)
      .post(`/api/hotels/room-categories/${category._id}/gallery`)
      .set(bearer(await User.findById(manager)))
      .attach('images', Buffer.from('fake-image-bytes'), 'chambre.jpg');
    expect(response.status).toBe(201);
    expect(response.body.data.urls).toHaveLength(1);
    expect(response.body.data.urls[0]).toMatch(/^https:\/\/cloudinary\.test\//);
  });

  test('sans fichier fourni, upload refusé (422)', async () => {
    const { hotel, manager } = await makeHotel();
    const category = await makeCategory(hotel);
    const response = await request(app)
      .post(`/api/hotels/room-categories/${category._id}/gallery`)
      .set(bearer(await User.findById(manager)));
    expect(response.status).toBe(422);
  });

  test('un autre propriétaire ne peut pas uploader sur cette catégorie', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    const { manager: intruder } = await makeHotel();
    const response = await request(app)
      .post(`/api/hotels/room-categories/${category._id}/gallery`)
      .set(bearer(await User.findById(intruder)))
      .attach('images', Buffer.from('fake-image-bytes'), 'chambre.jpg');
    expect(response.status).toBe(403);
  });
});

describe('applySellableInventoryUpdates — stock vendable par date (PHASE-HX1 §15-17)', () => {
  test('des valeurs différentes sur des dates consécutives sont appliquées en un seul appel', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel, { unitsAvailable: 5 });
    const updates = [
      { date: daysFromNow(5), sellableUnits: 5 },
      { date: daysFromNow(6), sellableUnits: 5 },
      { date: daysFromNow(7), sellableUnits: 3 },
      { date: daysFromNow(8), sellableUnits: 0 },
    ];
    const results = await applySellableInventoryUpdates({ hotelId: hotel._id, roomCategoryId: category._id, updates, updatedBy: hotel.manager });
    expect(results.every((r) => r.ok)).toBe(true);
    const docs = await RoomInventory.find({ roomCategory: category._id }).sort({ date: 1 });
    expect(docs.map((d) => d.totalUnits - d.blockedUnits)).toEqual([5, 5, 3, 0]);
  });

  test('jamais un second champ persistant : seul blockedUnits est écrit', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel, { unitsAvailable: 5 });
    await applySellableInventoryUpdates({ hotelId: hotel._id, roomCategoryId: category._id, updates: [{ date: daysFromNow(5), sellableUnits: 3 }], updatedBy: hotel.manager });
    const doc = await RoomInventory.findOne({ roomCategory: category._id, date: daysFromNow(5) });
    expect(doc.toObject().sellableUnits).toBeUndefined();
    expect(doc.blockedUnits).toBe(2);
  });

  test('une valeur dépassant la capacité physique est refusée', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel, { unitsAvailable: 5 });
    const results = await applySellableInventoryUpdates({ hotelId: hotel._id, roomCategoryId: category._id, updates: [{ date: daysFromNow(5), sellableUnits: 9 }], updatedBy: hotel.manager });
    expect(results[0]).toEqual(expect.objectContaining({ ok: false, code: 'INVENTORY_EXCEEDS_CAPACITY' }));
  });

  test('une valeur négative est refusée', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    const results = await applySellableInventoryUpdates({ hotelId: hotel._id, roomCategoryId: category._id, updates: [{ date: daysFromNow(5), sellableUnits: -1 }], updatedBy: hotel.manager });
    expect(results[0]).toEqual(expect.objectContaining({ ok: false, code: 'INVENTORY_INVALID_VALUE' }));
  });

  test('le stock vendable ne peut jamais descendre sous le déjà-réservé', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel, { unitsAvailable: 5 });
    const date = daysFromNow(5);
    await ensureInventoryExists(hotel._id, category._id, [date], category);
    await RoomInventory.updateOne({ roomCategory: category._id, date }, { $set: { reservedUnits: 4 } });
    const results = await applySellableInventoryUpdates({ hotelId: hotel._id, roomCategoryId: category._id, updates: [{ date, sellableUnits: 2 }], updatedBy: hotel.manager });
    expect(results[0]).toEqual(expect.objectContaining({ ok: false, code: 'INVENTORY_BELOW_RESERVED', reservedUnits: 4 }));
    const doc = await RoomInventory.findOne({ roomCategory: category._id, date });
    expect(doc.blockedUnits).toBe(0); // inchangé, jamais une écriture partielle
  });

  test('demander exactement le déjà-réservé est accepté (limite incluse)', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel, { unitsAvailable: 5 });
    const date = daysFromNow(5);
    await ensureInventoryExists(hotel._id, category._id, [date], category);
    await RoomInventory.updateOne({ roomCategory: category._id, date }, { $set: { reservedUnits: 3 } });
    const results = await applySellableInventoryUpdates({ hotelId: hotel._id, roomCategoryId: category._id, updates: [{ date, sellableUnits: 3 }], updatedBy: hotel.manager });
    expect(results[0].ok).toBe(true);
  });

  test('plus de 62 dates en un seul appel est refusé', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    const updates = Array.from({ length: 63 }, (_, i) => ({ date: daysFromNow(i), sellableUnits: 1 }));
    await expect(applySellableInventoryUpdates({ hotelId: hotel._id, roomCategoryId: category._id, updates, updatedBy: hotel.manager }))
      .rejects.toMatchObject({ statusCode: 422 });
  });

  test('une catégorie appartenant à un autre hôtel est refusée (isolation)', async () => {
    const { hotel: hotelA } = await makeHotel();
    const { hotel: hotelB } = await makeHotel();
    const category = await makeCategory(hotelA);
    await expect(applySellableInventoryUpdates({ hotelId: hotelB._id, roomCategoryId: category._id, updates: [{ date: daysFromNow(5), sellableUnits: 1 }], updatedBy: hotelB.manager }))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('PATCH /:hotelId/inventory/days — endpoint HTTP (PHASE-HX1)', () => {
  test('200 — le propriétaire applique un lot de dates différentes', async () => {
    const { hotel, manager } = await makeHotel();
    const category = await makeCategory(hotel, { unitsAvailable: 4 });
    const response = await request(app)
      .patch(`/api/hotels/${hotel._id}/inventory/days`)
      .set(bearer(await User.findById(manager)))
      .send({ roomCategoryId: category._id, updates: [{ date: daysFromNow(5), sellableUnits: 4 }, { date: daysFromNow(6), sellableUnits: 1 }] });
    expect(response.status).toBe(200);
    expect(response.body.data.results.every((r) => r.ok)).toBe(true);
  });

  test('403 — hôtel appartenant à un autre propriétaire', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    const { manager: intruder } = await makeHotel();
    const response = await request(app)
      .patch(`/api/hotels/${hotel._id}/inventory/days`)
      .set(bearer(await User.findById(intruder)))
      .send({ roomCategoryId: category._id, updates: [{ date: daysFromNow(5), sellableUnits: 1 }] });
    expect(response.status).toBe(403);
  });

  test('403 — un jeton tenant forgé ne contourne pas l’accès opérationnel', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    const { manager: intruder } = await makeHotel();
    const forgedToken = jwt.sign({ id: intruder, tokenVersion: 0, platformTenant: 'not-a-real-tenant' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const response = await request(app)
      .patch(`/api/hotels/${hotel._id}/inventory/days`)
      .set('Authorization', `Bearer ${forgedToken}`)
      .set('x-tenant-id', String(hotel._id))
      .send({ roomCategoryId: category._id, updates: [{ date: daysFromNow(5), sellableUnits: 1 }] });
    expect(response.status).toBe(403);
  });
});

describe('syncFutureTotalUnits — capacité physique (PHASE-HX1 §12)', () => {
  test('augmente totalUnits pour les dates futures sûres', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel, { unitsAvailable: 5 });
    const date = daysFromNow(10);
    await ensureInventoryExists(hotel._id, category._id, [date], category);
    await syncFutureTotalUnits(category._id, 8);
    const doc = await RoomInventory.findOne({ roomCategory: category._id, date });
    expect(doc.totalUnits).toBe(8);
  });

  test('ne touche jamais une date passée', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel, { unitsAvailable: 5 });
    const pastDate = normalizeDate(new Date(Date.now() - 5 * 86400000));
    await RoomInventory.create({ hotel: hotel._id, roomCategory: category._id, date: pastDate, totalUnits: 5, reservedUnits: 2, blockedUnits: 0 });
    await syncFutureTotalUnits(category._id, 1);
    const doc = await RoomInventory.findOne({ roomCategory: category._id, date: pastDate });
    expect(doc.totalUnits).toBe(5); // inchangé
  });

  test('ne corrompt jamais une date où le nouveau total serait inférieur au déjà-réservé', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel, { unitsAvailable: 5 });
    const date = daysFromNow(10);
    await ensureInventoryExists(hotel._id, category._id, [date], category);
    await RoomInventory.updateOne({ roomCategory: category._id, date }, { $set: { reservedUnits: 4 } });
    await syncFutureTotalUnits(category._id, 2);
    const doc = await RoomInventory.findOne({ roomCategory: category._id, date });
    expect(doc.totalUnits).toBe(5); // inchangé, jamais 2 (< reservedUnits)
  });

  test('déclenché automatiquement par PATCH room-categories/:id quand unitsAvailable change', async () => {
    const { hotel, manager } = await makeHotel();
    const category = await makeCategory(hotel, { unitsAvailable: 5 });
    const date = daysFromNow(10);
    await ensureInventoryExists(hotel._id, category._id, [date], category);
    const response = await request(app)
      .patch(`/api/hotels/room-categories/${category._id}`)
      .set(bearer(await User.findById(manager)))
      .send({ unitsAvailable: 7 });
    expect(response.status).toBe(200);
    const doc = await RoomInventory.findOne({ roomCategory: category._id, date });
    expect(doc.totalUnits).toBe(7);
  });
});

describe('Non-régression H2 — surbooking et disponibilité inchangés (PHASE-HX1 §35)', () => {
  test('le stock vendable réduit via HX1 est bien respecté par la recherche de disponibilité H2', async () => {
    const { searchAvailableRoomCategories } = require('../services/hotelReservationService');
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel, { unitsAvailable: 5 });
    const RatePlan = require('../models/RatePlan');
    await RatePlan.create({ roomCategory: category._id, rateType: 'public', amount: 30000, currency: 'XAF', active: true, createdBy: hotel.manager });
    const checkIn = daysFromNow(20);
    const checkOut = daysFromNow(22);
    await applySellableInventoryUpdates({
      hotelId: hotel._id, roomCategoryId: category._id, updatedBy: hotel.manager,
      updates: [{ date: checkIn, sellableUnits: 0 }, { date: new Date(checkIn.getTime() + 86400000), sellableUnits: 2 }],
    });
    const result = await searchAvailableRoomCategories({ hotelId: hotel._id, checkInDate: checkIn.toISOString().slice(0, 10), checkOutDate: checkOut.toISOString().slice(0, 10), roomsCount: 1, adults: 1, children: 0 });
    // Une nuit à 0 vendable rend toute la catégorie indisponible pour ce séjour.
    expect(result.roomCategories).toHaveLength(0);
  });
});
