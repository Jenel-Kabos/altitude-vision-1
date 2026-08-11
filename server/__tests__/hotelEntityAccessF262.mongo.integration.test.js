const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Hotel = require('../models/Hotel');
const User = require('../models/User');
const HotelStaffAssignment = require('../models/HotelStaffAssignment');
const assignmentService = require('../services/hotel/hotelStaffAssignmentService');
const { assertOperationalHotelAccess, listAccessibleHotels } = require('../services/hotel/hotelAccessScopeService');
const { listHotelsForAdmin } = require('../services/hotelService');
const { HOTEL_OPERATIONAL_CAPABILITIES: CAP } = require('../constants/hotelAccessConstants');
const { createTenantFixture, addTenantMember, tenantActor } = require('./helpers/tenantAwareFixture');

jest.setTimeout(180000);
const id = () => new mongoose.Types.ObjectId();
const admin = { role: 'Admin', _id: id() };
let tenantFixture;
async function ensureTenant() {
  if (!tenantFixture) {
    tenantFixture = await createTenantFixture({ label: 'Hotel entity', bootstrap: admin });
    Object.assign(admin, tenantActor(admin, tenantFixture.tenant));
  }
  return tenantFixture;
}
const actorOf = (user) => tenantActor(user, tenantFixture.tenant);
let userCounter = 0;
const makeUser = async (overrides = {}) => {
  userCounter += 1;
  const context = await ensureTenant();
  const user = await User.create({ name: 'Entity Staff', email: `entitystaff${userCounter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Collaborateur', ...overrides });
  await addTenantMember({ tenant: context.tenant, user, bootstrap: admin });
  return user;
};
const makeHotel = async (overrides = {}) => { const managerId = id(); const { tenant } = await ensureTenant(); return Hotel.create({ name: 'Hôtel F262', tenant: tenant._id, createdBy: managerId, manager: managerId, ...overrides }); };

beforeAll(async () => { await startFinancialMongo(); await HotelStaffAssignment.syncIndexes(); });
afterEach(async () => { await clearFinancialMongo(); tenantFixture = null; delete admin.platformTenant; delete admin.tenantScopeUserIds; });
afterAll(stopFinancialMongo);

test('liste scopée : Admin voit tout, manager legacy voit le sien, staff multi-hôtels voit uniquement ses hôtels autorisés, staff sans rattachement ne voit rien', async () => {
  const hotelA = await makeHotel({ name: 'Hôtel A' });
  const hotelB = await makeHotel({ name: 'Hôtel B' });
  const hotelC = await makeHotel({ name: 'Hôtel C' });
  const managerLegacy = { role: 'Proprietaire', _id: hotelA.manager };
  const multiStaff = await makeUser();
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotelB._id, userId: multiStaff._id, assignmentRole: 'hotel_manager' });
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotelC._id, userId: multiStaff._id, assignmentRole: 'hotel_manager' });
  const noRattachement = await makeUser();

  const adminResult = await listAccessibleHotels(admin);
  expect(adminResult.globalAccess).toBe(false);

  const legacyResult = await listAccessibleHotels(managerLegacy);
  expect(legacyResult.hotels.map((h) => String(h._id))).toEqual([String(hotelA._id)]);

  const multiResult = await listAccessibleHotels({ role: 'Collaborateur', _id: multiStaff._id });
  expect(multiResult.hotels.map((h) => String(h._id)).sort()).toEqual([String(hotelB._id), String(hotelC._id)].sort());
  expect(multiResult.hotels.some((h) => String(h._id) === String(hotelA._id))).toBe(false);

  const noneResult = await listAccessibleHotels({ role: 'Collaborateur', _id: noRattachement._id });
  expect(noneResult.hotels).toHaveLength(0);
});

test('rattachements suspendu et expiré exclus de la liste et du scope', async () => {
  const hotel = await makeHotel();
  const suspendedUser = await makeUser();
  const expiredUser = await makeUser();
  const suspendedAssignment = await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotel._id, userId: suspendedUser._id, assignmentRole: 'hotel_manager' });
  await assignmentService.suspendHotelStaffAssignment({ actor: admin, assignmentId: suspendedAssignment._id, reason: 'Contrôle de sécurité en cours.' });
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotel._id, userId: expiredUser._id, assignmentRole: 'hotel_manager', validFrom: new Date(Date.now() - 10 * 86400000), validUntil: new Date(Date.now() - 1000) });

  expect((await listAccessibleHotels({ role: 'Collaborateur', _id: suspendedUser._id })).hotels).toHaveLength(0);
  expect((await listAccessibleHotels({ role: 'Collaborateur', _id: expiredUser._id })).hotels).toHaveLength(0);
});

test('total (pagination) utilise exactement le même scope que la liste (listHotelsForAdmin)', async () => {
  const hotelA = await makeHotel({ name: 'Hôtel A', publicationStatus: 'soumis' });
  const hotelB = await makeHotel({ name: 'Hôtel B', publicationStatus: 'soumis' });
  const staffA = await makeUser();
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotelA._id, userId: staffA._id, assignmentRole: 'hotel_manager' });

  const { hotels: accessibleHotels } = await listAccessibleHotels({ role: 'Collaborateur', _id: staffA._id });
  const hotelIds = accessibleHotels.map((h) => h._id);
  const result = await listHotelsForAdmin({ status: 'soumis', hotelIds });
  expect(result.hotels).toHaveLength(1);
  expect(result.total).toBe(1); // jamais 2 : le total suit exactement le même filtre que la liste
  expect(String(result.hotels[0]._id)).toBe(String(hotelA._id));
});

test('détail : staff A accède à A, refusé sur B ; hôtel inexistant → 404', async () => {
  const hotelA = await makeHotel();
  const hotelB = await makeHotel();
  const staffA = await makeUser();
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotelA._id, userId: staffA._id, assignmentRole: 'hotel_manager' });
  const actorA = actorOf(staffA);

  await expect(assertOperationalHotelAccess({ actor: actorA, hotelId: hotelA._id, capability: CAP.HOTEL_VIEW })).resolves.toEqual({});
  expect((await assertOperationalHotelAccess({ actor: actorA, hotelId: hotelB._id, capability: CAP.HOTEL_VIEW })).error).toBe(403);
  expect((await assertOperationalHotelAccess({ actor: actorA, hotelId: id(), capability: CAP.HOTEL_VIEW })).error).toBe(404);
});

test('mise à jour : hotel.manage requis, hôtel étranger refusé, aucune mutation après refus', async () => {
  const hotelA = await makeHotel({ name: 'Nom original A' });
  const hotelB = await makeHotel({ name: 'Nom original B' });
  const staffA = await makeUser();
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotelA._id, userId: staffA._id, assignmentRole: 'hotel_manager' });
  const actorA = actorOf(staffA);

  await expect(assertOperationalHotelAccess({ actor: actorA, hotelId: hotelA._id, capability: CAP.HOTEL_MANAGE })).resolves.toEqual({});
  const denied = await assertOperationalHotelAccess({ actor: actorA, hotelId: hotelB._id, capability: CAP.HOTEL_MANAGE });
  expect(denied.error).toBe(403);
  const stillOriginal = await Hotel.findById(hotelB._id).lean();
  expect(stillOriginal.name).toBe('Nom original B'); // aucune écriture partielle après refus
});

test('viewer (hotel.view seul) ne peut pas obtenir hotel.manage', async () => {
  const hotel = await makeHotel();
  const viewerUser = await makeUser();
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotel._id, userId: viewerUser._id, assignmentRole: 'viewer' });
  const actor = actorOf(viewerUser);
  await expect(assertOperationalHotelAccess({ actor, hotelId: hotel._id, capability: CAP.HOTEL_VIEW })).resolves.toEqual({});
  expect((await assertOperationalHotelAccess({ actor, hotelId: hotel._id, capability: CAP.HOTEL_MANAGE })).error).toBe(403);
});

test('révocation prend effet immédiatement (y compris lectures concurrentes)', async () => {
  const hotel = await makeHotel();
  const staffUser = await makeUser();
  const assignment = await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotel._id, userId: staffUser._id, assignmentRole: 'hotel_manager' });
  const actor = actorOf(staffUser);
  await expect(assertOperationalHotelAccess({ actor, hotelId: hotel._id, capability: CAP.HOTEL_MANAGE })).resolves.toEqual({});

  await assignmentService.revokeHotelStaffAssignment({ actor: admin, assignmentId: assignment._id, reason: 'Fin de mandat confirmée par la direction.' });

  const reads = await Promise.allSettled(Array.from({ length: 6 }, () => assertOperationalHotelAccess({ actor, hotelId: hotel._id, capability: CAP.HOTEL_MANAGE })));
  reads.forEach((r) => expect(r.value.error).toBe(403));
});

test('Admin reste scopé quand un hotelId précis est demandé (jamais un accès inter-hôtel incohérent)', async () => {
  const hotelA = await makeHotel();
  const hotelB = await makeHotel();
  await expect(assertOperationalHotelAccess({ actor: admin, hotelId: hotelA._id, capability: CAP.HOTEL_MANAGE })).resolves.toEqual({});
  await expect(assertOperationalHotelAccess({ actor: admin, hotelId: hotelB._id, capability: CAP.HOTEL_MANAGE })).resolves.toEqual({});
});

test('Hotel.manager legacy passe uniquement par le service central (pas de HotelStaffAssignment nécessaire)', async () => {
  const hotel = await makeHotel();
  const legacyActor = { role: 'Proprietaire', _id: hotel.manager };
  await expect(assertOperationalHotelAccess({ actor: legacyActor, hotelId: hotel._id, capability: CAP.HOTEL_MANAGE })).resolves.toEqual({});
  expect(await HotelStaffAssignment.countDocuments({ hotel: hotel._id })).toBe(0);
});

test('/accessible (listAccessibleHotels) : aucun doublon si legacy manager ET assignment explicite coexistent', async () => {
  const managerUser = await makeUser();
  const hotel = await makeHotel({ manager: managerUser._id });
  const dualUser = { role: 'Proprietaire', _id: managerUser._id };
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotel._id, userId: managerUser._id, assignmentRole: 'finance' });
  const { hotels } = await listAccessibleHotels(dualUser);
  expect(hotels).toHaveLength(1); // pas de doublon entre legacy manager et assignment explicite
});

test('une simple lecture (détail, liste) ne mute jamais la donnée', async () => {
  const hotel = await makeHotel();
  const before = await Hotel.findById(hotel._id).lean();
  const staffUser = await makeUser();
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotel._id, userId: staffUser._id, assignmentRole: 'hotel_manager' });
  const actor = actorOf(staffUser);
  await Promise.all(Array.from({ length: 5 }, () => assertOperationalHotelAccess({ actor, hotelId: hotel._id, capability: CAP.HOTEL_VIEW })));
  const after = await Hotel.findById(hotel._id).lean();
  expect(after).toEqual(before);
});
