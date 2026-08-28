// HOTFIX-ACCOMMODATION-CREATED-NOT-VISIBLE-1 — un hébergement créé depuis le
// dashboard admin (POST /accommodations/admin → createFullAccommodation)
// restait bloqué en `publicationStatus: 'brouillon'` (valeur par défaut du
// schéma) : invisible de "Hébergements" (`publie` uniquement) ET de
// "Modération Hébergements" (`soumis` uniquement), sans aucune UI staff pour
// le soumettre. Suite service-level sur un vrai Mongo (comportement de
// persistance réel de `evaluateReadiness` + `.save()`, pas de mock).

const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const RatePlan = require('../models/RatePlan');
const User = require('../models/User');
const { createFullAccommodation, listAccommodationsForAdmin } = require('../services/accommodationService');

jest.setTimeout(120000);

let userCounter = 0;
const makeAdmin = () => {
  userCounter += 1;
  return User.create({
    name: 'Admin Test', email: `admin${userCounter}${Date.now()}@example.com`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin',
  });
};

const propertyData = (owner, overrides = {}) => ({
  title: 'Villa Meublée Test', description: 'Une belle villa meublée pour séjours courts.',
  price: 50000, pole: 'Altimmo', type: 'Villa', status: 'hebergement', availability: 'Disponible',
  address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, surface: 120,
  bedrooms: 3, bathrooms: 2, images: ['https://res.cloudinary.test/villa.jpg'],
  latitude: -4.26, longitude: 15.24, statusAdmin: 'Validée', owner: owner._id,
  ...overrides,
});

const accommodationData = (overrides = {}) => ({
  accommodationType: 'villa_meublee', capacity: { maxAdults: 4, maxChildren: 2 },
  checkInTime: '14:00', checkOutTime: '11:00',
  ...overrides,
});

beforeAll(async () => {
  await startFinancialMongo();
  await Accommodation.syncIndexes();
  await Property.syncIndexes();
  await RatePlan.syncIndexes();
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('createFullAccommodation — visibilité post-création (dashboard admin)', () => {
  test('un hébergement complet (readiness OK) est automatiquement soumis à la modération, jamais laissé invisible en brouillon', async () => {
    const admin = await makeAdmin();

    const result = await createFullAccommodation({
      propertyData: propertyData(admin), accommodationData: accommodationData(),
      rateData: { mode: 'nightly', amount: 35000, currency: 'XAF' }, hotelInput: null, actingUser: admin,
    });

    expect(result.accommodation.publicationStatus).toBe('soumis');
    expect(result.accommodation.submittedAt).toBeTruthy();

    // Preuve directe de la régression corrigée : l'hébergement apparaît
    // désormais dans la queue "Modération Hébergements" (avant ce hotfix, il
    // restait `brouillon`, invisible de cette requête).
    const pending = await Accommodation.find({ publicationStatus: 'soumis' });
    expect(pending.map((a) => String(a._id))).toContain(String(result.accommodation._id));

    // Toujours absent de la liste "Hébergements" (validatedOnly) tant qu'un
    // staff ne l'a pas validé — la modération reste un gate réel, non
    // contourné par ce hotfix.
    const adminList = await listAccommodationsForAdmin({
      status: 'publie', independentOnly: true, validatedOnly: true, activeOnly: true,
    });
    expect(adminList.accommodations.map((a) => String(a._id))).not.toContain(String(result.accommodation._id));
  });

  test('un hébergement incomplet (readiness KO — ex. bathrooms manquant) reste en brouillon, comportement inchangé', async () => {
    const admin = await makeAdmin();

    const result = await createFullAccommodation({
      propertyData: propertyData(admin, { bathrooms: 0 }), accommodationData: accommodationData(),
      rateData: null, hotelInput: null, actingUser: admin,
    });

    expect(result.accommodation.publicationStatus).toBe('brouillon');
    expect(result.accommodation.submittedAt).toBeFalsy();

    const pending = await Accommodation.find({ publicationStatus: 'soumis' });
    expect(pending.map((a) => String(a._id))).not.toContain(String(result.accommodation._id));
  });

  test('après validation staff (publicationStatus="publie"), l’hébergement apparaît bien dans la liste "Hébergements"', async () => {
    const admin = await makeAdmin();
    const result = await createFullAccommodation({
      propertyData: propertyData(admin), accommodationData: accommodationData(),
      rateData: { mode: 'nightly', amount: 35000, currency: 'XAF' }, hotelInput: null, actingUser: admin,
    });
    expect(result.accommodation.publicationStatus).toBe('soumis');

    await Accommodation.updateOne({ _id: result.accommodation._id }, { publicationStatus: 'publie', publishedAt: new Date() });

    const adminList = await listAccommodationsForAdmin({
      status: 'publie', independentOnly: true, validatedOnly: true, activeOnly: true,
    });
    expect(adminList.accommodations.map((a) => String(a._id))).toContain(String(result.accommodation._id));
  });
});
