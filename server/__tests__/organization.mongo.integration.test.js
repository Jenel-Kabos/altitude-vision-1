// ORGANIZATION-1 — couche organisationnelle générique : hiérarchie flexible
// (OrgUnit auto-référencé), appartenances multiples (OrgMembership), scope
// bulk sans boucle, intégration additive au Reporting (filtre par unité
// sans recalcul de KPI).
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const OrgUnit = require('../models/OrgUnit');
const OrgMembership = require('../models/OrgMembership');
const {
  createOrgUnit, archiveOrgUnit, getOrgTree, grantMembership, suspendMembership, revokeMembership,
  getEffectiveMemberships, getScopeUserIds, OrganizationError,
} = require('../services/organizationService');
const { getExecutiveReport, getDomainReport } = require('../services/reporting/reportingService');
const organizationRoutes = require('../routes/organizationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/organization', organizationRoutes);
app.use(errorHandler);

const signToken = (userId) => jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Test User', email: `org${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('organizationService — hiérarchie flexible (Phase 2/3/4)', () => {
  test('une organisation racine ne peut pas avoir de parent', async () => {
    const admin = await makeUser({ role: 'Admin' });
    await expect(createOrgUnit({ name: 'Altitude Vision', type: 'organization', parentId: 'aaaaaaaaaaaaaaaaaaaaaaaa', actor: admin }))
      .rejects.toBeInstanceOf(OrganizationError);
  });

  test('toute unité non-racine exige un parent existant et actif', async () => {
    const admin = await makeUser({ role: 'Admin' });
    await expect(createOrgUnit({ name: 'Filiale', type: 'business_unit', actor: admin })).rejects.toMatchObject({ code: 'ORG_UNIT_PARENT_REQUIRED' });
    await expect(createOrgUnit({ name: 'Filiale', type: 'business_unit', parentId: 'aaaaaaaaaaaaaaaaaaaaaaaa', actor: admin })).rejects.toMatchObject({ code: 'ORG_UNIT_PARENT_NOT_FOUND' });
  });

  test('la profondeur est flexible : organisation → filiale → département → équipe, chemin matérialisé cohérent', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const org = await createOrgUnit({ name: 'Altitude Vision', type: 'organization', actor: admin });
    const bu = await createOrgUnit({ name: 'Altimmo', type: 'business_unit', parentId: org._id, actor: admin });
    const dept = await createOrgUnit({ name: 'Gestion Locative', type: 'department', parentId: bu._id, actor: admin });
    const team = await createOrgUnit({ name: 'Équipe Nord', type: 'team', parentId: dept._id, actor: admin });

    expect(team.path).toBe(`/${org._id}/${bu._id}/${dept._id}/`);
    expect(team.ancestors.map(String)).toEqual([String(org._id), String(bu._id), String(dept._id)]);

    const tree = await getOrgTree(org._id);
    expect(tree.children[0].children[0].children[0].name).toBe('Équipe Nord');
  });

  test('un niveau supplémentaire (ex: "brand") ne nécessite aucune migration — juste une nouvelle valeur de type acceptée par le même modèle', async () => {
    // Démontre la flexibilité : le schéma n'impose aucun ordre de type,
    // seulement qu'un parent actif existe.
    const admin = await makeUser({ role: 'Admin' });
    const org = await createOrgUnit({ name: 'Groupe', type: 'organization', actor: admin });
    const establishment = await createOrgUnit({ name: 'Hôtel X', type: 'establishment', parentId: org._id, actor: admin });
    const team = await createOrgUnit({ name: 'Réception', type: 'team', parentId: establishment._id, actor: admin });
    expect(team.path).toBe(`/${org._id}/${establishment._id}/`);
  });

  test('archiveOrgUnit refuse tant que des enfants actifs existent, jamais de suppression physique', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const org = await createOrgUnit({ name: 'Org', type: 'organization', actor: admin });
    await createOrgUnit({ name: 'BU', type: 'business_unit', parentId: org._id, actor: admin });
    await expect(archiveOrgUnit(org._id, { actor: admin })).rejects.toMatchObject({ code: 'ORG_UNIT_HAS_ACTIVE_CHILDREN' });
    expect((await OrgUnit.findById(org._id)).status).toBe('active');
  });

  test('linkedEstablishment relie une unité à un Hotel existant, sans dupliquer Hotel.manager', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const hotel = await Hotel.create({ name: 'Hotel Org Test', manager: admin._id, createdBy: admin._id });
    const org = await createOrgUnit({ name: 'Org', type: 'organization', actor: admin });
    const establishment = await createOrgUnit({
      name: 'Hotel Org Test', type: 'establishment', parentId: org._id, actor: admin,
      linkedEstablishment: { establishmentType: 'Hotel', establishmentId: hotel._id },
    });
    expect(establishment.linkedEstablishment.establishmentType).toBe('Hotel');
    expect(String(establishment.linkedEstablishment.establishmentId)).toBe(String(hotel._id));
    // Hotel.manager reste l'unique source d'autorité pour l'hôtel lui-même.
    expect(String((await Hotel.findById(hotel._id)).manager)).toBe(String(admin._id));
  });
});

