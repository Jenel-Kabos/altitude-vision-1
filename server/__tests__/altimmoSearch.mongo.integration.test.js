// Correctif architecture recherche Altimmo (2026-07-25) : offerType=hebergement doit
// interroger Accommodation (accommodationType réel), jamais Property seul — garantit
// structurellement qu'aucune annonce Vente/Location ne peut apparaître sous Hébergement et
// inversement (collections différentes, pas un simple filtre applicatif).

const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const { search } = require('../controllers/altimmoSearchController');

jest.setTimeout(120000);
const ownerId = () => new mongoose.Types.ObjectId();

const baseProperty = (overrides = {}) => ({
  title: 'Bien Test Altimmo Search', description: 'Description suffisamment longue pour la validation du modèle.',
  pole: 'Altimmo', type: 'Appartement', status: 'vente', price: 50000000,
  address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: 4.26, longitude: 15.28,
  images: ['https://example.test/image.jpg'], surface: 120, statusAdmin: 'Validée', availability: 'Disponible',
  owner: ownerId(), ...overrides,
});

const makeAccommodation = async (accommodationType, propertyOverrides = {}, accommodationOverrides = {}) => {
  const property = await Property.create(baseProperty({ status: 'hebergement', ...propertyOverrides }));
  const accommodation = await Accommodation.create({
    property: property._id, accommodationType, publicationStatus: 'publie', createdBy: ownerId(),
    ...accommodationOverrides,
  });
  return { property, accommodation };
};

const callSearch = async (query) => {
  const req = { query: { ...query } };
  let payload;
  const res = { status: () => res, json: (body) => { payload = body; return res; } };
  await search(req, res);
  return payload;
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('GET /api/altimmo/search — offerType=hebergement (source Accommodation)', () => {
  test('hebergement ne retourne QUE des hébergements — jamais Vente ni Location', async () => {
    await Property.create(baseProperty({ status: 'vente', title: 'Vente1' }));
    await Property.create(baseProperty({ status: 'location', title: 'Location1' }));
    await makeAccommodation('villa_meublee', { title: 'Villa Meublée 1' });

    const { data } = await callSearch({ offerType: 'hebergement' });
    expect(data.properties).toHaveLength(1);
    expect(data.properties[0].title).toBe('Villa Meublée 1');
    expect(data.properties.some((p) => p.status !== 'hebergement')).toBe(false);
  });

  test('vente ne retourne jamais d’hébergement', async () => {
    await makeAccommodation('residence_hoteliere', { title: 'Hôtel A' });
    await Property.create(baseProperty({ status: 'vente', title: 'Vente1' }));

    const { data } = await callSearch({ offerType: 'vente' });
    expect(data.properties).toHaveLength(1);
    expect(data.properties[0].title).toBe('Vente1');
  });

  test('location ne retourne jamais d’hébergement', async () => {
    await makeAccommodation('residence_hoteliere', { title: 'Hôtel A' });
    await Property.create(baseProperty({ status: 'location', title: 'Location1' }));

    const { data } = await callSearch({ offerType: 'location' });
    expect(data.properties).toHaveLength(1);
    expect(data.properties[0].title).toBe('Location1');
  });

  test('accommodationType filtre correctement parmi les hébergements', async () => {
    await makeAccommodation('villa_meublee', { title: 'Villa' });
    await makeAccommodation('appartement_meuble', { title: 'Appart Meublé' });

    const { data } = await callSearch({ offerType: 'hebergement', accommodationType: 'villa_meublee' });
    expect(data.properties).toHaveLength(1);
    expect(data.properties[0].title).toBe('Villa');
    expect(data.properties[0].accommodationType).toBe('villa_meublee');
  });

  test('propertyType est ignoré pour offerType=hebergement (jamais d’erreur, jamais de faux filtre)', async () => {
    await makeAccommodation('villa_meublee', { title: 'Villa', type: 'Villa' });
    const { data } = await callSearch({ offerType: 'hebergement', propertyType: 'Terrain' });
    expect(data.properties).toHaveLength(1); // propertyType='Terrain' n'exclut pas la villa
  });

  test('accommodationType est ignoré pour offerType=vente/location (jamais d’erreur)', async () => {
    await Property.create(baseProperty({ status: 'vente', title: 'Vente1' }));
    const { data } = await callSearch({ offerType: 'vente', accommodationType: 'hotel' });
    expect(data.properties).toHaveLength(1);
  });

  test('aucun hébergement non publié ou non disponible ne fuite', async () => {
    await makeAccommodation('residence_hoteliere', { title: 'Hôtel Publié' });
    await makeAccommodation('residence_hoteliere', { title: 'Hôtel Brouillon' }, { publicationStatus: 'brouillon' });
    await makeAccommodation('residence_hoteliere', { title: 'Hôtel Non Validé', statusAdmin: 'En attente' });
    await makeAccommodation('residence_hoteliere', { title: 'Hôtel Indisponible', availability: 'Indisponible' });

    const { data } = await callSearch({ offerType: 'hebergement' });
    expect(data.properties.map((p) => p.title)).toEqual(['Hôtel Publié']);
  });

  test('total et résultats cohérents (pagination correcte, jamais de total surestimé)', async () => {
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await makeAccommodation('villa_meublee', { title: `Villa ${i}` });
    }
    await makeAccommodation('residence_hoteliere', { title: 'Hôtel Brouillon' }, { publicationStatus: 'brouillon' });

    const { data } = await callSearch({ offerType: 'hebergement', page: '1', limit: '3' });
    expect(data.total).toBe(5); // le brouillon n'est jamais compté
    expect(data.properties).toHaveLength(3);
  });

  test('filtres ville/arrondissement/prix appliqués sur les hébergements', async () => {
    await makeAccommodation('villa_meublee', { title: 'Brazza', address: { arrondissement: 'Bacongo', city: 'Brazzaville' } });
    await makeAccommodation('villa_meublee', { title: 'Pointe-Noire', address: { arrondissement: 'Centre-ville', city: 'Pointe-Noire' } });

    const { data } = await callSearch({ offerType: 'hebergement', city: 'Brazzaville' });
    expect(data.properties.map((p) => p.title)).toEqual(['Brazza']);
  });
});

describe('GET /api/altimmo/search — offerType absent (tous)', () => {
  test('mélange Vente/Location/Hébergement publié, comportement inchangé de getAllProperties', async () => {
    await Property.create(baseProperty({ status: 'vente', title: 'Vente1' }));
    await Property.create(baseProperty({ status: 'location', title: 'Location1' }));
    await makeAccommodation('residence_hoteliere', { title: 'Hôtel Publié' });

    const { data } = await callSearch({});
    expect(data.properties.map((p) => p.title).sort()).toEqual(['Hôtel Publié', 'Location1', 'Vente1']);
  });
});
