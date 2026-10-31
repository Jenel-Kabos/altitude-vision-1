const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
require('../models/Hotel');
const { searchRealEstateFromText } = require('../services/altimmoAssistant/intelligentSearchService');

jest.setTimeout(120000);
const oid = () => new mongoose.Types.ObjectId();
const property = (overrides = {}) => ({
  title: 'Maison réelle', description: 'Annonce de test représentative et suffisamment détaillée.', pole: 'Altimmo',
  type: 'Maison', status: 'location', price: 200000, address: { neighborhood: 'Plateau', arrondissement: 'Talangaï', city: 'Brazzaville' },
  latitude: -4.22, longitude: 15.29, images: ['https://example.test/house.jpg'], bedrooms: 3, bathrooms: 2,
  surface: 120, amenities: ['parking'], availability: 'Disponible', statusAdmin: 'Validée', isPublished: true,
  owner: oid(), documents: ['https://example.test/private.pdf'], commissionRate: 17, tenant: oid(), ...overrides,
});

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('IA-03B — recherche Mongo ciblée sur annonces réelles de test', () => {
  test('vente/location applique publication, disponibilité, contraintes et projection fermée', async () => {
    await Property.create(property());
    await Property.create(property({ title: 'Non publiée', isPublished: false }));
    await Property.create(property({ title: 'Non approuvée', statusAdmin: 'En attente' }));
    await Property.create(property({ title: 'Retirée', availability: 'Retiré' }));
    await Property.create(property({ title: 'Trop chère', price: 400000 }));

    const out = await searchRealEstateFromText({
      query: 'Maison à louer à Talangaï, 3 chambres, maximum 250 000 FCFA par mois',
      context: { scopeMode: 'PUBLIC' }, pagination: { page: 1, limit: 10 },
    });
    expect(out.results.map((item) => item.title)).toEqual(['Maison réelle']);
    expect(out.coverage).toMatchObject({ evaluated: 1, sourceTotal: 1, complete: true });
    expect(out.results[0]).not.toHaveProperty('owner');
    expect(out.results[0]).not.toHaveProperty('tenant');
    expect(out.results[0]).not.toHaveProperty('documents');
    expect(out.results[0]).not.toHaveProperty('commissionRate');
    expect(out.results[0]).not.toHaveProperty('latitude');
    expect(out.results[0]).not.toHaveProperty('longitude');
    expect(out.results[0].address).not.toHaveProperty('street');
  });

  test('retourne un résultat vide sans substituer une annonce', async () => {
    await Property.create(property({ price: 200000 }));
    const out = await searchRealEstateFromText({ query: 'Maison à louer à Brazzaville, maximum 5 000 FCFA par mois', context: { scopeMode: 'PUBLIC' } });
    expect(out.results).toEqual([]);
    expect(out.total).toBe(0);
  });

  test('recherche un meublé publié via Accommodation sans créer de réservation', async () => {
    const p = await Property.create(property({ title: 'Maison meublée réelle', type: 'Maison', status: 'hebergement', price: 30000 }));
    await Accommodation.create({
      property: p._id, accommodationType: 'maison_meublee', publicationStatus: 'publie', active: true,
      createdBy: oid(), capacity: { maxAdults: 4, maxChildren: 2 }, amenities: { parking: ['parking'] },
    });
    const out = await searchRealEstateFromText({ query: 'Maison meublée à Brazzaville pour un court séjour', context: { scopeMode: 'PUBLIC' } });
    expect(out.results.map((item) => item.title)).toEqual(['Maison meublée réelle']);
    expect(out.results[0].accommodationType).toBe('maison_meublee');

    const tooMany = await searchRealEstateFromText({ query: 'Maison meublée à Brazzaville pour un court séjour pour 5 adultes', context: { scopeMode: 'PUBLIC' } });
    expect(tooMany.results).toEqual([]);
    expect(tooMany.candidatesToVerify).toEqual([]);
  });

  test('un contexte non résolu ne lit aucune collection', async () => {
    await Property.create(property());
    const findSpy = jest.spyOn(Property, 'find');
    const out = await searchRealEstateFromText({ query: 'Maison à louer à Brazzaville', context: { scopeMode: 'UNRESOLVED' } });
    expect(out.status).toBe('forbidden');
    expect(findSpy).not.toHaveBeenCalled();
    findSpy.mockRestore();
  });
});
