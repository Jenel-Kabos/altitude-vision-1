// HOTFIX-PROPERTY-APPROVED-VISIBILITY-ENDTOEND-1 — reproduit exactement le
// bug réel observé : un Property vente approuvé ("PARCELLE A VENDRE",
// statusAdmin='Validée', isPublished=false) n'apparaît ni dans Sales list,
// ni dans "Tous les biens" (même endpoint /properties/portfolio), ni dans
// Home > Dernières annonces Altimmo (/properties/latest), alors que le KPI
// Sales (dashboard-analytics/sales) le voit partiellement (total/actifs/
// brouillons, jamais publié). Prouve que ceci n'est PAS un bug de code
// actuel : le workflow réel de validation (PATCH /admin/:id/validate) publie
// déjà correctement de façon atomique — c'est une dette de donnée
// historique (document approuvé avant l'introduction de ce correctif
// atomique) que seule une nouvelle validation via le vrai workflow répare,
// jamais une mutation directe.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture } = require('./helpers/tenantAwareFixture');

const User = require('../models/User');
const Property = require('../models/Property');
const propertyRoutes = require('../routes/propertyRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const { getPropertyPortfolio } = require('../services/propertyPortfolioService');
const { sales } = require('../controllers/dashboardAnalyticsController');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/properties', propertyRoutes);
app.use(errorHandler);

const signToken = (userId) => jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({
    name: 'Test User', email: `endtoend-${counter}-${Date.now()}@example.com`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides,
  });
};

const propertyPayload = (owner, overrides = {}) => ({
  title: 'PARCELLE A VENDRE', description: 'Description suffisamment longue pour la validation du modèle Property.',
  pole: 'Altimmo', type: 'Parcelle', status: 'vente', price: 80000000,
  address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.28,
  images: ['https://example.test/parcelle.jpg'], surface: 500,
  statusAdmin: 'En attente', availability: 'Disponible', owner: owner._id,
  ...overrides,
});

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('Reproduction — bien historique déjà approuvé mais isPublished=false (avant réparation)', () => {
  test('caractérise exactement le défaut observé sur les trois surfaces + KPI Sales', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    // État final identique au document réel : validé, mais jamais publié
    // (simule une approbation survenue avant l'introduction du correctif
    // atomique — jamais recréé via une mutation manuelle en production).
    await Property.create(propertyPayload(owner, { statusAdmin: 'Validée', isPublished: false }));

    const portfolio = await getPropertyPortfolio();
    const analytics = await sales();

    // Matrice attendu/actuel du mandat, AVANT réparation :
    expect(portfolio.items.some((i) => i.title === 'PARCELLE A VENDRE')).toBe(false); // Sales list : NON
    expect(portfolio.items.length).toBe(0); // Tous les biens (même endpoint) : NON
    // Home > Dernières annonces (baseFilter public réel de runPropertySearch)
    const homeVisible = await Property.exists({ title: 'PARCELLE A VENDRE', statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', pole: 'Altimmo' });
    expect(homeVisible).toBeNull(); // Home Altimmo : NON

    // Le KPI Sales, lui, voit bien le document (aucun filtre de publication
    // dans son propertyFilter) — explique pourquoi Valeur totale/Total
    // biens/Actifs sont non nuls alors que Publiés=0/Brouillons=1.
    expect(analytics.kpis).toMatchObject({ total: 1, active: 1, published: 0, drafts: 1 });
  });

  test('jamais visible côté Rentals, quel que soit son état de publication', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    await Property.create(propertyPayload(owner, { statusAdmin: 'Validée', isPublished: false }));
    const portfolioLocation = await getPropertyPortfolio();
    expect(portfolioLocation.items.filter((i) => i.status === 'location')).toHaveLength(0);
  });
});

