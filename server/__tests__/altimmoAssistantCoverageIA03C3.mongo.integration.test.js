const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const RatePlan = require('../models/RatePlan');
require('../models/Hotel');
const { searchAndRankRealEstateFromText } = require('../services/altimmoAssistant/personalizedSearchService');
const { searchRealEstateFromText } = require('../services/altimmoAssistant/intelligentSearchService');

jest.setTimeout(180000);
const oid = () => new mongoose.Types.ObjectId();
const BASE = Date.UTC(2026, 9, 1);
const RENT = 'Je cherche une maison à louer à Talangaï, 3 chambres, maximum 250 000 FCFA par mois. Je préfère un parking, un jardin et la climatisation.';
// Insertion directe : createdAt maîtrisé, données historiques (champ absent) reproductibles.
const doc = (n, overrides = {}) => ({
  _id: oid(), title: `Maison ${n}`, description: 'Annonce de test représentative.', pole: 'Altimmo', type: 'Maison', status: 'location',
  price: 200000, address: { street: 'Rue privée', neighborhood: 'Plateau', arrondissement: 'Talangaï', city: 'Brazzaville' },
  latitude: -4.2, longitude: 15.2, images: [], bedrooms: 3, bathrooms: 1, surface: 100, amenities: [],
  availability: 'Disponible', statusAdmin: 'Validée', isPublished: true, owner: oid(), tenant: oid(), commissionRate: 12,
  createdAt: new Date(BASE - n * 60000), updatedAt: new Date(BASE), ...overrides,
});
const insert = async (docs) => { await Property.collection.insertMany(docs); return docs; };
const rank = (query, extra = {}, dependencies = {}) => searchAndRankRealEstateFromText({ query, context: { scopeMode: 'PUBLIC' }, ...extra }, dependencies);
const titles = (items) => items.map((item) => item.listing.title);

beforeAll(startFinancialMongo);
afterEach(async () => { jest.restoreAllMocks(); await clearFinancialMongo(); });
afterAll(stopFinancialMongo);

describe('IA-03C3 — classement global sur MongoDB', () => {
  test('30 annonces : la meilleure, en page 3 chronologique, est première', async () => {
    await insert(Array.from({ length: 30 }, (_, i) => doc(i + 1, i + 1 === 25 ? { amenities: ['parking', 'jardin', 'climatisation'] } : {})));
    const out = await rank(RENT, { pagination: { page: 1, limit: 10 } });
    expect(titles(out.rankedResults)[0]).toBe('Maison 25');
    expect(out.coverage).toMatchObject({ evaluated: 30, mongoMatchedTotal: 30, complete: true, admissible: 30 });
    const json = JSON.stringify(out);
    for (const secret of ['Rue privée', 'commissionRate', 'latitude', '"owner"', '"tenant"']) expect(json).not.toContain(secret);
  });

  test('volumes 1 001 et 1 500 : 1 000 évalués, couverture partielle, lectures bornées', async () => {
    for (const size of [1001, 1500]) {
      await clearFinancialMongo();
      await insert(Array.from({ length: size }, (_, i) => doc(i + 1)));
      const findSpy = jest.spyOn(Property, 'find');
      const out = await rank(RENT, { pagination: { page: 1, limit: 5 } });
      expect(out.coverage).toMatchObject({ evaluated: 1000, mongoMatchedTotal: size, mongoTotalExact: true, complete: false, admissibleTotalExact: false, limit: 1000 });
      expect(out.warnings.map((w) => w.code)).toContain('CATALOG_COVERAGE_LIMITED');
      expect(findSpy.mock.calls.length).toBeLessThanOrEqual(11);
      findSpy.mockRestore();
    }
  });
});

