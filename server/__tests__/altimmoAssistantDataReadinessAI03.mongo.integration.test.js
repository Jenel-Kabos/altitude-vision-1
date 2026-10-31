// ALTIMMO-AI-DATA-READINESS-01 — robustesse du moteur IA-03 face aux formes de données réelles possibles
// sur `main` (documents insérés bruts, sans cast Mongoose : valeurs par défaut, null, types hérités).
// Données fictives, MongoMemory. Objectifs : aucune réponse rejetée pour une valeur nulle, aucune
// information inventée, et une valeur ambiguë (0 chambre par défaut sur un logement) jamais traitée
// comme connue.
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');

jest.setTimeout(180000);

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use('/api/altimmo', require('../routes/altimmoSearchRoutes'));

let ipCounter = 0;
const ip = () => { ipCounter += 1; return `198.18.0.${ipCounter % 250}`; };
const search = (body) => request(app).post('/api/altimmo/assistant/search').set('X-Forwarded-For', ip()).send(body);
const compare = (body) => request(app).post('/api/altimmo/assistant/compare').set('X-Forwarded-For', ip()).send(body);
const exact = (res) => (res.body.data.rankedResults || []).map((item) => item.listing.title).sort();
const toVerify = (res) => (res.body.data.rankedCandidatesToVerify || []).map((item) => item.listing.title).sort();
const itemOf = (res, title) => [...res.body.data.rankedResults, ...res.body.data.rankedCandidatesToVerify].find((item) => item.listing.title === title);

const ids = {};
const previousFlag = process.env.ALTIMMO_ASSISTANT_ENABLED;
const BASE = Date.parse('2026-10-30T12:00:00Z');

// Document brut : seuls les champs fournis existent (comme un document ancien ou créé sans valeur).
const raw = (title, minutes, fields = {}) => ({
  title, description: 'Annonce fictive pour l’audit de préparation des données.', pole: 'Altimmo', status: 'location', type: 'Maison',
  price: 200000, surface: 100, address: { city: 'Brazzaville', arrondissement: 'Moungali' },
  statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', publicationLifecycleState: 'published',
  owner: new mongoose.Types.ObjectId(), createdAt: new Date(BASE - minutes * 60000), updatedAt: new Date(BASE), ...fields,
});

beforeAll(async () => {
  await startFinancialMongo();
  const insert = async (key, doc) => { ids[key] = (await Property.collection.insertOne(doc)).insertedId; };
  // Chambres : connue 0 / inconnue / connue 1 / connue 3, sur logement et hors logement.
  await insert('house0', raw('R Maison chambres 0 (défaut)', 1, { bedrooms: 0 }));
  await insert('houseNull', raw('R Maison chambres null', 2, { bedrooms: null }));
  await insert('houseMissing', raw('R Maison chambres absentes', 3));
  await insert('house1', raw('R Maison 1 chambre', 4, { bedrooms: 1 }));
  await insert('house3', raw('R Maison 3 chambres', 5, { bedrooms: 3 }));
  await insert('studio0', raw('R Studio 0 chambre', 6, { type: 'Studio', bedrooms: 0 }));
  await insert('land0', raw('R Terrain 0 chambre', 7, { type: 'Terrain', bedrooms: 0 }));
  // Valeurs nulles ou héritées sur des champs exposés.
  await insert('nulls', raw('R Maison champs nuls', 8, {
    bedrooms: 3, honoraires: null, fraisVisite: null, cautionMultiplicateur: null, constructionType: null, views: null,
    address: { city: 'Brazzaville', arrondissement: 'Moungali', neighborhood: null },
  }));
  await insert('priceString', raw('R Maison prix texte', 9, { bedrooms: 3, price: '180000' }));
  await insert('priceNull', raw('R Maison prix nul', 10, { bedrooms: 3, price: null }));
  // Annonces exclues : suspendue (même avec isPublished incohérent), non approuvée.
  await insert('suspended', raw('R Maison suspendue', 11, { bedrooms: 3, publicationLifecycleState: 'admin_suspended' }));
  await insert('pending', raw('R Maison non approuvée', 12, { bedrooms: 3, statusAdmin: 'En attente', isPublished: false, publicationLifecycleState: 'pending' }));
  process.env.ALTIMMO_ASSISTANT_ENABLED = 'true';
});

afterAll(async () => {
  if (previousFlag === undefined) delete process.env.ALTIMMO_ASSISTANT_ENABLED;
  else process.env.ALTIMMO_ASSISTANT_ENABLED = previousFlag;
  await stopFinancialMongo();
});

