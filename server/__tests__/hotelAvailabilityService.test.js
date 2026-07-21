// __tests__/hotelAvailabilityService.test.js — Sprint C
//
// RoomCategory/RoomInventory sont mockés (comme toutes les suites de
// contrôleurs de ce projet), MAIS le mock de `RoomInventory.findOneAndUpdate`
// reproduit fidèlement la sémantique ATOMIQUE réelle de MongoDB : lecture +
// condition + mutation dans un seul appel synchrone, sur un état partagé en
// mémoire — exactement le contrat qu'un `findOneAndUpdate` réel garantit
// nativement sur un document unique, même sans replica set/transaction
// (voir l'en-tête de hotelAvailabilityService.js). Ce test démontre donc
// que LA LOGIQUE DU SERVICE respecte cette atomicité ; l'atomicité
// elle-même reste une garantie de la base de données, pas quelque chose
// qu'un test unitaire peut re-prouver indépendamment sans serveur réel.

jest.mock('../models/RoomCategory');
jest.mock('../models/RoomInventory');
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const RoomCategory = require('../models/RoomCategory');
const RoomInventory = require('../models/RoomInventory');
const {
  getNightDates, isPastDate, assertNotPast, getAvailability, assertAvailability,
  reserveInventory, releaseInventory,
} = require('../services/hotelAvailabilityService');

const HOTEL_ID = '707f1f77bcf86cd799439055';
const CATEGORY_ID = '807f1f77bcf86cd799439066';

/** Simule fidèlement la collection RoomInventory avec un état en mémoire. */
function makeInventoryStore(initialDocs = []) {
  const docs = new Map();
  initialDocs.forEach((d) => docs.set(d.date.toISOString(), { ...d }));

  RoomInventory.find = jest.fn(async ({ roomCategory, date }) => {
    const wanted = date?.$in || [];
    return wanted
      .map((d) => docs.get(new Date(d).toISOString()))
      .filter(Boolean)
      .map((d) => ({ ...d }));
  });

  RoomInventory.findOneAndUpdate = jest.fn(async (filter, update, options = {}) => {
    const dateKey = new Date(filter.date).toISOString();
    let doc = docs.get(dateKey);

    // Upsert (ensureInventoryExists) — $setOnInsert uniquement si absent.
    if (update.$setOnInsert) {
      if (!doc) {
        doc = { ...update.$setOnInsert };
        docs.set(dateKey, doc);
      }
      return { ...doc };
    }

    if (!doc) return null;
    if (filter.isClosed?.$ne !== undefined && doc.isClosed) return null;
    if (filter.stopSell?.$ne !== undefined && doc.stopSell) return null;

    if (update.$inc?.reservedUnits !== undefined) {
      const delta = update.$inc.reservedUnits;
      if (delta > 0) {
        // Condition atomique : reservedUnits + delta <= totalUnits - blockedUnits
        const wouldBe = doc.reservedUnits + delta;
        const capacity = doc.totalUnits - doc.blockedUnits;
        if (wouldBe > capacity) return null;
      } else {
        // Libération : garde-fou reservedUnits >= |delta|
        if (filter.reservedUnits?.$gte !== undefined && doc.reservedUnits < filter.reservedUnits.$gte) return null;
      }
      doc.reservedUnits += delta;
      return { ...doc };
    }
    return { ...doc };
  });

  return docs;
}

describe('hotelAvailabilityService — dates — TEST DATA', () => {
  test('getNightDates : une nuit (1 jour d\'écart)', () => {
    const nights = getNightDates('2026-08-10', '2026-08-11');
    expect(nights).toHaveLength(1);
  });

  test('getNightDates : plusieurs nuits', () => {
    const nights = getNightDates('2026-08-10', '2026-08-15');
    expect(nights).toHaveLength(5);
  });

  test('la nuit de départ n\'est jamais consommée (checkOut exclusif)', () => {
    const nights = getNightDates('2026-08-10', '2026-08-12');
    expect(nights.map((d) => d.toISOString().slice(0, 10))).toEqual(['2026-08-10', '2026-08-11']);
  });

  test('checkOut == checkIn est rejeté (0 nuit)', () => {
    expect(() => getNightDates('2026-08-10', '2026-08-10')).toThrow();
  });

  test('checkOut < checkIn est rejeté', () => {
    expect(() => getNightDates('2026-08-10', '2026-08-05')).toThrow();
  });

  test('les dates sont normalisées à minuit UTC quel que soit l\'horaire fourni', () => {
    const nights = getNightDates('2026-08-10T23:59:00+05:00', '2026-08-12T00:00:00Z');
    expect(nights[0].getUTCHours()).toBe(0);
  });

  test('isPastDate détecte une date antérieure à aujourd\'hui', () => {
    expect(isPastDate('2020-01-01')).toBe(true);
    expect(isPastDate('2999-01-01')).toBe(false);
  });

  test('assertNotPast rejette une date passée par défaut', () => {
    expect(() => assertNotPast('2020-01-01')).toThrow();
  });

  test('assertNotPast accepte une date passée si allowPast=true (privilège admin explicite)', () => {
    expect(() => assertNotPast('2020-01-01', { allowPast: true })).not.toThrow();
  });
});

