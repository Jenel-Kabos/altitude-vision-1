// Correctif robustesse 2026-07 — parcours mobile de création d'un hébergement.
// Le service `createFullMobileAccommodation` doit orchestrer Property + Accommodation +
// RatePlan + soumission dans UNE transaction Mongo réelle (réplique requise), garantir
// l'idempotence via `publicationRequestId`, et nettoyer Cloudinary après un échec définitif.
// Suite service-level (pas de HTTP/JWT ici — voir mobileAccommodationPublicationRoute pour
// la route réelle), sur un vrai MongoMemoryReplSet (transactions non simulables autrement).

jest.mock('../config/cloudinary', () => ({
  destroyFromCloudinary: jest.fn().mockResolvedValue(true),
}));

const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const RatePlan = require('../models/RatePlan');
const User = require('../models/User');
const ActionLog = require('../models/ActionLog');
const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const { destroyFromCloudinary } = require('../config/cloudinary');
const { createFullMobileAccommodation } = require('../services/accommodation/mobileAccommodationPublicationService');
const { assertHotelNameAvailable } = require('../services/hotel/hotelNameUniquenessService');

jest.setTimeout(120000);

let userCounter = 0;
const makeUser = (overrides = {}) => {
  userCounter += 1;
  return User.create({
    name: 'Propriétaire Test', email: `owner${userCounter}${Date.now()}@example.com`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', ...overrides,
  });
};

const basePayload = (overrides = {}) => ({
  publicationKind: 'furnished_accommodation',
  property: {
    titre: 'Villa meublée avec piscine',
    description: 'Description suffisamment longue pour la validation du modèle Property.',
    type: 'Villa',
    ville: 'Brazzaville',
    arrondissement: 'Bacongo',
    superficie: 200,
    prix: 35000,
    bathrooms: 1,
    photos: ['https://res.cloudinary.test/photo1.jpg', 'https://res.cloudinary.test/photo2.jpg'],
    ...overrides.property,
  },
  accommodation: {
    accommodationType: 'villa_meublee',
    capacity: { maxAdults: 2, maxChildren: 0 },
    checkInTime: '14:00',
    checkOutTime: '11:00',
    ...overrides.accommodation,
  },
  ratePlan: {
    mode: 'nightly',
    amount: 35000,
    currency: 'XAF',
    ...overrides.ratePlan,
  },
});

const hotelPayload = (overrides = {}) => ({
  publicationKind: 'hotel_establishment',
  property: {
    titre: 'Hôtel Inventaire', description: 'Établissement professionnel avec inventaire détaillé.',
    type: 'Commerce', ville: 'Brazzaville', arrondissement: 'Bacongo', superficie: 1,
    prix: 35000, bathrooms: 0, photos: ['https://res.cloudinary.test/hotel.jpg'],
    ...overrides.property,
  },
  accommodation: {
    accommodationType: 'hotel', capacity: { maxAdults: 41, maxChildren: 0 },
    checkInTime: '14:00', checkOutTime: '11:00',
    hotel: { name: 'Hôtel Inventaire', description: 'Deux catégories', phone: '+242060000000', hotelServices: { reception24h: true } },
    ...overrides.accommodation,
  },
  roomCategories: overrides.roomCategories || [
    { clientKey: 'std', name: 'Standard', code: 'STD', categoryType: 'standard', quantity: 13, adultCapacity: 2, childCapacity: 0, beds: 1, ratePlans: [{ rateType: 'public', amount: 35000, currency: 'XAF' }] },
    { clientKey: 'ste', name: 'Suite', code: 'STE', categoryType: 'suite', quantity: 5, adultCapacity: 2, childCapacity: 1, beds: 2, ratePlans: [{ rateType: 'public', amount: 85000, currency: 'XAF' }] },
  ],
});

const counts = async () => ({
  property: await Property.countDocuments(),
  accommodation: await Accommodation.countDocuments(),
  ratePlan: await RatePlan.countDocuments(),
});

const fullHotelCounts = async () => Promise.all([
  Hotel.countDocuments(), Property.countDocuments(), Accommodation.countDocuments(),
  RoomCategory.countDocuments(), RatePlan.countDocuments(),
]);

const hotelPayloadNamed = (name) => {
  const payload = hotelPayload();
  payload.property.titre = name;
  payload.accommodation.hotel.name = name;
  return payload;
};

const userInTenant = (user, tenantId) => ({ ...user.toObject(), _id: user._id, id: user.id, platformTenant: { _id: tenantId } });

