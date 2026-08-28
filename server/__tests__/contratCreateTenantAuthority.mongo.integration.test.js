// SECURITY-FINAL-CLOSURE-BLOCKERS-HOTFIX-1 (FCA1-01) — reproduction
// rouge->verte PERMANENTE : `POST /api/contrats` (contratController.create)
// n'appliquait aucune frontière tenant sur la `Property` cible
// (req.body.bien), contrairement aux routes `:id` du même fichier
// (protégées par router.param, TENANT-CERT-2). Un staff du Tenant A pouvait
// créer un bail (+ échéancier de paiements réel) sur une Property du
// Tenant B en fournissant simplement son ObjectId. Correctif : même
// frontière canonique que router.param('id', …) de ce fichier —
// resolveTenantForUser + assertResourceTenantOrUnattributed({resourceType:
// 'Property', ...}) — appliquée dans le contrôleur avant toute écriture.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const contratRoutes = require('../routes/contratRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/contrats', contratRoutes);
app.use(errorHandler);

const signToken = (id) => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const bearer = (user, tenantId) => ({
  Authorization: `Bearer ${signToken(user._id)}`,
  ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}),
});

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

let seq = 0;
async function buildTenant(label) {
  seq += 1;
  const admin = await User.create({ name: `Admin ${label}`, email: `fca101-admin-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  const owner = await User.create({ name: `Owner ${label}`, email: `fca101-owner-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  const tenant = await platformTenantService.createTenant({ name: `FCA101-${label}-${seq}-${Date.now()}`, actor: admin });
  await Promise.all([
    organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: owner._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
  ]);
  return { admin, owner, tenant };
}

async function buildProperty(owner, availability = 'Disponible') {
  return Property.create({
    title: `Villa FCA1-01 ${owner._id}`, description: 'Description suffisamment longue pour la validation du modele Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability, owner: owner._id,
  });
}

function createBody(property, montantLoyer = 150000) {
  return {
    bien: String(property._id), type: 'location',
    dateEntree: new Date().toISOString(), dateFinBail: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
    montantLoyer,
  };
}

describe('SECURITY-FINAL-CLOSURE-BLOCKERS-HOTFIX-1 (FCA1-01) — POST /api/contrats', () => {
  test('1. Admin A + Property A -> creation legitime OK', async () => {
    const a = await buildTenant('A1');
    const property = await buildProperty(a.owner);
    const res = await request(app).post('/api/contrats').set(bearer(a.admin, a.tenant._id)).send(createBody(property));
    expect(res.status).toBe(201);
    const created = await Contrat.findOne({ bien: property._id });
    expect(created).toBeTruthy();
  });

  test('2. Admin A + Property B -> refuse, zero Contrat, zero Paiement', async () => {
    const a = await buildTenant('A2');
    const b = await buildTenant('B2');
    const propertyB = await buildProperty(b.owner);
    const res = await request(app).post('/api/contrats').set(bearer(a.admin, a.tenant._id)).send(createBody(propertyB));
    expect(res.status).not.toBe(201);
    const created = await Contrat.findOne({ bien: propertyB._id });
    expect(created).toBeFalsy();
    const paiements = await Paiement.countDocuments({});
    expect(paiements).toBe(0);
    const propertyAfter = await Property.findById(propertyB._id);
    expect(propertyAfter.availability).toBe('Disponible');
  });

  test('3. Admin B + Property A -> refuse symetrique', async () => {
    const a = await buildTenant('A3');
    const b = await buildTenant('B3');
    const propertyA = await buildProperty(a.owner);
    const res = await request(app).post('/api/contrats').set(bearer(b.admin, b.tenant._id)).send(createBody(propertyA));
    expect(res.status).not.toBe(201);
    const created = await Contrat.findOne({ bien: propertyA._id });
    expect(created).toBeFalsy();
  });

  test('4. Staff sans tenant resolu -> refuse (fail-closed), pas de fallback global', async () => {
    const b = await buildTenant('B4');
    const propertyB = await buildProperty(b.owner);
    const orphanStaff = await User.create({ name: 'Orphan Admin', email: `fca101-orphan-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    const res = await request(app).post('/api/contrats').set(bearer(orphanStaff)).send(createBody(propertyB));
    expect(res.status).not.toBe(201);
    const created = await Contrat.findOne({ bien: propertyB._id });
    expect(created).toBeFalsy();
  });

  test('5. PlatformOperator global -> peut creer sur n\'importe quel tenant (contrat historique)', async () => {
    const a = await buildTenant('A5');
    const propertyA = await buildProperty(a.owner);
    const operator = await User.create({ name: 'PO Global', email: `fca101-po-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    await grantOperator({ userId: operator._id, actor: a.admin, reason: 'FCA1-01 certification', capabilities: [] });
    const res = await request(app).post('/api/contrats').set(bearer(operator, a.tenant._id)).send(createBody(propertyA));
    expect(res.status).toBe(201);
  });

  test('6. PlatformOperator scoped explicitement sur A -> A seulement', async () => {
    const a = await buildTenant('A6');
    const b = await buildTenant('B6');
    const propertyB = await buildProperty(b.owner);
    const operator = await User.create({ name: 'PO Scoped', email: `fca101-po-scoped-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    await grantOperator({ userId: operator._id, actor: a.admin, reason: 'FCA1-01 certification scoped', capabilities: [] });
    const res = await request(app).post('/api/contrats').set(bearer(operator, a.tenant._id)).send(createBody(propertyB));
    expect(res.status).not.toBe(201);
  });

  test('7. Invalid tenant header -> fail-closed', async () => {
    const a = await buildTenant('A7');
    const propertyA = await buildProperty(a.owner);
    const res = await request(app).post('/api/contrats').set(bearer(a.admin, '000000000000000000000000')).send(createBody(propertyA));
    expect(res.status).not.toBe(201);
  });
});