describe('organizationService — appartenances multiples (Phase 5)', () => {
  test('un utilisateur peut appartenir à plusieurs unités simultanément, avec des rôles différents', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const employee = await makeUser();
    const org = await createOrgUnit({ name: 'Org', type: 'organization', actor: admin });
    const teamA = await createOrgUnit({ name: 'Équipe A', type: 'team', parentId: org._id, actor: admin });
    const teamB = await createOrgUnit({ name: 'Équipe B', type: 'team', parentId: org._id, actor: admin });

    await grantMembership({ userId: employee._id, orgUnitId: teamA._id, roleInUnit: 'member', actor: admin });
    await grantMembership({ userId: employee._id, orgUnitId: teamB._id, roleInUnit: 'lead', actor: admin });

    const memberships = await getEffectiveMemberships(employee._id);
    expect(memberships).toHaveLength(2);
    expect(memberships.map((m) => m.roleInUnit).sort()).toEqual(['lead', 'member']);
  });

  test('grantMembership est idempotent (jamais de doublon) et réactive une appartenance révoquée', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const employee = await makeUser();
    const org = await createOrgUnit({ name: 'Org', type: 'organization', actor: admin });
    const first = await grantMembership({ userId: employee._id, orgUnitId: org._id, actor: admin });
    const second = await grantMembership({ userId: employee._id, orgUnitId: org._id, actor: admin });
    expect(String(first._id)).toBe(String(second._id));
    expect(await OrgMembership.countDocuments({ user: employee._id, orgUnit: org._id })).toBe(1);

    await revokeMembership({ membershipId: first._id, actor: admin, reason: 'Test' });
    const reactivated = await grantMembership({ userId: employee._id, orgUnitId: org._id, actor: admin });
    expect(reactivated.status).toBe('active');
    expect(await OrgMembership.countDocuments({ user: employee._id, orgUnit: org._id })).toBe(1);
  });

  test('suspend/revoke ne suppriment jamais le document', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const employee = await makeUser();
    const org = await createOrgUnit({ name: 'Org', type: 'organization', actor: admin });
    const membership = await grantMembership({ userId: employee._id, orgUnitId: org._id, actor: admin });
    await suspendMembership({ membershipId: membership._id, actor: admin, reason: 'Congé' });
    expect((await OrgMembership.findById(membership._id)).status).toBe('suspended');
    await revokeMembership({ membershipId: membership._id, actor: admin, reason: 'Départ' });
    expect(await OrgMembership.countDocuments({ _id: membership._id })).toBe(1);
    expect((await OrgMembership.findById(membership._id)).status).toBe('revoked');
  });

  test('ne casse jamais USER-ARCH-1 : getEffectiveProfiles reste indépendant de OrgMembership', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const employee = await makeUser({ role: 'Proprietaire' });
    const org = await createOrgUnit({ name: 'Org', type: 'organization', actor: admin });
    await grantMembership({ userId: employee._id, orgUnitId: org._id, actor: admin });
    const { getEffectiveProfiles } = require('../services/userBusinessProfileService');
    // Aucune UserBusinessProfile stockée/dérivée pour cet utilisateur ici —
    // OrgMembership ne doit jamais en créer une implicitement.
    expect(await getEffectiveProfiles(employee._id)).toEqual([]);
  });
});

describe('organizationService — scope bulk (Phase 6, sans N+1)', () => {
  test('getScopeUserIds résout les membres directs ET des descendants en requêtes bornées', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const memberOrg = await makeUser();
    const memberTeam = await makeUser();
    const outsider = await makeUser();
    const org = await createOrgUnit({ name: 'Org', type: 'organization', actor: admin });
    const dept = await createOrgUnit({ name: 'Dept', type: 'department', parentId: org._id, actor: admin });
    const team = await createOrgUnit({ name: 'Team', type: 'team', parentId: dept._id, actor: admin });

    await grantMembership({ userId: memberOrg._id, orgUnitId: org._id, actor: admin });
    await grantMembership({ userId: memberTeam._id, orgUnitId: team._id, actor: admin });

    const scope = await getScopeUserIds(org._id);
    expect(scope.has(String(memberOrg._id))).toBe(true);
    expect(scope.has(String(memberTeam._id))).toBe(true); // descendant inclus
    expect(scope.has(String(outsider._id))).toBe(false);

    const teamOnlyScope = await getScopeUserIds(team._id, { includeDescendants: false });
    expect(teamOnlyScope.has(String(memberOrg._id))).toBe(false);
    expect(teamOnlyScope.has(String(memberTeam._id))).toBe(true);
  });
});

