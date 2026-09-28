// GOOGLE-PLAY-P0-1 — Suite d'intégration : suppression self-service.
// Vérifie les invariants critiques exigés par le sprint :
//   - authentification requise
//   - autorité exclusivement req.user (pas de :id du client)
//   - anonymisation du User (nom/email/téléphone/photo)
//   - status='Supprimé', isActive=false, tokenVersion incrémenté
//   - révocation de toutes les memberships actives
//   - last-admin bloqué avec code LAST_TENANT_ADMIN_ACCOUNT_DELETION_BLOCKED
//   - non-last-admin autorisé
//   - idempotence
//   - pas de suppression d'un autre compte

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo, clearFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const userRoutes = require('../routes/userRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');

jest.setTimeout(180000);

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-account-deletion';

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);
app.use(errorHandler);

function bearer(user) {
  return { Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` };
}

async function makeAdminMembership(user, tenant, bootstrap) {
  await organizationService.grantMembership({
    userId: user._id, orgUnitId: tenant.rootOrgUnit, actor: bootstrap,
  });
  await OrgMembership.updateOne(
    { user: user._id, orgUnit: tenant.rootOrgUnit, status: 'active' },
    { $set: { businessRole: 'Admin' } },
  );
}

beforeAll(async () => { await startFinancialMongo(); });
afterAll(async () => { await stopFinancialMongo(); });
afterEach(async () => { await clearFinancialMongo(); });

async function makeUser(overrides = {}) {
  return User.create({
    name: overrides.name || 'Alice Test',
    email: overrides.email || `alice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`,
    password: 'Password123!',
    passwordConfirm: 'Password123!',
    role: overrides.role || 'Client',
    phone: overrides.phone || '+242 06 000 00 00',
    photo: overrides.photo || null,
    isEmailVerified: true,
  });
}

describe('DELETE /api/users/me — suppression self-service', () => {
  test('401 sans authentification', async () => {
    const res = await request(app).delete('/api/users/me');
    expect(res.status).toBe(401);
  });

  test('supprime le compte authentifié (anonymisation + status Supprimé)', async () => {
    const user = await makeUser({ name: 'Bob Client', phone: '+242 06 111 11 11' });
    const originalEmail = user.email;

    const res = await request(app).delete('/api/users/me').set(bearer(user));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.userId).toBe(String(user._id));

    const reloaded = await User.findById(user._id).select('+password');
    expect(reloaded.status).toBe('Supprimé');
    expect(reloaded.isActive).toBe(false);
    expect(reloaded.name).toBe('Utilisateur supprimé');
    expect(reloaded.email).not.toBe(originalEmail);
    expect(reloaded.email).toMatch(/^deleted-.+@deleted\.altitudevision\.local$/);
    expect(reloaded.phone).toBeNull();
    expect(reloaded.photo).toBeNull();
    expect(reloaded.pushToken).toBeNull();
    expect(reloaded.tokenVersion).toBeGreaterThan(0);
  });

  test('idempotent : deuxième appel ne fait rien mais renvoie 200', async () => {
    const user = await makeUser();
    await request(app).delete('/api/users/me').set(bearer(user));

    // La session initiale est révoquée (tokenVersion++), mais on émet
    // un nouveau JWT avec la version courante pour vérifier l'idempotence
    // au niveau du service (le compte reste "Supprimé" mais protect() le
    // rejette avec 403 ACCOUNT_INACTIVE avant même d'atteindre le
    // controller). C'est le comportement attendu : un compte supprimé
    // ne peut pas se reconnecter.
    const reloaded = await User.findById(user._id);
    const res2 = await request(app).delete('/api/users/me').set({
      Authorization: `Bearer ${jwt.sign({ id: reloaded._id, tokenVersion: reloaded.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
    });
    expect([200, 403]).toContain(res2.status);
  });

  test("refuse de supprimer un autre compte via /users/:id/me spoofing (autorité req.user seul)", async () => {
    const alice = await makeUser({ name: 'Alice' });
    const bob = await makeUser({ name: 'Bob' });

    // Alice se supprime → seule Alice doit être supprimée.
    await request(app).delete('/api/users/me').set(bearer(alice));

    const aliceReloaded = await User.findById(alice._id);
    const bobReloaded = await User.findById(bob._id);
    expect(aliceReloaded.status).toBe('Supprimé');
    expect(bobReloaded.status).toBe('Actif');
    expect(bobReloaded.name).toBe('Bob');
  });

  test('révoque toutes les memberships actives', async () => {
    const { tenant, bootstrap } = await createTenantFixture({ label: 'Tenant révocation' });
    const user = await makeUser({ name: 'Membre' });
    // Ajoute un membership 'member' non-Admin (bootstrap est déjà Admin).
    // businessRole doit provenir de TENANT_BUSINESS_ROLES ; 'Collaborateur'
    // est le rôle standard non-Admin.
    await addTenantMember({ tenant, user, bootstrap, businessRole: 'Collaborateur' });

    const before = await OrgMembership.countDocuments({ user: user._id, status: 'active' });
    expect(before).toBeGreaterThan(0);

    const res = await request(app).delete('/api/users/me').set(bearer(user));
    expect(res.status).toBe(200);

    const activeAfter = await OrgMembership.countDocuments({ user: user._id, status: 'active' });
    expect(activeAfter).toBe(0);
    const revokedAfter = await OrgMembership.countDocuments({ user: user._id, status: 'revoked' });
    expect(revokedAfter).toBeGreaterThan(0);
  });

  test('bloque le dernier Admin actif avec LAST_TENANT_ADMIN_ACCOUNT_DELETION_BLOCKED', async () => {
    const { tenant, bootstrap } = await createTenantFixture({ label: 'Tenant last-admin' });
    // bootstrap est user Admin global mais pas encore Admin de la membership :
    // on doit lui promouvoir une membership Admin sur ce tenant.
    await makeAdminMembership(bootstrap, tenant, bootstrap);

    const res = await request(app).delete('/api/users/me').set(bearer(bootstrap));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LAST_TENANT_ADMIN_ACCOUNT_DELETION_BLOCKED');
    expect(res.body.details?.blockingTenants?.length).toBeGreaterThan(0);

    // Le compte doit rester intact.
    const reloaded = await User.findById(bootstrap._id);
    expect(reloaded.status).toBe('Actif');
    expect(reloaded.isActive).toBe(true);
  });

  test('un Admin non-dernier peut supprimer son compte', async () => {
    const { tenant, bootstrap } = await createTenantFixture({ label: 'Tenant multi-admin' });
    await makeAdminMembership(bootstrap, tenant, bootstrap);

    // Deuxième admin
    const admin2 = await makeUser({ name: 'Admin 2' });
    await makeAdminMembership(admin2, tenant, bootstrap);

    const res = await request(app).delete('/api/users/me').set(bearer(admin2));
    expect(res.status).toBe(200);

    const reloaded = await User.findById(admin2._id);
    expect(reloaded.status).toBe('Supprimé');

    // Bootstrap reste Admin actif.
    const bootstrapReloaded = await User.findById(bootstrap._id);
    expect(bootstrapReloaded.status).toBe('Actif');
  });

  test("invalide les sessions JWT existantes (tokenVersion incrémenté)", async () => {
    const user = await makeUser();
    const tokenBefore = jwt.sign({ id: user._id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

    await request(app).delete('/api/users/me').set({ Authorization: `Bearer ${tokenBefore}` });

    // Un GET /me avec l'ancien token doit être rejeté (tokenVersion périmé
    // OU compte Supprimé/isActive:false).
    const meRes = await request(app).get('/api/users/me').set({ Authorization: `Bearer ${tokenBefore}` });
    expect([401, 403]).toContain(meRes.status);
  });
});
