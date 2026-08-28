// RBAC-ACCOMMODATION-AVAILABILITY-BLOCKS-1 (RBAC-FINAL-01) — reproduction
// rouge→verte, vrai Mongo + vrai HTTP. Avant correctif : `GET
// /:id/availability-blocks` (`listBlocks`) n'appliquait AUCUN contrôle
// RBAC/ownership — contrairement à ses trois routes sœurs sur la même
// ressource (`calendar`, `createBlock`, `deleteBlock`), qui exigent toutes
// `isStaff(user) || String(accommodation.property.owner) === String(user.id)`
// (voir HOTFIX_ACCOMMODATION_CALENDAR_TENANT_SCOPE1_RBAC_CONTRACT.md,
// contrat déjà prouvé et déjà en production). Tout utilisateur authentifié
// (Client, Proprietaire non-owner, staff sans rapport avec l'immobilier)
// pouvait lire les blocages internes (dates, motif libre, créateur) de
// N'IMPORTE QUEL hébergement de SON PROPRE TENANT en connaissant/devinant
// son ObjectId. La frontière tenant (HZ-02, `authorizedCalendarAccommodation`)
// reste intacte et n'est PAS remise en cause ici : elle continue de bloquer
// tout accès cross-tenant pour un STAFF, indépendamment de ce correctif.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const Block = require('../models/AccommodationAvailabilityBlock');
const NightLock = require('../models/AccommodationNightLock');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const routes = require('../routes/accommodationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/accommodations', routes);
app.use(errorHandler);

const bearer = (user, tenant) => (user ? {
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
} : {});

let tenantA;
let ownerA;
let ownerB; // Proprietaire non-owner de A (possède B ailleurs, sans lien avec A)
let adminA;
let staffAuthorized;   // Collaborateur, tenant A — dans la liste isStaff locale
let staffUnauthorized; // Secretaire, tenant A — staff ailleurs dans l'app, PAS dans isStaff local
let staffNoTenant;     // Collaborateur, aucune adhésion
let client;            // Client, aucun tenant, aucun lien avec l'hébergement
let operatorGlobal;
let accommodationA;
let blockA;

