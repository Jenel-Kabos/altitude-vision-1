// GL-LIFE-1 — Couche HTTP/RBAC du cycle de vie du bail.
// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-I-TENANT-CONTEXT-A —
// migré vers l'autorité tenant canonique : la route exige désormais
// `requireTenantScope + requireTenantModule('location') +
// requireTenantMembershipRole('Admin','GestionnaireImmobilier',
// 'Collaborateur')`. Les fixtures créent un tenant réel, une OrgMembership
// active avec `businessRole` canonique, et envoient
// `X-Platform-Tenant-Id`. Aucun test ne s'appuie sur `User.role` global
// comme autorité tenant.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const OrgMembership = require('../models/OrgMembership');
const User = require('../models/User');
const Property = require('../models/Property');
const Proprietaire = require('../models/Proprietaire');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');
const RentalManagement = require('../models/RentalManagement');
const rentalLeaseLifecycleRoutes = require('../routes/rentalLeaseLifecycleRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/rental-lease-lifecycle', rentalLeaseLifecycleRoutes);
app.use(errorHandler);

const signToken = (userId, tokenVersion = 0) => jwt.sign({ id: userId, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });
const bearer = (user, tenant) => ({
  Authorization: `Bearer ${signToken(user._id)}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Test User', email: `gllifer${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

async function buildStaffContext({ businessRole = 'Admin', userRole = 'Admin' } = {}) {
  const fixture = await createTenantFixture({ label: `LifecycleRoutes ${counter++}`, withAdminMembership: true });
  const staff = await makeUser({ role: userRole });
  await addTenantMember({ tenant: fixture.tenant, user: staff, bootstrap: fixture.bootstrap, businessRole });
  return { tenant: fixture.tenant, staff };
}

async function buildActiveLease({ tenant } = {}) {
  const owner = await makeUser({ role: 'Proprietaire' });
  const property = await Property.create({
    title: 'Villa Route GL-LIFE-1', description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Loué', owner: owner._id, tenant: tenant?._id || null,
  });
  const proprietaire = await Proprietaire.create({ nom: 'Nkounkou', prenom: 'Alice', telephone: '+242060000010' });
  const locataire = await Locataire.create({ nom: 'Moke', prenom: 'Paul', telephone: '+242060000011' });
  const contrat = await Contrat.create({
    type: 'location', bien: property._id, proprietaire: proprietaire._id, locataire: locataire._id, statut: 'actif', cycleVie: 'actif',
    dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000, montantCaution: 600000,
  });
  await RentalManagement.create({ property: property._id, owner: owner._id, tenant: tenant?._id || null, managementActivated: true, occupancyStatus: 'occupe', activeLease: contrat._id });
  return { owner, property, proprietaire, locataire, contrat };
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('401 sans authentification', async () => {
  const res = await request(app).get('/api/rental-lease-lifecycle/dashboard');
  expect(res.status).toBe(401);
});

test('403 pour un membre tenant sans businessRole staff GL (ex: Secretaire ne fait pas partie de GL_MANAGE)', async () => {
  const { tenant, staff } = await buildStaffContext({ userRole: 'Secretaire', businessRole: 'Secretaire' });
  const res = await request(app).get('/api/rental-lease-lifecycle/dashboard').set(bearer(staff, tenant));
  expect(res.status).toBe(403);
});

test('GET /dashboard renvoie la forme attendue pour un Tenant Admin canonique', async () => {
  const { tenant, staff } = await buildStaffContext({ businessRole: 'Admin' });
  const res = await request(app).get('/api/rental-lease-lifecycle/dashboard').set(bearer(staff, tenant));
  expect(res.status).toBe(200);
  expect(res.body.data.dashboard).toHaveProperty('bauxAEcheance');
  expect(res.body.data.dashboard).toHaveProperty('cautionsARestituer');
  expect(res.body.data.dashboard).toHaveProperty('dossiersBloques');
});

test('POST /:id/transition applique une transition légale', async () => {
  const { tenant, staff } = await buildStaffContext();
  const { contrat } = await buildActiveLease({ tenant });
  const res = await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/transition`).set(bearer(staff, tenant)).send({ target: 'preavis' });
  expect(res.status).toBe(200);
  expect(res.body.data.contrat.cycleVie).toBe('preavis');
});

test('POST /:id/transition rejette une transition illégale (409)', async () => {
  const { tenant, staff } = await buildStaffContext();
  const { contrat } = await buildActiveLease({ tenant });
  const res = await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/transition`).set(bearer(staff, tenant)).send({ target: 'archive' });
  expect(res.status).toBe(409);
});

test('GET /:id/available-transitions renvoie les cibles légales depuis l\'étape actuelle', async () => {
  const { tenant, staff } = await buildStaffContext();
  const { contrat } = await buildActiveLease({ tenant });
  const res = await request(app).get(`/api/rental-lease-lifecycle/${contrat._id}/available-transitions`).set(bearer(staff, tenant));
  expect(res.status).toBe(200);
  expect(res.body.data.cycleVie).toBe('actif');
  expect(res.body.data.allowed).toEqual(expect.arrayContaining(['preavis', 'resilie']));
});

test('POST /:id/renew/preview ne persiste rien et renvoie le mode + le diff', async () => {
  const { tenant, staff } = await buildStaffContext();
  const { contrat } = await buildActiveLease({ tenant });
  const res = await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/renew/preview`).set(bearer(staff, tenant)).send({ dateFinBail: '2028-12-31', montantLoyer: 330000 });
  expect(res.status).toBe(200);
  expect(res.body.data.preview.mode).toBe('prolongation');
  expect(res.body.data.preview.champsModifies.map((c) => c.champ)).toEqual(expect.arrayContaining(['dateFinBail', 'montantLoyer']));

  const fresh = await Contrat.findById(contrat._id);
  expect(fresh.avenants).toHaveLength(0);
  expect(fresh.montantLoyer).toBe(300000);
});

test('POST /:id/renew/preview détecte un changement majeur (nouveau locataire) sans rien persister', async () => {
  const { tenant, staff } = await buildStaffContext();
  const { contrat } = await buildActiveLease({ tenant });
  const autreLocataire = await Locataire.create({ nom: 'Loemba', prenom: 'Marie', telephone: '+242060000097' });
  const res = await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/renew/preview`).set(bearer(staff, tenant)).send({ locataire: String(autreLocataire._id) });
  expect(res.status).toBe(200);
  expect(res.body.data.preview.mode).toBe('nouveau_contrat');

  const fresh = await Contrat.findById(contrat._id);
  expect(String(fresh.locataire)).toBe(String(contrat.locataire));
  expect(fresh.renouvelePar).toBeNull();
  const totalContrats = await Contrat.countDocuments({ bien: contrat.bien });
  expect(totalContrats).toBe(1);
});

test('POST /:id/avenants crée un avenant', async () => {
  const { tenant, staff } = await buildStaffContext();
  const { contrat } = await buildActiveLease({ tenant });
  const res = await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/avenants`).set(bearer(staff, tenant)).send({ type: 'loyer', changes: { montantLoyer: 350000 } });
  expect(res.status).toBe(201);
  expect(res.body.data.contrat.montantLoyer).toBe(350000);
});

test('POST /:id/renew (prolongation) renvoie mode=prolongation', async () => {
  const { tenant, staff } = await buildStaffContext();
  const { contrat } = await buildActiveLease({ tenant });
  const res = await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/renew`).set(bearer(staff, tenant)).send({ dateFinBail: '2028-12-31' });
  expect(res.status).toBe(200);
  expect(res.body.data.mode).toBe('prolongation');
});

test('POST /:id/caution/encaisser puis /bloquer puis /restituer', async () => {
  const { tenant, staff } = await buildStaffContext();
  const { contrat } = await buildActiveLease({ tenant });
  await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/caution/encaisser`).set(bearer(staff, tenant)).send({});
  const blocRes = await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/caution/bloquer`).set(bearer(staff, tenant)).send({});
  expect(blocRes.status).toBe(200);
  expect(blocRes.body.data.contrat.caution.statut).toBe('bloquee');

  await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/transition`).set(bearer(staff, tenant)).send({ target: 'preavis' });
  await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/transition`).set(bearer(staff, tenant)).send({ target: 'inspection_sortie' });

  const restRes = await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/caution/restituer`).set(bearer(staff, tenant)).send({ montant: 600000 });
  expect(restRes.status).toBe(200);
  expect(restRes.body.data.contrat.caution.statut).toBe('restituee');
  expect(restRes.body.data.contrat.cycleVie).toBe('resilie');
});

void OrgMembership; // référencé indirectement via addTenantMember
