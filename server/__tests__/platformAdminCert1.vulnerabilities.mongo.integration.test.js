// PLATFORM-ADMIN-CERT-1 — régression permanente des 4 vulnérabilités
// démontrées et corrigées par ce sprint (voir PLATFORM_ADMIN_CERT_1_AUDIT.md
// §"Vulnérabilités démontrées"). Convention identique aux suites
// adversariales précédentes (tenantCert3Pre, platformAdmin1).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Locataire = require('../models/Locataire');
const Proprietaire = require('../models/Proprietaire');
const Contrat = require('../models/Contrat');
const Property = require('../models/Property');
const Reconciliation = require('../models/RentalContractReconciliation');

let seq = 0;
async function makeAttributedProperty(owner) {
  seq += 1;
  return Property.create({
    title: `Cert1Vuln Property ${seq}`, description: 'Description suffisamment longue pour une fixture PLATFORM-ADMIN-CERT-1.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.2, longitude: 15.2,
    images: ['https://placehold.co/1200x800/png'], surface: 70, statusAdmin: 'Validée', isPublished: true,
    availability: 'Disponible', owner: owner._id,
  });
}
const { grantOperator } = require('../services/platformOperator/platformOperatorService');

const userRoutes = require('../routes/userRoutes');
const locataireRoutes = require('../routes/locataireRoutes');
const proprietaireRoutes = require('../routes/proprietaireRoutes');
const rentalContractRegularizationRoutes = require('../routes/rentalContractRegularizationRoutes');
const gestionDocumentRoutes = require('../routes/gestionDocumentRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);
app.use('/api/locataires', locataireRoutes);
app.use('/api/proprietaires', proprietaireRoutes);
app.use('/api/rental-contract-regularization', rentalContractRegularizationRoutes);
app.use('/api/documents-gestion', gestionDocumentRoutes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let tenantA;
let tenantB;
let adminA;
let adminB;
let staffB;
let operatorUser;
let grantingAdmin;

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'Cert1 Vuln A' });
  const fixtureB = await createTenantFixture({ label: 'Cert1 Vuln B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  adminA = (await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Admin' } })).user;
  adminB = (await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } })).user;
  staffB = (await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Collaborateur' } })).user;
  grantingAdmin = await User.create({
    name: 'GrantingAdmin V', email: `granting-v-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
  });
  operatorUser = await User.create({
    name: 'Operator V', email: `operator-v-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
  });
  await grantOperator({
    userId: operatorUser._id, actor: grantingAdmin, reason: 'Test V1-V4',
    capabilities: ['platform.users.read', 'platform.users.manage', 'platform.rentals.read', 'platform.rentals.manage'],
  });
});

afterAll(async () => stopFinancialMongo());

describe('V1 — User CRUD (userRoutes.js)', () => {
  test('RÉGRESSION : AdminA ne peut plus lire un utilisateur de Tenant B par ObjectId', async () => {
    const res = await request(app).get(`/api/users/${staffB._id}`).set(bearer(adminA));
    expect(res.status).toBe(404);
  });

  test('RÉGRESSION : AdminA ne peut plus suspendre un utilisateur de Tenant B', async () => {
    const res = await request(app).patch(`/api/users/${staffB._id}/suspend`).set(bearer(adminA));
    expect(res.status).toBe(404);
    const check = await User.findById(staffB._id).select('status');
    expect(check.status).not.toBe('Suspendu');
  });

  test('RÉGRESSION : AdminA ne peut plus changer le rôle d\'un utilisateur de Tenant B', async () => {
    const res = await request(app).patch(`/api/users/${staffB._id}/role`).set(bearer(adminA)).send({ role: 'Admin' });
    expect(res.status).toBe(404);
    const check = await User.findById(staffB._id).select('role');
    expect(check.role).toBe('Collaborateur');
  });

  test('RÉGRESSION : liste globale AdminA ne contient jamais staffB (Tenant B)', async () => {
    const res = await request(app).get('/api/users').set(bearer(adminA));
    expect(res.status).toBe(200);
    const ids = res.body.data.users.map((u) => String(u._id));
    expect(ids).not.toContain(String(staffB._id));
  });

  test('POSITIF : AdminB peut lire/suspendre/réactiver un utilisateur de son propre tenant', async () => {
    const read = await request(app).get(`/api/users/${staffB._id}`).set(bearer(adminB));
    expect(read.status).toBe(200);
    const suspend = await request(app).patch(`/api/users/${staffB._id}/suspend`).set(bearer(adminB));
    expect(suspend.status).toBe(200);
    const activate = await request(app).patch(`/api/users/${staffB._id}/activate`).set(bearer(adminB));
    expect(activate.status).toBe(200);
  });

  test('POSITIF : PlatformOperator avec Tenant B sélectionné peut lister/lire staffB', async () => {
    const list = await request(app).get('/api/users').set(bearer(operatorUser, tenantB));
    expect(list.status).toBe(200);
    expect(list.body.data.users.map((u) => String(u._id))).toContain(String(staffB._id));
    const read = await request(app).get(`/api/users/${staffB._id}`).set(bearer(operatorUser, tenantB));
    expect(read.status).toBe(200);
  });

  test('POSITIF : PlatformOperator avec Tenant A sélectionné ne voit PAS staffB (Tenant B)', async () => {
    const read = await request(app).get(`/api/users/${staffB._id}`).set(bearer(operatorUser, tenantA));
    expect(read.status).toBe(404);
  });
});

