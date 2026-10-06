// PLATFORM-ADMIN-04B0 — P0 : `Property.tenant` est une donnée de provenance
// protégée. Aucune mutation ordinaire d'une Property existante (owner, staff
// tenant, PlatformOperator ; web ou mobile) ne peut la modifier depuis une
// valeur contrôlée par le client. Chaque scénario relit la ressource en base
// et compare explicitement le tenant avant / après.
const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture } = require('./helpers/tenantAwareFixture');
const Hotel = require('../models/Hotel');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const User = require('../models/User');
const Property = require('../models/Property');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(240000);

const app = express();
app.use(express.json());
app.use('/api/properties', require('../routes/propertyRoutes'));
app.use('/api/admin', require('../routes/adminRoutes'));
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let seq = 0;
const makeUser = (role, label) => {
  seq += 1;
  return User.create({ name: `PA04B0 ${label} ${seq}`, email: `pa04b0-${label}-${seq}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
};
const makeProperty = ({ owner, tenant, status = 'location', statusAdmin = 'Validée' }) => Property.create({
  tenant: tenant?._id || null, title: `PA04B0 bien ${seq++}`, description: 'Description suffisamment longue pour la validation Property.',
  pole: 'Altimmo', type: 'Villa', status, price: 250000,
  address: { arrondissement: 'Centre', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.28,
  images: ['https://example.test/pa04b0.jpg'], surface: 90, statusAdmin, isPublished: statusAdmin === 'Validée',
  availability: 'Disponible', owner: owner._id,
});
const tenantOf = async (property) => {
  const stored = await Property.findById(property._id).select('tenant').lean();
  return stored.tenant ? String(stored.tenant) : null;
};
const id = (doc) => (doc ? String(doc._id) : null);

const S = {};
beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'PA04B0 Tenant A', withAdminMembership: true });
  const fixtureB = await createTenantFixture({ label: 'PA04B0 Tenant B', withAdminMembership: true });
  S.tenantA = fixtureA.tenant; S.tenantB = fixtureB.tenant;
  S.adminA = fixtureA.bootstrap; S.adminB = fixtureB.bootstrap;
  S.owner = await makeUser('Proprietaire', 'unaffiliated-owner');
  S.platformAdmin = await makeUser('Admin', 'platform-admin');
  await grantOperator({ userId: S.platformAdmin._id, actor: S.adminA, reason: 'PA04B0 eligible operator', capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES] });
});
afterAll(stopFinancialMongo);

describe('PA-04B0 — propriétaire non affilié (tenant:null)', () => {
  test('Case A — tenant:null → Tenant A refusé : tenant reste null, édition métier appliquée', async () => {
    const property = await makeProperty({ owner: S.owner, tenant: null });
    expect(await tenantOf(property)).toBeNull();
    const res = await request(app).put(`/api/properties/${property._id}`).set(bearer(S.owner))
      .send({ description: 'Description mise à jour par le propriétaire, assez longue.', tenant: id(S.tenantA) });
    expect(res.status).toBe(200);
    expect(await tenantOf(property)).toBeNull();
    expect((await Property.findById(property._id).lean()).description).toMatch(/mise à jour par le propriétaire/);
  });

  test('Case E — tenant forgé (ObjectId aléatoire) : tenant reste null', async () => {
    const property = await makeProperty({ owner: S.owner, tenant: null });
    await request(app).put(`/api/properties/${property._id}`).set(bearer(S.owner))
      .send({ description: 'Tentative avec un tenant inexistant, assez longue.', tenant: String(new mongoose.Types.ObjectId()) });
    expect(await tenantOf(property)).toBeNull();
  });

  test('variantes : objet imbriqué, alias tenantId, opérateurs $set / $unset, chemin pointé', async () => {
    const property = await makeProperty({ owner: S.owner, tenant: null });
    const attempts = [
      { description: 'Variante objet imbriqué, description assez longue.', tenant: { _id: id(S.tenantA) } },
      { description: 'Variante alias tenantId, description assez longue.', tenantId: id(S.tenantA) },
      { description: 'Variante $set, description assez longue.', $set: { tenant: id(S.tenantA) } },
      { description: 'Variante chemin pointé, description assez longue.', 'tenant._id': id(S.tenantA) },
    ];
    for (const body of attempts) {
      await request(app).put(`/api/properties/${property._id}`).set(bearer(S.owner)).send(body);
      expect(await tenantOf(property)).toBeNull();
    }
  });

  test('Case D (owner) — édition normale sans tenant : réussit, tenant inchangé (null)', async () => {
    const property = await makeProperty({ owner: S.owner, tenant: null });
    const res = await request(app).put(`/api/properties/${property._id}`).set(bearer(S.owner))
      .send({ title: 'Titre modifié par le propriétaire', price: 260000 });
    expect(res.status).toBe(200);
    expect(res.body.data.property.title).toBe('Titre modifié par le propriétaire');
    expect(await tenantOf(property)).toBeNull();
  });
});

describe('PA-04B0 — contrat mobile (payloads exacts de altimmo-app, PUT /properties/:id)', () => {
  // Payloads reproduits depuis MesAnnoncesScreen.handleToggleAvailability,
  // MesAnnoncesScreen.saveLeaseTerms et PublierBienScreen (édition).
  test('les trois éditions owner mobile réussissent et la provenance est inchangée', async () => {
    const property = await makeProperty({ owner: S.owner, tenant: null });
    const toggle = await request(app).put(`/api/properties/${property._id}`).set(bearer(S.owner)).send({ availability: 'Loué' });
    expect(toggle.status).toBe(200);
    const lease = await request(app).put(`/api/properties/${property._id}`).set(bearer(S.owner)).send({
      cautionMultiplicateur: 3, profilsLocataireRecherches: ['Étudiant'], documentsRequis: ['CNI'],
    });
    expect(lease.status).toBe(200);
    const edit = await request(app).put(`/api/properties/${property._id}`).set(bearer(S.owner)).send({
      title: 'Édition mobile', description: 'Description éditée depuis l’application mobile.', price: 270000, surface: 95,
      bedrooms: 3, bathrooms: 2, livingRooms: 1, kitchens: 1, amenities: ['Parking'],
      address: { city: 'Brazzaville', arrondissement: 'Centre' },
    });
    expect(edit.status).toBe(200);
    const stored = await Property.findById(property._id).lean();
    expect(stored.title).toBe('Édition mobile');
    expect(stored.cautionMultiplicateur).toBe(3);
    expect(stored.tenant).toBeNull();
  });

  test('un payload mobile forgé avec tenant ne change jamais la provenance', async () => {
    const property = await makeProperty({ owner: S.owner, tenant: null });
    await request(app).put(`/api/properties/${property._id}`).set(bearer(S.owner)).send({ availability: 'Loué', tenant: id(S.tenantB) });
    expect(await tenantOf(property)).toBeNull();
  });
});

describe('PA-04B0 — staff Tenant A', () => {
  test('Case B — Tenant A → Tenant B refusé : tenant reste Tenant A', async () => {
    const property = await makeProperty({ owner: S.adminA, tenant: S.tenantA });
    const res = await request(app).put(`/api/properties/${property._id}`).set(bearer(S.adminA, S.tenantA))
      .send({ description: 'Description modifiée par le staff Tenant A, assez longue.', tenant: id(S.tenantB) });
    expect(res.status).toBe(200);
    expect(await tenantOf(property)).toBe(id(S.tenantA));
  });

  test('Case C — Tenant A → null refusé : tenant reste Tenant A', async () => {
    const property = await makeProperty({ owner: S.adminA, tenant: S.tenantA });
    await request(app).put(`/api/properties/${property._id}`).set(bearer(S.adminA, S.tenantA))
      .send({ description: 'Tentative de détachement du tenant, assez longue.', tenant: null });
    expect(await tenantOf(property)).toBe(id(S.tenantA));
  });

  test('Case E (staff) — tenant forgé inexistant : tenant reste Tenant A', async () => {
    const property = await makeProperty({ owner: S.adminA, tenant: S.tenantA });
    await request(app).put(`/api/properties/${property._id}`).set(bearer(S.adminA, S.tenantA))
      .send({ description: 'Tentative tenant inexistant par le staff, assez longue.', tenant: String(new mongoose.Types.ObjectId()) });
    expect(await tenantOf(property)).toBe(id(S.tenantA));
  });

  test('Case D (staff) — édition normale autorisée : réussit, tenant inchangé', async () => {
    const property = await makeProperty({ owner: S.adminA, tenant: S.tenantA });
    const res = await request(app).put(`/api/properties/${property._id}`).set(bearer(S.adminA, S.tenantA))
      .send({ title: 'Titre modifié par le staff Tenant A', price: 300000 });
    expect(res.status).toBe(200);
    expect(res.body.data.property.title).toBe('Titre modifié par le staff Tenant A');
    expect(await tenantOf(property)).toBe(id(S.tenantA));
  });

  test('isolation inchangée : le staff Tenant A ne modifie pas un bien Tenant B', async () => {
    const property = await makeProperty({ owner: S.adminB, tenant: S.tenantB });
    const res = await request(app).put(`/api/properties/${property._id}`).set(bearer(S.adminA, S.tenantA))
      .send({ title: 'Intrusion', tenant: id(S.tenantA) });
    expect([403, 404]).toContain(res.status);
    expect(await tenantOf(property)).toBe(id(S.tenantB));
    expect((await Property.findById(property._id).lean()).title).not.toBe('Intrusion');
  });
});

describe('PA-04B0 — revalidation hôtel (même updateData, chemin transactionnel)', () => {
  test('owner d’un hôtel publié : tenant forgé ignoré, la revalidation hôtel reste déclenchée', async () => {
    const property = await makeProperty({ owner: S.owner, tenant: null, status: 'hebergement' });
    const hotel = await Hotel.create({ name: `PA04B0 Hôtel ${seq++}`, tenant: null, manager: S.owner._id, createdBy: S.owner._id, property: property._id, publicationStatus: 'publie' });
    const res = await request(app).put(`/api/properties/${property._id}`).set(bearer(S.owner))
      .send({ description: 'Modification d’un hôtel publié par son propriétaire.', tenant: id(S.tenantA) });
    expect(res.status).toBe(200);
    expect(await tenantOf(property)).toBeNull();
    expect((await Hotel.findById(hotel._id).lean()).publicationStatus).toBe('soumis');
  });
});

describe('PA-04B0 — mutations PLATFORM existantes : provenance conservée', () => {
  test.each([
    ['Tenant A', () => S.tenantA],
    ['tenant:null', () => null],
  ])('Case F — approve / reject / recommande sur un bien %s : tenant inchangé', async (_label, tenant) => {
    const owner = tenant() ? S.adminA : S.owner;
    const property = await makeProperty({ owner, tenant: tenant(), status: 'vente', statusAdmin: 'En attente' });
    const before = await tenantOf(property);
    expect((await request(app).patch(`/api/admin/properties/${property._id}/approve`).set(bearer(S.platformAdmin)).send({ tenant: id(S.tenantB) })).status).toBe(200);
    expect((await request(app).patch(`/api/admin/properties/${property._id}/reject`).set(bearer(S.platformAdmin)).send({ tenant: id(S.tenantB) })).status).toBe(200);
    expect((await request(app).patch(`/api/properties/${property._id}/recommande`).set(bearer(S.platformAdmin)).send({ recommande: true, tenant: id(S.tenantB) })).status).toBe(200);
    expect(await tenantOf(property)).toBe(before);
  });

  test('modération tenant (/properties/admin/:id/:action) par le staff Tenant A : tenant inchangé', async () => {
    const property = await makeProperty({ owner: S.adminA, tenant: S.tenantA, status: 'vente', statusAdmin: 'En attente' });
    const res = await request(app).patch(`/api/properties/admin/${property._id}/validate`).set(bearer(S.adminA, S.tenantA)).send({ tenant: id(S.tenantB) });
    expect(res.status).toBe(200);
    expect(await tenantOf(property)).toBe(id(S.tenantA));
  });
});