beforeAll(async () => {
  await startFinancialMongo();
  await Accommodation.syncIndexes();
  await Property.syncIndexes();
  await RatePlan.syncIndexes();
  await Hotel.syncIndexes();
  await RoomCategory.syncIndexes();
});
afterEach(async () => { await clearFinancialMongo(); jest.clearAllMocks(); });
afterAll(stopFinancialMongo);

describe('createFullMobileAccommodation — succès', () => {
  test('1. succès complet : 1 Property, 1 Accommodation, 1 RatePlan, statut de soumission correct', async () => {
    const user = await makeUser();
    const requestId = `req-success-${Date.now()}`;

    const result = await createFullMobileAccommodation({ user, payload: basePayload(), publicationRequestId: requestId });

    expect(result.idempotent).toBe(false);
    expect(result.accommodation.publicationStatus).toBe('soumis');
    expect(result.accommodation.submittedAt).toBeTruthy();
    expect(String(result.accommodation.property)).toBe(String(result.property._id));
    expect(String(result.rate.accommodation)).toBe(String(result.accommodation._id));

    expect(await counts()).toEqual({ property: 1, accommodation: 1, ratePlan: 1 });
  });
});

describe('createFullMobileAccommodation — établissement hôtelier professionnel', () => {
  test('crée Hotel, deux catégories, leurs tarifs et les totaux cohérents dans la transaction', async () => {
    const user = await makeUser();
    const result = await createFullMobileAccommodation({ user, payload: hotelPayload(), publicationRequestId: `hotel-${Date.now()}` });
    expect(result.hotel).toMatchObject({ totalRooms: 18, totalCapacity: 41, totalBeds: 23, minNightlyRate: 35000, maxNightlyRate: 85000, currency: 'XAF' });
    expect(result.roomCategories).toHaveLength(2);
    expect(result.roomCategories.map((category) => [category.code, category.unitsAvailable])).toEqual([['STD', 13], ['STE', 5]]);
    expect(result.categoryRates.map((rate) => rate.amount).sort((a, b) => a - b)).toEqual([35000, 85000]);
    expect(result.property.price).toBe(35000);
    expect(await RatePlan.countDocuments({ accommodation: result.accommodation._id })).toBe(0);
  });

  test('rollback complet si une catégorie est invalide', async () => {
    const user = await makeUser();
    const payload = hotelPayload({ roomCategories: [{ ...hotelPayload().roomCategories[0], quantity: 0 }] });
    await expect(createFullMobileAccommodation({ user, payload, publicationRequestId: `hotel-invalid-${Date.now()}` }))
      .rejects.toMatchObject({ statusCode: 422 });
    expect(await Promise.all([Property.countDocuments(), Accommodation.countDocuments(), Hotel.countDocuments(), RoomCategory.countDocuments(), RatePlan.countDocuments()])).toEqual([0, 0, 0, 0, 0]);
  });

  test('retry idempotent ne duplique ni catégorie ni tarif', async () => {
    const user = await makeUser();
    const publicationRequestId = `hotel-retry-${Date.now()}`;
    const first = await createFullMobileAccommodation({ user, payload: hotelPayload(), publicationRequestId });
    const retry = await createFullMobileAccommodation({ user, payload: hotelPayload(), publicationRequestId });
    expect(String(retry.hotel._id)).toBe(String(first.hotel._id));
    expect(retry.roomCategories).toHaveLength(2);
    expect(await RoomCategory.countDocuments()).toBe(2);
    expect(await RatePlan.countDocuments()).toBe(2);
  });

  test('équivalence H-W1 — les payloads sémantiques Web et Mobile créent les mêmes documents métier', async () => {
    const [webUser, mobileUser] = await Promise.all([makeUser(), makeUser()]);
    const web = await createFullMobileAccommodation({ user: webUser, payload: hotelPayload(), publicationRequestId: `web-${Date.now()}` });
    const mobile = await createFullMobileAccommodation({ user: mobileUser, payload: hotelPayload(), publicationRequestId: `mobile-${Date.now()}` });
    const snapshot = async (result) => {
      const categories = await RoomCategory.find({ hotel: result.hotel._id }).sort({ displayOrder: 1 }).lean();
      const rates = await RatePlan.find({ roomCategory: { $in: categories.map((category) => category._id) } }).lean();
      return {
        property: { title: result.property.title, type: result.property.type, status: result.property.status, price: result.property.price, address: result.property.address },
        accommodation: { accommodationType: result.accommodation.accommodationType, capacity: result.accommodation.capacity, checkInTime: result.accommodation.checkInTime, checkOutTime: result.accommodation.checkOutTime, occupancyMode: result.accommodation.occupancyMode },
        hotel: { name: result.hotel.name, totalRooms: result.hotel.totalRooms, totalCapacity: result.hotel.totalCapacity, totalBeds: result.hotel.totalBeds, minNightlyRate: result.hotel.minNightlyRate, maxNightlyRate: result.hotel.maxNightlyRate, currency: result.hotel.currency },
        categories: categories.map((category) => ({ name: category.name, code: category.code, categoryType: category.categoryType, unitsAvailable: category.unitsAvailable, capacity: category.capacity, beds: category.beds, displayOrder: category.displayOrder })),
        rates: rates.map((rate) => ({ categoryCode: categories.find((category) => String(category._id) === String(rate.roomCategory)).code, rateType: rate.rateType, amount: rate.amount, currency: rate.currency })).sort((left, right) => left.categoryCode.localeCompare(right.categoryCode)),
      };
    };
    expect(await snapshot(web)).toEqual(await snapshot(mobile));
  });
});

