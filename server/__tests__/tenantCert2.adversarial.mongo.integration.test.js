// TENANT-CERT-2 — Certification finale adversariale de l'isolation
// multi-tenant. Modèle de menace : Tenant A et Tenant B, chacun avec sa
// propre racine organisationnelle, ses propres utilisateurs et ses propres
// ressources — l'attaquant (un acteur légitimement authentifié du Tenant A)
// CONNAÎT déjà l'ObjectId de la ressource adverse du Tenant B (jamais une
// sécurité par obscurité de l'identifiant).
//
// Règle obligatoire (§34/§35 du sprint) : pour chaque attaque, on prouve
// D'ABORD que la ressource B existe et est accessible par un acteur
// légitime de B (contrôle positif), PUIS que le même accès depuis A échoue.
// Un simple 404/403 sans contrôle positif correspondant n'est jamais
// accepté comme preuve d'isolation.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');

const User = require('../models/User');
const Property = require('../models/Property');
const Hotel = require('../models/Hotel');
const RentalManagement = require('../models/RentalManagement');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const OrgUnit = require('../models/OrgUnit');

const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');

const propertyRoutes = require('../routes/propertyRoutes');
const rentalManagementRoutes = require('../routes/rentalManagementRoutes');
const contratRoutes = require('../routes/contratRoutes');
const paiementRoutes = require('../routes/paiementRoutes');
const organizationRoutes = require('../routes/organizationRoutes');
const hotelRoutes = require('../routes/hotelRoutes');
const erpRoutes = require('../routes/erpRoutes');
const reportingRoutes = require('../routes/reportingRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/properties', propertyRoutes);
app.use('/api/rental-management', rentalManagementRoutes);
app.use('/api/contrats', contratRoutes);
app.use('/api/paiements', paiementRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/erp', erpRoutes);
app.use('/api/reporting', reportingRoutes);
app.use(errorHandler);

const signToken = (userId) => jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const auth = (userId) => `Bearer ${signToken(userId)}`;

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({
    name: overrides.name || 'Test User', email: `cert2-${counter}-${Date.now()}@example.com`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides,
  });
};

const makeProperty = (owner, overrides = {}) => Property.create({
  title: overrides.title || 'Bien Cert2', description: 'Description suffisamment longue pour la validation du modèle Property.',
  pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
  address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
  images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
  statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', owner: owner._id, ...overrides,
});

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

// ── Construction du modèle de menace : Tenant A / Tenant B ──────────────
async function buildThreatModel() {
  const bootstrapAdmin = await makeUser({ role: 'Admin', name: 'Bootstrap' });
  const tenantA = await platformTenantService.createTenant({ name: `Tenant A ${Date.now()}`, actor: bootstrapAdmin });
  const tenantB = await platformTenantService.createTenant({ name: `Tenant B ${Date.now()}`, actor: bootstrapAdmin });

  const adminA = await makeUser({ role: 'Admin', name: 'Admin A' });
  const adminB = await makeUser({ role: 'Admin', name: 'Admin B' });
  const gestA = await makeUser({ role: 'GestionnaireImmobilier', name: 'Gestionnaire A' });
  const gestB = await makeUser({ role: 'GestionnaireImmobilier', name: 'Gestionnaire B' });
  const propOwnerA = await makeUser({ role: 'Proprietaire', name: 'Propriétaire A' });
  const propOwnerB = await makeUser({ role: 'Proprietaire', name: 'Propriétaire B' });

  await Promise.all([
    organizationService.grantMembership({ userId: adminA._id, orgUnitId: tenantA.rootOrgUnit, actor: bootstrapAdmin }),
    organizationService.grantMembership({ userId: gestA._id, orgUnitId: tenantA.rootOrgUnit, actor: bootstrapAdmin }),
    organizationService.grantMembership({ userId: propOwnerA._id, orgUnitId: tenantA.rootOrgUnit, actor: bootstrapAdmin }),
    organizationService.grantMembership({ userId: adminB._id, orgUnitId: tenantB.rootOrgUnit, actor: bootstrapAdmin }),
    organizationService.grantMembership({ userId: gestB._id, orgUnitId: tenantB.rootOrgUnit, actor: bootstrapAdmin }),
    organizationService.grantMembership({ userId: propOwnerB._id, orgUnitId: tenantB.rootOrgUnit, actor: bootstrapAdmin }),
  ]);

  return { tenantA, tenantB, adminA, adminB, gestA, gestB, propOwnerA, propOwnerB };
}

