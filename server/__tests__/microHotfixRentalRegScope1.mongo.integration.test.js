// MICRO-HOTFIX-RENTAL-REG-SCOPE-1 — reproduit et verrouille la question du
// mandat : le staff (Admin/GestionnaireImmobilier/Collaborateur, TOUJOURS
// l'acteur sur ce routeur — jamais le Proprietaire lui-même) peut-il être
// bloqué à tort quand le CONTRAT à régulariser référence un
// `proprietaire.user` public-signup SANS OrgMembership ? `isContractInScope`
// (rentalContractRegularizationService.js) compare `contract.proprietaire.user`
// au scope brut `req.tenantScopeUserIds` (OrgMembership-only) — sur tenant
// unique, un tel owner appartient pourtant sans ambiguïté au seul tenant
// existant. Teste la route RÉELLE (middleware `requireTenantScope` inclus),
// pas seulement le service en isolation (les tests existants du fichier
// `rentalContractRegularization.mongo.integration.test.js` appellent le
// service directement avec un scope déjà correct à la main — ils ne
// couvrent pas la résolution réelle de `req.tenantScopeUserIds`).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Proprietaire = require('../models/Proprietaire');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');

const rentalContractRegularizationRoutes = require('../routes/rentalContractRegularizationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/rental-contract-regularization', rentalContractRegularizationRoutes);
app.use(errorHandler);

const bearer = (user) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
});

async function createUnaffiliatedProprietaireWithContract(overrides = {}) {
  const ownerUser = await User.create({
    name: 'Unaffiliated Owner', email: `unaffiliated-owner-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true,
  });
  const proprietaire = await Proprietaire.create({ nom: 'Owner', prenom: 'Unaffiliated', telephone: '060000000', user: ownerUser._id });
  const locataire = await Locataire.create({ nom: 'Tenant', prenom: 'One', telephone: '070000000' });
  const contract = await Contrat.create({
    type: 'location', statut: 'actif', proprietaire: proprietaire._id, locataire: locataire._id,
    adresseBien: 'Rue Test', villeBien: 'Brazzaville', montantLoyer: 250000,
    ...overrides,
  });
  return { ownerUser, proprietaire, locataire, contract };
}

beforeAll(async () => { await startFinancialMongo(); });
afterAll(async () => stopFinancialMongo());

describe('MICRO-HOTFIX-RENTAL-REG-SCOPE-1 — scénario réel : contrat lié à un Proprietaire non affilié, tenant unique', () => {
  let fixture; let contract;

  beforeAll(async () => {
    fixture = await createTenantFixture({ label: 'RentalRegScope1 Solo' });
    ({ contract } = await createUnaffiliatedProprietaireWithContract());
  });

  test('GET / (liste) inclut le dossier dont le propriétaire est un compte non affilié au tenant unique', async () => {
    const res = await request(app).get('/api/rental-contract-regularization').set(bearer(fixture.bootstrap));
    expect(res.status).toBe(200);
    const ids = res.body.data.cases.map((c) => String(c.contract._id));
    expect(ids).toContain(String(contract._id));
  });

  test('POST /:contractId/decision (flag_anomaly) atteint le controller/service — pas de 409 CASE_NOT_PENDING à tort', async () => {
    const res = await request(app)
      .post(`/api/rental-contract-regularization/${contract._id}/decision`)
      .set(bearer(fixture.bootstrap))
      .send({ action: 'flag_anomaly', reason: 'Vérification humaine du dossier historique' });
    expect(res.status).toBe(200);
    expect(res.body.data.reconciliation.status).toBe('anomaly');
  });

  test('POST /:contractId/revert (Admin) réussit ensuite sur ce même dossier — controller atteint, pas de faux 409', async () => {
    const res = await request(app)
      .post(`/api/rental-contract-regularization/${contract._id}/revert`)
      .set(bearer(fixture.bootstrap))
      .send({ reason: 'Réversion de contrôle après vérification complémentaire' });
    expect(res.status).toBe(200);
    expect(res.body.data.reconciliation.status).toBe('reverted');
  });
});

describe('MICRO-HOTFIX-RENTAL-REG-SCOPE-1 — sécurité : le safety gate single-tenant reste respecté', () => {
  let fixtureA; let fixtureB; let contractA; let adminB;

  beforeAll(async () => {
    fixtureA = await createTenantFixture({ label: 'RentalRegScope1 CrossA' });
    ({ contract: contractA } = await createUnaffiliatedProprietaireWithContract());
    fixtureB = await createTenantFixture({ label: 'RentalRegScope1 CrossB' });
    adminB = (await createTenantUser({ tenant: fixtureB.tenant, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } })).user;
  });

  test('dès qu’un second tenant existe, le dossier non affilié au Tenant A n’est plus automatiquement inclus pour AdminA (repli sûr documenté, pas une fuite)', async () => {
    const res = await request(app).get('/api/rental-contract-regularization').set(bearer(fixtureA.bootstrap));
    const ids = res.body.data.cases.map((c) => String(c.contract._id));
    expect(ids).not.toContain(String(contractA._id));
  });

  test('AdminB (tenant distinct) ne peut jamais agir sur le dossier du Tenant A — 409 CASE_NOT_PENDING, aucune fuite cross-tenant', async () => {
    const res = await request(app)
      .post(`/api/rental-contract-regularization/${contractA._id}/decision`)
      .set(bearer(adminB))
      .send({ action: 'flag_anomaly', reason: 'Tentative illégitime depuis un autre tenant' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CASE_NOT_PENDING');
  });
});

describe('MICRO-HOTFIX-RENTAL-REG-SCOPE-1 — non-régression : staff avec OrgMembership normal', () => {
  let fixture; let manager; let contract;

  beforeAll(async () => {
    fixture = await createTenantFixture({ label: 'RentalRegScope1 IAM' });
    manager = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'GestionnaireImmobilier' } })).user;
    const ownerUser = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    const proprietaire = await Proprietaire.create({ nom: 'Owner', prenom: 'Affiliated', telephone: '060000001', user: ownerUser._id });
    const locataire = await Locataire.create({ nom: 'Tenant', prenom: 'Two', telephone: '070000001' });
    contract = await Contrat.create({
      type: 'location', statut: 'actif', proprietaire: proprietaire._id, locataire: locataire._id,
      adresseBien: 'Rue Affiliée', villeBien: 'Brazzaville', montantLoyer: 180000,
    });
  });

  test('un dossier dont le propriétaire a un OrgMembership réel continue de fonctionner sans changement (GestionnaireImmobilier)', async () => {
    const res = await request(app).get('/api/rental-contract-regularization').set(bearer(manager));
    const ids = res.body.data.cases.map((c) => String(c.contract._id));
    expect(ids).toContain(String(contract._id));
  });

  test('Collaborateur/rôle insuffisant reste refusé (403) — inchangé', async () => {
    const client = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Client' } })).user;
    const res = await request(app).get('/api/rental-contract-regularization').set(bearer(client));
    expect(res.status).toBe(403);
  });
});
