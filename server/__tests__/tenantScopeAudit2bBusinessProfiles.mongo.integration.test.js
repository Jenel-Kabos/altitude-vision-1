// TENANT-SCOPE-AUDIT-2B — Phase C (User Business Profiles).
// `userBusinessProfileRoutes.js` monte SEULEMENT `auth.protect` (pas
// `requireTenantScope`) et son garde `selfOrStaff` court-circuite
// ENTIÈREMENT la vérification tenant quand `isSelf` (voir routes/
// userBusinessProfileRoutes.js:38-44) : l'auto-lecture ne dépend jamais
// d'OrgMembership/PlatformTenant. `userBusinessProfileService.
// deriveProfilesFromExistingData` dérive purement par ownership
// (Property.owner, Hotel.manager, HotelStaffAssignment.user, Locataire.user)
// — aucun lookup OrgMembership/PlatformTenant dans tout le service.
//
// Seul le chemin STAFF regardant le profil d'un AUTRE utilisateur
// (`!isSelf`) passe par `assertTargetInActorTenant` → `assertResourceTenant`
// (STRICTE, resourceType 'User') — même famille de bug que
// HOTFIX-OWNER-CONTRACT-RESEND-1/documentController (AUDIT-2A), testée
// séparément ci-dessous.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const Hotel = require('../models/Hotel');

const userBusinessProfileRoutes = require('../routes/userBusinessProfileRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/user-business-profiles', userBusinessProfileRoutes);
app.use(errorHandler);

const bearer = (user) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
});

let seq = 0;
async function createUnaffiliatedUser(overrides = {}) {
  seq += 1;
  return User.create({
    name: 'Unaffiliated BizProfile User', email: `bizprofile-${Date.now()}-${seq}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true,
    ...overrides,
  });
}
async function createProperty(owner, statusOverride = {}) {
  seq += 1;
  return Property.create({
    title: `Villa BizProfile ${seq}`, description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Villa', status: 'vente', statusAdmin: 'Validée', isPublished: true,
    price: 300000, address: { street: 'Rue BP', city: 'Brazzaville', arrondissement: 'Centre' },
    latitude: -4.26, longitude: 15.24, images: ['https://placehold.co/1200x800/png?text=Test'],
    surface: 90, availability: 'Disponible', owner: owner._id,
    ...statusOverride,
  });
}
async function createHotel(manager) {
  seq += 1;
  return Hotel.create({ name: `Hotel BizProfile ${seq}`, manager: manager._id, createdBy: manager._id, publicationStatus: 'publie' });
}

beforeAll(async () => { await startFinancialMongo(); });
afterAll(async () => stopFinancialMongo());

describe('TENANT-SCOPE-AUDIT-2B — Phase C : self-service, sans OrgMembership, indépendant du tenant staff', () => {
  test('Proprietaire public-signup possédant un Property obtient "proprietaire_immobilier" en auto-lecture', async () => {
    const owner = await createUnaffiliatedUser();
    await createProperty(owner);
    const res = await request(app).get(`/api/user-business-profiles/${owner._id}`).set(bearer(owner));
    expect(res.status).toBe(200);
    expect(res.body.data.profiles).toContain('proprietaire_immobilier');
  });

  test('exploitant public-signup possédant un Hotel obtient "exploitant_etablissement" en auto-lecture', async () => {
    const manager = await createUnaffiliatedUser();
    await createHotel(manager);
    const res = await request(app).get(`/api/user-business-profiles/${manager._id}`).set(bearer(manager));
    expect(res.status).toBe(200);
    expect(res.body.data.profiles).toContain('exploitant_etablissement');
  });

  test('utilisateur multi-activité (Property + Hotel) obtient les deux profils', async () => {
    const user = await createUnaffiliatedUser();
    await createProperty(user);
    await createHotel(user);
    const res = await request(app).get(`/api/user-business-profiles/${user._id}`).set(bearer(user));
    expect(res.status).toBe(200);
    expect(res.body.data.profiles).toEqual(expect.arrayContaining(['proprietaire_immobilier', 'exploitant_etablissement']));
  });

  test('utilisateur public-signup sans aucune ressource obtient un tableau vide (pas de blocage, pas de profil fantôme)', async () => {
    const user = await createUnaffiliatedUser();
    const res = await request(app).get(`/api/user-business-profiles/${user._id}`).set(bearer(user));
    expect(res.status).toBe(200);
    expect(res.body.data.profiles).toEqual([]);
  });

  test('cross-owner : un utilisateur n’obtient JAMAIS de profil à cause d’une ressource d’un AUTRE owner', async () => {
    const userA = await createUnaffiliatedUser();
    const userB = await createUnaffiliatedUser();
    await createProperty(userB); // ressource appartient à B, jamais à A
    const res = await request(app).get(`/api/user-business-profiles/${userA._id}`).set(bearer(userA));
    expect(res.status).toBe(200);
    expect(res.body.data.profiles).toEqual([]);
  });
});

describe('TENANT-SCOPE-AUDIT-2B — Phase C : chemin STAFF (!isSelf) — correction confirmée', () => {
  test('Admin (tenant unique) peut désormais consulter le profil d’un Proprietaire public-signup sans OrgMembership', async () => {
    const fixture = await createTenantFixture({ label: 'ScopeAudit2bBizProfile Solo' });
    const owner = await createUnaffiliatedUser();
    await createProperty(owner);

    const res = await request(app).get(`/api/user-business-profiles/${owner._id}`).set(bearer(fixture.bootstrap));

    expect(res.status).toBe(200);
    expect(res.body.data.profiles).toContain('proprietaire_immobilier');
  });

  test('cross-tenant reste refusé : AdminA ne peut pas consulter le profil d’un utilisateur affilié au Tenant B', async () => {
    const fixtureA = await createTenantFixture({ label: 'ScopeAudit2bBizProfile CrossA' });
    const fixtureB = await createTenantFixture({ label: 'ScopeAudit2bBizProfile CrossB' });
    const ownerB = (await createTenantUser({ tenant: fixtureB.tenant, bootstrap: fixtureB.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    await createProperty(ownerB);

    const res = await request(app).get(`/api/user-business-profiles/${ownerB._id}`).set(bearer(fixtureA.bootstrap));
    expect(res.status).toBe(404);
  });

  test('non-régression : Admin consultant le profil d’un utilisateur AFFILIÉ (OrgMembership réel) fonctionne toujours', async () => {
    const fixture = await createTenantFixture({ label: 'ScopeAudit2bBizProfile IAM' });
    const owner = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    await createProperty(owner);

    const res = await request(app).get(`/api/user-business-profiles/${owner._id}`).set(bearer(fixture.bootstrap));
    expect(res.status).toBe(200);
    expect(res.body.data.profiles).toContain('proprietaire_immobilier');
  });

  test('non-régression : Collaborateur/rôle hors ROLES_DOCS reste refusé (403) sur le profil d’un tiers', async () => {
    const fixture = await createTenantFixture({ label: 'ScopeAudit2bBizProfile IAM2' });
    const owner = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    const client = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Client' } })).user;
    const res = await request(app).get(`/api/user-business-profiles/${owner._id}`).set(bearer(client));
    expect(res.status).toBe(403);
  });
});