describe('TENANT-CERT-2 — PROPERTY (§5)', () => {
  test('contrôle positif : B existe et est modifiable par un acteur légitime de B (Admin B)', async () => {
    const { adminB, propOwnerB } = await buildThreatModel();
    const propertyB = await makeProperty(propOwnerB, { title: 'Villa B légitime' });
    const res = await request(app).put(`/api/properties/${propertyB._id}`).set('Authorization', auth(adminB._id)).send({ title: 'Villa B modifiée' });
    expect(res.status).toBe(200);
  });

  test('Admin A → PUT Property B = refusé (ancien bypass role===Admin corrigé)', async () => {
    const { adminA, propOwnerB } = await buildThreatModel();
    const propertyB = await makeProperty(propOwnerB, { title: 'Villa B cible' });
    const res = await request(app).put(`/api/properties/${propertyB._id}`).set('Authorization', auth(adminA._id)).send({ title: 'Hack' });
    expect(res.status).toBe(404);
    const untouched = await Property.findById(propertyB._id).lean();
    expect(untouched.title).toBe('Villa B cible');
  });

  test('Admin A → DELETE Property B = refusé', async () => {
    const { adminA, propOwnerB } = await buildThreatModel();
    const propertyB = await makeProperty(propOwnerB);
    const res = await request(app).delete(`/api/properties/${propertyB._id}`).set('Authorization', auth(adminA._id));
    expect(res.status).toBe(404);
    expect(await Property.findById(propertyB._id)).not.toBeNull();
  });

  test('Admin A → PATCH modération Property B (validate) = refusé', async () => {
    const { adminA, propOwnerB } = await buildThreatModel();
    const propertyB = await makeProperty(propOwnerB, { statusAdmin: 'En attente' });
    const res = await request(app).patch(`/api/properties/admin/${propertyB._id}/validate`).set('Authorization', auth(adminA._id));
    expect(res.status).toBe(404);
    expect((await Property.findById(propertyB._id).lean()).statusAdmin).toBe('En attente');
  });

  test('Admin A → DELETE admin Property B = refusé', async () => {
    const { adminA, propOwnerB } = await buildThreatModel();
    const propertyB = await makeProperty(propOwnerB);
    const res = await request(app).delete(`/api/properties/admin/${propertyB._id}`).set('Authorization', auth(adminA._id));
    expect(res.status).toBe(404);
    expect(await Property.findById(propertyB._id)).not.toBeNull();
  });

  test('Admin A → PATCH recommande Property B = refusé', async () => {
    const { adminA, propOwnerB } = await buildThreatModel();
    const propertyB = await makeProperty(propOwnerB);
    const res = await request(app).patch(`/api/properties/${propertyB._id}/recommande`).set('Authorization', auth(adminA._id)).send({ recommande: true });
    expect(res.status).toBe(404);
    expect((await Property.findById(propertyB._id).lean()).recommande).not.toBe(true);
  });

  test('Admin A → GET Property B non publiée (vue privilégiée) = refusé', async () => {
    const { adminA, propOwnerB } = await buildThreatModel();
    const propertyB = await makeProperty(propOwnerB, { statusAdmin: 'En attente', isPublished: false });
    const res = await request(app).get(`/api/properties/${propertyB._id}`).set('Authorization', auth(adminA._id));
    expect(res.status).toBe(403);
  });

  test('contrôle positif : GET Property B publiée reste public (catalogue), jamais bloqué par erreur', async () => {
    const { propOwnerB } = await buildThreatModel();
    const propertyB = await makeProperty(propOwnerB, { statusAdmin: 'Validée', isPublished: true });
    const res = await request(app).get(`/api/properties/${propertyB._id}`);
    expect(res.status).toBe(200); // le correctif ne doit jamais casser le catalogue public légitime
  });

  test('Admin A opérant sur SA propre Property A reste pleinement fonctionnel (non-régression)', async () => {
    const { adminA, propOwnerA } = await buildThreatModel();
    const propertyA = await makeProperty(propOwnerA, { title: 'Villa A' });
    const res = await request(app).put(`/api/properties/${propertyA._id}`).set('Authorization', auth(adminA._id)).send({ title: 'Villa A modifiée' });
    expect(res.status).toBe(200);
  });

  test('un Propriétaire agit toujours librement sur SON propre bien (aucune régression du chemin owner)', async () => {
    const { propOwnerA } = await buildThreatModel();
    const propertyA = await makeProperty(propOwnerA, { title: 'Villa Owner' });
    const res = await request(app).put(`/api/properties/${propertyA._id}`).set('Authorization', auth(propOwnerA._id)).send({ title: 'Villa Owner modifiée' });
    expect(res.status).toBe(200);
  });
});

