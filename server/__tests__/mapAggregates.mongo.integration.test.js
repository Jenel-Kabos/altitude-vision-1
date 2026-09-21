// ALTIMMO-MAP-LOCALITY-CENTROIDS-2 — parité stricte entre le count agrégé
// par localité et le total renvoyé par /api/altimmo/search filtré sur cet
// arrondissement, exclusion des non publiés, filtre par prix/type/offerType,
// unmappedTotal pour les localités sans centroïde, et absence de toute
// coordonnée de propriété dans la réponse.

const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');
const { getMapAggregates } = require('../controllers/mapAggregatesController');
const { search } = require('../controllers/altimmoSearchController');

jest.setTimeout(120000);

const ownerId = () => new mongoose.Types.ObjectId();

const baseProperty = (overrides = {}) => ({
  title: 'Bien Test Map Aggregates',
  description: 'Description suffisamment longue pour la validation du modèle.',
  pole: 'Altimmo', type: 'Appartement', status: 'vente', price: 50000000,
  address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' },
  latitude: -4.27, longitude: 15.27, images: ['https://example.test/image.jpg'],
  location: { type: 'Point', coordinates: [15.27, -4.27] },
  surface: 120, statusAdmin: 'Validée', isPublished: true, availability: 'Disponible',
  owner: ownerId(),
  ...overrides,
});

const callAggregates = async (query = {}) => {
  const req = { query };
  let payload;
  const res = { status: () => res, json: (body) => { payload = body; return res; } };
  await getMapAggregates(req, res);
  return payload;
};

