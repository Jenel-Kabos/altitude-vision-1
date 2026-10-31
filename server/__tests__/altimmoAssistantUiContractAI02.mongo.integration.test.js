// ALTIMMO-AI-INTEGRATION-02 — contrat entre les interfaces web/mobile et le moteur IA-03.
// Données fictives, MongoMemory, aucun modèle IA. Couvre : état d'activation, filtres structurés des
// formulaires (couche filterQuery), corrections de l'analyseur, et la forme des réponses réelles,
// comparée au jeu de référence partagé `shared/altimmoAssistant/contractFixtures.json` que les tests
// web et mobile consomment (une dérivée de forme côté serveur fait échouer ce test).
// Régénération volontaire du jeu : ALTIMMO_AI02_WRITE_FIXTURES=1.
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const Hotel = require('../models/Hotel');
const RatePlan = require('../models/RatePlan');
const { parseRealEstateRequest } = require('../services/altimmoAssistant/ruleParser');
const { normalizeAssistantFilters, filtersToQuery } = require('../services/altimmoAssistant/filterQuery');

jest.setTimeout(180000);

const FIXTURE_PATH = path.join(__dirname, '..', '..', 'shared', 'altimmoAssistant', 'contractFixtures.json');
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use('/api/altimmo', require('../routes/altimmoSearchRoutes'));

let ipCounter = 0;
const ip = () => { ipCounter += 1; return `192.0.2.${ipCounter % 250}`; };
const search = (body) => request(app).post('/api/altimmo/assistant/search').set('X-Forwarded-For', ip()).send(body);
const compare = (body) => request(app).post('/api/altimmo/assistant/compare').set('X-Forwarded-For', ip()).send(body);
const titles = (res) => [...(res.body.data.rankedResults || []), ...(res.body.data.rankedCandidatesToVerify || [])].map((item) => item.listing.title).sort();

const ownerId = new mongoose.Types.ObjectId();
const ids = {};
const previousFlag = process.env.ALTIMMO_ASSISTANT_ENABLED;

const base = (overrides = {}) => ({
  owner: ownerId, description: 'Annonce fictive de test pour le contrat de l’assistant Altimmo.',
  pole: 'Altimmo', type: 'Maison', status: 'location', price: 200000, honoraires: null,
  address: { street: 'Rue privée AI02', city: 'Brazzaville', arrondissement: 'Moungali', neighborhood: 'Plateau des 15 ans' },
  latitude: -4.26, longitude: 15.28, images: ['https://placehold.co/1200x800/png?text=AI02'], surface: 120, bedrooms: 3, amenities: [],
  statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', publicationLifecycleState: 'published', ...overrides,
});

// Signature de forme : chemins et types, indépendamment des valeurs (identifiants, dates).
function shapeOf(value, prefix = '$', out = new Set()) {
  if (Array.isArray(value)) { out.add(`${prefix}:array`); value.forEach((item) => shapeOf(item, `${prefix}[]`, out)); return out; }
  if (value && typeof value === 'object') { out.add(`${prefix}:object`); Object.entries(value).forEach(([key, item]) => shapeOf(item, `${prefix}.${key}`, out)); return out; }
  out.add(`${prefix}:${value === null ? 'null' : typeof value}`);
  return out;
}

