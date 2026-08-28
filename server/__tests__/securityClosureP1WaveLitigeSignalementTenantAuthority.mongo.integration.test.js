// SECURITY-CLOSURE-P1-WAVE-1 (P1-C, finding RA-07) — reproduction rouge->verte
// PERMANENTE : `litigeController.*`/`signalementController.*` n'appliquaient
// aucune frontière tenant, même sur les accès unitaires (`getLitige`,
// `downloadProof`). Correctif : dérivation via `bienConcerné`/`property`
// (Property) -> owner -> OrgMembership, réutilisant
// `tenantResourceAttributionService` (resourceType 'Litige'/'Signalement',
// déjà supportés nativement).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Litige = require('../models/Litige');
const Signalement = require('../models/Signalement');
const litigeRoutes = require('../routes/litigeRoutes');
const signalementRoutes = require('../routes/signalementRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/litiges', litigeRoutes);
app.use('/api/signalements', signalementRoutes);
app.use(errorHandler);

const signToken = (id) => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const bearer = (user, tenantId) => ({
  Authorization: `Bearer ${signToken(user._id)}`,
  ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}),
});

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

let seq = 0;
async function buildTenantFixture(label) {
  seq += 1;
  const admin = await User.create({ name: `Admin ${label}`, email: `p1c-admin-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  const owner = await User.create({ name: `Owner ${label}`, email: `p1c-owner-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  const plaignant = await User.create({ name: `Plaignant ${label}`, email: `p1c-plaignant-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true });
  const tenant = await platformTenantService.createTenant({ name: `P1C-${label}-${seq}-${Date.now()}`, actor: admin });
  await Promise.all([
    organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: owner._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
  ]);
  const property = await Property.create({
    title: `Villa P1C ${label}`, description: 'Description suffisamment longue pour la validation du modele Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Disponible', owner: owner._id,
  });
  const litige = await Litige.create({ type: 'Autre', description: 'Description du litige suffisamment longue.', bienConcerné: property._id, plaignant: { userId: plaignant._id, type: 'Client' } });
  const signalement = await Signalement.create({ property: property._id, signalePar: plaignant._id, raison: 'autre' });
  return { admin, tenant, property, litige, signalement };
}

describe('SECURITY-CLOSURE-P1-WAVE-1 (P1-C) — Litige', () => {
  test('1. Admin A ne voit QUE les litiges du tenant A (liste)', async () => {
    const a = await buildTenantFixture('A');
    const b = await buildTenantFixture('B');
    const res = await request(app).get('/api/litiges').set(bearer(a.admin, a.tenant._id));
    expect(res.status).toBe(200);
    const ids = res.body.data.litiges.map((l) => l._id);
    expect(ids).toContain(String(a.litige._id));
    expect(ids).not.toContain(String(b.litige._id));
  });

  test('2. GET /api/litiges/:id : Admin A refusé sur le litige du tenant B', async () => {
    const a = await buildTenantFixture('C');
    const b = await buildTenantFixture('D');
    const res = await request(app).get(`/api/litiges/${b.litige._id}`).set(bearer(a.admin, a.tenant._id));
    expect(res.status).not.toBe(200);
  });

  test('3. PUT /:id/statut : Admin A ne peut PAS modifier le litige du tenant B', async () => {
    const a = await buildTenantFixture('E');
    const b = await buildTenantFixture('F');
    const res = await request(app).put(`/api/litiges/${b.litige._id}/statut`).set(bearer(a.admin, a.tenant._id)).send({ statut: 'Résolu' });
    expect(res.status).not.toBe(200);
    const fresh = await Litige.findById(b.litige._id);
    expect(fresh.statut).not.toBe('Résolu');
  });

  test('4. Admin A PEUT consulter/modifier le litige de son propre tenant', async () => {
    const a = await buildTenantFixture('G');
    const get = await request(app).get(`/api/litiges/${a.litige._id}`).set(bearer(a.admin, a.tenant._id));
    expect(get.status).toBe(200);
    const put = await request(app).put(`/api/litiges/${a.litige._id}/statut`).set(bearer(a.admin, a.tenant._id)).send({ statut: 'Résolu' });
    expect(put.status).toBe(200);
  });

  test('5. Staff multi-tenant sans en-tête → fail-closed', async () => {
    const a = await buildTenantFixture('H');
    const b = await buildTenantFixture('I');
    const staffMulti = await User.create({ name: 'Staff Multi', email: `p1c-multi-lit-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: a.tenant.rootOrgUnit, actor: a.admin });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: b.tenant.rootOrgUnit, actor: b.admin });
    const res = await request(app).get('/api/litiges').set(bearer(staffMulti));
    expect(res.status).toBe(403);
  });
});

describe('SECURITY-CLOSURE-P1-WAVE-1 (P1-C) — Signalement', () => {
  test('6. Admin A ne voit QUE les signalements du tenant A', async () => {
    const a = await buildTenantFixture('J');
    const b = await buildTenantFixture('K');
    const res = await request(app).get('/api/signalements').set(bearer(a.admin, a.tenant._id));
    expect(res.status).toBe(200);
    const ids = res.body.data.map((s) => String(s._id));
    expect(ids).toContain(String(a.signalement._id));
    expect(ids).not.toContain(String(b.signalement._id));
  });

  test('7. PATCH /:id/traiter : Admin A ne peut PAS traiter le signalement du tenant B', async () => {
    const a = await buildTenantFixture('L');
    const b = await buildTenantFixture('M');
    const res = await request(app).patch(`/api/signalements/${b.signalement._id}/traiter`).set(bearer(a.admin, a.tenant._id)).send({ statut: 'traite' });
    expect(res.status).not.toBe(200);
    const fresh = await Signalement.findById(b.signalement._id);
    expect(fresh.statut).not.toBe('traite');
  });

  test('8. Staff multi-tenant sans en-tête → fail-closed (Signalement)', async () => {
    const a = await buildTenantFixture('N');
    const b = await buildTenantFixture('O');
    const staffMulti = await User.create({ name: 'Staff Multi', email: `p1c-multi-sig-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: a.tenant.rootOrgUnit, actor: a.admin });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: b.tenant.rootOrgUnit, actor: b.admin });
    const res = await request(app).get('/api/signalements').set(bearer(staffMulti));
    expect(res.status).toBe(403);
  });
});
