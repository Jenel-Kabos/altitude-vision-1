// GL-LIFE-1 — PUT sur un contrat de location : toute demande de
// changement de `statut` passe désormais par la machine d'état
// centralisée (rentalLeaseLifecycleService) — jamais un écrasement direct.
// Les contrats de vente restent inchangés (hors périmètre du cycle de vie
// locatif) et les champs non liés au statut restent modifiables comme avant.
//
// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.2.XIV-3E-MONGO — surface certifiée
// des mutations post-contrat : `/api/contrats/location/:id`
// (rentalContratRoutes, module `location` + tenant membership +
// requireContratType('location')). La surface polymorphique legacy
// `PUT /api/contrats/:id` est retirée uniformément (410
// CONTRACT_LEGACY_MUTATION_RETIRED — voir suite LCR). Les invariants métier
// du cycle de vie sont testés ici sur la surface canonique typée.
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
const OrgMembership = require('../models/OrgMembership');
const contratRoutes = require('../routes/contratRoutes');
const rentalContratRoutes = require('../routes/rentalContratRoutes');
const saleContratRoutes = require('../routes/saleContratRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
// Surfaces typées AVANT le legacy — même ordre que server.js pour éviter
// que `/api/contrats/location/:id` soit absorbé par `/:id` du router legacy.
app.use('/api/contrats/location', rentalContratRoutes);
app.use('/api/contrats/vente', saleContratRoutes);
app.use('/api/contrats', contratRoutes);
app.use(errorHandler);

const signToken = (id, tokenVersion = 0) => jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Utilisateur Test', email: `contratlife${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function buildLeaseFixture() {
  const admin = await makeUser({ role: 'Admin' });
  const owner = await makeUser({ role: 'Proprietaire' });
  const tenant = await platformTenantService.createTenant({ name: `GL-LIFE-1 ${Date.now()}`, actor: admin });
  await Promise.all([
    organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: owner._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
  ]);
  // USER-TENANT-MEMBERSHIP-ARCHITECTURE — l'admin de tenant doit porter un
  // businessRole canonique pour satisfaire `requireTenantMembershipRole`
  // sur la surface typée. Aucun fallback User.role.
  await OrgMembership.updateOne(
    { user: admin._id, orgUnit: tenant.rootOrgUnit, status: 'active' },
    { $set: { businessRole: 'Admin' } },
  );
  const property = await Property.create({
    title: 'Villa Update Guard', description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Loué', owner: owner._id, tenant: tenant._id,
  });
  const proprietaire = await Proprietaire.create({ nom: 'Nkounkou', prenom: 'Alice', telephone: '+242060000010' });
  const locataire = await Locataire.create({ nom: 'Moke', prenom: 'Paul', telephone: '+242060000011' });
  const contrat = await Contrat.create({
    type: 'location', bien: property._id, proprietaire: proprietaire._id, locataire: locataire._id, statut: 'actif', cycleVie: 'actif',
    dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000,
  });
  await RentalManagement.create({ property: property._id, owner: owner._id, managementActivated: true, occupancyStatus: 'occupe', activeLease: contrat._id });
  return { admin, contrat, tenant };
}

const bearer = (user, tenant) => ({ Authorization: `Bearer ${signToken(user._id)}`, 'X-Platform-Tenant-Id': String(tenant._id) });

test('PUT statut illégal (actif → en_attente) est rejeté par la machine d\'état, jamais un écrasement silencieux', async () => {
  const { admin, contrat, tenant } = await buildLeaseFixture();
  const res = await request(app).put(`/api/contrats/location/${contrat._id}`).set(bearer(admin, tenant)).send({ statut: 'en_attente' });
  expect(res.status).toBe(409);
  const fresh = await Contrat.findById(contrat._id);
  expect(fresh.statut).toBe('actif'); // inchangé
});

test('PUT statut légal (actif → résilié) synchronise cycleVie', async () => {
  const { admin, contrat, tenant } = await buildLeaseFixture();
  const res = await request(app).put(`/api/contrats/location/${contrat._id}`).set(bearer(admin, tenant)).send({ statut: 'résilié' });
  expect(res.status).toBe(200);
  expect(res.body.data.contrat.statut).toBe('résilié');
  const fresh = await Contrat.findById(contrat._id);
  expect(fresh.cycleVie).toBe('resilie');
});

test('PUT sans changement de statut modifie les autres champs comme avant (aucune régression)', async () => {
  const { admin, contrat, tenant } = await buildLeaseFixture();
  const res = await request(app).put(`/api/contrats/location/${contrat._id}`).set(bearer(admin, tenant)).send({ montantLoyer: 350000 });
  expect(res.status).toBe(200);
  expect(res.body.data.contrat.montantLoyer).toBe(350000);
});

test('PUT statut identique au statut actuel ne déclenche aucune transition', async () => {
  const { admin, contrat, tenant } = await buildLeaseFixture();
  const res = await request(app).put(`/api/contrats/location/${contrat._id}`).set(bearer(admin, tenant)).send({ statut: 'actif', montantLoyer: 310000 });
  expect(res.status).toBe(200);
  const fresh = await Contrat.findById(contrat._id);
  expect(fresh.cycleHistory).toHaveLength(0);
  expect(fresh.montantLoyer).toBe(310000);
});

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.2.XIV-3C — regression : la surface
// legacy polymorphique reste explicitement retirée. La couverture
// détaillée du retirement (410 + zéro effet de bord) est portée par la
// suite `legacyContratMutationRetirement3C` (LCR-01..09). Ici on garde une
// assertion locale minimale pour verrouiller la non-résurrection du
// point d'entrée legacy dans ce contexte lifecycle.
test('PUT legacy /api/contrats/:id reste retiré → 410 CONTRACT_LEGACY_MUTATION_RETIRED', async () => {
  const { admin, contrat, tenant } = await buildLeaseFixture();
  const before = await Contrat.findById(contrat._id).lean();
  const res = await request(app).put(`/api/contrats/${contrat._id}`).set(bearer(admin, tenant)).send({ montantLoyer: 999999 });
  expect(res.status).toBe(410);
  expect(res.body.code).toBe('CONTRACT_LEGACY_MUTATION_RETIRED');
  const after = await Contrat.findById(contrat._id).lean();
  expect(after.montantLoyer).toBe(before.montantLoyer);
});