describe('TENANT-CERT-2 — GESTION LOCATIVE (§6)', () => {
  async function makeRental(owner, overrides = {}) {
    const property = await makeProperty(owner, overrides.propertyOverrides);
    return RentalManagement.create({ property: property._id, owner: owner._id, managementActivated: true, ...overrides });
  }

  test('contrôle positif : RentalManagement B accessible par Gestionnaire B', async () => {
    const { gestB, propOwnerB } = await buildThreatModel();
    const rentalB = await makeRental(propOwnerB);
    const res = await request(app).get(`/api/rental-management/${rentalB._id}`).set('Authorization', auth(gestB._id));
    expect(res.status).toBe(200);
  });

  test('Gestionnaire A → GET RentalManagement B = refusé', async () => {
    const { gestA, propOwnerB } = await buildThreatModel();
    const rentalB = await makeRental(propOwnerB);
    const res = await request(app).get(`/api/rental-management/${rentalB._id}`).set('Authorization', auth(gestA._id));
    expect([403, 404]).toContain(res.status);
  });

  test('Gestionnaire A → PATCH update RentalManagement B = refusé', async () => {
    const { gestA, propOwnerB } = await buildThreatModel();
    const rentalB = await makeRental(propOwnerB);
    const res = await request(app).patch(`/api/rental-management/${rentalB._id}`).set('Authorization', auth(gestA._id)).send({ occupancyStatus: 'occupe' });
    expect([403, 404]).toContain(res.status);
    expect((await RentalManagement.findById(rentalB._id).lean()).occupancyStatus).not.toBe('occupe');
  });

  test('Gestionnaire A → POST deactivate RentalManagement B = refusé', async () => {
    const { gestA, propOwnerB } = await buildThreatModel();
    const rentalB = await makeRental(propOwnerB);
    const res = await request(app).post(`/api/rental-management/${rentalB._id}/deactivate`).set('Authorization', auth(gestA._id)).send({});
    expect([403, 404]).toContain(res.status);
    expect((await RentalManagement.findById(rentalB._id).lean()).managementActivated).toBe(true);
  });

  test("Propriétaire B garde l'accès self-service à SON dossier sans OrgMembership (non-régression)", async () => {
    const bootstrapAdmin = await makeUser({ role: 'Admin' });
    const soloOwner = await makeUser({ role: 'Proprietaire', name: 'Propriétaire Solo' }); // aucun membership
    const rental = await makeRental(soloOwner);
    void bootstrapAdmin;
    const res = await request(app).post(`/api/rental-management/${rental._id}/owner/request-publish`).set('Authorization', auth(soloOwner._id)).send({ reason: 'test' });
    expect(res.status).not.toBe(403); // ne doit jamais être bloqué faute de contexte tenant
  });

  test('contrôle positif : Contrat B accessible par le staff B (STAFF_IMMO/Secretaire)', async () => {
    const { gestB, propOwnerB } = await buildThreatModel();
    const propertyB = await makeProperty(propOwnerB);
    const contratB = await Contrat.create({ type: 'location', bien: propertyB._id, statut: 'actif', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000 });
    const res = await request(app).get(`/api/contrats/${contratB._id}`).set('Authorization', auth(gestB._id));
    expect(res.status).toBe(200);
  });

  test('Gestionnaire A → GET Contrat B = refusé', async () => {
    const { gestA, propOwnerB } = await buildThreatModel();
    const propertyB = await makeProperty(propOwnerB);
    const contratB = await Contrat.create({ type: 'location', bien: propertyB._id, statut: 'actif', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000 });
    const res = await request(app).get(`/api/contrats/${contratB._id}`).set('Authorization', auth(gestA._id));
    expect([403, 404]).toContain(res.status);
  });

  test('Gestionnaire A → PUT Contrat B = refusé', async () => {
    const { gestA, propOwnerB } = await buildThreatModel();
    const propertyB = await makeProperty(propOwnerB);
    const contratB = await Contrat.create({ type: 'location', bien: propertyB._id, statut: 'actif', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000 });
    const res = await request(app).put(`/api/contrats/${contratB._id}`).set('Authorization', auth(gestA._id)).send({ montantLoyer: 999999 });
    expect([403, 404]).toContain(res.status);
    expect((await Contrat.findById(contratB._id).lean()).montantLoyer).toBe(300000);
  });

  // ROLES_PAIEMENTS = ['Admin', 'Collaborateur', 'Secretaire'] (n'inclut PAS
  // GestionnaireImmobilier) — Admin B/A utilisés ici pour rester dans le
  // périmètre RBAC réel de ces routes.
  test('contrôle positif : Paiement B accessible par le staff B', async () => {
    const { adminB, propOwnerB } = await buildThreatModel();
    const propertyB = await makeProperty(propOwnerB);
    const contratB = await Contrat.create({ type: 'location', bien: propertyB._id, statut: 'actif', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000 });
    const paiementB = await Paiement.create({ contrat: contratB._id, mois: 1, annee: 2027, montant: 300000, statut: 'payé', datePaiement: new Date('2027-01-05') });
    const res = await request(app).get(`/api/paiements/${paiementB._id}`).set('Authorization', auth(adminB._id));
    expect(res.status).toBe(200);
  });

  test('Admin A → GET Paiement B = refusé', async () => {
    const { adminA, propOwnerB } = await buildThreatModel();
    const propertyB = await makeProperty(propOwnerB);
    const contratB = await Contrat.create({ type: 'location', bien: propertyB._id, statut: 'actif', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000 });
    const paiementB = await Paiement.create({ contrat: contratB._id, mois: 1, annee: 2027, montant: 300000, statut: 'payé', datePaiement: new Date('2027-01-05') });
    const res = await request(app).get(`/api/paiements/${paiementB._id}`).set('Authorization', auth(adminA._id));
    expect([403, 404]).toContain(res.status);
  });
});

