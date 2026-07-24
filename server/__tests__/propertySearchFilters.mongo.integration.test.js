// Audit filtrage Altimmo — vérifie le comportement RÉEL (Mongo) de
// `propertyController.getAllProperties` avec la nomenclature canonique + les alias legacy,
// et l'absence de fuite d'annonces non approuvées. Appel direct du contrôleur (pas de
// supertest/JWT nécessaire ici — c'est le filtre Mongo qui est sous test, pas le routage/auth,
// déjà couverts par `propertyRoutes.test.js`).

const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const { getAllProperties, getRecommendedProperties } = require('../controllers/propertyController');

jest.setTimeout(120000);

const ownerId = () => new mongoose.Types.ObjectId();

const baseProperty = (overrides = {}) => ({
  title: 'Bel appartement lumineux',
  description: 'Description suffisamment longue pour la validation du modèle Property.',
  pole: 'Altimmo',
  type: 'Appartement',
  status: 'vente',
  price: 50000000,
  address: { arrondissement: 'Bacongo', city: 'Brazzaville' },
  latitude: 4.26,
  longitude: 15.28,
  images: ['https://example.test/image.jpg'],
  surface: 120,
  statusAdmin: 'Validée',
  availability: 'Disponible',
  owner: ownerId(),
  ...overrides,
});

