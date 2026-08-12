// TENANT-CERT-3-PRE — preuves adversariales pour les domaines non couverts
// par TENANT-CERT-2/TENANT-HARDENING-2 : PlatformTenant admin (vulnérabilité
// critique découverte et corrigée ce sprint), Accommodation (idem),
// AccommodationReservation, CRM merge (preuve positive, aucune correction
// nécessaire), RentalManagement mass assignment (preuve positive). Chaque
// test documente acteur/tenant acteur/ressource/tenant ressource/opération/
// résultat attendu dans son intitulé, conformément au §41 du sprint.
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const AccommodationReservation = require('../models/AccommodationReservation');
const CrmCustomer = require('../models/CrmCustomer');
const RentalManagement = require('../models/RentalManagement');
const platformTenantRoutes = require('../routes/platformTenantRoutes');
const accommodationRoutes = require('../routes/accommodationRoutes');
const accommodationReservationRoutes = require('../routes/accommodationReservationRoutes');
const crmRoutes = require('../routes/crmRoutes');
const rentalManagementRoutes = require('../routes/rentalManagementRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/platform-tenants', platformTenantRoutes);
app.use('/api/accommodations', accommodationRoutes);
app.use('/api/accommodation-reservations', accommodationReservationRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/rental-management', rentalManagementRoutes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let seq = 0;
let tenantA;
let tenantB;
let ownerA;
let ownerB;
let adminA;
let adminB;
let platformOperator; // Admin sans aucune appartenance tenant

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'Cert3Pre A' });
  const fixtureB = await createTenantFixture({ label: 'Cert3Pre B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  ownerA = (await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Proprietaire' } })).user;
  ownerB = (await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Proprietaire' } })).user;
  adminA = (await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Admin' } })).user;
  adminB = (await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } })).user;
  platformOperator = await User.create({
    name: 'Platform Operator', email: `platform-operator-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
  });
});
afterEach(async () => Promise.all([
  Property.deleteMany({}), Accommodation.deleteMany({}), AccommodationReservation.deleteMany({}),
  CrmCustomer.deleteMany({}), RentalManagement.deleteMany({}),
]));
afterAll(async () => stopFinancialMongo());

async function makeProperty(owner) {
  seq += 1;
  return Property.create({
    title: `Cert3Pre Property ${seq}`, description: 'Description suffisamment longue pour une fixture TENANT-CERT-3-PRE.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 400000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.2, longitude: 15.2,
    images: ['https://placehold.co/1200x800/png'], surface: 85, statusAdmin: 'Validée', isPublished: true,
    availability: 'Disponible', owner: owner._id,
  });
}

async function makeAccommodation(owner) {
  seq += 1;
  const property = await makeProperty(owner);
  const accommodation = await Accommodation.create({
    property: property._id, createdBy: owner._id, accommodationType: 'appartement_meuble',
    capacity: { maxAdults: 2, maxChildren: 0 }, publicationStatus: 'brouillon',
  });
  return { property, accommodation };
}

// ── PlatformTenant admin — vulnérabilité critique découverte et corrigée ──
describe('PlatformTenant admin — Admin tenant-bound ne doit jamais agir sur un autre tenant', () => {
  test('B→B : Admin du Tenant B consulte l\'overview de son propre tenant → 200', async () => {
    const res = await request(app).get(`/api/platform-tenants/${tenantB._id}`).set(bearer(adminB));
    expect(res.status).toBe(200);
  });

  test('A→B : Admin du Tenant A consulte l\'overview du Tenant B → refus (plus jamais 200)', async () => {
    const res = await request(app).get(`/api/platform-tenants/${tenantB._id}`).set(bearer(adminA));
    expect(res.status).not.toBe(200);
    expect([403, 404]).toContain(res.status);
  });

  test('A→B : Admin du Tenant A tente de SUSPENDRE le Tenant B → refus', async () => {
    const res = await request(app).patch(`/api/platform-tenants/${tenantB._id}/suspend`).set(bearer(adminA)).send({ reason: 'attaque adversariale' });
    expect(res.status).not.toBe(200);
  });

  test('A→B : Admin du Tenant A tente de reconfigurer settings du Tenant B → refus', async () => {
    const res = await request(app).patch(`/api/platform-tenants/${tenantB._id}/settings`).set(bearer(adminA)).send({ locale: 'en' });
    expect(res.status).not.toBe(200);
  });

  test('A→B : Admin du Tenant A tente de changer l\'abonnement du Tenant B → refus', async () => {
    const res = await request(app).post(`/api/platform-tenants/${tenantB._id}/subscription`).set(bearer(adminA)).send({ plan: 'pro' });
    expect(res.status).not.toBe(200);
  });

  test('Admin sans appartenance tenant → B refusé faute de capacité plateforme vérifiable', async () => {
    const res = await request(app).get(`/api/platform-tenants/${tenantB._id}`).set(bearer(platformOperator));
    expect(res.status).toBe(403);
  });

  test('Admin sans appartenance tenant → A également refusé, jamais de fallback global', async () => {
    const res = await request(app).get(`/api/platform-tenants/${tenantA._id}`).set(bearer(platformOperator));
    expect(res.status).toBe(403);
  });

  test('ressource inexistante n\'est pas une preuve de sécurité : ObjectId valide mais inexistant → 404, jamais 200', async () => {
    const res = await request(app).get(`/api/platform-tenants/${new mongoose.Types.ObjectId()}`).set(bearer(adminA));
    expect(res.status).not.toBe(200);
  });

  test('identifiant invalide → 400, jamais une bascule silencieuse', async () => {
    const res = await request(app).get('/api/platform-tenants/not-an-object-id').set(bearer(adminA));
    expect(res.status).toBe(400);
  });
});

// ── Accommodation — vulnérabilité critique découverte et corrigée ─────────
describe('Accommodation — staff/Admin tenant-bound ne doit jamais agir sur un Accommodation d\'un autre tenant', () => {
  test('B→B : Admin du Tenant B consulte un Accommodation du Tenant B → 200', async () => {
    const { accommodation } = await makeAccommodation(ownerB);
    const res = await request(app).get(`/api/accommodations/${accommodation._id}`).set(bearer(adminB));
    expect(res.status).toBe(200);
  });

  test('A→B : Admin du Tenant A consulte un Accommodation du Tenant B → refus', async () => {
    const { accommodation } = await makeAccommodation(ownerB);
    const res = await request(app).get(`/api/accommodations/${accommodation._id}`).set(bearer(adminA));
    expect(res.status).not.toBe(200);
    expect([403, 404]).toContain(res.status);
  });

  test('A→B : Admin du Tenant A modifie un Accommodation du Tenant B (PATCH) → refus', async () => {
    const { accommodation } = await makeAccommodation(ownerB);
    const originalMinimumStay = accommodation.minimumStay;
    const res = await request(app).patch(`/api/accommodations/${accommodation._id}`).set(bearer(adminA)).send({ minimumStay: 99 });
    expect(res.status).not.toBe(200);
    const fresh = await Accommodation.findById(accommodation._id);
    expect(fresh.minimumStay).toBe(originalMinimumStay);
    expect(fresh.minimumStay).not.toBe(99);
  });

  test('A→B : Admin du Tenant A désactive un Accommodation du Tenant B → refus, l\'état n\'est pas modifié', async () => {
    const { accommodation } = await makeAccommodation(ownerB);
    accommodation.active = true; await accommodation.save();
    const res = await request(app).patch(`/api/accommodations/${accommodation._id}/deactivate`).set(bearer(adminA));
    expect(res.status).not.toBe(200);
    const fresh = await Accommodation.findById(accommodation._id);
    expect(fresh.active).toBe(true);
  });

  test('A→B : Admin du Tenant A supprime un Accommodation du Tenant B → refus, la ressource existe toujours', async () => {
    const { accommodation } = await makeAccommodation(ownerB);
    const res = await request(app).delete(`/api/accommodations/${accommodation._id}`).set(bearer(adminA));
    expect(res.status).not.toBe(200);
    expect(await Accommodation.findById(accommodation._id)).not.toBeNull();
  });

  test('A→B : staff GestionnaireImmobilier du Tenant A valide/rejette (reviewDecision) un Accommodation soumis du Tenant B → refus', async () => {
    const { accommodation } = await makeAccommodation(ownerB);
    accommodation.publicationStatus = 'soumis'; await accommodation.save();
    const { user: managerA } = await createTenantUser({ tenant: tenantA, bootstrap: adminA, overrides: { role: 'GestionnaireImmobilier' } });
    const res = await request(app).patch(`/api/accommodations/${accommodation._id}/validate`).set(bearer(managerA));
    expect(res.status).not.toBe(200);
    const fresh = await Accommodation.findById(accommodation._id);
    expect(fresh.publicationStatus).toBe('soumis');
  });

  test('B→B : staff du Tenant B accède au traitement (reject, ne nécessite pas la complétude "validate") d\'un Accommodation soumis du Tenant B → 200 (contrôle positif)', async () => {
    const { accommodation } = await makeAccommodation(ownerB);
    accommodation.publicationStatus = 'soumis'; await accommodation.save();
    const { user: managerB } = await createTenantUser({ tenant: tenantB, bootstrap: adminB, overrides: { role: 'GestionnaireImmobilier' } });
    const res = await request(app).patch(`/api/accommodations/${accommodation._id}/reject`).set(bearer(managerB)).send({ reason: 'Fixture de test incomplète, action de contrôle uniquement.' });
    expect(res.status).toBe(200);
  });

  test('A→B : Admin du Tenant A lit les tarifs (listRates) d\'un Accommodation du Tenant B → refus', async () => {
    const { accommodation } = await makeAccommodation(ownerB);
    const res = await request(app).get(`/api/accommodations/${accommodation._id}/rate-plans`).set(bearer(adminA));
    expect(res.status).not.toBe(200);
  });

  test('propriétaire A garde toujours accès à son propre hébergement, même sans rôle staff', async () => {
    const { accommodation } = await makeAccommodation(ownerA);
    const res = await request(app).get(`/api/accommodations/${accommodation._id}`).set(bearer(ownerA));
    expect(res.status).toBe(200);
  });

  // Régression détectée pendant ce sprint : la première version du correctif
  // autorisait tout acteur du MÊME tenant (pas seulement les rôles staff) à
  // contourner la propriété via la frontière tenant — un second Proprietaire
  // du même tenant pouvait alors désactiver l'hébergement d'un autre
  // Proprietaire. Corrigé en conditionnant le contournement tenant à une
  // liste explicite de rôles staff, jamais à la seule appartenance tenant.
  test('même tenant, non-staff : un autre Proprietaire du Tenant A ne peut pas désactiver l\'hébergement d\'un autre Proprietaire du Tenant A', async () => {
    const { accommodation } = await makeAccommodation(ownerA);
    accommodation.active = true; await accommodation.save();
    const { user: otherOwnerA } = await createTenantUser({ tenant: tenantA, bootstrap: adminA, overrides: { role: 'Proprietaire' } });
    const res = await request(app).patch(`/api/accommodations/${accommodation._id}/deactivate`).set(bearer(otherOwnerA));
    expect(res.status).not.toBe(200);
    const fresh = await Accommodation.findById(accommodation._id);
    expect(fresh.active).toBe(true);
  });
});

// ── AccommodationReservation ───────────────────────────────────────────────
describe('AccommodationReservation — liste et lecture bornées au tenant du staff', () => {
  async function makeReservation(owner, tenant) {
    const { accommodation } = await makeAccommodation(owner);
    seq += 1;
    const guest = await User.create({ name: 'Guest', email: `guest-cert3pre-${seq}-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true });
    const reservation = await AccommodationReservation.create({
      accommodation: accommodation._id, owner: owner._id, guest: guest._id, tenant: tenant._id,
      checkInDate: new Date(Date.now() + 86400000), checkOutDate: new Date(Date.now() + 3 * 86400000),
      nights: 2, guestCount: 1, adults: 1, createdBy: owner._id, status: 'pending',
    });
    return { reservation, guest };
  }

  test('A→B : Admin du Tenant A lit une réservation du Tenant B par ID → refus', async () => {
    const { reservation } = await makeReservation(ownerB, tenantB);
    const res = await request(app).get(`/api/accommodation-reservations/${reservation._id}`).set(bearer(adminA));
    expect(res.status).not.toBe(200);
  });

  test('B→B : Admin du Tenant B lit une réservation du Tenant B par ID → 200', async () => {
    const { reservation } = await makeReservation(ownerB, tenantB);
    const res = await request(app).get(`/api/accommodation-reservations/${reservation._id}`).set(bearer(adminB));
    expect(res.status).toBe(200);
  });

  test('le client (guest) garde toujours accès à sa propre réservation', async () => {
    const { reservation, guest } = await makeReservation(ownerB, tenantB);
    const res = await request(app).get(`/api/accommodation-reservations/${reservation._id}`).set(bearer(guest));
    expect(res.status).toBe(200);
  });

  test('liste : Admin du Tenant A ne voit jamais une réservation marqueur du Tenant B', async () => {
    const { reservation: reservationB } = await makeReservation(ownerB, tenantB);
    const { reservation: reservationA } = await makeReservation(ownerA, tenantA);
    const res = await request(app).get('/api/accommodation-reservations').set(bearer(adminA));
    expect(res.status).toBe(200);
    const ids = res.body.data.reservations.map((r) => String(r._id));
    expect(ids).not.toContain(String(reservationB._id));
    expect(ids).toContain(String(reservationA._id));
  });
});