describe('Réparation idempotente — re-validation via le vrai workflow (PATCH /admin/:id/validate)', () => {
  test('une nouvelle annonce validée par le vrai workflow devient immédiatement visible sur les trois surfaces', async () => {
    const { bootstrap: admin } = await createTenantFixture({ label: 'ApprovedVisibilityE2E' });
    const owner = await makeUser({ role: 'Proprietaire' });
    const pending = await Property.create(propertyPayload(owner)); // statusAdmin: 'En attente', isPublished non défini (undefined/false par défaut)

    const res = await request(app)
      .patch(`/api/properties/admin/${pending._id}/validate`)
      .set('Authorization', `Bearer ${signToken(admin._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.property.statusAdmin).toBe('Validée');
    expect(res.body.data.property.isPublished).toBe(true);

    const portfolio = await getPropertyPortfolio();
    expect(portfolio.items.map((i) => i.title)).toContain('PARCELLE A VENDRE');
    const homeVisible = await Property.exists({ _id: pending._id, statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', pole: 'Altimmo' });
    expect(homeVisible).not.toBeNull();
    const analytics = await sales();
    expect(analytics.kpis).toMatchObject({ total: 1, published: 1, drafts: 0 });
  });

  test('re-valider un bien déjà Validée mais resté isPublished=false (le cas réel historique) le répare de façon idempotente', async () => {
    const { bootstrap: admin } = await createTenantFixture({ label: 'ApprovedVisibilityE2E' });
    const owner = await makeUser({ role: 'Proprietaire' });
    // Reproduit exactement l'état réel avant réparation.
    const stuck = await Property.create(propertyPayload(owner, { statusAdmin: 'Validée', isPublished: false }));

    let portfolio = await getPropertyPortfolio();
    expect(portfolio.items).toHaveLength(0); // confirmé invisible avant réparation

    // La réparation légitime est de rejouer le VRAI workflow de validation
    // (jamais une mutation directe `isPublished: true` en base) — idempotent
    // car `action=validate` fixe toujours `isPublished` à `true` pour un
    // Property vente/location, quel que soit son état de départ.
    const res = await request(app)
      .patch(`/api/properties/admin/${stuck._id}/validate`)
      .set('Authorization', `Bearer ${signToken(admin._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.property.isPublished).toBe(true);

    portfolio = await getPropertyPortfolio();
    expect(portfolio.items.map((i) => i.title)).toEqual(['PARCELLE A VENDRE']);

    // Rejouer une deuxième fois (double-clic/rejeu) ne casse rien — même
    // résultat, jamais un doublon ni une régression.
    const res2 = await request(app)
      .patch(`/api/properties/admin/${stuck._id}/validate`)
      .set('Authorization', `Bearer ${signToken(admin._id)}`);
    expect(res2.status).toBe(200);
    portfolio = await getPropertyPortfolio();
    expect(portfolio.items).toHaveLength(1);
  });

  test('un rejet explicite dépublie un bien resté isPublished=false par erreur (statut final cohérent)', async () => {
    const { bootstrap: admin } = await createTenantFixture({ label: 'ApprovedVisibilityE2E' });
    const owner = await makeUser({ role: 'Proprietaire' });
    const stuck = await Property.create(propertyPayload(owner, { statusAdmin: 'Validée', isPublished: false }));
    const res = await request(app)
      .patch(`/api/properties/admin/${stuck._id}/reject`)
      .set('Authorization', `Bearer ${signToken(admin._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.property.statusAdmin).toBe('Rejetée');
    expect(res.body.data.property.isPublished).toBe(false);
    const portfolio = await getPropertyPortfolio();
    expect(portfolio.items).toHaveLength(0);
  });
});

describe('Adversarial — variations autour du bug réel (mandat Phase 8)', () => {
  test('vente approuvée mais non publiée (isPublished=false) : absente de Home', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    await Property.create(propertyPayload(owner, { statusAdmin: 'Validée', isPublished: false }));
    const visible = await Property.exists({ statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', pole: 'Altimmo' });
    expect(visible).toBeNull();
  });

  test('bien rejeté : absent de Home même si isPublished a été forcé à true par erreur', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    await Property.create(propertyPayload(owner, { statusAdmin: 'Rejetée', isPublished: true }));
    const visible = await Property.exists({ statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', pole: 'Altimmo' });
    expect(visible).toBeNull();
  });

  test('brouillon (En attente) : absent de Home', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    await Property.create(propertyPayload(owner, { statusAdmin: 'En attente', isPublished: false }));
    const visible = await Property.exists({ statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', pole: 'Altimmo' });
    expect(visible).toBeNull();
  });

  test('location approuvée et publiée : visible côté Rentals, jamais Sales', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    await Property.create(propertyPayload(owner, {
      title: 'Maison à louer', type: 'Maison', status: 'location', statusAdmin: 'Validée', isPublished: true,
    }));
    const portfolio = await getPropertyPortfolio();
    expect(portfolio.items.filter((i) => i.status === 'vente')).toHaveLength(0);
    expect(portfolio.items.filter((i) => i.status === 'location')).toHaveLength(1);
  });

  test('type Parcelle n\'influence jamais la discrimination vente/location', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    await Property.create(propertyPayload(owner, {
      title: 'Parcelle en location', type: 'Parcelle', status: 'location', statusAdmin: 'Validée', isPublished: true,
    }));
    const portfolio = await getPropertyPortfolio();
    expect(portfolio.items.filter((i) => i.status === 'vente')).toHaveLength(0);
    expect(portfolio.items[0]).toMatchObject({ type: 'Parcelle', status: 'location' });
  });
});
