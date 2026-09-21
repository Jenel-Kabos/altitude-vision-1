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
const { createTenantFixture, createTenantUser, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const Proprietaire = require('../models/Proprietaire');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-B — le routeur exige désormais
// requireTenantMembershipRole(...). Les fixtures pré-2E.1.X n'attribuaient
// pas de `businessRole` — on l'ajoute ici pour garder la sémantique des
// tests (staff légitime = accès autorisé, non-staff = 403).
const promoteBootstrapToAdmin = async (tenant, bootstrap) => {
  // createTenantFixture creates the tenant + rootOrgUnit + settings but does
  // NOT grant its bootstrap user any OrgMembership. Post-2E.1.X-B the route
  // requires a canonical membership + businessRole: grant one here.
  await addTenantMember({ tenant, user: bootstrap, bootstrap, businessRole: 'Admin' });
  await OrgMembership.updateOne(
    { user: bootstrap._id, orgUnit: tenant.rootOrgUnit, status: 'active' },
    { $set: { businessRole: 'Admin' } },
  );
};
const promoteMembershipTo = (user, tenant, businessRole) => OrgMembership.updateOne(
  { user: user._id, orgUnit: tenant.rootOrgUnit, status: 'active' },
  { $set: { businessRole } },
);

const rentalContractRegularizationRoutes = require('../routes/rentalContractRegularizationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/rental-contract-regularization', rentalContractRegularizationRoutes);
app.use(errorHandler);

const bearer = (user, tenantId) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}),
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
    await promoteBootstrapToAdmin(fixture.tenant, fixture.bootstrap);
    ({ contract } = await createUnaffiliatedProprietaireWithContract());
  });

  test('GET / (liste) inclut le dossier dont le propriétaire est un compte non affilié au tenant unique', async () => {
    const res = await request(app).get('/api/rental-contract-regularization').set(bearer(fixture.bootstrap, fixture.tenant._id));
    expect(res.status).toBe(200);
    const ids = res.body.data.cases.map((c) => String(c.contract._id));
    expect(ids).toContain(String(contract._id));
  });

  test('POST /:contractId/decision (flag_anomaly) atteint le controller/service — pas de 409 CASE_NOT_PENDING à tort', async () => {
    const res = await request(app)
      .post(`/api/rental-contract-regularization/${contract._id}/decision`)
      .set(bearer(fixture.bootstrap, fixture.tenant._id))
      .send({ action: 'flag_anomaly', reason: 'Vérification humaine du dossier historique' });
    expect(res.status).toBe(200);
    expect(res.body.data.reconciliation.status).toBe('anomaly');
  });

  test('POST /:contractId/revert (Admin) réussit ensuite sur ce même dossier — controller atteint, pas de faux 409', async () => {
    const res = await request(app)
      .post(`/api/rental-contract-regularization/${contract._id}/revert`)
      .set(bearer(fixture.bootstrap, fixture.tenant._id))
      .send({ reason: 'Réversion de contrôle après vérification complémentaire' });
    expect(res.status).toBe(200);
    expect(res.body.data.reconciliation.status).toBe('reverted');
  });
});

describe('MICRO-HOTFIX-RENTAL-REG-SCOPE-1 — sécurité : le safety gate single-tenant reste respecté', () => {
  let fixtureA; let fixtureB; let contractA; let adminB;

  beforeAll(async () => {
    fixtureA = await createTenantFixture({ label: 'RentalRegScope1 CrossA' });
    await promoteBootstrapToAdmin(fixtureA.tenant, fixtureA.bootstrap);
    ({ contract: contractA } = await createUnaffiliatedProprietaireWithContract());
    fixtureB = await createTenantFixture({ label: 'RentalRegScope1 CrossB' });
    await promoteBootstrapToAdmin(fixtureB.tenant, fixtureB.bootstrap);
    adminB = (await createTenantUser({ tenant: fixtureB.tenant, bootstrap: fixtureB.bootstrap, overrides: { role: 'Client' } })).user;
    await promoteMembershipTo(adminB, fixtureB.tenant, 'Admin');
  });

  test('dès qu’un second tenant existe, le dossier non affilié au Tenant A n’est plus automatiquement inclus pour AdminA (repli sûr documenté, pas une fuite)', async () => {
    const res = await request(app).get('/api/rental-contract-regularization').set(bearer(fixtureA.bootstrap, fixtureA.tenant._id));
    const ids = res.body.data.cases.map((c) => String(c.contract._id));
    expect(ids).not.toContain(String(contractA._id));
  });

  test('AdminB (tenant distinct) ne peut jamais agir sur le dossier du Tenant A — refus explicite (403 module/membership, ou 409 case-not-pending), aucune fuite cross-tenant', async () => {
    const res = await request(app)
      .post(`/api/rental-contract-regularization/${contractA._id}/decision`)
      .set(bearer(adminB, fixtureB.tenant._id))
      .send({ action: 'flag_anomaly', reason: 'Tentative illégitime depuis un autre tenant' });
    // Post-2E.1.X-B: adminB has an active membership only in tenant B. Acting
    // on tenant A's contract with X-Platform-Tenant-Id=B resolves the tenant
    // as B, then the service refuses the cross-tenant contract with 409
    // CASE_NOT_PENDING (its `req.tenantScopeUserIds` from tenant B does not
    // contain the tenant-A proprietaire.user). Either 403 (module/membership
    // rejection upstream) or 409 (service-level rejection) is an acceptable
    // fail-closed answer — the invariant is: NO write on tenant A.
    expect([403, 409]).toContain(res.status);
  });
});

describe('MICRO-HOTFIX-RENTAL-REG-SCOPE-1 — non-régression : staff avec OrgMembership normal', () => {
  let fixture; let manager; let contract;

  beforeAll(async () => {
    fixture = await createTenantFixture({ label: 'RentalRegScope1 IAM' });
    await promoteBootstrapToAdmin(fixture.tenant, fixture.bootstrap);
    manager = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Client' } })).user;
    await promoteMembershipTo(manager, fixture.tenant, 'GestionnaireImmobilier');
    const ownerUser = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    await promoteMembershipTo(ownerUser, fixture.tenant, 'Collaborateur');
    const proprietaire = await Proprietaire.create({ nom: 'Owner', prenom: 'Affiliated', telephone: '060000001', user: ownerUser._id });
    const locataire = await Locataire.create({ nom: 'Tenant', prenom: 'Two', telephone: '070000001' });
    contract = await Contrat.create({
      type: 'location', statut: 'actif', proprietaire: proprietaire._id, locataire: locataire._id,
      adresseBien: 'Rue Affiliée', villeBien: 'Brazzaville', montantLoyer: 180000,
    });
  });

  test('un dossier dont le propriétaire a un OrgMembership réel continue de fonctionner sans changement (GestionnaireImmobilier)', async () => {
    const res = await request(app).get('/api/rental-contract-regularization').set(bearer(manager, fixture.tenant._id));
    const ids = res.body.data.cases.map((c) => String(c.contract._id));
    expect(ids).toContain(String(contract._id));
  });

  test('membership sans businessRole staff éligible (rôle Secretaire non listé) est refusé (403) — inchangé', async () => {
    const client = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Client' } })).user;
    await promoteMembershipTo(client, fixture.tenant, 'Secretaire');
    const res = await request(app).get('/api/rental-contract-regularization').set(bearer(client, fixture.tenant._id));
    expect(res.status).toBe(403);
  });
});
