// C2.10A — RENTAL SCOPE SECURITY HOTFIX + ORGANIZATION REALIGNMENT.
// Property.tenant est l'unique provenance organisationnelle de la gestion
// locative. tenant:null = bien INDIVIDUAL, jamais administrable par le staff
// d'une organisation (ni via l'OrgMembership du propriétaire, ni via le
// manager, ni via l'heuristique « tenant unique »). Un bien tenant:T apparaît
// dans T même si son propriétaire n'est pas membre de T.
//
// Matrice : X, Y = PlatformTenant ; A = propriétaire membre de X ; B =
// propriétaire membre de Y ; C = propriétaire externe (aucune membership).
//   P1 A null · P2 B null · P3 A X · P4 B Y · P5 C X · P6 A Y
//   P7 C null — reproduction exacte du P0 (propriétaire indépendant sans membership).
jest.mock('../services/tenantPortalEmailService', () => ({ sendInvitation: jest.fn().mockResolvedValue() }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const PlatformTenant = require('../models/PlatformTenant');
const RentalManagement = require('../models/RentalManagement');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const Locataire = require('../models/Locataire');
const Proprietaire = require('../models/Proprietaire');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const TenantLinkRequest = require('../models/TenantLinkRequest');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(240000);

const app = express();
app.use(express.json());
app.use('/api/rental-management', require('../routes/rentalManagementRoutes'));
app.use('/api/contrats/location', require('../routes/rentalContratRoutes'));
app.use('/api/contrats', require('../routes/contratRoutes'));
app.use('/api/paiements/location', require('../routes/paiementLocationRoutes'));
app.use('/api/paiements', require('../routes/paiementRoutes'));
app.use('/api/locataires', require('../routes/locataireRoutes'));
app.use('/api/proprietaires', require('../routes/proprietaireRoutes'));
app.use('/api/gestion-docs', require('../routes/gestionDocumentRoutes'));
app.use('/api/rental-maintenance', require('../routes/rentalMaintenanceRoutes'));
app.use('/api/rental-lease-lifecycle', require('../routes/rentalLeaseLifecycleRoutes'));
app.use('/api/rental-contract-regularization', require('../routes/rentalContractRegularizationRoutes'));
app.use(errorHandler);

const as = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});
let seq = 0;
const makeUser = (role) => User.create({
  name: `C210A ${role} ${++seq}`, email: `c210a-${seq}-${Date.now()}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true,
});
const DENIED = [403, 404];
const ids = (body) => new Set(JSON.stringify(body || {}).match(/[a-f0-9]{24}/g) || []);

const S = {};
async function seedAsset(key, owner, tenant, { manager = null } = {}) {
  const property = await Property.create({
    title: `C210A ${key}`, description: 'Description suffisamment longue pour la validation.',
    pole: 'Altimmo', type: 'Appartement', status: 'location', price: 250000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' }, images: ['https://example.test/i.jpg'],
    surface: 80, statusAdmin: 'Validée', availability: 'Disponible', latitude: -4.27, longitude: 15.27,
    owner: owner._id, tenant: tenant?._id || null,
  });
  const rental = await RentalManagement.create({
    property: property._id, owner: owner._id, tenant: tenant?._id || null, manager: manager?._id,
    managementActivated: true, availabilityStatus: 'disponible', occupancyStatus: 'occupe', createdBy: owner._id,
  });
  const locataire = await Locataire.create({ nom: `Loc${key}`, prenom: 'R', telephone: `06000${seq}`, email: `loc-${key}-${Date.now()}@example.test` });
  const proprietaire = await Proprietaire.create({ nom: `Prop${key}`, prenom: 'O', telephone: `05000${seq}` });
  const contrat = await Contrat.create({
    type: 'location', bien: property._id, locataire: locataire._id, proprietaire: proprietaire._id,
    statut: 'actif', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000,
  });
  const paiement = await Paiement.create({ contrat: contrat._id, mois: 1, annee: 2027, montant: 300000, statut: 'impayé' });
  const ticket = await RentalMaintenanceTicket.create({ property: property._id, category: 'plomberie', description: `Fuite ${key}`, owner: owner._id });
  S[key] = { property, rental, locataire, proprietaire, contrat, paiement, ticket };
}

beforeAll(async () => {
  await startFinancialMongo();
  const fX = await createTenantFixture({ label: 'C210A X' });
  const fY = await createTenantFixture({ label: 'C210A Y' });
  S.X = fX.tenant; S.Y = fY.tenant;
  S.staffX = await makeUser('Collaborateur');
  await addTenantMember({ tenant: S.X, user: S.staffX, bootstrap: fX.bootstrap, businessRole: 'Admin' });
  S.staffY = await makeUser('Collaborateur');
  await addTenantMember({ tenant: S.Y, user: S.staffY, bootstrap: fY.bootstrap, businessRole: 'Admin' });
  S.A = await makeUser('Proprietaire');
  await addTenantMember({ tenant: S.X, user: S.A, bootstrap: fX.bootstrap, businessRole: 'Collaborateur' });
  S.B = await makeUser('Proprietaire');
  await addTenantMember({ tenant: S.Y, user: S.B, bootstrap: fY.bootstrap, businessRole: 'Collaborateur' });
  S.C = await makeUser('Proprietaire');
  // P1 : manager = staff X (le manager n'est jamais une provenance).
  await seedAsset('P1', S.A, null, { manager: S.staffX });
  await seedAsset('P2', S.B, null);
  await seedAsset('P3', S.A, S.X);
  await seedAsset('P4', S.B, S.Y);
  await seedAsset('P5', S.C, S.X);
  // P6 : bien de Y, manager = staff X.
  await seedAsset('P6', S.A, S.Y, { manager: S.staffX });
  await seedAsset('P7', S.C, null);
});
afterAll(stopFinancialMongo);

// Accès direct par ID — lecture + mutation pour chaque domaine GL.
const directReads = {
  RentalManagement: (k) => `/api/rental-management/${S[k].rental._id}`,
  Contrat: (k) => `/api/contrats/${S[k].contrat._id}`,
  RentalContrat: (k) => `/api/contrats/location/${S[k].contrat._id}`,
  Paiement: (k) => `/api/paiements/${S[k].paiement._id}`,
  RentalPaiement: (k) => `/api/paiements/location/${S[k].paiement._id}`,
  Notice: (k) => `/api/rental-lease-lifecycle/${S[k].contrat._id}/available-transitions`,
  Document: (k) => `/api/gestion-docs/contrat/${S[k].contrat._id}`,
  Maintenance: (k) => `/api/rental-maintenance?propertyId=${S[k].property._id}`,
  Locataire: (k) => `/api/locataires/${S[k].locataire._id}`,
  Proprietaire: (k) => `/api/proprietaires/${S[k].proprietaire._id}`,
};
const CROSS = [
  ['A · X → ressource Y', 'staffX', 'X', 'P4'],
  ['A · X → ressource Y (owner A membre de X)', 'staffX', 'X', 'P6'],
  ['B · X → tenant:null owner A (membre de X)', 'staffX', 'X', 'P1'],
  ['B · X → tenant:null owner B', 'staffX', 'X', 'P2'],
  ['C · Y → tenant:null owner B (membre de Y)', 'staffY', 'Y', 'P2'],
  ['C · Y → tenant:null owner A', 'staffY', 'Y', 'P1'],
  ['F · Y → ressource X (ID forgé)', 'staffY', 'Y', 'P3'],
  ['P0 · Y → tenant:null owner C indépendant', 'staffY', 'Y', 'P7'],
  ['P0 · X → tenant:null owner C indépendant', 'staffX', 'X', 'P7'],
];
const OWN = [
  ['D · X → tenant:X (owner A)', 'staffX', 'X', 'P3'],
  ['D · X → tenant:X (owner externe C)', 'staffX', 'X', 'P5'],
  ['E · Y → tenant:Y', 'staffY', 'Y', 'P4'],
  ['E · Y → tenant:Y (owner A membre de X)', 'staffY', 'Y', 'P6'],
];

describe('C2.10A LOT A — accès direct par ID (lecture)', () => {
  describe.each(Object.keys(directReads))('%s', (domain) => {
    test.each(CROSS)('%s → DENY', async (_label, actor, tenant, key) => {
      const res = await request(app).get(directReads[domain](key)).set(as(S[actor], S[tenant]));
      expect(DENIED).toContain(res.status);
    });
    test.each(OWN)('%s → ALLOW', async (_label, actor, tenant, key) => {
      const res = await request(app).get(directReads[domain](key)).set(as(S[actor], S[tenant]));
      expect(res.status).toBe(200);
    });
  });
});

describe('C2.10A LOT A — mutations par ID refusées hors scope, sans écriture', () => {
  test.each(CROSS)('%s', async (_label, actor, tenant, key) => {
    const h = as(S[actor], S[tenant]);
    const r = S[key];
    const results = await Promise.all([
      request(app).patch(`/api/rental-management/${r.rental._id}`).set(h).send({ notes: 'pwned' }),
      request(app).put(`/api/contrats/${r.contrat._id}`).set(h).send({ montantLoyer: 1 }),
      request(app).put(`/api/contrats/location/${r.contrat._id}`).set(h).send({ montantLoyer: 1 }),
      request(app).put(`/api/paiements/location/${r.paiement._id}`).set(h).send({ montant: 1 }),
      request(app).post(`/api/rental-lease-lifecycle/${r.contrat._id}/transition`).set(h).send({ to: 'preavis', comment: 'x' }),
      request(app).patch(`/api/rental-maintenance/${r.ticket._id}/assign`).set(h).send({ assignedToUserId: String(S[actor]._id) }),
      request(app).put(`/api/locataires/${r.locataire._id}`).set(h).send({ nom: 'pwned' }),
      request(app).post(`/api/locataires/${r.locataire._id}/invite`).set(h).send({}),
      request(app).put(`/api/proprietaires/${r.proprietaire._id}`).set(h).send({ nom: 'pwned' }),
    ]);
    results.forEach((res) => expect(DENIED).toContain(res.status));
    expect((await RentalManagement.findById(r.rental._id).lean()).notes).not.toBe('pwned');
    const contrat = await Contrat.findById(r.contrat._id).lean();
    expect(contrat.montantLoyer).toBe(300000);
    expect(contrat.statut).toBe('actif');
    expect((await Paiement.findById(r.paiement._id).lean()).montant).toBe(300000);
    expect((await RentalMaintenanceTicket.findById(r.ticket._id).lean()).assignedTo).toBeFalsy();
    expect((await Locataire.findById(r.locataire._id).lean()).nom).toBe(`Loc${key}`);
    expect((await Proprietaire.findById(r.proprietaire._id).lean()).nom).toBe(`Prop${key}`);
    expect(await TenantLinkRequest.countDocuments({ locataire: r.locataire._id })).toBe(0);
  });
});

describe('C2.10A LOT A — provenance Locataire/Proprietaire posée par le serveur', () => {
  test.each([
    ['locataires', Locataire, { nom: 'Neuf', prenom: 'L', telephone: '060000001' }],
    ['proprietaires', Proprietaire, { nom: 'Neuf', prenom: 'P', telephone: '050000001' }],
  ])('/api/%s : tenant forgé ignoré, fiche sans bail visible du seul tenant créateur', async (path, Model, body) => {
    const created = await request(app).post(`/api/${path}`).set(as(S.staffX, S.X)).send({ ...body, tenant: String(S.Y._id) });
    expect(created.status).toBe(201);
    const id = created.body.data[path === 'locataires' ? 'locataire' : 'proprietaire']._id;
    expect(String((await Model.findById(id).lean()).tenant)).toBe(String(S.X._id));
    expect((await request(app).get(`/api/${path}/${id}`).set(as(S.staffX, S.X))).status).toBe(200);
    expect(DENIED).toContain((await request(app).get(`/api/${path}/${id}`).set(as(S.staffY, S.Y))).status);
    await request(app).put(`/api/${path}/${id}`).set(as(S.staffX, S.X)).send({ tenant: String(S.Y._id) });
    expect(String((await Model.findById(id).lean()).tenant)).toBe(String(S.X._id));
  });

  test('fiche historique sans bail ni provenance → refusée à tout staff tenant (fail-closed)', async () => {
    const legacy = await Locataire.create({ nom: 'Legacy', prenom: 'L', telephone: '060000009' });
    expect(DENIED).toContain((await request(app).get(`/api/locataires/${legacy._id}`).set(as(S.staffX, S.X))).status);
    expect(DENIED).toContain((await request(app).get(`/api/locataires/${legacy._id}`).set(as(S.staffY, S.Y))).status);
  });
});

// LOT B — la population d'une liste tenant = biens dont Property.tenant = T.
const X_YES = ['P3', 'P5'];
const X_NO = ['P1', 'P2', 'P4', 'P6', 'P7'];
const Y_YES = ['P4', 'P6'];
const Y_NO = ['P1', 'P2', 'P3', 'P5', 'P7'];
const LISTS = [
  ['RentalManagement', '/api/rental-management?limit=100', 'rental'],
  ['Contrat', '/api/contrats', 'contrat'],
  ['RentalContrat', '/api/contrats/location', 'contrat'],
  ['Paiement', '/api/paiements', 'paiement'],
  ['RentalPaiement', '/api/paiements/location', 'paiement'],
  ['Locataire', '/api/locataires', 'locataire'],
  ['LocataireDossiers', '/api/locataires/dossiers', 'locataire'],
  ['Proprietaire', '/api/proprietaires', 'proprietaire'],
  ['Maintenance', '/api/rental-maintenance', 'ticket'],
];

describe('C2.10A LOT B — listes organisationnelles = Property.tenant', () => {
  describe.each(LISTS)('%s', (_name, url, entity) => {
    test('tenant X : P3 + P5 présents ; P1, P2, P4, P6, P7 absents', async () => {
      const res = await request(app).get(url).set(as(S.staffX, S.X));
      expect(res.status).toBe(200);
      const found = ids(res.body);
      X_YES.forEach((k) => expect([k, found.has(String(S[k][entity]._id))]).toEqual([k, true]));
      X_NO.forEach((k) => expect([k, found.has(String(S[k][entity]._id))]).toEqual([k, false]));
    });
    test('tenant Y : P4 + P6 présents ; P1, P2, P3, P5, P7 absents', async () => {
      const res = await request(app).get(url).set(as(S.staffY, S.Y));
      expect(res.status).toBe(200);
      const found = ids(res.body);
      Y_YES.forEach((k) => expect([k, found.has(String(S[k][entity]._id))]).toEqual([k, true]));
      Y_NO.forEach((k) => expect([k, found.has(String(S[k][entity]._id))]).toEqual([k, false]));
    });
  });
});

// LOT C — centre de régularisation (baux historiques sans bien) : un dossier
// n'appartient à T que par provenance explicite (fiche Proprietaire.tenant),
// jamais via l'OrgMembership de Proprietaire.user ni par défaut (fail-open).
describe('C2.10A LOT C — centre de régularisation', () => {
  const orphanLease = async (proprietaire) => Contrat.create({
    type: 'location', statut: 'actif', bien: null, proprietaire: proprietaire._id,
    montantLoyer: 90000, villeBien: 'Brazzaville', adresseBien: 'Adresse libre',
  });
  const caseIds = async (actor, tenant) => {
    const res = await request(app).get('/api/rental-contract-regularization').set(as(S[actor], S[tenant]));
    expect(res.status).toBe(200);
    return ids(res.body);
  };

  test('fiche liée à A (membre de X) sans provenance → visible dans aucun tenant', async () => {
    const lease = await orphanLease(await Proprietaire.create({ nom: 'RegA', prenom: 'O', telephone: '051', user: S.A._id }));
    expect((await caseIds('staffX', 'X')).has(String(lease._id))).toBe(false);
    expect((await caseIds('staffY', 'Y')).has(String(lease._id))).toBe(false);
  });

  test('fiche sans compte ni provenance → plus ouverte à tous les tenants', async () => {
    const lease = await orphanLease(await Proprietaire.create({ nom: 'RegNone', prenom: 'O', telephone: '052' }));
    expect((await caseIds('staffX', 'X')).has(String(lease._id))).toBe(false);
    expect((await caseIds('staffY', 'Y')).has(String(lease._id))).toBe(false);
    const forged = await request(app).post(`/api/rental-contract-regularization/${lease._id}/decision`)
      .set(as(S.staffY, S.Y)).send({ action: 'flag_anomaly', reason: 'Tentative hors scope' });
    expect(forged.status).toBeGreaterThanOrEqual(400);
  });

  test('fiche de provenance X → visible de X uniquement', async () => {
    const lease = await orphanLease(await Proprietaire.create({ nom: 'RegX', prenom: 'O', telephone: '053', tenant: S.X._id }));
    expect((await caseIds('staffX', 'X')).has(String(lease._id))).toBe(true);
    expect((await caseIds('staffY', 'Y')).has(String(lease._id))).toBe(false);
  });
});

// LOT C — activation en gestion locative : seul un bien Property.tenant = T
// peut être activé (ou proposé) dans T.
describe('C2.10A LOT C — onboarding / activation', () => {
  // activateExisting exige une fiche Proprietaire liée au compte owner.
  const bareProperty = async (owner, tenant) => {
    if (!await Proprietaire.exists({ user: owner._id })) {
      await Proprietaire.create({ nom: `Fiche ${owner.name}`, prenom: 'O', telephone: `07${++seq}`, user: owner._id });
    }
    return Property.create({
    title: `C210A bare ${++seq}`, description: 'Description suffisamment longue pour la validation.',
    pole: 'Altimmo', type: 'Appartement', status: 'location', price: 150000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' }, images: ['https://example.test/i.jpg'],
    surface: 50, statusAdmin: 'Validée', availability: 'Disponible', latitude: -4.27, longitude: 15.27,
    owner: owner._id, tenant: tenant?._id || null,
    });
  };

  test.each([
    ['tenant:null owner externe', () => S.C, () => null],
    ['tenant:null owner A membre de X', () => S.A, () => null],
    ['tenant Y', () => S.B, () => S.Y],
  ])('X ne peut ni activer (onboarding/create) un bien %s', async (_label, owner, tenant) => {
    const p1 = await bareProperty(owner(), tenant());
    const p2 = await bareProperty(owner(), tenant());
    const onboard = await request(app).post('/api/rental-management/onboarding').set(as(S.staffX, S.X)).send({ mode: 'existing', property: String(p1._id) });
    const create = await request(app).post('/api/rental-management').set(as(S.staffX, S.X)).send({ property: String(p2._id) });
    expect(DENIED).toContain(onboard.status);
    expect(DENIED).toContain(create.status);
    expect(await RentalManagement.countDocuments({ property: { $in: [p1._id, p2._id] }, managementActivated: true })).toBe(0);
  });

  test('X peut activer un bien tenant:X dont l’owner externe n’est pas membre', async () => {
    const p = await bareProperty(S.C, S.X);
    const res = await request(app).post('/api/rental-management/onboarding').set(as(S.staffX, S.X)).send({ mode: 'existing', property: String(p._id) });
    expect(res.status).toBe(201);
  });

  test('options d’onboarding de X : aucun bien ni fiche hors de X', async () => {
    const res = await request(app).get('/api/rental-management/onboarding/options').set(as(S.staffX, S.X));
    expect(res.status).toBe(200);
    const found = ids(res.body);
    ['P1', 'P2', 'P4', 'P6', 'P7'].forEach((k) => expect([k, found.has(String(S[k].property._id))]).toEqual([k, false]));
  });
});

// LOT C — agrégats : même population canonique que les listes.
describe('C2.10A LOT C — agrégats GL', () => {
  test('tableau de bord cycle de vie des baux : uniquement les baux/préavis du tenant', async () => {
    const soon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    await Contrat.updateMany({ _id: { $in: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'].map((k) => S[k].contrat._id) } }, { $set: { dateFinBail: soon } });
    await RentalManagement.updateMany({}, { $set: { occupancyStatus: 'sortie_programmee', noticeAcknowledgedAt: null } });
    const res = await request(app).get('/api/rental-lease-lifecycle/dashboard').set(as(S.staffX, S.X));
    expect(res.status).toBe(200);
    const found = ids(res.body);
    X_YES.forEach((k) => {
      expect([k, found.has(String(S[k].contrat._id))]).toEqual([k, true]);
      expect([k, found.has(String(S[k].rental._id))]).toEqual([k, true]);
    });
    X_NO.forEach((k) => {
      expect([k, found.has(String(S[k].contrat._id))]).toEqual([k, false]);
      expect([k, found.has(String(S[k].rental._id))]).toEqual([k, false]);
    });
  });

  test('stats gestion locative : total = population de la liste (X et Y)', async () => {
    for (const [actor, tenant] of [['staffX', 'X'], ['staffY', 'Y']]) {
      const list = await request(app).get('/api/rental-management?limit=100').set(as(S[actor], S[tenant]));
      const stats = await request(app).get('/api/rental-management/stats').set(as(S[actor], S[tenant]));
      expect(stats.status).toBe(200);
      const total = stats.body.data?.total ?? stats.body.data?.stats?.total;
      expect(total).toBe(list.body.data.total);
    }
  });

  test('stats paiements locatifs : impayés = paiements de la liste (X)', async () => {
    const list = await request(app).get('/api/paiements/location').set(as(S.staffX, S.X));
    const stats = await request(app).get('/api/paiements/location/stats').set(as(S.staffX, S.X));
    expect(stats.status).toBe(200);
    const rows = list.body.data?.paiements || list.body.paiements || list.body.data || [];
    expect(JSON.stringify(stats.body)).toMatch(new RegExp(`"nbTotal":${Array.isArray(rows) ? rows.length : -1}\\b`));
  });
});

describe('C2.10A — heuristiques supprimées du scope GL', () => {
  test('§9 tenant unique actif : un bien tenant:null d’un owner sans membership reste INDIVIDUAL et invisible', async () => {
    await PlatformTenant.updateOne({ _id: S.Y._id }, { $set: { status: 'suspended' } });
    try {
      expect(await PlatformTenant.countDocuments({ status: { $in: ['trial', 'active'] } })).toBe(1);
      const h = as(S.staffX, S.X);
      const lists = await Promise.all([
        request(app).get('/api/rental-management?limit=100').set(h),
        request(app).get('/api/rental-contract-regularization').set(h),
        request(app).get('/api/rental-management/onboarding/options').set(h),
      ]);
      lists.forEach((res) => {
        expect(res.status).toBe(200);
        expect(ids(res.body).has(String(S.P7.rental._id))).toBe(false);
        expect(ids(res.body).has(String(S.P7.property._id))).toBe(false);
      });
      expect(DENIED).toContain((await request(app).get(`/api/rental-management/${S.P7.rental._id}`).set(h)).status);
    } finally {
      await PlatformTenant.updateOne({ _id: S.Y._id }, { $set: { status: 'active' } });
    }
  });

  test('§10 manager n’est pas une provenance : tenant:null + manager staff X → refusé à X', async () => {
    expect(String(S.P1.rental.manager)).toBe(String(S.staffX._id));
    expect(DENIED).toContain((await request(app).get(`/api/rental-management/${S.P1.rental._id}`).set(as(S.staffX, S.X))).status);
  });

  test('§10 manager n’est pas une provenance : tenant:Y + manager staff X → refusé à X, accessible à Y', async () => {
    expect(String(S.P6.rental.manager)).toBe(String(S.staffX._id));
    expect(DENIED).toContain((await request(app).get(`/api/rental-management/${S.P6.rental._id}`).set(as(S.staffX, S.X))).status);
    expect((await request(app).get(`/api/rental-management/${S.P6.rental._id}`).set(as(S.staffY, S.Y))).status).toBe(200);
  });

  test('§19 KPI Home tenant « baux actifs » = baux des biens Property.tenant = T', async () => {
    const { getDashboardKpis } = require('../services/dashboardKpiQueryService');
    const kpis = await getDashboardKpis({ scopeUserIds: [S.staffX._id, S.A._id], tenantId: S.X._id });
    const expected = await Contrat.countDocuments({ type: 'location', statut: 'actif', bien: { $in: [S.P3.property._id, S.P5.property._id] } });
    expect(kpis.RentalActiveContracts).toBe(expected);
    expect(expected).toBeGreaterThan(0);
  });
});