beforeAll(async () => {
  await startFinancialMongo();
  const t0 = Date.parse('2026-10-30T12:00:00Z');
  const at = (minutes) => new Date(t0 - minutes * 60000);
  ids.moungali3 = (await Property.create(base({ title: 'AI02 Maison Moungali 3 chambres', amenities: ['Parking'], honoraires: 200000, createdAt: at(1) })))._id;
  ids.moungali4 = (await Property.create(base({ title: 'AI02 Maison Moungali 4 chambres', bedrooms: 4, price: 350000, amenities: ['Parking', 'Jardin'], createdAt: at(2) })))._id;
  // Équipements non renseignés : le parking exigé reste « à vérifier », jamais affirmé ni exclu.
  ids.unknownAmenities = (await Property.create(base({ title: 'AI02 Maison Moungali équipements non renseignés', price: 180000, createdAt: at(3) })))._id;
  ids.pending = (await Property.create(base({ title: 'AI02 Maison non approuvée', statusAdmin: 'En attente', isPublished: false, publicationLifecycleState: 'pending', createdAt: at(4) })))._id;
  ids.sale = (await Property.create(base({ title: 'AI02 Appartement vente', type: 'Appartement', status: 'vente', price: 25000000, createdAt: at(5) })))._id;
  const hotelProperty = await Property.create(base({ title: 'AI02 Hôtel Brazzaville', status: 'hebergement', type: 'Commerce', price: 45000, amenities: ['Wifi'], createdAt: at(6) }));
  const hotel = await Hotel.create({ name: hotelProperty.title, description: hotelProperty.description, manager: ownerId, property: hotelProperty._id, publicationStatus: 'publie', createdBy: ownerId });
  const accommodation = await Accommodation.create({ property: hotelProperty._id, accommodationType: 'hotel', hotel: hotel._id, publicationStatus: 'publie', createdBy: ownerId });
  await RatePlan.create({ accommodation: accommodation._id, mode: 'nightly', amount: 45000, currency: 'XAF', createdBy: ownerId });
  ids.hotel = hotelProperty._id;
  process.env.ALTIMMO_ASSISTANT_ENABLED = 'true';
});

afterAll(async () => {
  if (previousFlag === undefined) delete process.env.ALTIMMO_ASSISTANT_ENABLED;
  else process.env.ALTIMMO_ASSISTANT_ENABLED = previousFlag;
  await stopFinancialMongo();
});

afterEach(() => { process.env.ALTIMMO_ASSISTANT_ENABLED = 'true'; });

describe('AI-INTEGRATION-02 — état d’activation', () => {
  test('GET /assistant/status reflète la configuration, sans lecture de données', async () => {
    const find = jest.spyOn(Property, 'find');
    delete process.env.ALTIMMO_ASSISTANT_ENABLED;
    expect((await request(app).get('/api/altimmo/assistant/status')).body).toEqual({ status: 'success', data: { enabled: false } });
    process.env.ALTIMMO_ASSISTANT_ENABLED = 'TRUE';
    expect((await request(app).get('/api/altimmo/assistant/status')).body.data.enabled).toBe(false);
    process.env.ALTIMMO_ASSISTANT_ENABLED = 'true';
    expect((await request(app).get('/api/altimmo/assistant/status')).body.data.enabled).toBe(true);
    expect(find).not.toHaveBeenCalled();
    find.mockRestore();
  });

  test('désactivé : la recherche par filtres répond 503 ALTIMMO_ASSISTANT_DISABLED', async () => {
    delete process.env.ALTIMMO_ASSISTANT_ENABLED;
    const res = await search({ filters: { offerType: 'location', city: 'Brazzaville' } });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('ALTIMMO_ASSISTANT_DISABLED');
  });
});