describe('IA-03C3 — filtres poussés en base sans changer la sémantique', () => {
  test('donnée historique sans chambres : à vérifier, jamais éliminée par MongoDB', async () => {
    const legacy = doc(1, { title: 'Sans chambres renseignées' }); delete legacy.bedrooms;
    await insert([legacy, doc(2, { title: 'Deux chambres', bedrooms: 2 }), doc(3, { title: 'Trois chambres' })]);
    const out = await rank(RENT);
    expect(titles(out.rankedResults)).toEqual(['Trois chambres']);
    expect(titles(out.rankedCandidatesToVerify)).toEqual(['Sans chambres renseignées']);
    expect(out.rankedCandidatesToVerify[0].unknownCriteria).toEqual([{ field: 'bedrooms.min', state: 'UNKNOWN' }]);
  });

  test('quartier : filtré en base, quartier absent conservé à vérifier', async () => {
    const unknown = doc(1, { title: 'Quartier absent' }); delete unknown.address.neighborhood;
    await insert([unknown, doc(2, { title: 'Autre quartier', address: { neighborhood: 'Moukondo', arrondissement: 'Talangaï', city: 'Brazzaville' } }), doc(3, { title: 'Plateau' })]);
    const out = await rank('Maison à louer à Talangaï quartier Plateau, 3 chambres, maximum 250 000 FCFA par mois.');
    expect(titles(out.rankedResults)).toEqual(['Plateau']);
    expect(titles(out.rankedCandidatesToVerify)).toEqual(['Quartier absent']);
    expect(out.coverage.scanned).toBe(2);
  });

  test('type numérique incorrect : évalué en mémoire comme avant, jamais éliminé en base', async () => {
    await insert([doc(1, { title: 'Chambres en texte', bedrooms: '3' }), doc(2, { title: 'Prix normal' })]);
    const out = await rank(RENT);
    expect(titles(out.rankedResults).sort()).toEqual(['Chambres en texte', 'Prix normal']);
  });
});

describe('IA-03C3 — hébergements : aucune relecture complète du catalogue', () => {
  const STAY = 'Maison meublée à Brazzaville pour un court séjour, maximum 40 000 FCFA par nuit. Je préfère la climatisation.';
  async function stays(count, patch = () => ({})) {
    const properties = []; const accommodations = []; const rates = [];
    for (let n = 1; n <= count; n += 1) {
      const p = doc(n, { title: `Meublé ${n}`, status: 'hebergement' });
      const a = { _id: oid(), property: p._id, accommodationType: 'maison_meublee', publicationStatus: 'publie', active: true, createdBy: oid(), amenities: { salon: n % 2 ? ['climatisation'] : [] } };
      const r = { _id: oid(), accommodation: a._id, mode: 'nightly', amount: 30000, currency: 'XAF', active: true, createdBy: oid() };
      Object.assign(p, patch(n).property || {}); Object.assign(a, patch(n).accommodation || {}); Object.assign(r, patch(n).rate || {});
      properties.push(p); accommodations.push(a); rates.push(r);
    }
    await Property.collection.insertMany(properties);
    await Accommodation.collection.insertMany(accommodations);
    await RatePlan.collection.insertMany(rates);
  }

  test('grand catalogue : chaque lecture Accommodation est restreinte au lot courant', async () => {
    await stays(260);
    const accSpy = jest.spyOn(Accommodation, 'find');
    const out = await rank(STAY, { pagination: { page: 1, limit: 5 } });
    expect(out.rankingStatus).toBe('ranked');
    expect(out.coverage).toMatchObject({ evaluated: 260, complete: true });
    expect(accSpy.mock.calls.length).toBeGreaterThan(0);
    for (const [filter] of accSpy.mock.calls) {
      expect(filter.property?.$in).toBeDefined();
      expect(filter.property.$in.length).toBeLessThanOrEqual(100);
    }
    expect(accSpy.mock.calls.length).toBeLessThanOrEqual(3);
  });

  test('tarifs actif/inactif/absent, hôtel, privé et dépublié', async () => {
    await stays(7, (n) => ({
      1: { rate: { amount: 30000 } },
      2: { rate: { active: false } }, // tarif expiré : jamais utilisé comme prix
      3: { rate: { amount: 50000 } },
      4: { accommodation: { publicationStatus: 'soumis' } },
      5: { property: { isPublished: false } },
      6: { accommodation: { accommodationType: 'hotel', hotel: oid() } },
      7: { accommodation: { active: false } },
    }[n] || {}));
    const out = await rank(STAY, { pagination: { page: 1, limit: 50 } });
    expect(titles(out.rankedResults)).toEqual(['Meublé 1']);
    expect(titles(out.rankedCandidatesToVerify)).toEqual(['Meublé 2']);
    expect(out.rankedCandidatesToVerify[0].unknownCriteria).toContainEqual({ field: 'budget.max', state: 'UNKNOWN' });
    const hotel = await rank('Hôtel à Brazzaville pour un court séjour', { pagination: { page: 1, limit: 50 } });
    expect(titles(hotel.rankedResults)).toEqual(['Meublé 6']);
  });

  test('contrat public IA-03B inchangé et lui aussi sans relecture par page', async () => {
    await stays(120);
    const accSpy = jest.spyOn(Accommodation, 'find');
    const out = await searchRealEstateFromText({ query: STAY, context: { scopeMode: 'PUBLIC' }, pagination: { page: 1, limit: 10 } });
    expect(out.results).toHaveLength(10);
    expect(out.coverage).toMatchObject({ evaluated: 120, sourceTotal: 120, complete: true, limit: 250 });
    for (const [filter] of accSpy.mock.calls) expect(filter.property?.$in).toBeDefined();
  });
});

