const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Hotel = require('../models/Hotel');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const { resyncValidatedHotelPublication } = require('../services/validatedHotelPublicationResyncService');

jest.setTimeout(120000);

const oid = () => new mongoose.Types.ObjectId();

const propertyPayload = ({ tenant, owner, overrides = {} }) => ({
  tenant, owner, title: 'Hôtel cible', description: 'Ancre publique hôtelière.', pole: 'Altimmo',
  type: 'Commerce', status: 'hebergement', price: 45000,
  address: { arrondissement: 'Centre-ville', city: 'Brazzaville' },
  latitude: -4.26, longitude: 15.28, images: ['https://example.test/hotel.jpg'], surface: 300,
  statusAdmin: 'Validée', isPublished: false, internalManagedOnly: false, availability: 'Disponible',
  ...overrides,
});

async function fixture({ hotelStatus = 'publie', hotelActive = true, propertyOverrides = {}, accommodationOverrides = {}, withProperty = true } = {}) {
  const tenant = oid();
  const owner = oid();
  const property = withProperty ? await Property.create(propertyPayload({ tenant, owner, overrides: propertyOverrides })) : null;
  const hotel = await Hotel.create({
    tenant, name: 'Hôtel cible', manager: owner, createdBy: owner, property: property?._id,
    publicationStatus: hotelStatus, status: 'actif', active: hotelActive,
  });
  if (property) {
    await Accommodation.create({
      tenant, property: property._id, hotel: hotel._id, accommodationType: 'hotel',
      publicationStatus: 'publie', active: true, createdBy: owner, ...accommodationOverrides,
    });
  }
  return { tenant, owner, property, hotel };
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('resyncValidatedHotelPublication — Mongo réel isolé', () => {
  test('dry-run qualifie le stale boolean sans écrire', async () => {
    const { hotel, property } = await fixture();
    const result = await resyncValidatedHotelPublication({ hotelId: hotel._id, apply: false });
    expect(result).toMatchObject({ result: 'ELIGIBLE', wouldUpdate: true, writes: 0, hotelId: String(hotel._id), propertyId: String(property._id) });
    expect((await Property.findById(property._id)).isPublished).toBe(false);
  });

  test('apply répare un seul booléen puis devient idempotent', async () => {
    const { hotel, property } = await fixture();
    const before = (await Property.findById(property._id).lean()).updatedAt;
    expect(await resyncValidatedHotelPublication({ hotelId: hotel._id, apply: true }))
      .toMatchObject({ result: 'UPDATED', writes: 1 });
    const repaired = await Property.findById(property._id).lean();
    expect(repaired.isPublished).toBe(true);
    expect(repaired.updatedAt).toEqual(before);
    expect(await resyncValidatedHotelPublication({ hotelId: hotel._id, apply: true }))
      .toMatchObject({ result: 'ALREADY_SYNCED', writes: 0 });
  });

  test.each(['soumis', 'rejete', 'brouillon'])(
    'Hotel %s reste non éligible et non publié',
    async (hotelStatus) => {
      const { hotel, property } = await fixture({ hotelStatus });
      expect(await resyncValidatedHotelPublication({ hotelId: hotel._id, apply: true }))
        .toMatchObject({ result: 'NOT_ELIGIBLE', writes: 0 });
      expect((await Property.findById(property._id)).isPublished).toBe(false);
    },
  );

  test('Property absente échoue sans création automatique', async () => {
    const { hotel } = await fixture({ withProperty: false });
    expect(await resyncValidatedHotelPublication({ hotelId: hotel._id, apply: true }))
      .toMatchObject({ result: 'NOT_FOUND', reason: 'PROPERTY_LINK_MISSING', writes: 0 });
    expect(await Property.countDocuments()).toBe(0);
  });

  test('tenant mismatch échoue fermé', async () => {
    const { hotel, property } = await fixture();
    await Property.updateOne({ _id: property._id }, { $set: { tenant: oid() } });
    expect(await resyncValidatedHotelPublication({ hotelId: hotel._id, apply: true }))
      .toMatchObject({ result: 'TENANT_MISMATCH', writes: 0 });
    expect((await Property.findById(property._id)).isPublished).toBe(false);
  });

  test.each([
    ['internal', { internalManagedOnly: true }],
    ['rejetée', { statusAdmin: 'Rejetée' }],
    ['indisponible', { availability: 'Indisponible' }],
    ['mauvais domaine', { status: 'vente' }],
  ])('Property %s est NOT_ELIGIBLE', async (_label, propertyOverrides) => {
    const { hotel, property } = await fixture({ propertyOverrides });
    expect(await resyncValidatedHotelPublication({ hotelId: hotel._id, apply: true }))
      .toMatchObject({ result: 'NOT_ELIGIBLE', writes: 0 });
    expect((await Property.findById(property._id)).isPublished).toBe(false);
  });

  test('Accommodation absente ou incohérente échoue fermé', async () => {
    const { hotel, property } = await fixture();
    await Accommodation.deleteMany({ hotel: hotel._id });
    expect(await resyncValidatedHotelPublication({ hotelId: hotel._id, apply: true }))
      .toMatchObject({ result: 'AMBIGUOUS_LINK', reason: 'ACCOMMODATION_NOT_FOUND', writes: 0 });
    expect((await Property.findById(property._id)).isPublished).toBe(false);
  });

  test('CAS détecte un changement Property entre qualification et écriture', async () => {
    const { hotel, property } = await fixture();
    const result = await resyncValidatedHotelPublication({
      hotelId: hotel._id,
      apply: true,
      beforeWrite: () => Property.updateOne({ _id: property._id }, { $set: { availability: 'Indisponible' } }),
    });
    expect(result).toMatchObject({ result: 'STATE_CHANGED', writes: 0 });
    expect((await Property.findById(property._id)).isPublished).toBe(false);
  });

  test('requalification détecte un changement Hotel entre lecture et écriture', async () => {
    const { hotel, property } = await fixture();
    const result = await resyncValidatedHotelPublication({
      hotelId: hotel._id,
      apply: true,
      beforeWrite: () => Hotel.updateOne({ _id: hotel._id }, { $set: { publicationStatus: 'suspendu' } }),
    });
    expect(result).toMatchObject({ result: 'STATE_CHANGED', hotelPublicationState: 'suspendu', writes: 0 });
    expect((await Property.findById(property._id)).isPublished).toBe(false);
  });

  test('un booléen legacy absent est réparable sans élargir la cible', async () => {
    const { hotel, property } = await fixture();
    await Property.collection.updateOne({ _id: property._id }, { $unset: { isPublished: '' } });
    expect(await resyncValidatedHotelPublication({ hotelId: hotel._id, apply: true }))
      .toMatchObject({ result: 'UPDATED', writes: 1 });
    expect((await Property.findById(property._id)).isPublished).toBe(true);
  });

  test('deux apply concurrents produisent un seul UPDATED', async () => {
    const { hotel, property } = await fixture();
    const results = await Promise.all([
      resyncValidatedHotelPublication({ hotelId: hotel._id, apply: true }),
      resyncValidatedHotelPublication({ hotelId: hotel._id, apply: true }),
    ]);
    expect(results.filter(({ result }) => result === 'UPDATED')).toHaveLength(1);
    expect(['ALREADY_SYNCED', 'STATE_CHANGED']).toContain(results.find(({ result }) => result !== 'UPDATED').result);
    expect(results.reduce((sum, item) => sum + item.writes, 0)).toBe(1);
    expect((await Property.findById(property._id)).isPublished).toBe(true);
  });
});
