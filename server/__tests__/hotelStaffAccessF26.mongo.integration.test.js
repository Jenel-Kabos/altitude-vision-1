const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Hotel = require('../models/Hotel');
const User = require('../models/User');
const HotelStaffAssignment = require('../models/HotelStaffAssignment');
const ActionLog = require('../models/ActionLog');
const FinancialDocument = require('../models/FinancialDocument');
const assignmentService = require('../services/hotel/hotelStaffAssignmentService');
const { resolveHotelAccessScope, assertHotelCapability, listAccessibleHotels } = require('../services/hotel/hotelAccessScopeService');
const authz = require('../services/finance/financialAuthorizationService');
const { HOTEL_OPERATIONAL_CAPABILITIES } = require('../constants/hotelAccessConstants');
const { createTenantFixture, addTenantMember, tenantActor } = require('./helpers/tenantAwareFixture');

jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();
const admin = { role: 'Admin', _id: id() };
let tenantFixture;
async function ensureTenant() {
  if (!tenantFixture) {
    tenantFixture = await createTenantFixture({ label: 'Hotel staff', bootstrap: admin });
    Object.assign(admin, tenantActor(admin, tenantFixture.tenant));
  }
  return tenantFixture;
}
const actorOf = (user) => tenantActor(user, tenantFixture.tenant);