describe('hotelAvailabilityService — getAvailability — TEST DATA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    RoomCategory.findById = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, unitsAvailable: 3, status: 'actif', hotel: HOTEL_ID });
  });

  test('stock suffisant sur toutes les nuits → disponible', async () => {
    makeInventoryStore([]);
    const result = await getAvailability({ roomCategoryId: CATEGORY_ID, checkInDate: '2026-08-10', checkOutDate: '2026-08-12', roomsCount: 2 });
    expect(result.available).toBe(true);
    expect(result.nights).toHaveLength(2);
  });

  test('stock insuffisant sur une nuit → indisponible, dates listées', async () => {
    makeInventoryStore([
      { hotel: HOTEL_ID, roomCategory: CATEGORY_ID, date: new Date('2026-08-11T00:00:00Z'), totalUnits: 3, blockedUnits: 0, reservedUnits: 3, isClosed: false, stopSell: false },
    ]);
    const result = await getAvailability({ roomCategoryId: CATEGORY_ID, checkInDate: '2026-08-10', checkOutDate: '2026-08-12', roomsCount: 1 });
    expect(result.available).toBe(false);
    expect(result.unavailableDates).toHaveLength(1);
  });

  test('catégorie fermée (isClosed) sur une nuit → indisponible', async () => {
    makeInventoryStore([
      { hotel: HOTEL_ID, roomCategory: CATEGORY_ID, date: new Date('2026-08-10T00:00:00Z'), totalUnits: 3, blockedUnits: 0, reservedUnits: 0, isClosed: true, stopSell: false },
    ]);
    const result = await getAvailability({ roomCategoryId: CATEGORY_ID, checkInDate: '2026-08-10', checkOutDate: '2026-08-11', roomsCount: 1 });
    expect(result.available).toBe(false);
  });

  test('stop-sell sur une nuit → indisponible', async () => {
    makeInventoryStore([
      { hotel: HOTEL_ID, roomCategory: CATEGORY_ID, date: new Date('2026-08-10T00:00:00Z'), totalUnits: 3, blockedUnits: 0, reservedUnits: 0, isClosed: false, stopSell: true },
    ]);
    const result = await getAvailability({ roomCategoryId: CATEGORY_ID, checkInDate: '2026-08-10', checkOutDate: '2026-08-11', roomsCount: 1 });
    expect(result.available).toBe(false);
  });

  test('unités bloquées réduisent la disponibilité effective', async () => {
    makeInventoryStore([
      { hotel: HOTEL_ID, roomCategory: CATEGORY_ID, date: new Date('2026-08-10T00:00:00Z'), totalUnits: 3, blockedUnits: 2, reservedUnits: 0, isClosed: false, stopSell: false },
    ]);
    const result = await getAvailability({ roomCategoryId: CATEGORY_ID, checkInDate: '2026-08-10', checkOutDate: '2026-08-11', roomsCount: 2 });
    expect(result.available).toBe(false); // 3-2=1 dispo, 2 demandées
  });

  test('assertAvailability lève une 409 avec unavailableDates si insuffisant', async () => {
    makeInventoryStore([
      { hotel: HOTEL_ID, roomCategory: CATEGORY_ID, date: new Date('2026-08-10T00:00:00Z'), totalUnits: 1, blockedUnits: 0, reservedUnits: 1, isClosed: false, stopSell: false },
    ]);
    await expect(assertAvailability({ roomCategoryId: CATEGORY_ID, checkInDate: '2026-08-10', checkOutDate: '2026-08-11', roomsCount: 1 }))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('hotelAvailabilityService — reserveInventory / releaseInventory — TEST DATA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    RoomCategory.findById = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, unitsAvailable: 2, status: 'actif', hotel: HOTEL_ID });
  });

  test('réservation réussie sur plusieurs nuits avec stock suffisant', async () => {
    makeInventoryStore([]);
    const result = await reserveInventory({ hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, checkInDate: '2026-08-10', checkOutDate: '2026-08-13', roomsCount: 1 });
    expect(result.ok).toBe(true);
    expect(result.nights).toHaveLength(3);
  });

  test('échec sur une nuit → aucune réservation partielle (toutes les nuits déjà prises sont libérées)', async () => {
    const docs = makeInventoryStore([
      { hotel: HOTEL_ID, roomCategory: CATEGORY_ID, date: new Date('2026-08-12T00:00:00Z'), totalUnits: 1, blockedUnits: 0, reservedUnits: 1, isClosed: false, stopSell: false },
    ]);
    const result = await reserveInventory({ hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, checkInDate: '2026-08-10', checkOutDate: '2026-08-13', roomsCount: 1 });
    expect(result.ok).toBe(false);
    expect(result.conflictDate.toISOString().slice(0, 10)).toBe('2026-08-12');
    // Les nuits du 10 et 11 (réservées avec succès avant l'échec du 12) ont
    // bien été libérées — aucune trace de réservation partielle.
    expect(docs.get('2026-08-10T00:00:00.000Z').reservedUnits).toBe(0);
    expect(docs.get('2026-08-11T00:00:00.000Z').reservedUnits).toBe(0);
  });

  test('releaseInventory décrémente reservedUnits sur chaque nuit', async () => {
    const docs = makeInventoryStore([
      { hotel: HOTEL_ID, roomCategory: CATEGORY_ID, date: new Date('2026-08-10T00:00:00Z'), totalUnits: 2, blockedUnits: 0, reservedUnits: 1, isClosed: false, stopSell: false },
    ]);
    await releaseInventory({ roomCategoryId: CATEGORY_ID, checkInDate: '2026-08-10', checkOutDate: '2026-08-11', roomsCount: 1 });
    expect(docs.get('2026-08-10T00:00:00.000Z').reservedUnits).toBe(0);
  });
});