describe('AI-INTEGRATION-02 — filtres structurés des formulaires', () => {
  test.each([
    [{ offerType: 'location', propertyType: 'Maison', city: 'Brazzaville', arrondissement: 'Moungali', minBedrooms: '3', maxPrice: '250000' },
      { transaction: 'RENT', propertyTypes: ['Maison'], city: 'Brazzaville', districts: ['Moungali'], min: null, max: 250000, bedrooms: 3 }],
    [{ offerType: 'vente', propertyType: 'Appartement', city: 'Brazzaville', minPrice: '10000000', maxPrice: '30000000' },
      { transaction: 'BUY', propertyTypes: ['Appartement'], city: 'Brazzaville', districts: [], min: 10000000, max: 30000000, bedrooms: null }],
    [{ offerType: 'hebergement', accommodationType: 'hotel', city: 'Pointe-Noire' },
      { transaction: 'STAY', accommodationTypes: ['hotel'], city: 'Pointe-Noire', districts: [], min: null, max: null, bedrooms: null }],
    [{ offerType: 'hebergement', accommodationType: 'studio_meuble', city: 'Brazzaville' },
      { transaction: 'STAY', accommodationTypes: ['studio_meuble'], city: 'Brazzaville', districts: [], min: null, max: null, bedrooms: null }],
    [{ offerType: 'location', city: 'pointe-noire', arrondissement: 'tie-tie' },
      { transaction: 'RENT', propertyTypes: [], city: 'Pointe-Noire', districts: ['Tié-Tié'], min: null, max: null, bedrooms: null }],
  ])('%j → critères reconnus par l’analyseur réel', (filters, expected) => {
    const normalized = normalizeAssistantFilters(filters);
    expect(normalized.valid).toBe(true);
    const parsed = parseRealEstateRequest(filtersToQuery(normalized.filters));
    expect(parsed.status).toBe('recognized');
    expect(parsed.ambiguities).toEqual([]);
    expect(parsed.criteria.transaction).toBe(expected.transaction);
    if (expected.propertyTypes) expect(parsed.criteria.propertyTypes).toEqual(expected.propertyTypes);
    if (expected.accommodationTypes) expect(parsed.criteria.accommodationTypes).toEqual(expected.accommodationTypes);
    expect(parsed.criteria.location.city).toBe(expected.city);
    expect(parsed.criteria.location.districts).toEqual(expected.districts);
    expect(parsed.criteria.budget.min).toBe(expected.min);
    expect(parsed.criteria.budget.max).toBe(expected.max);
    expect(parsed.criteria.bedrooms.min).toBe(expected.bedrooms);
  });

  test('chaque catégorie d’hébergement est reconnue', () => {
    for (const type of ['villa_meublee', 'maison_meublee', 'appartement_meuble', 'studio_meuble', 'residence_meublee', 'bungalow', 'hotel', 'residence_hoteliere', 'chambre_hotes']) {
      const parsed = parseRealEstateRequest(filtersToQuery(normalizeAssistantFilters({ offerType: 'hebergement', accommodationType: type, city: 'Brazzaville' }).filters));
      expect(parsed.criteria.accommodationTypes).toEqual([type]);
    }
  });

  test('valeurs hors catalogue refusées (400), sentinelles ignorées', async () => {
    for (const filters of [
      { unknown: 'x' }, { offerType: 'achat' }, { propertyType: 'Château' }, { city: 'Paris' }, { city: 'Dolisie', arrondissement: 'Centre-ville' },
      { minPrice: '-5' }, { minPrice: 'abc' }, { minPrice: '300000', maxPrice: '100000' }, { minBedrooms: '0' }, { minBedrooms: '2.5' },
      { offerType: 'hebergement', propertyType: 'Maison' }, { offerType: 'vente', accommodationType: 'hotel' }, { city: { $ne: null } }, 'Brazzaville', ['x'],
    ]) {
      const res = await search({ filters });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ALTIMMO_ASSISTANT_INVALID_REQUEST');
    }
    expect(normalizeAssistantFilters({ offerType: 'tous', propertyType: 'Tous', city: 'Toutes' })).toEqual({ valid: true, filters: {} });
    expect((await search({ filters: { offerType: 'tous' } })).status).toBe(400); // ni requête ni filtre utile
  });

  test('recherche par filtres et précisions libres : mêmes portes de publication', async () => {
    const res = await search({ filters: { offerType: 'location', propertyType: 'Maison', city: 'Brazzaville', arrondissement: 'Moungali', minBedrooms: '3' }, query: 'avec parking' });
    expect(res.status).toBe(200);
    expect(res.body.data.interpretedCriteria.amenities.required).toEqual(['parking']);
    expect(titles(res)).toEqual(['AI02 Maison Moungali 3 chambres', 'AI02 Maison Moungali 4 chambres', 'AI02 Maison Moungali équipements non renseignés']);
    expect(res.body.data.rankedCandidatesToVerify.map((item) => item.listing.title)).toContain('AI02 Maison Moungali équipements non renseignés');
    expect(JSON.stringify(res.body)).not.toMatch(/non approuvée|"owner"|latitude|Rue privée/);
  });

  test('filtres incomplets : demande de précision, aucune recherche', async () => {
    const find = jest.spyOn(Property, 'find');
    const res = await search({ filters: { city: 'Brazzaville' } });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('needs_clarification');
    expect(res.body.data.clarificationQuestions.length).toBeGreaterThan(0);
    expect(find).not.toHaveBeenCalled();
    find.mockRestore();
  });
});