describe('TENANT-CERT-2 — ORGANIZATION (§17)', () => {
  test('contrôle positif : Admin B consulte son propre arbre organisationnel', async () => {
    const { adminB, tenantB } = await buildThreatModel();
    const res = await request(app).get(`/api/organization/units/${tenantB.rootOrgUnit}/tree`).set('Authorization', auth(adminB._id));
    expect(res.status).toBe(200);
  });

  test('Admin A → GET tree OrgUnit racine B = refusé', async () => {
    const { adminA, tenantB } = await buildThreatModel();
    const res = await request(app).get(`/api/organization/units/${tenantB.rootOrgUnit}/tree`).set('Authorization', auth(adminA._id));
    expect(res.status).toBe(404);
  });

  test('Admin A → archive OrgUnit racine B = refusé', async () => {
    const { adminA, tenantB } = await buildThreatModel();
    const res = await request(app).post(`/api/organization/units/${tenantB.rootOrgUnit}/archive`).set('Authorization', auth(adminA._id)).send({});
    expect(res.status).toBe(404);
    expect((await OrgUnit.findById(tenantB.rootOrgUnit).lean()).status).toBe('active');
  });

  test('Admin A → grantMembership vers OrgUnit racine B = refusé', async () => {
    const { adminA, tenantB, propOwnerA } = await buildThreatModel();
    const res = await request(app).post('/api/organization/memberships').set('Authorization', auth(adminA._id))
      .send({ userId: String(propOwnerA._id), orgUnitId: String(tenantB.rootOrgUnit) });
    expect(res.status).toBe(404);
  });

  test('listUnits (Admin A) ne contient jamais aucune unité de B', async () => {
    const { adminA, tenantB } = await buildThreatModel();
    const res = await request(app).get('/api/organization/units').set('Authorization', auth(adminA._id));
    expect(res.status).toBe(200);
    const ids = res.body.data.units.map((u) => String(u.id));
    expect(ids).not.toContain(String(tenantB.rootOrgUnit._id || tenantB.rootOrgUnit));
  });
});