describe('V2 — Locataire/Proprietaire CRUD', () => {
  let locataireB;
  let proprietaireB;

  beforeAll(async () => {
    // Locataire/Proprietaire ne portent pas de champ `tenant` direct — leur
    // tenant se résout via un Contrat réellement attribué (bien → Property →
    // owner), voir tenantResourceAttributionService.js. Un Locataire/
    // Proprietaire sans aucun Contrat attribué reste authentiquement non
    // attribuable (accessible à tous, comportement voulu et inchangé) — pas
    // un cas utile pour démontrer V2.
    const property = await makeAttributedProperty(staffB);
    locataireB = await Locataire.create({
      nom: 'Nom B', prenom: 'Prenom B', email: `locataire-b-${Date.now()}@example.test`, telephone: '+242060000000',
    });
    proprietaireB = await Proprietaire.create({
      nom: 'Prop B', prenom: 'Prenom B', email: `proprietaire-b-${Date.now()}@example.test`,
      telephone: '+242060000001', user: staffB._id,
    });
    await Contrat.create({
      type: 'location', statut: 'actif', bien: property._id, locataire: locataireB._id, proprietaire: proprietaireB._id,
      montantLoyer: 100000, villeBien: 'Brazzaville', adresseBien: 'Adresse test',
    });
  });

  test('RÉGRESSION : AdminA ne peut plus lire le Locataire de Tenant B par ObjectId', async () => {
    const res = await request(app).get(`/api/locataires/${locataireB._id}`).set(bearer(adminA));
    expect([403, 404]).toContain(res.status);
  });

  test('RÉGRESSION : AdminA ne peut plus lire le Proprietaire de Tenant B par ObjectId', async () => {
    const res = await request(app).get(`/api/proprietaires/${proprietaireB._id}`).set(bearer(adminA));
    expect([403, 404]).toContain(res.status);
  });

  test('POSITIF : AdminB peut lire son propre Locataire/Proprietaire', async () => {
    const l = await request(app).get(`/api/locataires/${locataireB._id}`).set(bearer(adminB));
    expect(l.status).toBe(200);
    const p = await request(app).get(`/api/proprietaires/${proprietaireB._id}`).set(bearer(adminB));
    expect(p.status).toBe(200);
  });

  test('POSITIF : PlatformOperator avec Tenant B sélectionné peut lire, avec Tenant A refusé', async () => {
    const withB = await request(app).get(`/api/locataires/${locataireB._id}`).set(bearer(operatorUser, tenantB));
    expect(withB.status).toBe(200);
    const withA = await request(app).get(`/api/locataires/${locataireB._id}`).set(bearer(operatorUser, tenantA));
    expect([403, 404]).toContain(withA.status);
  });
});