describe('hotelAvailabilityService — CONCURRENCE : deux réservations simultanées ne surbookent jamais — TEST DATA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    RoomCategory.findById = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, unitsAvailable: 1, status: 'actif', hotel: HOTEL_ID });
  });

  test('avec 1 seule unité disponible, deux créations concurrentes → une seule réussit, l\'autre échoue proprement (jamais les deux)', async () => {
    makeInventoryStore([]);

    const [resultA, resultB] = await Promise.all([
      reserveInventory({ hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, checkInDate: '2026-09-01', checkOutDate: '2026-09-02', roomsCount: 1 }),
      reserveInventory({ hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, checkInDate: '2026-09-01', checkOutDate: '2026-09-02', roomsCount: 1 }),
    ]);

    const outcomes = [resultA.ok, resultB.ok];
    expect(outcomes.filter(Boolean)).toHaveLength(1); // exactement une des deux a réussi
    expect(outcomes.filter((ok) => !ok)).toHaveLength(1); // l'autre a échoué proprement (409 côté appelant), jamais un surbooking silencieux
  });

  test('avec 2 unités disponibles et 2 demandes concurrentes d\'1 chambre chacune, les deux réussissent (pas de faux rejet)', async () => {
    RoomCategory.findById = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, unitsAvailable: 2, status: 'actif', hotel: HOTEL_ID });
    makeInventoryStore([]);

    const [resultA, resultB] = await Promise.all([
      reserveInventory({ hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, checkInDate: '2026-09-05', checkOutDate: '2026-09-06', roomsCount: 1 }),
      reserveInventory({ hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, checkInDate: '2026-09-05', checkOutDate: '2026-09-06', roomsCount: 1 }),
    ]);

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
  });

  test('une 3ᵉ demande après épuisement du stock (2/2 réservées) échoue toujours, même en séquentiel', async () => {
    RoomCategory.findById = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, unitsAvailable: 2, status: 'actif', hotel: HOTEL_ID });
    makeInventoryStore([]);

    await reserveInventory({ hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, checkInDate: '2026-09-10', checkOutDate: '2026-09-11', roomsCount: 1 });
    await reserveInventory({ hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, checkInDate: '2026-09-10', checkOutDate: '2026-09-11', roomsCount: 1 });
    const third = await reserveInventory({ hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, checkInDate: '2026-09-10', checkOutDate: '2026-09-11', roomsCount: 1 });

    expect(third.ok).toBe(false);
  });
});
