// GL-ASSET-1 — Couche HTTP/RBAC du cycle de vie patrimonial du bien +
// domaine de dossier 'bien' (Phase 5/8). Même convention que
// rentalLeaseLifecycleRoutes.mongo.integration.test.js /
// dossierRoutes.mongo.integration.test.js.
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Proprietaire = require('../models/Proprietaire');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');
const RentalManagement = require('../models/RentalManagement');
const Paiement = require('../models/Paiement');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const propertyAssetRoutes = require('../routes/propertyAssetRoutes');
const dossierRoutes = require('../routes/dossierRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();

const app = express();
app.use(express.json());
app.use('/api/property-asset', propertyAssetRoutes);
app.use('/api/dossiers', dossierRoutes);
app.use(errorHandler);

const signToken = (userId, tokenVersion = 0) => jwt.sign({ id: userId, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Test User', email: `propasset${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

async function buildManagedProperty(overrides = {}) {
  const owner = await makeUser({ role: 'Proprietaire' });
  const property = await Property.create({
    title: 'Villa GL-ASSET-1', description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Disponible', owner: owner._id,
    ...overrides,
  });
  return { owner, property };
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('401 sans authentification', async () => {
  const { property } = await buildManagedProperty();
  const res = await request(app).get(`/api/property-asset/${property._id}/lifecycle`);
  expect(res.status).toBe(401);
});

test('un tiers (ni staff ni propriétaire) est refusé (403) sur la lecture', async () => {
  const { property } = await buildManagedProperty();
  const stranger = await makeUser({ role: 'Client' });
  const res = await request(app).get(`/api/property-asset/${property._id}/history`).set('Authorization', `Bearer ${signToken(stranger._id)}`);
  expect(res.status).toBe(403);
});

test('le propriétaire du bien peut lire son historique/valorisation/alertes', async () => {
  const { owner, property } = await buildManagedProperty();
  const res = await request(app).get(`/api/property-asset/${property._id}/history`).set('Authorization', `Bearer ${signToken(owner._id)}`);
  expect(res.status).toBe(200);
  expect(res.body.data.history).toHaveProperty('contrats');
});

test('GET /lifecycle renvoie l\'étape dérivée et les transitions légales', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const { property } = await buildManagedProperty({ availability: 'Disponible' });
  const res = await request(app).get(`/api/property-asset/${property._id}/lifecycle`).set('Authorization', `Bearer ${signToken(admin._id)}`);
  expect(res.status).toBe(200);
  expect(res.body.data.assetCycle).toBe('disponible');
  expect(res.body.data.allowed).toEqual(expect.arrayContaining(['reserve', 'en_location', 'vendu']));
});

test('POST /transition applique une transition légale et synchronise availability', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const { property } = await buildManagedProperty({ availability: 'Disponible' });
  const res = await request(app).post(`/api/property-asset/${property._id}/transition`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ target: 'travaux' });
  expect(res.status).toBe(200);
  expect(res.body.data.property.assetCycle).toBe('travaux');
  expect(res.body.data.property.availability).toBe('En maintenance');
});

test('POST /transition rejette une transition illégale (409)', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const { property } = await buildManagedProperty({ availability: 'Disponible' });
  // 'disponible' → 'inspection' n'est pas une transition légale (l'inspection
  // ne suit qu'un préavis) — contrairement à 'archive', directement
  // atteignable depuis 'disponible' (bien retiré sans vente).
  const res = await request(app).post(`/api/property-asset/${property._id}/transition`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ target: 'inspection' });
  expect(res.status).toBe(409);
});

test('POST /transition est refusé pour un rôle hors STAFF_IMMO', async () => {
  const secretaire = await makeUser({ role: 'Secretaire' });
  const { property } = await buildManagedProperty();
  const res = await request(app).post(`/api/property-asset/${property._id}/transition`).set('Authorization', `Bearer ${signToken(secretaire._id)}`).send({ target: 'reserve' });
  expect(res.status).toBe(403);
});