describe('createFullMobileAccommodation — unicité du nom hôtelier par tenant', () => {
  test.each(['HÔTEL MILA', 'Hôtel Mila', '  Hôtel   Mila  ', 'Hotel Mila'])('refuse le doublon normalisé %s avant toute ressource orpheline', async (duplicateName) => {
    const tenantId = new mongoose.Types.ObjectId();
    const user = userInTenant(await makeUser(), tenantId);
    await createFullMobileAccommodation({ user, payload: hotelPayloadNamed('Hôtel Mila'), publicationRequestId: `hotel-first-${Date.now()}` });
    const before = await fullHotelCounts();

    await expect(createFullMobileAccommodation({ user, payload: hotelPayloadNamed(duplicateName), publicationRequestId: `hotel-duplicate-${duplicateName}-${Date.now()}` }))
      .rejects.toMatchObject({ statusCode: 409, code: 'HOTEL_NAME_ALREADY_EXISTS' });

    expect(await fullHotelCounts()).toEqual(before);
  });

  test('autorise un nom réellement différent dans le même tenant', async () => {
    const user = userInTenant(await makeUser(), new mongoose.Types.ObjectId());
    await createFullMobileAccommodation({ user, payload: hotelPayloadNamed('Mila Hotel'), publicationRequestId: `hotel-a-${Date.now()}` });
    await createFullMobileAccommodation({ user, payload: hotelPayloadNamed('Mila Residence'), publicationRequestId: `hotel-b-${Date.now()}` });
    expect(await Hotel.countDocuments()).toBe(2);
  });

  test('autorise le même nom dans deux tenants sans fuite cross-tenant', async () => {
    const owner = await makeUser();
    const tenantAUser = userInTenant(owner, new mongoose.Types.ObjectId());
    const tenantBUser = userInTenant(owner, new mongoose.Types.ObjectId());
    await createFullMobileAccommodation({ user: tenantAUser, payload: hotelPayloadNamed('Mila Hotel'), publicationRequestId: `hotel-tenant-a-${Date.now()}` });
    await createFullMobileAccommodation({ user: tenantBUser, payload: hotelPayloadNamed('MILA HOTEL'), publicationRequestId: `hotel-tenant-b-${Date.now()}` });
    expect(await Hotel.countDocuments()).toBe(2);
  });

  test('un hôtel publié bloque aussi une seconde création du même nom', async () => {
    const user = userInTenant(await makeUser(), new mongoose.Types.ObjectId());
    const first = await createFullMobileAccommodation({ user, payload: hotelPayloadNamed('Mila Hotel'), publicationRequestId: `hotel-published-${Date.now()}` });
    await Hotel.updateOne({ _id: first.hotel._id }, { $set: { publicationStatus: 'publie' } });
    await expect(createFullMobileAccommodation({ user, payload: hotelPayloadNamed('mila hotel'), publicationRequestId: `hotel-after-published-${Date.now()}` }))
      .rejects.toMatchObject({ statusCode: 409, code: 'HOTEL_NAME_ALREADY_EXISTS' });
  });

  test.each(['brouillon', 'rejete', 'suspendu'])('un hôtel %s reste réservé dans le tenant', async (publicationStatus) => {
    const tenantId = new mongoose.Types.ObjectId();
    const owner = await makeUser();
    await Hotel.create({
      name: 'Mila Hotel', tenant: tenantId, manager: owner._id,
      createdBy: owner._id, publicationStatus,
    });
    await expect(assertHotelNameAvailable({ name: ' MILA   HOTEL ', tenantId, managerId: owner._id }))
      .rejects.toMatchObject({ statusCode: 409, code: 'HOTEL_NAME_ALREADY_EXISTS' });
  });

  test('une édition conserve son propre nom mais refuse le nom normalisé d’un autre hôtel', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const owner = await makeUser();
    const [mila, rival] = await Hotel.create([
      { name: 'Mila Hotel', tenant: tenantId, manager: owner._id, createdBy: owner._id },
      { name: 'Rival Palace', tenant: tenantId, manager: owner._id, createdBy: owner._id },
    ]);

    await expect(assertHotelNameAvailable({
      name: ' MILA  HOTEL ', tenantId, managerId: owner._id, excludeHotelId: mila._id,
    })).resolves.toMatchObject({ normalizedName: 'mila hotel' });
    await expect(assertHotelNameAvailable({
      name: 'Mila Hotel', tenantId, managerId: owner._id, excludeHotelId: rival._id,
    })).rejects.toMatchObject({ statusCode: 409, code: 'HOTEL_NAME_ALREADY_EXISTS' });
  });

  test('deux créations concurrentes de même nom produisent au maximum un hôtel', async () => {
    const user = userInTenant(await makeUser(), new mongoose.Types.ObjectId());
    const results = await Promise.allSettled([
      createFullMobileAccommodation({ user, payload: hotelPayloadNamed('MILA HOTEL'), publicationRequestId: `hotel-race-a-${Date.now()}` }),
      createFullMobileAccommodation({ user, payload: hotelPayloadNamed('Mila Hotel'), publicationRequestId: `hotel-race-b-${Date.now()}` }),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')[0]?.reason).toMatchObject({ statusCode: 409, code: 'HOTEL_NAME_ALREADY_EXISTS' });
    expect(await Hotel.countDocuments()).toBe(1);
  });
});

describe('createFullMobileAccommodation — rollback complet à chaque étape', () => {
  test('2. échec Property (type invalide) : aucune donnée créée', async () => {
    const user = await makeUser();
    const payload = basePayload({ property: { type: 'TypeInexistant' } });

    await expect(createFullMobileAccommodation({ user, payload, publicationRequestId: `req-fail-property-${Date.now()}` }))
      .rejects.toThrow();

    expect(await counts()).toEqual({ property: 0, accommodation: 0, ratePlan: 0 });
  });

  test('3. échec Accommodation (type hotel sans référence hotel) : aucune Property résiduelle', async () => {
    const user = await makeUser();
    const payload = basePayload({ accommodation: { accommodationType: 'hotel' } });

    await expect(createFullMobileAccommodation({ user, payload, publicationRequestId: `req-fail-accommodation-${Date.now()}` }))
      .rejects.toThrow();

    expect(await counts()).toEqual({ property: 0, accommodation: 0, ratePlan: 0 });
  });

  test('4. échec RatePlan (mode invalide) : aucune Property ni Accommodation résiduelle', async () => {
    const user = await makeUser();
    const payload = basePayload({ ratePlan: { mode: 'mode-invalide', amount: 35000 } });

    await expect(createFullMobileAccommodation({ user, payload, publicationRequestId: `req-fail-rate-${Date.now()}` }))
      .rejects.toThrow();

    expect(await counts()).toEqual({ property: 0, accommodation: 0, ratePlan: 0 });
  });

  test('5. échec submit (bathrooms=0, readiness non atteinte) : rollback complet', async () => {
    const user = await makeUser();
    const payload = basePayload({ property: { bathrooms: 0 } });

    await expect(createFullMobileAccommodation({ user, payload, publicationRequestId: `req-fail-submit-${Date.now()}` }))
      .rejects.toMatchObject({ code: 'MOBILE_ACCOMMODATION_NOT_READY' });

    expect(await counts()).toEqual({ property: 0, accommodation: 0, ratePlan: 0 });
  });

  test('6. échec ActionLog (inclus dans la transaction) : rollback complet', async () => {
    const user = await makeUser();
    const spy = jest.spyOn(ActionLog, 'create').mockRejectedValueOnce(new Error('ActionLog indisponible'));

    await expect(createFullMobileAccommodation({ user, payload: basePayload(), publicationRequestId: `req-fail-actionlog-${Date.now()}` }))
      .rejects.toThrow('ActionLog indisponible');

    expect(await counts()).toEqual({ property: 0, accommodation: 0, ratePlan: 0 });
    spy.mockRestore();
  });

  test('12. nettoyage Cloudinary déclenché après un échec définitif (photos déjà uploadées)', async () => {
    const user = await makeUser();
    const payload = basePayload({ ratePlan: { mode: 'mode-invalide', amount: 35000 } });

    await expect(createFullMobileAccommodation({ user, payload, publicationRequestId: `req-cleanup-${Date.now()}` }))
      .rejects.toThrow();

    expect(destroyFromCloudinary).toHaveBeenCalledTimes(2);
    expect(destroyFromCloudinary).toHaveBeenCalledWith('https://res.cloudinary.test/photo1.jpg');
    expect(destroyFromCloudinary).toHaveBeenCalledWith('https://res.cloudinary.test/photo2.jpg');
  });
});

describe('createFullMobileAccommodation — idempotence', () => {
  test('7. retry séquentiel avec la même publicationRequestId : même réponse, aucun doublon', async () => {
    const user = await makeUser();
    const requestId = `req-retry-${Date.now()}`;
    const payload = basePayload();

    const first = await createFullMobileAccommodation({ user, payload, publicationRequestId: requestId });
    const second = await createFullMobileAccommodation({ user, payload, publicationRequestId: requestId });

    expect(String(second.accommodation._id)).toBe(String(first.accommodation._id));
    expect(second.idempotent).toBe(true);
    expect(await counts()).toEqual({ property: 1, accommodation: 1, ratePlan: 1 });
  });

  test('8. cinq requêtes concurrentes avec la même clé : une seule publication créée', async () => {
    const user = await makeUser();
    const requestId = `req-concurrent-${Date.now()}`;
    const payload = basePayload();

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => createFullMobileAccommodation({ user, payload, publicationRequestId: requestId })),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(5); // jamais d'échec côté appelant : les perdants récupèrent le gagnant

    const accommodationIds = new Set(fulfilled.map((r) => String(r.value.accommodation._id)));
    expect(accommodationIds.size).toBe(1); // une seule Accommodation réelle, quel que soit l'ordre d'arrivée

    expect(await counts()).toEqual({ property: 1, accommodation: 1, ratePlan: 1 });
  });

  test('9. deux clés différentes : deux publications distinctes', async () => {
    const user = await makeUser();
    const payloadA = basePayload({ property: { titre: 'Villa A' } });
    const payloadB = basePayload({ property: { titre: 'Villa B' } });

    const resultA = await createFullMobileAccommodation({ user, payload: payloadA, publicationRequestId: `req-a-${Date.now()}` });
    const resultB = await createFullMobileAccommodation({ user, payload: payloadB, publicationRequestId: `req-b-${Date.now()}` });

    expect(String(resultA.accommodation._id)).not.toBe(String(resultB.accommodation._id));
    expect(await counts()).toEqual({ property: 2, accommodation: 2, ratePlan: 2 });
  });

  test('10. clé déjà utilisée par un autre utilisateur : rejet 403, aucune écriture supplémentaire', async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const requestId = `req-conflict-${Date.now()}`;

    await createFullMobileAccommodation({ user: owner, payload: basePayload(), publicationRequestId: requestId });

    await expect(createFullMobileAccommodation({ user: intruder, payload: basePayload(), publicationRequestId: requestId }))
      .rejects.toMatchObject({ statusCode: 403, code: 'MOBILE_ACCOMMODATION_IDEMPOTENCY_KEY_CONFLICT' });

    expect(await counts()).toEqual({ property: 1, accommodation: 1, ratePlan: 1 });
  });

  test('11. payload invalide (titre manquant) : rejet 400, aucune écriture', async () => {
    const user = await makeUser();
    const payload = basePayload({ property: { titre: '' } });

    await expect(createFullMobileAccommodation({ user, payload, publicationRequestId: `req-invalid-${Date.now()}` }))
      .rejects.toMatchObject({ statusCode: 400, code: 'MOBILE_ACCOMMODATION_VALIDATION_ERROR' });

    expect(await counts()).toEqual({ property: 0, accommodation: 0, ratePlan: 0 });
  });

  test('publicationRequestId manquant : rejet 400 immédiat', async () => {
    const user = await makeUser();
    await expect(createFullMobileAccommodation({ user, payload: basePayload(), publicationRequestId: '' }))
      .rejects.toMatchObject({ statusCode: 400, code: 'MOBILE_ACCOMMODATION_MISSING_IDEMPOTENCY_KEY' });
  });
});
