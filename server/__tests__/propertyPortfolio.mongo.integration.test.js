const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const Hotel = require('../models/Hotel');
const RentalManagement = require('../models/RentalManagement');
const { getPropertyPortfolio } = require('../services/propertyPortfolioService');
const { listValidatedHotelPortfolio } = require('../services/hotelService');
const { listAccommodationsForAdmin } = require('../services/accommodationService');

jest.setTimeout(120000);
const actor = () => new mongoose.Types.ObjectId();
let seq = 0;
const property = (overrides = {}) => Property.create({
  title: `Portfolio ${++seq}`, description: 'Description suffisamment longue pour le test portfolio.',
  pole: 'Altimmo', type: 'Appartement', status: 'vente', price: 100000,
  address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.28,
  images: ['https://example.test/property.jpg'], surface: 80, owner: actor(),
  statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', ...overrides,
});
const accommodation = (propertyId, overrides = {}) => Accommodation.create({
  property: propertyId, accommodationType: 'appartement_meuble', publicationStatus: 'publie', active: true,
  createdBy: actor(), ...overrides,
});
const hotel = (propertyId, overrides = {}) => Hotel.create({
  name: `Hotel ${++seq}`, property: propertyId, manager: actor(), createdBy: actor(),
  publicationStatus: 'publie', status: 'actif', active: true, ...overrides,
});

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('portfolio vide avec quatre sources vides', async () => {
  await expect(getPropertyPortfolio()).resolves.toMatchObject({ items: [], stats: { total: 0 } });
});

test('vente et location publiées apparaissent, les brouillons et retraits disparaissent', async () => {
  await property({ status: 'vente', title: 'Vente publiée' });
  await property({ status: 'location', title: 'Location publiée' });
  await property({ status: 'vente', title: 'Vente brouillon', statusAdmin: 'En attente', isPublished: false });
  await property({ status: 'location', title: 'Location retirée', availability: 'Retiré' });
  const result = await getPropertyPortfolio();
  expect(result.items.map((item) => item.title).sort()).toEqual(['Location publiée', 'Vente publiée']);
  expect(result.stats).toMatchObject({ total: 2, bySource: { vente: 1, location: 1 } });
});

test('hébergement suit exactement publication, activation et validation de sa source spécialisée', async () => {
  const pendingProperty = await property({ status: 'hebergement', title: 'Hébergement non validé', statusAdmin: 'En attente' });
  await accommodation(pendingProperty._id);
  const draftProperty = await property({ status: 'hebergement', title: 'Hébergement brouillon' });
  await accommodation(draftProperty._id, { publicationStatus: 'brouillon' });
  const validProperty = await property({ status: 'hebergement', title: 'Hébergement validé' });
  await accommodation(validProperty._id);

  const specialized = await listAccommodationsForAdmin({ status: 'publie', independentOnly: true, validatedOnly: true, activeOnly: true });
  const portfolio = await getPropertyPortfolio();
  expect(specialized.total).toBe(1);
  expect(portfolio.items.map((item) => item.title)).toEqual(['Hébergement validé']);
  expect(portfolio.items[0].source).toBe('accommodation');
});

test('hôtel suit le portefeuille spécialisé et disparaît après désactivation', async () => {
  const inactiveProperty = await property({ status: 'hebergement', title: 'Hôtel inactif' });
  await hotel(inactiveProperty._id, { active: false });
  const validProperty = await property({ status: 'hebergement', title: 'Ancre hôtel valide' });
  const validHotel = await hotel(validProperty._id, { name: 'Hôtel visible' });

  expect((await listValidatedHotelPortfolio({ limit: 100 })).total).toBe(1);
  expect((await getPropertyPortfolio()).items.map((item) => item.title)).toEqual(['Hôtel visible']);

  validHotel.active = false;
  await validHotel.save();
  expect((await listValidatedHotelPortfolio({ limit: 100 })).total).toBe(0);
  expect((await getPropertyPortfolio()).items).toHaveLength(0);
});

test('Gestion locative ne publie jamais un Property interne et respecte une publication Property ultérieure', async () => {
  const managed = await property({
    status: 'location', title: 'Bien GL privé', statusAdmin: 'En attente', isPublished: false,
    internalManagedOnly: true, images: [],
  });
  await RentalManagement.create({ property: managed._id, owner: managed.owner, manager: actor(), managementActivated: true });
  expect((await getPropertyPortfolio()).items).toHaveLength(0);
  expect(await RentalManagement.countDocuments({ managementActivated: true })).toBe(1);

  managed.statusAdmin = 'Validée'; managed.isPublished = true; managed.internalManagedOnly = false;
  await managed.save();
  expect((await getPropertyPortfolio()).items.map((item) => item.title)).toEqual(['Bien GL privé']);
});

test('legacy orphelin ne plante pas et la déduplication privilégie la source spécialisée', async () => {
  await property({ status: 'hebergement', title: 'Orphelin legacy' });
  const shared = await property({ status: 'hebergement', title: 'Ancre partagée' });
  await accommodation(shared._id);
  await hotel(shared._id, { name: 'Source Hôtel prioritaire' });
  const result = await getPropertyPortfolio();
  expect(result.items).toHaveLength(1);
  expect(result.items[0]).toMatchObject({ title: 'Source Hôtel prioritaire', source: 'hotel' });
  expect(result.stats.total).toBe(result.items.length);
});