describe('AI-INTEGRATION-02 — corrections de l’analyseur IA-03', () => {
  test('un nombre de chambres, de salles de bain ou de nuits n’est jamais un budget', () => {
    expect(parseRealEstateRequest('maison avec au moins 3 chambres à louer à Brazzaville').criteria).toMatchObject({ budget: { min: null, max: null }, bedrooms: { min: 3 } });
    expect(parseRealEstateRequest('maison à louer à Brazzaville maximum 2 salles de bain').criteria.budget).toMatchObject({ min: null, max: null });
    expect(parseRealEstateRequest('hôtel à Brazzaville minimum 2 nuits').criteria.budget).toMatchObject({ min: null, max: null });
    expect(parseRealEstateRequest('appartement à louer à Brazzaville loyer minimum 100000 FCFA').criteria.budget).toMatchObject({ min: 100000, currency: 'XAF' });
  });

  test('« 120 m2 » est une surface, jamais 120 millions ; « 25 m FCFA » reste 25 millions', () => {
    expect(parseRealEstateRequest('maison à vendre à Brazzaville au moins 120 m2').criteria).toMatchObject({ budget: { min: null, max: null }, surface: { min: 120 } });
    expect(parseRealEstateRequest('maison à vendre à Brazzaville budget 25 m FCFA').criteria.budget).toMatchObject({ max: 25000000, currency: 'XAF' });
  });
});

describe('AI-INTEGRATION-02 — forme des réponses consommées par le web et le mobile', () => {
  test('réponses réelles conformes au jeu de référence partagé', async () => {
    const real = {
      status: (await request(app).get('/api/altimmo/assistant/status')).body,
      searchResults: (await search({ filters: { offerType: 'location', propertyType: 'Maison', city: 'Brazzaville', arrondissement: 'Moungali' }, query: 'avec parking si possible' })).body,
      searchToVerify: (await search({ filters: { offerType: 'location', propertyType: 'Maison', city: 'Brazzaville', arrondissement: 'Moungali' }, query: 'avec parking' })).body,
      searchEmpty: (await search({ query: 'Villa 6 chambres avec piscine à louer à Poto-Poto moins de 100 000 FCFA' })).body,
      searchIncomplete: (await search({ filters: { city: 'Brazzaville' } })).body,
      searchProximity: (await search({ query: 'Maison à louer à Moungali proche d’un marché' })).body,
      searchHotel: (await search({ filters: { offerType: 'hebergement', accommodationType: 'hotel', city: 'Brazzaville' } })).body,
      compareSelected: (await compare({ propertyIds: [String(ids.moungali3), String(ids.moungali4), String(ids.pending)], query: 'Maison à louer à Moungali avec parking' })).body,
      compareUnavailable: (await compare({ propertyIds: [String(ids.pending), String(ids.moungali3)] })).body,
      disabled: await (async () => {
        delete process.env.ALTIMMO_ASSISTANT_ENABLED;
        const body = (await search({ query: 'Maison à louer à Moungali' })).body;
        process.env.ALTIMMO_ASSISTANT_ENABLED = 'true';
        return body;
      })(),
      rateLimited: { status: 'fail', message: "Trop de messages envoyés à l'assistant. Réessayez dans une minute." },
      invalid: (await search({ filters: { city: 'Paris' } })).body,
    };
    expect(real.searchResults.data.rankedResults.length).toBeGreaterThan(0);
    expect(real.searchToVerify.data.rankedCandidatesToVerify.length).toBeGreaterThan(0);
    expect(real.searchHotel.notices.map((item) => item.code)).toContain('STAY_AVAILABILITY_NOT_VERIFIED');
    expect(real.compareSelected.data.items.length).toBe(2);
    expect(real.compareUnavailable.data.status).not.toBe('success');
    // Aucune donnée privée dans ce qui sera partagé avec les interfaces.
    expect(JSON.stringify(real)).not.toMatch(/"owner"|"tenant"|latitude|longitude|Rue privée|"documents"/);

    if (process.env.ALTIMMO_AI02_WRITE_FIXTURES === '1') {
      fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
      fs.writeFileSync(FIXTURE_PATH, `${JSON.stringify(real, null, 2)}\n`);
    }
    const reference = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
    for (const key of Object.keys(real)) {
      expect({ key, shape: [...shapeOf(real[key])].sort() }).toEqual({ key, shape: [...shapeOf(reference[key])].sort() });
    }
  });
});