async function makeAccommodation(tenant, owner, suffix) {
  const property = await Property.create({
    tenant: tenant._id, title: `RBAC Villa ${suffix}`,
    description: 'Description complète destinée au test RBAC availability-blocks.',
    pole: 'Altimmo', type: 'Villa', status: 'hebergement', price: 35000,
    address: { arrondissement: 'Centre', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.28,
    images: ['https://example.test/rbac-villa.jpg'], surface: 100,
    statusAdmin: 'Validée', availability: 'Disponible', owner: owner._id,
  });
  return Accommodation.create({
    tenant: tenant._id, property: property._id, accommodationType: 'villa_meublee',
    publicationStatus: 'publie', capacity: { maxAdults: 4, maxChildren: 2 }, createdBy: owner._id,
  });
}

async function makeBlock(accommodation, creator) {
  const startDate = new Date(Date.UTC(2032, 5, 10));
  const endDate = new Date(Date.UTC(2032, 5, 12));
  const block = await Block.create({ accommodation: accommodation._id, startDate, endDate, type: 'maintenance', reason: 'SENTINEL-INTERNAL-NOTE', createdBy: creator._id });
  await NightLock.create({ accommodation: accommodation._id, date: startDate, sourceType: 'block', sourceId: block._id, operationToken: new mongoose.Types.ObjectId() });
  return block;
}

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'RBAC-FINAL-01 A' });
  tenantA = fixtureA.tenant;
  ({ user: adminA } = await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Admin' } }));
  ({ user: staffAuthorized } = await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Collaborateur' } }));
  ({ user: staffUnauthorized } = await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Secretaire' } }));
  staffNoTenant = await User.create({ name: 'RBAC Staff No Tenant', email: `rbac-staff-no-tenant-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Collaborateur', isEmailVerified: true });
  ownerA = await User.create({ name: 'RBAC Owner A', email: `rbac-owner-a-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  ownerB = await User.create({ name: 'RBAC Owner B', email: `rbac-owner-b-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  client = await User.create({ name: 'RBAC Client', email: `rbac-client-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true });
  operatorGlobal = await User.create({ name: 'RBAC Operator', email: `rbac-operator-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  await grantOperator({ userId: operatorGlobal._id, actor: adminA, reason: 'RBAC-FINAL-01 test', capabilities: [] });

  accommodationA = await makeAccommodation(tenantA, ownerA, 'A');
  blockA = await makeBlock(accommodationA, ownerA);
});
afterAll(stopFinancialMongo);

const getBlocks = (actor, tenant) => request(app).get(`/api/accommodations/${accommodationA._id}/availability-blocks`).set(bearer(actor, tenant));

describe('RBAC-FINAL-01 — GET /:id/availability-blocks — matrice d’acteurs', () => {
  test('Unauthenticated → 401 (mécanisme auth existant, inchangé)', async () => {
    const res = await getBlocks(null);
    expect(res.status).toBe(401);
  });

  test('Client authentifié sans lien avec l’hébergement → refusé (403) — RED avant correctif', async () => {
    const res = await getBlocks(client);
    expect(res.status).toBe(403);
    expect(res.body.data).toBeUndefined();
  });

  test('Proprietaire NON-owner (ownerB) sur Accommodation A → refusé (403) — RED avant correctif', async () => {
    const res = await getBlocks(ownerB);
    expect(res.status).toBe(403);
  });

  test('Proprietaire OWNER (ownerA) sur sa propre Accommodation A → autorisé (200), comportement historique préservé', async () => {
    const res = await getBlocks(ownerA);
    expect(res.status).toBe(200);
    expect(res.body.data.blocks.map((b) => String(b._id))).toEqual([String(blockA._id)]);
  });

  test('Admin Tenant A sur Accommodation A → autorisé (200), comportement historique préservé', async () => {
    const res = await getBlocks(adminA, tenantA);
    expect(res.status).toBe(200);
  });

  test('Staff autorisé (Collaborateur, isStaff local) Tenant A sur A → autorisé (200), comportement historique préservé', async () => {
    const res = await getBlocks(staffAuthorized, tenantA);
    expect(res.status).toBe(200);
  });

  test('Staff NON autorisé par rôle (Secretaire, hors isStaff local) Tenant A sur A → refusé (403) — RED avant correctif', async () => {
    const res = await getBlocks(staffUnauthorized, tenantA);
    expect(res.status).toBe(403);
  });

  test('Staff sans tenant (aucune adhésion) → 403 fail-closed — déjà correct avant ce hotfix (HZ-02, garde routeur), non affecté', async () => {
    const res = await getBlocks(staffNoTenant);
    expect(res.status).toBe(403);
  });

  test('PlatformOperator global (aucune sélection) → autorisé (200), contrat HZ-02 préservé', async () => {
    const res = await getBlocks(operatorGlobal);
    expect(res.status).toBe(200);
  });

  test('PlatformOperator scoped A → autorisé (200), contrat HZ-02 préservé', async () => {
    const res = await getBlocks(operatorGlobal, tenantA);
    expect(res.status).toBe(200);
  });
});

describe('RBAC-FINAL-01 — non-régression mutations (déjà protégées, doivent rester inchangées)', () => {
  test('CREATE toujours refusé pour un Client (comportement historique)', async () => {
    const res = await request(app).post(`/api/accommodations/${accommodationA._id}/availability-blocks`).set(bearer(client)).send({ startDate: '2033-01-10', endDate: '2033-01-12', type: 'other' });
    expect(res.status).toBe(403);
  });

  test('DELETE toujours refusé pour un Proprietaire non-owner (comportement historique)', async () => {
    const res = await request(app).delete(`/api/accommodations/${accommodationA._id}/availability-blocks/${blockA._id}`).set(bearer(ownerB));
    expect(res.status).toBe(403);
    expect(await Block.findById(blockA._id)).not.toBeNull();
  });
});