const callGetAllProperties = async (query, user) => {
  const req = { query: { ...query }, user };
  let payload;
  const res = { status: () => res, json: (body) => { payload = body; return res; } };
  await getAllProperties(req, res);
  return payload;
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('Audit filtrage Altimmo — getAllProperties (nomenclature canonique + alias legacy, Mongo réel)', () => {
  test('offerType seul (vente)', async () => {
    await Property.create(baseProperty({ status: 'vente', title: 'Villa Vente' }));
    await Property.create(baseProperty({ status: 'location', title: 'Villa Location' }));
    const { data } = await callGetAllProperties({ offerType: 'vente' });
    expect(data.properties).toHaveLength(1);
    expect(data.properties[0].status).toBe('vente');
  });

  test('propertyType seul', async () => {
    await Property.create(baseProperty({ type: 'Villa' }));
    await Property.create(baseProperty({ type: 'Studio' }));
    const { data } = await callGetAllProperties({ propertyType: 'Studio' });
    expect(data.properties).toHaveLength(1);
    expect(data.properties[0].type).toBe('Studio');
  });

  test('city seul (insensible à la casse, égalité exacte)', async () => {
    await Property.create(baseProperty({ address: { arrondissement: 'Bacongo', city: 'Brazzaville' } }));
    await Property.create(baseProperty({ address: { arrondissement: 'Centre-ville', city: 'Pointe-Noire' } }));
    const { data } = await callGetAllProperties({ city: 'brazzaville' });
    expect(data.properties).toHaveLength(1);
    expect(data.properties[0].address.city).toBe('Brazzaville');
  });

  test('arrondissement seul', async () => {
    await Property.create(baseProperty({ address: { arrondissement: 'Bacongo', city: 'Brazzaville' } }));
    await Property.create(baseProperty({ address: { arrondissement: 'Moungali', city: 'Brazzaville' } }));
    const { data } = await callGetAllProperties({ arrondissement: 'moungali' });
    expect(data.properties).toHaveLength(1);
    expect(data.properties[0].address.arrondissement).toBe('Moungali');
  });

  test('minPrice/maxPrice seuls', async () => {
    await Property.create(baseProperty({ price: 1000000, title: 'Pas cher' }));
    await Property.create(baseProperty({ price: 50000000, title: 'Moyen' }));
    await Property.create(baseProperty({ price: 900000000, title: 'Très cher' }));
    const { data } = await callGetAllProperties({ minPrice: '10000000', maxPrice: '100000000' });
    expect(data.properties).toHaveLength(1);
    expect(data.properties[0].title).toBe('Moyen');
  });

  test('plusieurs filtres combinés', async () => {
    await Property.create(baseProperty({ status: 'location', type: 'Studio', address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, price: 200000 }));
    await Property.create(baseProperty({ status: 'location', type: 'Villa', address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, price: 200000 }));
    await Property.create(baseProperty({ status: 'vente', type: 'Studio', address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, price: 200000 }));
    const { data } = await callGetAllProperties({ offerType: 'location', propertyType: 'Studio', city: 'Brazzaville', arrondissement: 'Bacongo' });
    expect(data.properties).toHaveLength(1);
    expect(data.properties[0]).toMatchObject({ status: 'location', type: 'Studio' });
  });

  test('hébergement : un Property status=hebergement n’apparaît que si son Accommodation est publicationStatus=publie', async () => {
    const hidden = await Property.create(baseProperty({ status: 'hebergement', title: 'Hébergement non publié' }));
    const visible = await Property.create(baseProperty({ status: 'hebergement', title: 'Hébergement publié' }));
    await Accommodation.create({ property: hidden._id, accommodationType: 'appartement_meuble', publicationStatus: 'brouillon', createdBy: ownerId() });
    await Accommodation.create({ property: visible._id, accommodationType: 'appartement_meuble', publicationStatus: 'publie', createdBy: ownerId() });
    const { data } = await callGetAllProperties({ offerType: 'hebergement' });
    expect(data.properties).toHaveLength(1);
    expect(data.properties[0].title).toBe('Hébergement publié');
  });

  test('alias legacy status/transaction/listingType → offerType', async () => {
    await Property.create(baseProperty({ status: 'vente' }));
    await Property.create(baseProperty({ status: 'location' }));
    expect((await callGetAllProperties({ status: 'vente' })).data.properties).toHaveLength(1);
    expect((await callGetAllProperties({ transaction: 'location' })).data.properties).toHaveLength(1);
    expect((await callGetAllProperties({ listingType: 'vente' })).data.properties).toHaveLength(1);
  });

  test('alias legacy `type` → propertyType', async () => {
    await Property.create(baseProperty({ type: 'Villa' }));
    await Property.create(baseProperty({ type: 'Studio' }));
    expect((await callGetAllProperties({ type: 'Villa' })).data.properties).toHaveLength(1);
  });

  test('alias legacy `ville` → city', async () => {
    await Property.create(baseProperty({ address: { arrondissement: 'Bacongo', city: 'Dolisie' } }));
    await Property.create(baseProperty({ address: { arrondissement: 'Centre-ville', city: 'Nkayi' } }));
    expect((await callGetAllProperties({ ville: 'Dolisie' })).data.properties).toHaveLength(1);
  });

  test('alias legacy price[gte]/price[lte] → minPrice/maxPrice', async () => {
    await Property.create(baseProperty({ price: 1000000 }));
    await Property.create(baseProperty({ price: 900000000 }));
    const { data } = await callGetAllProperties({ price: { gte: '10000000', lte: '1000000000' } });
    expect(data.properties).toHaveLength(1);
  });

  test('valeurs invalides ignorées silencieusement (aucune exception, aucun filtre appliqué)', async () => {
    await Property.create(baseProperty());
    await Property.create(baseProperty());
    const { data } = await callGetAllProperties({ offerType: 'n-importe-quoi', minPrice: 'abc' });
    expect(data.properties).toHaveLength(2);
  });

  test('tri (sort) et pagination (page/limit)', async () => {
    await Property.create(baseProperty({ price: 100, title: 'A' }));
    await Property.create(baseProperty({ price: 300, title: 'B' }));
    await Property.create(baseProperty({ price: 200, title: 'C' }));
    const { data } = await callGetAllProperties({ sort: 'price', page: '1', limit: '2' });
    expect(data.properties).toHaveLength(2);
    expect(data.properties.map((p) => p.price)).toEqual([100, 200]);
  });

  test('aucune fuite : statusAdmin ≠ Validée, availability ≠ Disponible, pole ≠ Altimmo exclus pour un non-admin', async () => {
    await Property.create(baseProperty({ statusAdmin: 'En attente', title: 'Non validé' }));
    await Property.create(baseProperty({ availability: 'Vendu', title: 'Indisponible' }));
    await Property.create(baseProperty({ pole: 'MilaEvents', type: 'Bureau', title: 'Autre pôle' }));
    await Property.create(baseProperty({ title: 'Visible' }));
    const { data } = await callGetAllProperties({});
    expect(data.properties).toHaveLength(1);
    expect(data.properties[0].title).toBe('Visible');
  });

  test('un client ne peut pas outrepasser statusAdmin/availability/pole via la query string', async () => {
    await Property.create(baseProperty({ statusAdmin: 'En attente', title: 'Non validé' }));
    const { data } = await callGetAllProperties({ statusAdmin: 'En attente', availability: 'Indisponible', pole: 'MilaEvents' });
    expect(data.properties).toHaveLength(0);
  });
});

describe('Audit filtrage Altimmo — getRecommendedProperties scope pole (Mongo réel)', () => {
  const callRecommended = async () => {
    let payload;
    const res = { status: () => res, json: (body) => { payload = body; return res; } };
    await getRecommendedProperties({ query: {} }, res);
    return payload;
  };

  test('un bien recommandé d’un autre pôle (MilaEvents) n’apparaît jamais dans les recommandations Altimmo', async () => {
    await Property.create(baseProperty({ recommande: true, pole: 'Altimmo', title: 'Recommandé Altimmo' }));
    await Property.create(baseProperty({ recommande: true, pole: 'MilaEvents', type: 'Bureau', title: 'Recommandé MilaEvents' }));
    const { data } = await callRecommended();
    expect(data.properties.map((p) => p.title)).toEqual(['Recommandé Altimmo']);
  });
});