describe('historique / carnet d\'entretien / valorisation / alertes — agrégation réelle', () => {
  async function seedFullHistory() {
    const { owner, property } = await buildManagedProperty({ availability: 'Loué' });
    const proprietaire = await Proprietaire.create({ nom: 'Nkounkou', prenom: 'Alice', telephone: '+242060000010' });
    const locataire = await Locataire.create({ nom: 'Moke', prenom: 'Paul', telephone: '+242060000011' });
    const contrat = await Contrat.create({
      type: 'location', bien: property._id, proprietaire: proprietaire._id, locataire: locataire._id, statut: 'actif',
      dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000,
    });
    await RentalManagement.create({ property: property._id, owner: owner._id, managementActivated: true, occupancyStatus: 'occupe', activeLease: contrat._id });
    await Paiement.create({ contrat: contrat._id, mois: 1, annee: new Date().getFullYear(), montant: 300000, montantRecu: 300000, statut: 'payé' });
    await RentalMaintenanceTicket.create({ property: property._id, lease: contrat._id, category: 'plomberie', description: 'Fuite évier', actualCost: 50000, entrepriseIntervenante: 'Plomberie Congo', status: 'resolu' });
    return { owner, property, contrat };
  }

  test('GET /history agrège contrats/paiements/maintenances sans duplication', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const { property } = await seedFullHistory();
    const res = await request(app).get(`/api/property-asset/${property._id}/history`).set('Authorization', `Bearer ${signToken(admin._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.history.contrats).toHaveLength(1);
    expect(res.body.data.history.paiements).toHaveLength(1);
    expect(res.body.data.history.maintenances).toHaveLength(1);
    expect(res.body.data.history.proprietaires).toHaveLength(1);
    expect(res.body.data.history.locataires).toHaveLength(1);
  });

  test('GET /maintenance-logbook calcule le coût total et liste les entreprises', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const { property } = await seedFullHistory();
    const res = await request(app).get(`/api/property-asset/${property._id}/maintenance-logbook`).set('Authorization', `Bearer ${signToken(admin._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.logbook.coutTotal).toBe(50000);
    expect(res.body.data.logbook.entreprises).toEqual(['Plomberie Congo']);
  });

  test('GET /valuation calcule les revenus et ne stocke jamais de champ "valeur estimée" inventé', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const { property } = await seedFullHistory();
    const res = await request(app).get(`/api/property-asset/${property._id}/valuation`).set('Authorization', `Bearer ${signToken(admin._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.valuation.revenusGeneres).toBe(300000);
    expect(res.body.data.valuation.valeurEstimee).toBeNull();
    expect(res.body.data.valuation.valeurReference).toBe(300000);
  });

  test('GET /alerts signale honnêtement l\'absence de suivi assurance plutôt que d\'inventer une donnée', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const { property } = await seedFullHistory();
    const res = await request(app).get(`/api/property-asset/${property._id}/alerts`).set('Authorization', `Bearer ${signToken(admin._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.alerts.checks.map((c) => c.key)).toContain('assurance_non_suivie');
  });

  test('le domaine de dossier "bien" (Phase 5/8) agrège la même donnée sans duplication', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const { property } = await seedFullHistory();
    const res = await request(app).get(`/api/dossiers/bien/${property._id}`).set('Authorization', `Bearer ${signToken(admin._id)}`);
    expect(res.status).toBe(200);
    const { dossier } = res.body.data;
    expect(dossier.domain).toBe('bien');
    expect(dossier.sections.find((s) => s.key === 'contrats').items).toHaveLength(1);
    expect(dossier.sections.find((s) => s.key === 'maintenance').items).toHaveLength(1);
    expect(dossier.summary.fields.revenusGeneres).toBe(300000);
  });
});

test('une transition locative (bail activé) fait avancer le cycle de vie patrimonial en best-effort', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const { owner, property } = await buildManagedProperty({ availability: 'Disponible' });
  const rental = await RentalManagement.create({ property: property._id, owner: owner._id, managementActivated: true, occupancyStatus: 'vacant' });
  const sync = require('../services/rentalListingSyncService');
  await sync.markPropertyRented(rental._id, { leaseId: id(), tenantId: id(), actor: admin._id });
  const fresh = await Property.findById(property._id);
  expect(fresh.assetCycle).toBe('en_location');
});

// GL-ASSET-UX-1 — Phase 8 : tableau de bord portefeuille.
describe('GET /portfolio/dashboard — agrégation portefeuille (Phase 8)', () => {
  test('le staff voit tout le patrimoine (plusieurs propriétaires confondus)', async () => {
    const admin = await makeUser({ role: 'Admin' });
    await buildManagedProperty({ price: 300000 });
    await buildManagedProperty({ price: 500000 });
    const res = await request(app).get('/api/property-asset/portfolio/dashboard').set('Authorization', `Bearer ${signToken(admin._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.dashboard.totalBiens).toBeGreaterThanOrEqual(2);
    expect(res.body.data.dashboard.valeurTotale).toBeGreaterThanOrEqual(800000);
  });

  test('un propriétaire ne voit que ses propres biens', async () => {
    const { owner, property } = await buildManagedProperty({ price: 300000 });
    await buildManagedProperty({ price: 999999 }); // un autre propriétaire, ne doit jamais apparaître
    const res = await request(app).get('/api/property-asset/portfolio/dashboard').set('Authorization', `Bearer ${signToken(owner._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.dashboard.totalBiens).toBe(1);
    expect(res.body.data.dashboard.valeurTotale).toBe(300000);
    void property;
  });

  test('401 sans authentification', async () => {
    const res = await request(app).get('/api/property-asset/portfolio/dashboard');
    expect(res.status).toBe(401);
  });
});

// GL-ASSET-UX-1 — Phase 9 : la notification de transition de cycle de vie
// (type partagé 'contrat_updated') doit porter un lien explicite vers la
// fiche du bien, jamais hériter du lien générique du bail — aucune
// notification orpheline.
test('la transition de cycle de vie du bien notifie le staff avec un lien vers sa propre fiche', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const { property } = await buildManagedProperty({ availability: 'Disponible' });
  await request(app).post(`/api/property-asset/${property._id}/transition`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ target: 'travaux' });

  const Notification = require('../models/Notification');
  let notif = null;
  for (let attempt = 0; attempt < 20 && !notif; attempt += 1) {
    notif = await Notification.findOne({ type: 'contrat_updated', entityType: 'Property', entityId: property._id });
    if (!notif) await new Promise((resolve) => setTimeout(resolve, 25));
  }
  expect(notif).toBeTruthy();
  expect(notif.link).toBe(`/dashboard/properties/${property._id}`);
});
