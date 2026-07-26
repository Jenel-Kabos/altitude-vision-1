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
const { destroyFromCloudinary } = require('../config/cloudinary');
const { createFullMobileAccommodation } = require('../services/accommodation/mobileAccommodationPublicationService');

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

const counts = async () => ({
  property: await Property.countDocuments(),
  accommodation: await Accommodation.countDocuments(),
  ratePlan: await RatePlan.countDocuments(),
});

beforeAll(async () => {
  await startFinancialMongo();
  await Accommodation.syncIndexes();
  await Property.syncIndexes();
  await RatePlan.syncIndexes();
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