describe('V3 — Centre de régularisation (17 contrats historiques)', () => {
  let historicalContractB;

  beforeAll(async () => {
    const proprietaire = await Proprietaire.create({
      nom: 'Historique', prenom: 'B', email: `historique-b-${Date.now()}@example.test`,
      telephone: '+242060000002', user: staffB._id,
    });
    historicalContractB = await Contrat.create({
      type: 'location', statut: 'actif', bien: null, proprietaire: proprietaire._id,
      montantLoyer: 100000, villeBien: 'Brazzaville', adresseBien: 'Adresse test',
    });
  });

  afterAll(async () => Reconciliation.deleteMany({ contract: historicalContractB._id }));

  test('RÉGRESSION : la liste des dossiers de AdminA (Tenant A) ne contient jamais le dossier de Tenant B', async () => {
    const res = await request(app).get('/api/rental-contract-regularization').set(bearer(adminA));
    expect(res.status).toBe(200);
    const ids = res.body.data.cases.map((c) => String(c.contract._id));
    expect(ids).not.toContain(String(historicalContractB._id));
  });

  test('RÉGRESSION : AdminA ne peut plus décider sur le dossier historique de Tenant B', async () => {
    const res = await request(app).post(`/api/rental-contract-regularization/${historicalContractB._id}/decision`)
      .set(bearer(adminA)).send({ action: 'flag_anomaly', reason: 'Tentative hostile cross-tenant' });
    expect(res.status).toBe(409);
    expect(await Reconciliation.countDocuments({ contract: historicalContractB._id })).toBe(0);
  });

  test('POSITIF : AdminB (propriétaire de son propre tenant) peut décider sur son dossier historique', async () => {
    const res = await request(app).post(`/api/rental-contract-regularization/${historicalContractB._id}/decision`)
      .set(bearer(adminB)).send({ action: 'flag_anomaly', reason: 'Traitement légitime du dossier' });
    expect(res.status).toBe(200);
  });

  test('POSITIF : PlatformOperator avec Tenant B sélectionné voit le dossier ; avec Tenant A, non', async () => {
    const withB = await request(app).get('/api/rental-contract-regularization').set(bearer(operatorUser, tenantB));
    expect(withB.body.data.cases.map((c) => String(c.contract._id))).toContain(String(historicalContractB._id));
    const withA = await request(app).get('/api/rental-contract-regularization').set(bearer(operatorUser, tenantA));
    expect(withA.body.data.cases.map((c) => String(c.contract._id))).not.toContain(String(historicalContractB._id));
  });
});

describe('V4 — gestionDocumentRoutes.js (bail/quittance/mise en demeure/préavis/état des lieux)', () => {
  let contratB;

  beforeAll(async () => {
    const property = await makeAttributedProperty(staffB);
    const proprietaire = await Proprietaire.create({
      nom: 'DocGen', prenom: 'B', email: `docgen-b-${Date.now()}@example.test`,
      telephone: '+242060000003', user: staffB._id,
    });
    const locataire = await Locataire.create({
      nom: 'DocGenLoc', prenom: 'B', email: `docgenloc-b-${Date.now()}@example.test`, telephone: '+242060000004',
    });
    contratB = await Contrat.create({
      type: 'location', statut: 'actif', bien: property._id, proprietaire: proprietaire._id, locataire: locataire._id,
      montantLoyer: 120000, villeBien: 'Pointe-Noire', adresseBien: 'Adresse Tenant B',
    });
  });

  test('RÉGRESSION : AdminA ne peut plus lister les documents du Contrat de Tenant B', async () => {
    const res = await request(app).get(`/api/documents-gestion/contrat/${contratB._id}`).set(bearer(adminA));
    expect([403, 404]).toContain(res.status);
  });

  test('RÉGRESSION : AdminA ne peut plus générer un bail pour le Contrat de Tenant B', async () => {
    const res = await request(app).post(`/api/documents-gestion/bail/${contratB._id}`).set(bearer(adminA)).send({});
    expect([403, 404]).toContain(res.status);
  });

  test('POSITIF : PlatformOperator avec Tenant B sélectionné accède au Contrat ; avec Tenant A, refusé', async () => {
    const withB = await request(app).get(`/api/documents-gestion/contrat/${contratB._id}`).set(bearer(operatorUser, tenantB));
    expect(withB.status).not.toBe(403);
    expect(withB.status).not.toBe(404);
    const withA = await request(app).get(`/api/documents-gestion/contrat/${contratB._id}`).set(bearer(operatorUser, tenantA));
    expect([403, 404]).toContain(withA.status);
  });
});