describe('reportingService — intégration ORGANIZATION-1 (Phase 7/9, additive)', () => {
  test('sans orgUnitId, les domaines non filtrables renvoient orgScopeSupported:false — comportement REPORTING-1 inchangé', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const report = await getExecutiveReport({ user: admin });
    expect(report.domains.immobilier.data.orgScopeSupported).toBe(false);
    expect(report.domains.location.data.orgScopeSupported).toBe(false);
    expect(report.domains.finance.data.orgScopeSupported).toBe(false);
    // CRM/Hôtel déclarent la CAPACITÉ de filtrage (true) même sans scope
    // demandé — comme `periodSupported` en REPORTING-1, un indicateur de
    // capacité, pas "un filtre a été appliqué cette fois".
    expect(report.domains.crm.data.orgScopeSupported).toBe(true);
  });

  test('avec orgUnitId, le pipeline CRM est filtré par assignedTo sans recalculer les KPI', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const outsider = await makeUser({ role: 'Admin' });
    const org = await createOrgUnit({ name: 'Org', type: 'organization', actor: admin });
    await grantMembership({ userId: admin._id, orgUnitId: org._id, actor: admin });

    const CrmCustomer = require('../models/CrmCustomer');
    const { createOpportunity } = require('../services/crmService');
    const customer = await CrmCustomer.create({ displayName: 'Client Org Test', identityKeys: ['source:Test:org-scope'], sourceRefs: [{ entityType: 'User', entityId: new mongoose.Types.ObjectId(), source: 'test' }] });
    await createOpportunity(customer._id, { title: 'Deal dans le scope', pole: 'Altimmo', assignedTo: admin._id }, admin._id);
    await createOpportunity(customer._id, { title: 'Deal hors scope', pole: 'Altimmo', assignedTo: outsider._id }, outsider._id);

    const scoped = await getDomainReport('crm', { orgUnitId: org._id });
    expect(scoped.orgScopeSupported).toBe(true);
    expect(scoped.pipeline.some((o) => o.title === 'Deal dans le scope')).toBe(true);
    expect(scoped.pipeline.some((o) => o.title === 'Deal hors scope')).toBe(false);

    const unscoped = await getDomainReport('crm', {});
    expect(unscoped.pipeline.some((o) => o.title === 'Deal hors scope')).toBe(true); // KPI globaux inchangés sans scope
  });

  test('un orgUnitId lié à un hôtel scope le détail financier hôtelier, jamais un calcul RevPAR/ADR approximé', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const hotel = await Hotel.create({ name: 'Hotel Reporting Org', manager: admin._id, createdBy: admin._id });
    const org = await createOrgUnit({ name: 'Org', type: 'organization', actor: admin });
    const establishment = await createOrgUnit({
      name: 'Hotel Reporting Org', type: 'establishment', parentId: org._id, actor: admin,
      linkedEstablishment: { establishmentType: 'Hotel', establishmentId: hotel._id },
    });
    const report = await getDomainReport('hotel', { user: admin, orgUnitId: establishment._id });
    expect(report.orgScopeSupported).toBe(true);
    expect(report.revPARMinor).toBeNull(); // jamais un ratio faux (chambres non scopées)
    expect(report.finance.scope.hotelId).toBe(String(hotel._id));
  });
});

describe('HTTP /api/organization — administration (Phase 8)', () => {
  test('401 sans authentification', async () => {
    const res = await request(app).get('/api/organization/units');
    expect(res.status).toBe(401);
  });

  test('403 pour un rôle non-staff en lecture, et non-Admin en écriture', async () => {
    const client = await makeUser();
    const secretaire = await makeUser({ role: 'Secretaire' });
    const readRes = await request(app).get('/api/organization/units').set('Authorization', `Bearer ${signToken(client._id)}`);
    expect(readRes.status).toBe(403);
    const writeRes = await request(app).post('/api/organization/units').set('Authorization', `Bearer ${signToken(secretaire._id)}`).send({ name: 'X', type: 'organization' });
    expect(writeRes.status).toBe(403);
  });

  test('un Admin peut créer une hiérarchie, consulter l\'arbre, affecter puis révoquer un membre', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const employee = await makeUser();
    const token = `Bearer ${signToken(admin._id)}`;

    const orgRes = await request(app).post('/api/organization/units').set('Authorization', token).send({ name: 'Altitude Vision', type: 'organization' });
    expect(orgRes.status).toBe(201);
    const orgId = orgRes.body.data.orgUnit.id;

    const buRes = await request(app).post('/api/organization/units').set('Authorization', token).send({ name: 'Altimmo', type: 'business_unit', parentId: orgId });
    expect(buRes.status).toBe(201);

    const treeRes = await request(app).get(`/api/organization/units/${orgId}/tree`).set('Authorization', token);
    expect(treeRes.status).toBe(200);
    expect(treeRes.body.data.tree.children).toHaveLength(1);

    const grantRes = await request(app).post('/api/organization/memberships').set('Authorization', token).send({ userId: employee._id, orgUnitId: orgId, roleInUnit: 'member' });
    expect(grantRes.status).toBe(201);
    const membershipId = grantRes.body.data.membership.id;

    const revokeRes = await request(app).post(`/api/organization/memberships/${membershipId}/revoke`).set('Authorization', token).send({ reason: 'Test' });
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.membership.status).toBe('revoked');
  });
});