describe('DATA-READINESS-01 — valeurs nulles et types hérités', () => {
  test('une valeur nulle ou mal typée ne fait jamais rejeter la réponse ; elle devient « non renseignée »', async () => {
    const res = await search({ query: 'Maison à louer à Moungali Brazzaville' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('success');
    const nulls = itemOf(res, 'R Maison champs nuls').listing;
    for (const field of ['honoraires', 'fraisVisite', 'cautionMultiplicateur', 'constructionType', 'views']) expect(nulls[field] ?? null).toBeNull();
    expect(nulls.address.neighborhood ?? null).toBeNull();
    expect(itemOf(res, 'R Maison prix nul').listing.price).toBeUndefined();
    expect(itemOf(res, 'R Maison prix texte').listing.price).toBeUndefined(); // jamais converti ni affiché
  });

  test('budget : un prix absent ou non numérique n’est jamais compté comme conforme', async () => {
    const res = await search({ query: 'Maison à louer à Moungali Brazzaville budget maximum 250000 FCFA' });
    expect(res.status).toBe(200);
    expect(exact(res)).not.toEqual(expect.arrayContaining(['R Maison prix nul']));
    expect(exact(res)).not.toContain('R Maison prix texte');
    expect(toVerify(res)).toEqual(expect.arrayContaining(['R Maison prix nul', 'R Maison prix texte']));
    for (const title of ['R Maison prix nul', 'R Maison prix texte']) {
      expect(itemOf(res, title).unknownCriteria).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'budget.max', state: 'UNKNOWN' })]));
    }
  });
});

describe('DATA-READINESS-01 — chambres : connue, inconnue, zéro ambigu', () => {
  test('« au moins 3 chambres » : 3 confirmé ; 1 exclu ; 0 par défaut, null ou absent sur un logement → à vérifier', async () => {
    const res = await search({ query: 'Maison à louer à Moungali Brazzaville avec au moins 3 chambres' });
    expect(res.status).toBe(200);
    expect(res.body.data.interpretedCriteria.bedrooms.min).toBe(3);
    expect(exact(res)).toEqual(expect.arrayContaining(['R Maison 3 chambres', 'R Maison champs nuls']));
    expect(exact(res)).not.toEqual(expect.arrayContaining(['R Maison 1 chambre']));
    expect(toVerify(res)).not.toContain('R Maison 1 chambre');
    expect(toVerify(res)).toEqual(expect.arrayContaining(['R Maison chambres 0 (défaut)', 'R Maison chambres null', 'R Maison chambres absentes']));
    for (const title of ['R Maison chambres 0 (défaut)', 'R Maison chambres null', 'R Maison chambres absentes']) {
      expect(itemOf(res, title).unknownCriteria).toEqual(expect.arrayContaining([{ field: 'bedrooms.min', state: 'UNKNOWN' }]));
    }
  });

  test('0 reste une valeur connue pour un studio ou un terrain', async () => {
    const studio = await search({ query: 'Studio à louer à Moungali Brazzaville avec 1 chambre' });
    expect([...exact(studio), ...toVerify(studio)]).not.toContain('R Studio 0 chambre');
    const land = await search({ query: 'Terrain à louer à Moungali Brazzaville avec 2 chambres' });
    expect([...exact(land), ...toVerify(land)]).not.toContain('R Terrain 0 chambre');
  });

  test('comparaison : un 0 ambigu n’est jamais affiché comme « 0 chambre »', async () => {
    const res = await compare({ propertyIds: [String(ids.house0), String(ids.house3)] });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('success');
    const row = res.body.data.grid.rows.find((item) => item.key === 'bedrooms');
    const position = res.body.data.items.findIndex((item) => item.id === String(ids.house0));
    expect(row.values[position].state).not.toBe('KNOWN');
    expect(JSON.stringify(res.body.data.items[position])).not.toMatch(/0 chambre/);
  });
});

describe('DATA-READINESS-01 — portes de publication sur documents bruts', () => {
  test('annonce suspendue (isPublished incohérent) et non approuvée : jamais proposées', async () => {
    const res = await search({ query: 'Maison à louer à Moungali Brazzaville' });
    const all = [...exact(res), ...toVerify(res)];
    expect(all).not.toContain('R Maison suspendue');
    expect(all).not.toContain('R Maison non approuvée');
    const selected = await compare({ propertyIds: [String(ids.house1), String(ids.house3), String(ids.suspended), String(ids.pending)] });
    expect((selected.body.data.items || []).map((item) => item.listing.title).sort()).toEqual(['R Maison 1 chambre', 'R Maison 3 chambres']);
    expect(selected.body.data.unavailable).toHaveLength(2);
  });
});