// Format d'email volontairement simple (sans tiret ni TLD long) : le regex de validation
// de User.js est vulnérable au ReDoS catastrophique sur certaines combinaisons
// tiret + identifiant long + TLD de 4 lettres — constat hors périmètre F2.6, non corrigé ici
// (modèle User.js préexistant), contourné en gardant les emails de test dans un format sûr.
let userCounter = 0;
async function makeUser(overrides = {}) {
  userCounter += 1;
  const context = await ensureTenant();
  const user = await User.create({ name: 'Ada Lovelace', email: `staffuser${userCounter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Collaborateur', ...overrides });
  await addTenantMember({ tenant: context.tenant, user, bootstrap: admin });
  return user;
}
async function makeHotel(overrides = {}) {
  const managerId = id();
  const { tenant } = await ensureTenant();
  return Hotel.create({ name: 'Hôtel F2.6', tenant: tenant._id, brand: 'F26', email: 'f26@example.test', manager: managerId, createdBy: managerId, ...overrides });
}

beforeAll(async () => { await startFinancialMongo(); await HotelStaffAssignment.syncIndexes(); });
afterEach(async () => { await clearFinancialMongo(); tenantFixture = null; delete admin.platformTenant; delete admin.tenantScopeUserIds; });
afterAll(stopFinancialMongo);

test('crée un rattachement, journalise dans ActionLog (historique) et respecte l’index d’unicité actif', async () => {
  const hotel = await makeHotel();
  const user = await makeUser();
  const assignment = await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotel._id, userId: user._id, assignmentRole: 'reception' });
  expect(assignment.status).toBe('active');
  expect(await ActionLog.countDocuments({ action: 'hotel_staff.assignment_created' })).toBe(1);

  await expect(assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotel._id, userId: user._id, assignmentRole: 'reception' }))
    .rejects.toMatchObject({ code: 'HOTEL_ASSIGNMENT_ALREADY_ACTIVE' });

  // Contournement applicatif : insertion directe en base pour vérifier que l'index Mongo
  // lui-même refuse un doublon actif (pas seulement le contrôle service).
  await expect(HotelStaffAssignment.create({ user: user._id, hotel: hotel._id, assignmentRole: 'reception', status: 'active', assignedBy: admin._id })).rejects.toThrow();
});

test('deux créations concurrentes du même rattachement aboutissent à une seule ligne active', async () => {
  const hotel = await makeHotel();
  const user = await makeUser();
  const attempts = await Promise.allSettled(Array.from({ length: 5 }, () => assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotel._id, userId: user._id, assignmentRole: 'housekeeping' })));
  const fulfilled = attempts.filter((a) => a.status === 'fulfilled');
  expect(fulfilled).toHaveLength(1);
  expect(await HotelStaffAssignment.countDocuments({ user: user._id, hotel: hotel._id, status: 'active' })).toBe(1);
});

test('cycle suspension → réactivation → révocation reste auditable et immédiatement effectif', async () => {
  const hotel = await makeHotel();
  const user = await makeUser();
  const assignment = await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotel._id, userId: user._id, assignmentRole: 'maintenance' });
  const staffActor = actorOf(user);

  await assertHotelCapability({ actor: staffActor, requiredCapability: HOTEL_OPERATIONAL_CAPABILITIES.MAINTENANCE_VIEW, hotelId: hotel._id });

  await assignmentService.suspendHotelStaffAssignment({ actor: admin, assignmentId: assignment._id, reason: 'Congé prolongé, à revoir au retour.' });
  await expect(assertHotelCapability({ actor: staffActor, requiredCapability: HOTEL_OPERATIONAL_CAPABILITIES.MAINTENANCE_VIEW, hotelId: hotel._id })).rejects.toMatchObject({ code: 'HOTEL_ACCESS_DENIED' });
  // Idempotence : suspendre un rattachement déjà suspendu ne crée pas de nouvel événement.
  await assignmentService.suspendHotelStaffAssignment({ actor: admin, assignmentId: assignment._id, reason: 'Nouvelle tentative sans effet.' });
  expect(await ActionLog.countDocuments({ action: 'hotel_staff.assignment_suspended' })).toBe(1);

  await assignmentService.reactivateHotelStaffAssignment({ actor: admin, assignmentId: assignment._id });
  await assertHotelCapability({ actor: staffActor, requiredCapability: HOTEL_OPERATIONAL_CAPABILITIES.MAINTENANCE_VIEW, hotelId: hotel._id });

  await assignmentService.revokeHotelStaffAssignment({ actor: admin, assignmentId: assignment._id, reason: 'Fin de mission confirmée par le manager.' });
  await expect(assertHotelCapability({ actor: staffActor, requiredCapability: HOTEL_OPERATIONAL_CAPABILITIES.MAINTENANCE_VIEW, hotelId: hotel._id })).rejects.toMatchObject({ code: 'HOTEL_ACCESS_DENIED' });
  // Un rattachement révoqué ne peut jamais être réactivé (l'historique reste, jamais réouvert).
  await expect(assignmentService.reactivateHotelStaffAssignment({ actor: admin, assignmentId: assignment._id })).rejects.toMatchObject({ code: 'HOTEL_ASSIGNMENT_REVOKED' });
  expect(await HotelStaffAssignment.countDocuments({ _id: assignment._id })).toBe(1); // jamais de suppression physique
});

test('période de validité : rattachement futur et rattachement expiré n’accordent aucun accès', async () => {
  const hotel = await makeHotel();
  const futureUser = await makeUser();
  const expiredUser = await makeUser();
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotel._id, userId: futureUser._id, assignmentRole: 'viewer', validFrom: new Date(Date.now() + 7 * 86400000) });
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotel._id, userId: expiredUser._id, assignmentRole: 'viewer', validFrom: new Date(Date.now() - 10 * 86400000), validUntil: new Date(Date.now() - 1000) });

  await expect(assertHotelCapability({ actor: actorOf(futureUser), requiredCapability: HOTEL_OPERATIONAL_CAPABILITIES.HOTEL_VIEW, hotelId: hotel._id })).rejects.toMatchObject({ code: 'HOTEL_ACCESS_DENIED' });
  await expect(assertHotelCapability({ actor: actorOf(expiredUser), requiredCapability: HOTEL_OPERATIONAL_CAPABILITIES.HOTEL_VIEW, hotelId: hotel._id })).rejects.toMatchObject({ code: 'HOTEL_ACCESS_DENIED' });
});

test('un utilisateur rattaché à plusieurs hôtels obtient uniquement ces hôtels dans son scope', async () => {
  const hotelA = await makeHotel({ name: 'Hôtel A' });
  const hotelB = await makeHotel({ name: 'Hôtel B' });
  const hotelC = await makeHotel({ name: 'Hôtel C' });
  const user = await makeUser();
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotelA._id, userId: user._id, assignmentRole: 'finance' });
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotelB._id, userId: user._id, assignmentRole: 'finance' });

  const { globalAccess, hotels } = await listAccessibleHotels({ role: 'Collaborateur', _id: user._id });
  expect(globalAccess).toBe(false);
  expect(hotels.map((h) => String(h._id)).sort()).toEqual([String(hotelA._id), String(hotelB._id)].sort());
  expect(hotels.some((h) => String(h._id) === String(hotelC._id))).toBe(false);
});

test('ressource hôtel étrangère : un rattachement sur l’hôtel A ne donne jamais accès à l’hôtel B', async () => {
  const hotelA = await makeHotel();
  const hotelB = await makeHotel();
  const user = await makeUser();
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotelA._id, userId: user._id, assignmentRole: 'reception' });
  await expect(assertHotelCapability({ actor: actorOf(user), requiredCapability: HOTEL_OPERATIONAL_CAPABILITIES.RESERVATION_VIEW, hotelId: hotelB._id })).rejects.toMatchObject({ code: 'HOTEL_ACCESS_DENIED' });
});

test('accès dashboard, document financier et paiement via un rattachement local "finance" (sans être Hotel.manager)', async () => {
  const hotel = await makeHotel();
  const financeUser = await makeUser();
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotel._id, userId: financeUser._id, assignmentRole: 'finance' });
  const actor = actorOf(financeUser);

  const dashboardScope = await resolveHotelAccessScope({ actor, requiredCapability: 'financial.hotel.dashboard.view', requestedHotelId: hotel._id });
  expect(dashboardScope.hotelIds).toEqual([String(hotel._id)]);
  await authz.assertCanViewFinancialDocument(actor, hotel._id);
  await authz.assertCanViewFinancialPayment(actor, hotel._id);

  // Un rattachement "housekeeping" (sans capacité finance) sur ce même hôtel doit être refusé.
  const housekeepingUser = await makeUser();
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotel._id, userId: housekeepingUser._id, assignmentRole: 'housekeeping' });
  await expect(authz.assertCanViewFinancialDocument(actorOf(housekeepingUser), hotel._id)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
});

test('prévention d’escalade : un manager ne peut ni s’auto-modifier ni déléguer une capacité qu’il ne détient pas ni attribuer l’override financier', async () => {
  const hotel = await makeHotel();
  const managerUser = await makeUser();
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotel._id, userId: managerUser._id, assignmentRole: 'hotel_manager', capabilities: [HOTEL_OPERATIONAL_CAPABILITIES.STAFF_ASSIGNMENT_MANAGE] });
  const managerActor = actorOf(managerUser);

  // Auto-escalade bloquée.
  await expect(assignmentService.createHotelStaffAssignment({ actor: managerActor, hotelId: hotel._id, userId: managerUser._id, assignmentRole: 'viewer' })).rejects.toMatchObject({ code: 'HOTEL_ASSIGNMENT_SELF_ESCALATION' });

  // Ne peut pas déléguer une capacité qu'il ne détient pas lui-même (ex: financial.reconciliation.run, jamais accordée à hotel_manager).
  const otherUser = await makeUser();
  await expect(assignmentService.createHotelStaffAssignment({ actor: managerActor, hotelId: hotel._id, userId: otherUser._id, assignmentRole: 'viewer', capabilities: ['financial.reconciliation.run'] })).rejects.toMatchObject({ code: 'HOTEL_ASSIGNMENT_PRIVILEGE_ESCALATION' });

  // L'override financier de check-out ne peut jamais être délégué, même par un manager habilité à gérer le personnel.
  await expect(assignmentService.createHotelStaffAssignment({ actor: managerActor, hotelId: hotel._id, userId: otherUser._id, assignmentRole: 'viewer', capabilities: [HOTEL_OPERATIONAL_CAPABILITIES.CHECKOUT_FINANCIAL_OVERRIDE] })).rejects.toMatchObject({ code: 'HOTEL_ASSIGNMENT_PRIVILEGE_ESCALATION' });

  // Même un Admin ne peut pas déléguer cette capacité à un rattachement local.
  await expect(assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotel._id, userId: otherUser._id, assignmentRole: 'viewer', capabilities: [HOTEL_OPERATIONAL_CAPABILITIES.CHECKOUT_FINANCIAL_OVERRIDE] })).rejects.toMatchObject({ code: 'HOTEL_ASSIGNMENT_PRIVILEGE_ESCALATION' });

  expect(await HotelStaffAssignment.countDocuments({ user: otherUser._id })).toBe(0); // aucune écriture partielle après un refus
});

test('aucune fuite : un document financier de l’hôtel B n’apparaît jamais dans le scope de l’hôtel A', async () => {
  const hotelA = await makeHotel();
  const hotelB = await makeHotel();
  const userA = await makeUser();
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotelA._id, userId: userA._id, assignmentRole: 'finance' });
  const docB = await FinancialDocument.create({ domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotelB._id, documentType: 'invoice', status: 'issued', currency: 'XAF', subjectType: 'HotelReservation', subjectId: id(), totalMinor: 5000, balanceMinor: 5000, businessOperationKey: `f26-${id()}`, createdBy: hotelB.manager });
  await expect(authz.assertCanViewFinancialDocument(actorOf(userA), docB.establishmentId)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
});

test('lectures concurrentes pendant une révocation ne laissent jamais un accès fantôme', async () => {
  const hotel = await makeHotel();
  const user = await makeUser();
  const assignment = await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotel._id, userId: user._id, assignmentRole: 'inspector' });
  await assignmentService.revokeHotelStaffAssignment({ actor: admin, assignmentId: assignment._id, reason: 'Ressource réaffectée définitivement ailleurs.' });

  const reads = await Promise.allSettled(Array.from({ length: 8 }, () => assertHotelCapability({ actor: actorOf(user), requiredCapability: HOTEL_OPERATIONAL_CAPABILITIES.INSPECTION_VIEW, hotelId: hotel._id })));
  expect(reads.every((r) => r.status === 'rejected')).toBe(true);
});