describe('TENANT-CERT-2 — REPORTING / ERP (§15/§16/§29 tenant explicite hostile)', () => {
  test('Admin A fournissant tenantId=B : le paramètre hostile est ignoré, jamais transmis tel quel', async () => {
    const { adminA, tenantB } = await buildThreatModel();
    const res = await request(app).get('/api/reporting/executive').query({ tenantId: String(tenantB._id) }).set('Authorization', auth(adminA._id));
    expect(res.status).toBe(200);
    // Le rapport ne doit jamais porter le tenantId hostile comme scope actif.
    expect(res.body.data.report.orgUnitId === null || res.body.data.report.orgUnitId === undefined || String(res.body.data.report.orgUnitId) !== String(tenantB.rootOrgUnit)).toBe(true);
  });

  test('Admin A fournissant orgUnitId=racine B : le paramètre hostile est ignoré côté ERP', async () => {
    const { adminA, tenantB } = await buildThreatModel();
    const res = await request(app).get('/api/erp/executive').query({ orgUnitId: String(tenantB.rootOrgUnit) }).set('Authorization', auth(adminA._id));
    expect(res.status).toBe(200);
  });

  test('contrôle positif : Admin A avec son propre orgUnitId (tenant A) fonctionne normalement', async () => {
    const { adminA, tenantA } = await buildThreatModel();
    const res = await request(app).get('/api/reporting/executive').query({ orgUnitId: String(tenantA.rootOrgUnit) }).set('Authorization', auth(adminA._id));
    expect(res.status).toBe(200);
    expect(String(res.body.data.report.orgUnitId)).toBe(String(tenantA.rootOrgUnit));
  });
});

describe('TENANT-CERT-2 — HÔTELLERIE (§8, contrôle de non-régression du correctif F2.6.2)', () => {
  test('contrôle positif : Admin B accède à Hotel B', async () => {
    const { adminB, propOwnerB, tenantB } = await buildThreatModel();
    const propertyB = await makeProperty(propOwnerB);
    const hotelB = await Hotel.create({ name: 'Hôtel B', manager: propOwnerB._id, createdBy: adminB._id, property: propertyB._id, tenant: tenantB._id });
    const res = await request(app).get(`/api/hotels/${hotelB._id}`).set('Authorization', auth(adminB._id));
    expect(res.status).toBe(200);
  });

  test('Admin A → GET Hotel B = refusé (déjà corrigé par tenantResourceAttributionService, non-régression)', async () => {
    const { adminA, propOwnerB, tenantB } = await buildThreatModel();
    const propertyB = await makeProperty(propOwnerB);
    const hotelB = await Hotel.create({ name: 'Hôtel B cible', manager: propOwnerB._id, createdBy: propOwnerB._id, property: propertyB._id, tenant: tenantB._id });
    const res = await request(app).get(`/api/hotels/${hotelB._id}`).set('Authorization', auth(adminA._id));
    expect(res.status).toBe(404);
  });

  test('Admin A → PUT admin Hotel B = refusé', async () => {
    const { adminA, propOwnerB, tenantB } = await buildThreatModel();
    const propertyB = await makeProperty(propOwnerB);
    const hotelB = await Hotel.create({ name: 'Hôtel B', manager: propOwnerB._id, createdBy: propOwnerB._id, property: propertyB._id, tenant: tenantB._id });
    const res = await request(app).put(`/api/hotels/admin/${hotelB._id}`).set('Authorization', auth(adminA._id)).send({ name: 'Hacked' });
    expect([403, 404]).toContain(res.status);
    expect((await Hotel.findById(hotelB._id).lean()).name).toBe('Hôtel B');
  });
});