const callSearchTotal = async (query = {}) => {
  const req = { query };
  let payload;
  const res = { status: () => res, json: (body) => { payload = body; return res; } };
  await search(req, res);
  return payload?.data?.total ?? payload?.total ?? 0;
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('GET /api/altimmo/map-aggregates — comptage par localité', () => {
  test('agrège correctement Poto-Poto et Moungali (5 + 3) et renvoie leurs centroïdes OSM', async () => {
    await Property.insertMany(Array.from({ length: 5 }, (_, i) =>
      baseProperty({ title: `Poto ${i}`, address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' } })
    ));
    await Property.insertMany(Array.from({ length: 3 }, (_, i) =>
      baseProperty({ title: `Moungali ${i}`, address: { city: 'Brazzaville', arrondissement: 'Moungali' } })
    ));

    const { data } = await callAggregates();
    expect(data.total).toBe(8);
    expect(data.mappedTotal).toBe(8);
    expect(data.unmappedTotal).toBe(0);
    const byLabel = Object.fromEntries(data.areas.map((a) => [a.label, a]));
    expect(byLabel['Poto-Poto'].count).toBe(5);
    expect(byLabel['Poto-Poto'].latitude).toBeCloseTo(-4.2726398, 4);
    expect(byLabel['Poto-Poto'].longitude).toBeCloseTo(15.2775717, 4);
    expect(byLabel['Moungali'].count).toBe(3);
    expect(byLabel['Moungali'].city).toBe('Brazzaville');
  });

  test('exclut les biens non publiés (statusAdmin ≠ Validée ou isPublished=false)', async () => {
    await Property.create(baseProperty({ address: { city: 'Brazzaville', arrondissement: 'Bacongo' } }));
    await Property.create(baseProperty({ statusAdmin: 'En attente', address: { city: 'Brazzaville', arrondissement: 'Bacongo' } }));
    await Property.create(baseProperty({ isPublished: false,          address: { city: 'Brazzaville', arrondissement: 'Bacongo' } }));
    await Property.create(baseProperty({ availability: 'Indisponible',address: { city: 'Brazzaville', arrondissement: 'Bacongo' } }));

    const { data } = await callAggregates();
    expect(data.total).toBe(1);
    expect(data.areas).toEqual([expect.objectContaining({ label: 'Bacongo', count: 1 })]);
  });

  test('normalise les variantes d\'arrondissement (Poto Poto / POTO-POTO / Ouenzé)', async () => {
    await Property.create(baseProperty({ address: { city: 'Brazzaville', arrondissement: 'Poto Poto' } }));
    await Property.create(baseProperty({ address: { city: 'Brazzaville', arrondissement: 'POTO-POTO' } }));
    await Property.create(baseProperty({ address: { city: 'brazzaville', arrondissement: 'Poto-Poto' } }));
    await Property.create(baseProperty({ address: { city: 'Brazzaville', arrondissement: 'OUENZE' } }));
    await Property.create(baseProperty({ address: { city: 'Brazzaville', arrondissement: 'Ouenzé' } }));

    const { data } = await callAggregates();
    const byLabel = Object.fromEntries(data.areas.map((a) => [a.label, a]));
    expect(byLabel['Poto-Poto'].count).toBe(3);
    expect(byLabel['Ouenzé'].count).toBe(2);
    expect(data.mappedTotal).toBe(5);
  });

  test('les filtres price et propertyType propagent au count', async () => {
    await Property.create(baseProperty({ price: 30000000, type: 'Appartement', address: { city: 'Brazzaville', arrondissement: 'Moungali' } }));
    await Property.create(baseProperty({ price: 80000000, type: 'Appartement', address: { city: 'Brazzaville', arrondissement: 'Moungali' } }));
    await Property.create(baseProperty({ price: 90000000, type: 'Maison',      address: { city: 'Brazzaville', arrondissement: 'Moungali' } }));

    const { data } = await callAggregates({ propertyType: 'Appartement', minPrice: 40000000, maxPrice: 100000000 });
    expect(data.total).toBe(1);
    expect(data.areas[0]).toMatchObject({ label: 'Moungali', count: 1 });
  });

  test('unmappedTotal isole les biens dont la localité n\'a pas de centroïde', async () => {
    await Property.create(baseProperty({ address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' } }));
    await Property.create(baseProperty({ address: { city: 'Ouesso',      arrondissement: 'Centre-ville' } }));
    await Property.create(baseProperty({ address: { city: 'Owando',      arrondissement: 'Autres' } }));

    const { data } = await callAggregates();
    expect(data.total).toBe(3);
    expect(data.mappedTotal).toBe(1);
    expect(data.unmappedTotal).toBe(2);
    expect(data.areas).toEqual([expect.objectContaining({ label: 'Poto-Poto' })]);
  });

  test('zéro résultat → tableau vide et total 0', async () => {
    const { data } = await callAggregates();
    expect(data).toEqual({ total: 0, mappedTotal: 0, unmappedTotal: 0, areas: [] });
  });

  test('aucune coordonnée de propriété n\'apparaît dans la réponse (privacy)', async () => {
    await Property.insertMany([
      baseProperty({ latitude: -4.271, longitude: 15.278, address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' } }),
      baseProperty({ latitude: -4.243, longitude: 15.267, address: { city: 'Brazzaville', arrondissement: 'Moungali' } }),
    ]);
    const { data } = await callAggregates();
    const serialized = JSON.stringify(data);
    // Les centroïdes OSM sont autorisés (Poto-Poto ~ -4.2726398). Les coordonnées
    // exactes des propriétés (-4.271 et -4.243) ne doivent PAS apparaître.
    expect(serialized).not.toMatch(/-4\.271/);
    expect(serialized).not.toMatch(/15\.278/);
    expect(serialized).not.toMatch(/-4\.243(?!3802)/); // exclut le centroïde Moungali -4.2433802
  });

  test('parité stricte : area.count(Poto-Poto) === /altimmo/search(arrondissement=Poto-Poto).total', async () => {
    await Property.insertMany([
      baseProperty({ address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' } }),
      baseProperty({ address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' } }),
      baseProperty({ address: { city: 'Brazzaville', arrondissement: 'Moungali'  } }),
    ]);
    const { data } = await callAggregates({});
    const potoArea = data.areas.find((a) => a.label === 'Poto-Poto');
    const searchTotal = await callSearchTotal({ arrondissement: 'Poto-Poto' });
    expect(potoArea.count).toBe(searchTotal);
  });
});
