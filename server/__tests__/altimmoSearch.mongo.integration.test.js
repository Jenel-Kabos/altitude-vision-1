// Correctif architecture recherche Altimmo (2026-07-25) : offerType=hebergement doit
// interroger Accommodation (accommodationType réel), jamais Property seul — garantit
// structurellement qu'aucune annonce Vente/Location ne peut apparaître sous Hébergement et
// inversement (collections différentes, pas un simple filtre applicatif).

const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const Hotel = require('../models/Hotel');
const RatePlan = require('../models/RatePlan');
const { search } = require('../controllers/altimmoSearchController');

jest.setTimeout(120000);
const ownerId = () => new mongoose.Types.ObjectId();

const baseProperty = (overrides = {}) => ({
  title: 'Bien Test Altimmo Search', description: 'Description suffisamment longue pour la validation du modèle.',
  pole: 'Altimmo', type: 'Appartement', status: 'vente', price: 50000000,
  address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: 4.26, longitude: 15.28,
  images: ['https://example.test/image.jpg'], surface: 120, statusAdmin: 'Validée', isPublished: true, availability: 'Disponible',
  owner: ownerId(), ...overrides,
});

const makeAccommodation = async (accommodationType, propertyOverrides = {}, accommodationOverrides = {}) => {
  const isHotelEstablishment = Accommodation.HOTEL_ACCOMMODATION_TYPES.includes(accommodationType);
  const property = await Property.create(baseProperty({
    status: 'hebergement',
    ...(isHotelEstablishment ? { type: 'Commerce' } : {}),
    ...propertyOverrides,
  }));
  const creatorId = ownerId();
  const hotel = isHotelEstablishment ? await Hotel.create({
    name: property.title,
    description: property.description,
    manager: creatorId,
    property: property._id,
    publicationStatus: 'publie',
    createdBy: creatorId,
  }) : null;
  const accommodation = await Accommodation.create({
    property: property._id, accommodationType, hotel: hotel?._id,
    publicationStatus: 'publie', createdBy: creatorId,
    ...accommodationOverrides,
  });
  const ratePlan = await RatePlan.create({
    accommodation: accommodation._id, mode: 'nightly', amount: property.price,
    currency: 'XAF', createdBy: creatorId,
  });
  return { property, accommodation, hotel, ratePlan };
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

  test('les deux familles sont liées selon leur modèle et recherchables séparément', async () => {
    const hotel = await makeAccommodation('hotel', { title: 'Hôtel Central' });
    const residence = await makeAccommodation('residence_hoteliere', { title: 'Résidence Marina' });
    const appartement = await makeAccommodation('appartement_meuble', { title: 'Appartement Centre' });
    const villa = await makeAccommodation('villa_meublee', { title: 'Villa Fleuve' });

    expect(hotel.hotel).toBeTruthy();
    expect(residence.hotel).toBeTruthy();
    expect(appartement.hotel).toBeNull();
    expect(villa.hotel).toBeNull();
    expect(await RatePlan.countDocuments()).toBe(4);

    const all = await callSearch({ offerType: 'hebergement' });
    expect(all.data.properties).toHaveLength(4);
    const onlyHotels = await callSearch({ offerType: 'hebergement', accommodationType: 'hotel' });
    expect(onlyHotels.data.properties.map((p) => p.title)).toEqual(['Hôtel Central']);
    const onlyApartments = await callSearch({ offerType: 'hebergement', accommodationType: 'appartement_meuble' });
    expect(onlyApartments.data.properties.map((p) => p.title)).toEqual(['Appartement Centre']);
  });

  test('propertyType=Commerce sous Vente ne retourne jamais un hôtel technique Commerce', async () => {
    await makeAccommodation('hotel', { title: 'Hôtel Commerce Technique' });
    const { data } = await callSearch({ offerType: 'vente', propertyType: 'Commerce' });
    expect(data.properties).toEqual([]);
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

// PHASE-H1.5 — un établissement Hotel doit porter `accommodationType`/`hotel`
// dans CHAQUE chemin de recherche public (tous ET hebergement), pour que la
// découverte mobile distingue un Hotel d'un hébergement générique sans
// requête supplémentaire (jamais un N+1, jamais un contrat divergent entre
// les deux branches — voir propertyController.runPropertySearch et
// accommodationSearchService.searchPublicAccommodations).
describe('GET /api/altimmo/search — identité Hotel exposée à la découverte (PHASE-H1.5)', () => {
  test('offerType=tous — un Hotel publié porte accommodationType et hotel (ObjectId Hotel, jamais Property)', async () => {
    const { hotel, property } = await makeAccommodation('hotel', { title: 'Mila Hotel' });
    const { data } = await callSearch({});
    const item = data.properties.find((p) => p.title === 'Mila Hotel');
    expect(item.accommodationType).toBe('hotel');
    expect(String(item.hotel)).toBe(String(hotel._id));
    expect(String(item.hotel)).not.toBe(String(property._id));
  });

  test('offerType=hebergement — un Hotel publié porte accommodationType et hotel', async () => {
    const { hotel } = await makeAccommodation('hotel', { title: 'Mila Hotel' });
    const { data } = await callSearch({ offerType: 'hebergement' });
    const item = data.properties.find((p) => p.title === 'Mila Hotel');
    expect(item.accommodationType).toBe('hotel');
    expect(String(item.hotel)).toBe(String(hotel._id));
  });

  test('un hébergement non-hôtelier ne porte pas de champ hotel', async () => {
    await makeAccommodation('villa_meublee', { title: 'Villa Ordinaire' });
    const { data } = await callSearch({});
    const item = data.properties.find((p) => p.title === 'Villa Ordinaire');
    expect(item.hotel).toBeFalsy();
  });

  test('un Hotel non publié (Accommodation brouillon) est exclu de la découverte, dans les deux branches', async () => {
    await makeAccommodation('hotel', { title: 'Hotel Non Publié' }, { publicationStatus: 'brouillon' });

    const tous = await callSearch({});
    expect(tous.data.properties.some((p) => p.title === 'Hotel Non Publié')).toBe(false);

    const hebergement = await callSearch({ offerType: 'hebergement' });
    expect(hebergement.data.properties.some((p) => p.title === 'Hotel Non Publié')).toBe(false);
  });

  test('deux Hotels publiés de tenants différents coexistent dans la découverte publique', async () => {
    const tenantA = new mongoose.Types.ObjectId();
    const tenantB = new mongoose.Types.ObjectId();
    await makeAccommodation('hotel', { title: 'Hotel Tenant A', tenant: tenantA });
    await makeAccommodation('hotel', { title: 'Hotel Tenant B', tenant: tenantB });

    const { data } = await callSearch({});
    expect(data.properties.map((p) => p.title).sort()).toEqual(['Hotel Tenant A', 'Hotel Tenant B']);
  });

  test('aucune donnée privée du Hotel n’est exposée — seul l’ObjectId est présent, jamais le document peuplé', async () => {
    const { hotel } = await makeAccommodation('hotel', { title: 'Mila Hotel' });
    const { data } = await callSearch({});
    const item = data.properties.find((p) => p.title === 'Mila Hotel');
    // `hotel` doit être un ObjectId brut (jamais populé) : aucune fuite de
    // manager/createdBy/taxInformation/legalName/administrativeDocuments du
    // document Hotel lui-même par ce chemin de recherche.
    expect(typeof item.hotel === 'string' || item.hotel?.constructor?.name === 'ObjectId').toBe(true);
    expect(String(item.hotel)).toBe(String(hotel._id));
    expect(item.hotel).not.toHaveProperty('manager');
    expect(item.hotel).not.toHaveProperty('taxInformation');
  });
});