// ── CRM merge — preuve positive (protection déjà en place, non modifiée) ──
describe('CRM merge/consolidation — preuve positive qu\'une fusion cross-tenant est impossible', () => {
  async function makeCustomer(tenant, displayName) {
    return CrmCustomer.create({ tenant: tenant._id, displayName, identityKeys: [`key-${Date.now()}-${Math.random()}`] });
  }

  test('B→B : consolider deux Customers du même tenant B → succès (contrôle positif)', async () => {
    const c1 = await makeCustomer(tenantB, 'Client Un B');
    const c2 = await makeCustomer(tenantB, 'Client Deux B');
    const res = await request(app).post('/api/crm/consolidations').set(bearer(adminB, tenantB))
      .send({ customerA: String(c1._id), customerB: String(c2._id), decision: 'keep_a', justification: 'Doublon confirmé manuellement.' });
    expect(res.status).toBe(201);
  });

  test('A→(A,B) : Admin du Tenant A tente de fusionner un Customer A avec un Customer B → refus, aucune archive côté B', async () => {
    const customerA = await makeCustomer(tenantA, 'Client A');
    const customerB = await makeCustomer(tenantB, 'Client B cible');
    const res = await request(app).post('/api/crm/consolidations').set(bearer(adminA, tenantA))
      .send({ customerA: String(customerA._id), customerB: String(customerB._id), decision: 'keep_a', justification: 'Tentative adversariale de fusion cross-tenant.' });
    expect(res.status).not.toBe(201);
    const freshB = await CrmCustomer.findById(customerB._id);
    expect(freshB.status).not.toBe('archived');
    expect(freshB.mergedInto).toBeFalsy();
  });
});

// ── Mass assignment — RentalManagement (preuve positive) ──────────────────
describe('Mass assignment — RentalManagement.create ignore les champs hostiles owner/manager/tenant/orgUnit', () => {
  test('un GestionnaireImmobilier ne peut pas s\'auto-attribuer un dossier appartenant au Property.owner réel', async () => {
    const property = await makeProperty(ownerA);
    const { user: managerA } = await createTenantUser({ tenant: tenantA, bootstrap: adminA, overrides: { role: 'GestionnaireImmobilier' } });
    const attackerId = new mongoose.Types.ObjectId();
    const res = await request(app).post('/api/rental-management').set(bearer(managerA, tenantA)).send({
      property: String(property._id), owner: String(attackerId), tenant: String(tenantB._id), orgUnit: String(tenantB.rootOrgUnit),
    });
    expect(res.status).toBe(201);
    const rental = await RentalManagement.findOne({ property: property._id });
    expect(String(rental.owner)).toBe(String(property.owner)); // dérivé du Property réel, jamais du body
    expect(String(rental.owner)).not.toBe(String(attackerId));
  });
});