describe('IA-03C3 — curseur par lots : dates identiques, annonces sans date, plan d’exécution', () => {
  test('groupes de dates identiques à cheval sur les lots : chaque annonce lue une seule fois', async () => {
    const docs = Array.from({ length: 250 }, (_, i) => doc(i + 1, { createdAt: new Date(BASE - Math.floor(i / 30) * 60000) }));
    const undated = [doc(900, { title: 'Sans date A' }), doc(901, { title: 'Sans date B' })];
    delete undated[0].createdAt; undated[1].createdAt = null;
    await insert([...docs, ...undated]);
    const out = await rank(RENT, { pagination: { page: 1, limit: 50 } }, { config: { batchSize: 25 } });
    expect(out.coverage).toMatchObject({ evaluated: 252, scanned: 252, mongoMatchedTotal: 252, complete: true });
    expect(out.total).toBe(252);
    const all = await rank(RENT, { pagination: { page: 6, limit: 50 } }, { config: { batchSize: 25 } });
    expect(titles(all.rankedResults)).toEqual(expect.arrayContaining(['Sans date A', 'Sans date B']));
  });

  test('un lot est servi par l’index existant { pole, status, createdAt } sans tri bloquant', async () => {
    await Property.syncIndexes(); // index déclarés par le schéma existant, base mémoire de test uniquement
    await insert(Array.from({ length: 3000 }, (_, i) => doc(i + 1, { status: i % 2 ? 'location' : 'vente' })));
    const { scanPropertyFilter } = require('../services/altimmoAssistant/searchSource');
    const filter = scanPropertyFilter({ offerType: 'location', propertyType: 'Maison', city: 'Brazzaville', arrondissement: 'Talangaï', maxPrice: '250000', minBedrooms: '3' }, { lodging: false });
    const plan = await Property.find({ $and: [filter, { createdAt: { $type: 'date' } }] }).sort({ createdAt: -1 }).limit(100).explain('executionStats');
    expect(JSON.stringify(plan.queryPlanner.winningPlan)).not.toMatch(/"stage":"SORT"/);
    expect(plan.executionStats.totalDocsExamined).toBeLessThanOrEqual(100);
  });
});

describe('IA-03C3 — modifications concurrentes pendant la lecture par lots', () => {
  test('ajout, suppression, dépublication, prix et statut modifiés : aucun doublon, aucun saut', async () => {
    const docs = await insert(Array.from({ length: 30 }, (_, i) => doc(i + 1)));
    const realSource = require('../services/altimmoAssistant/searchSource');
    let mutated = false;
    const scanCandidates = async (request, options) => {
      const out = await realSource.scanCandidates(request, options);
      if (!mutated) {
        mutated = true; // après le premier lot (annonces 1 à 10)
        await Property.collection.insertOne(doc(0, { title: 'Ajoutée pendant la lecture', createdAt: new Date(BASE + 3600000) }));
        await Property.collection.deleteOne({ _id: docs[19]._id });
        await Property.collection.updateOne({ _id: docs[24]._id }, { $set: { isPublished: false } });
        await Property.collection.updateOne({ _id: docs[14]._id }, { $set: { price: 999999 } });
        await Property.collection.updateOne({ _id: docs[15]._id }, { $set: { availability: 'Loué' } });
        await Property.collection.updateOne({ _id: docs[4]._id }, { $set: { isPublished: false } }); // déjà lue
      }
      return out;
    };
    const out = await rank(RENT, { pagination: { page: 1, limit: 50 } }, { searchDependencies: { scanCandidates }, config: { batchSize: 10 } });
    const seen = titles(out.rankedResults);
    expect(new Set(seen).size).toBe(seen.length);
    for (const absent of ['Ajoutée pendant la lecture', 'Maison 20', 'Maison 25', 'Maison 15', 'Maison 16']) expect(seen).not.toContain(absent);
    // Aucune annonce non modifiée n'est sautée par le décalage de pagination.
    const expected = docs.map((d) => d.title).filter((t) => !['Maison 20', 'Maison 25', 'Maison 15', 'Maison 16'].includes(t));
    expect(seen.sort()).toEqual(expected.sort());
    // Limite documentée : une annonce déjà lue puis dépubliée reste dans ce résultat.
    expect(seen).toContain('Maison 5');
    expect(out.coverage.mongoMatchedTotal).toBe(30);
  });
});
