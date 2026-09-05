// __tests__/hotelReservationService.test.js — Sprint C
// hotelAvailabilityService est mocké ici (déjà testé isolément dans
// hotelAvailabilityService.test.js, y compris la concurrence) — ce fichier
// teste l'orchestration propre à hotelReservationService : tarification
// recalculée côté serveur, transitions centralisées, historisation,
// création publique/propriétaire/admin, modification, annulation.

jest.mock('../models/Hotel');
jest.mock('../models/RoomCategory');
jest.mock('../models/RatePlan');
jest.mock('../models/HotelReservation');
jest.mock('../services/hotelAvailabilityService');
jest.mock('../services/roomAssignmentService', () => ({ releaseRoom: jest.fn() }));
jest.mock('../services/notificationService', () => ({ notify: jest.fn().mockResolvedValue(), notifyStaff: jest.fn().mockResolvedValue() }));
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const RatePlan = require('../models/RatePlan');
const HotelReservation = require('../models/HotelReservation');
const availability = require('../services/hotelAvailabilityService');
const roomAssignmentService = require('../services/roomAssignmentService');
const {
  computeReservationPricing, createReservation, transitionStatus, updateReservation,
} = require('../services/hotelReservationService');

const NO_ACTIVE_ASSIGNMENT = Object.assign(new Error('Aucune chambre active à libérer pour cette réservation.'), { statusCode: 404 });

HotelReservation.ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'rejected', 'cancelled', 'expired'],
  confirmed: ['cancelled'],
  cancelled: [],
  expired: [],
  rejected: [],
};

const HOTEL_ID = '707f1f77bcf86cd799439055';
const CATEGORY_ID = '807f1f77bcf86cd799439066';
const RATE_ID = '907f1f77bcf86cd799439077';
const USER_ID = '507f1f77bcf86cd799439012';
const OWNER_ID = '507f1f77bcf86cd799439011';

const guest = { firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com' };

describe('computeReservationPricing — tarification recalculée côté serveur (mission §6) — TEST DATA', () => {
  afterEach(() => jest.clearAllMocks());

  test('unitPrice x nights x roomsCount = subtotal, totalAmount identique tant que taxes/fees/discount valent 0', async () => {
    RatePlan.findOne = jest.fn().mockResolvedValue({ amount: 35000, currency: 'XAF', rateType: 'public', active: true });
    const pricing = await computeReservationPricing({ roomCategoryId: CATEGORY_ID, ratePlanId: RATE_ID, nights: 3, roomsCount: 2 });
    expect(pricing.unitPrice).toBe(35000);
    expect(pricing.subtotal).toBe(35000 * 3 * 2);
    expect(pricing.totalAmount).toBe(pricing.subtotal);
    expect(pricing.taxes).toBe(0);
    expect(pricing.fees).toBe(0);
    expect(pricing.discount).toBe(0);
  });

  test('un tarif inactif/inexistant pour cette catégorie est rejeté (jamais de prix inventé)', async () => {
    RatePlan.findOne = jest.fn().mockResolvedValue(null);
    await expect(computeReservationPricing({ roomCategoryId: CATEGORY_ID, ratePlanId: RATE_ID, nights: 2, roomsCount: 1 }))
      .rejects.toMatchObject({ statusCode: 422 });
  });

  test('rateSnapshot capture rateType/amount/currency (historisation, mission §6)', async () => {
    RatePlan.findOne = jest.fn().mockResolvedValue({ amount: 50000, currency: 'XAF', rateType: 'weekend', active: true });
    const pricing = await computeReservationPricing({ roomCategoryId: CATEGORY_ID, ratePlanId: RATE_ID, nights: 1, roomsCount: 1 });
    // PHASE-H5 — mealPlan/cancellation figés dans le même snapshot ; `null`
    // ici car le mock RatePlan n'en porte aucun (RatePlan antérieur à H5).
    expect(pricing.rateSnapshot).toEqual({
      rateType: 'weekend', amount: 50000, currency: 'XAF',
      nightlyRates: [{ date: null, amount: 50000, periodId: null, periodLabel: '', priority: null }],
      mealPlan: null, cancellation: null,
    });
  });

  test('C29 calcule chaque nuit, traverse deux périodes et fige le détail tarifaire', async () => {
    RatePlan.findOne = jest.fn().mockResolvedValue({
      amount: 35000, currency: 'XAF', rateType: 'public', active: true,
      seasonalPeriods: [
        { _id: 'period-low', label: 'Vacances', startDate: new Date('2026-12-20'), endDate: new Date('2027-01-05'), amount: 50000, priority: 10 },
        { _id: 'period-high', label: 'Réveillon', startDate: new Date('2026-12-31'), endDate: new Date('2027-01-02'), amount: 85000, priority: 20 },
      ],
    });
    const nightDates = [new Date('2026-12-30'), new Date('2026-12-31'), new Date('2027-01-01'), new Date('2027-01-02'), new Date('2027-01-05')];
    const pricing = await computeReservationPricing({ roomCategoryId: CATEGORY_ID, ratePlanId: RATE_ID, nights: 5, roomsCount: 2, nightDates });
    expect(pricing.rateSnapshot.nightlyRates.map(({ amount }) => amount)).toEqual([50000, 85000, 85000, 50000, 35000]);
    expect(pricing.rateSnapshot.nightlyRates[1]).toMatchObject({ periodId: 'period-high', periodLabel: 'Réveillon', priority: 20 });
    expect(pricing.subtotal).toBe((50000 + 85000 + 85000 + 50000 + 35000) * 2);
    expect(pricing.totalAmount).toBe(pricing.subtotal);
  });
});

describe('createReservation — parcours public/propriétaire/admin — TEST DATA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, name: 'Hôtel Test', manager: OWNER_ID });
    RoomCategory.findOne = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, hotel: HOTEL_ID, status: 'actif' });
    RatePlan.findOne = jest.fn().mockResolvedValue({ amount: 35000, currency: 'XAF', rateType: 'public', active: true });
    availability.assertNotPast.mockReturnValue(undefined);
    availability.assertAvailability.mockResolvedValue({ available: true });
    availability.getNightDates.mockReturnValue([new Date('2026-08-10'), new Date('2026-08-11')]);
    availability.reserveInventory.mockResolvedValue({ ok: true, nights: [] });
    availability.releaseInventory.mockResolvedValue();
    HotelReservation.create = jest.fn().mockImplementation(async (data) => ({ ...data, _id: 'NEW-RES', reference: 'RES-2026-000001' }));
  });

  test('création publique (source=public_web) sans compte (guestUserId=null)', async () => {
    const reservation = await createReservation({
      hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, ratePlanId: RATE_ID, guest,
      guestUserId: null, checkInDate: '2026-08-10', checkOutDate: '2026-08-12',
      roomsCount: 1, adults: 2, source: 'public_web', actingUser: {},
    });
    expect(reservation.source).toBe('public_web');
    expect(reservation.guestUser).toBeNull();
    expect(reservation.createdBy).toBeNull();
    expect(reservation.status).toBe('pending');
    expect(reservation.statusHistory[0]).toMatchObject({ from: null, to: 'pending' });
  });

  test('création propriétaire (source=owner_dashboard) journalise createdBy', async () => {
    const reservation = await createReservation({
      hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, ratePlanId: RATE_ID, guest,
      checkInDate: '2026-08-10', checkOutDate: '2026-08-12', roomsCount: 1, adults: 1,
      source: 'owner_dashboard', actingUser: { id: OWNER_ID },
    });
    expect(reservation.source).toBe('owner_dashboard');
    expect(reservation.createdBy).toBe(OWNER_ID);
  });

  test('création admin (source=admin_dashboard)', async () => {
    const reservation = await createReservation({
      hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, ratePlanId: RATE_ID, guest,
      checkInDate: '2026-08-10', checkOutDate: '2026-08-12', roomsCount: 1, adults: 1,
      source: 'admin_dashboard', actingUser: { id: USER_ID },
    });
    expect(reservation.source).toBe('admin_dashboard');
  });

  test('le prix est bien calculé côté serveur (jamais confiance à un total envoyé par le client)', async () => {
    const reservation = await createReservation({
      hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, ratePlanId: RATE_ID, guest,
      checkInDate: '2026-08-10', checkOutDate: '2026-08-12', roomsCount: 2, adults: 1,
      source: 'public_web', actingUser: {},
      // Un éventuel `totalAmount` envoyé par un client serait ignoré : le
      // service ne lit jamais de champ de prix depuis les paramètres d'entrée.
    });
    expect(reservation.subtotal).toBe(35000 * 2 * 2); // 2 nuits (mock) x 2 chambres
  });

  test('409 si reserveInventory échoue (dates devenues indisponibles) — la réservation n\'est jamais créée', async () => {
    availability.reserveInventory.mockResolvedValue({ ok: false, unavailableDates: [new Date('2026-08-10')] });
    await expect(createReservation({
      hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, ratePlanId: RATE_ID, guest,
      checkInDate: '2026-08-10', checkOutDate: '2026-08-12', roomsCount: 1, adults: 1,
      source: 'public_web', actingUser: {},
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(HotelReservation.create).not.toHaveBeenCalled();
  });

  test('compensation : si HotelReservation.create échoue après réservation du stock, l\'inventaire est libéré', async () => {
    HotelReservation.create = jest.fn().mockRejectedValue(new Error('DB down'));
    await expect(createReservation({
      hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, ratePlanId: RATE_ID, guest,
      checkInDate: '2026-08-10', checkOutDate: '2026-08-12', roomsCount: 1, adults: 1,
      source: 'public_web', actingUser: {},
    })).rejects.toThrow('DB down');
    expect(availability.releaseInventory).toHaveBeenCalled();
  });

  test('catégorie inactive refusée', async () => {
    RoomCategory.findOne = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, hotel: HOTEL_ID, status: 'inactif' });
    await expect(createReservation({
      hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, ratePlanId: RATE_ID, guest,
      checkInDate: '2026-08-10', checkOutDate: '2026-08-12', roomsCount: 1, adults: 1,
      source: 'public_web', actingUser: {},
    })).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe('transitionStatus — cycle de vie centralisé — TEST DATA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    availability.releaseInventory.mockResolvedValue();
    // Par défaut, aucune chambre affectée — comportement pré-Sprint D
    // inchangé pour la majorité des tests de ce describe.
    roomAssignmentService.releaseRoom.mockRejectedValue(NO_ACTIVE_ASSIGNMENT);
  });

  const pendingReservation = () => ({
    _id: 'RES-1', status: 'pending', reference: 'RES-2026-000001',
    roomCategory: CATEGORY_ID, checkInDate: new Date(), checkOutDate: new Date(), roomsCount: 1,
    statusHistory: [], guestUser: null,
    save: jest.fn().mockResolvedValue(),
  });

  test('pending → confirmed : autorisé, historisé, inventaire non libéré', async () => {
    const res = pendingReservation();
    const updated = await transitionStatus(res, { to: 'confirmed', actingUser: { id: USER_ID } });
    expect(updated.status).toBe('confirmed');
    expect(updated.statusHistory).toHaveLength(1);
    expect(updated.statusHistory[0]).toMatchObject({ from: 'pending', to: 'confirmed' });
    expect(availability.releaseInventory).not.toHaveBeenCalled();
  });

  test('pending → rejected : autorisé, libère l\'inventaire, enregistre le motif', async () => {
    const res = pendingReservation();
    const updated = await transitionStatus(res, { to: 'rejected', actingUser: { id: USER_ID }, reason: 'Complet' });
    expect(updated.status).toBe('rejected');
    expect(updated.rejectionReason).toBe('Complet');
    expect(availability.releaseInventory).toHaveBeenCalled();
  });

  test('pending → cancelled : autorisé, libère l\'inventaire, enregistre l\'auteur', async () => {
    const res = pendingReservation();
    const updated = await transitionStatus(res, { to: 'cancelled', actingUser: { id: USER_ID }, reason: 'Changement de plan' });
    expect(updated.status).toBe('cancelled');
    expect(updated.cancelledBy).toBe(USER_ID);
    expect(availability.releaseInventory).toHaveBeenCalled();
  });

  test('pending → expired : autorisé (expiration automatique), libère l\'inventaire', async () => {
    const res = pendingReservation();
    const updated = await transitionStatus(res, { to: 'expired', actingUser: null, reason: 'Expiration automatique' });
    expect(updated.status).toBe('expired');
    expect(availability.releaseInventory).toHaveBeenCalled();
  });

  test('confirmed → cancelled : autorisé, libère l\'inventaire', async () => {
    const res = { ...pendingReservation(), status: 'confirmed' };
    const updated = await transitionStatus(res, { to: 'cancelled', actingUser: { id: USER_ID }, reason: 'x' });
    expect(updated.status).toBe('cancelled');
    expect(availability.releaseInventory).toHaveBeenCalled();
  });

  test('confirmed → rejected est refusé (transition incohérente)', async () => {
    const res = { ...pendingReservation(), status: 'confirmed' };
    await expect(transitionStatus(res, { to: 'rejected', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('cancelled → cancelled est idempotent (pas d\'erreur, pas de double libération)', async () => {
    const res = { ...pendingReservation(), status: 'cancelled' };
    const updated = await transitionStatus(res, { to: 'cancelled', actingUser: { id: USER_ID } });
    expect(updated.status).toBe('cancelled');
    expect(availability.releaseInventory).not.toHaveBeenCalled();
  });

  test('cancelled → confirmed est explicitement rejeté (statut terminal)', async () => {
    const res = { ...pendingReservation(), status: 'cancelled' };
    await expect(transitionStatus(res, { to: 'confirmed', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 409 });
  });

  // Correctif — anomalie réelle : une chambre pré-affectée (Sprint D) restait
  // 'reserved' indéfiniment si la réservation était annulée/rejetée/expirée
  // avant le check-in. transitionStatus doit désormais libérer toute
  // affectation active dans ce cas.
  describe('libération de la chambre affectée sur annulation/rejet/expiration (correctif)', () => {
    test('confirmed → cancelled avec une chambre affectée : la chambre est libérée vers "available"', async () => {
      roomAssignmentService.releaseRoom.mockResolvedValue({ assignment: { _id: 'ASSIGN-1' }, room: { _id: 'ROOM-1', status: 'available' } });
      const res = { ...pendingReservation(), status: 'confirmed' };
      await transitionStatus(res, { to: 'cancelled', actingUser: { id: USER_ID }, reason: 'x' });
      expect(roomAssignmentService.releaseRoom).toHaveBeenCalledWith(
        expect.objectContaining({ reservationId: 'RES-1', nextRoomStatus: 'available' }),
      );
    });

    test("pending → rejected sans chambre affectée : aucune erreur (404 avalée silencieusement)", async () => {
      const res = pendingReservation();
      const updated = await transitionStatus(res, { to: 'rejected', actingUser: { id: USER_ID }, reason: 'Complet' });
      expect(updated.status).toBe('rejected');
    });

    test('pending → expired avec une chambre affectée : la chambre est aussi libérée', async () => {
      roomAssignmentService.releaseRoom.mockResolvedValue({ assignment: { _id: 'ASSIGN-2' }, room: { _id: 'ROOM-2', status: 'available' } });
      const res = pendingReservation();
      await transitionStatus(res, { to: 'expired', actingUser: null, reason: 'Expiration automatique' });
      expect(roomAssignmentService.releaseRoom).toHaveBeenCalled();
    });

    test('une erreur non-404 lors de la libération remonte (jamais avalée silencieusement)', async () => {
      const boom = Object.assign(new Error('DB indisponible'), { statusCode: 500 });
      roomAssignmentService.releaseRoom.mockRejectedValue(boom);
      const res = { ...pendingReservation(), status: 'confirmed' };
      await expect(transitionStatus(res, { to: 'cancelled', actingUser: { id: USER_ID }, reason: 'x' })).rejects.toBe(boom);
    });
  });
});

describe('updateReservation — modification (mission §9) — TEST DATA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    RatePlan.findOne = jest.fn().mockResolvedValue({ amount: 40000, currency: 'XAF', rateType: 'public', active: true });
    availability.getNightDates.mockReturnValue([new Date('2026-08-10'), new Date('2026-08-11'), new Date('2026-08-12')]);
    availability.reserveInventory.mockResolvedValue({ ok: true, nights: [] });
    availability.releaseInventory.mockResolvedValue();
  });

  const confirmedReservation = () => ({
    _id: 'RES-1', status: 'confirmed', hotel: HOTEL_ID,
    roomCategory: CATEGORY_ID, ratePlan: RATE_ID,
    checkInDate: new Date('2026-08-10'), checkOutDate: new Date('2026-08-12'),
    roomsCount: 1, adults: 1, children: 0,
    save: jest.fn().mockResolvedValue(),
  });

  test('changement de dates : réserve le nouveau stock AVANT de libérer l\'ancien (jamais de fenêtre de surbooking)', async () => {
    const res = confirmedReservation();
    const callOrder = [];
    availability.reserveInventory.mockImplementation(async () => { callOrder.push('reserve'); return { ok: true, nights: [] }; });
    availability.releaseInventory.mockImplementation(async () => { callOrder.push('release'); });

    await updateReservation(res, { checkInDate: '2026-08-15', checkOutDate: '2026-08-18' }, { id: USER_ID });
    expect(callOrder).toEqual(['reserve', 'release']);
  });

  test('le prix est recalculé après modification (jamais figé)', async () => {
    const res = confirmedReservation();
    const updated = await updateReservation(res, { checkInDate: '2026-08-15', checkOutDate: '2026-08-18' }, { id: USER_ID });
    expect(updated.unitPrice).toBe(40000);
    expect(updated.subtotal).toBe(40000 * 3 * 1);
  });

  test('409 si le nouveau stock est indisponible — la réservation existante n\'est pas modifiée', async () => {
    availability.reserveInventory.mockResolvedValue({ ok: false, unavailableDates: [new Date('2026-08-15')] });
    const res = confirmedReservation();
    await expect(updateReservation(res, { checkInDate: '2026-08-15', checkOutDate: '2026-08-18' }, { id: USER_ID }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(res.checkInDate.toISOString().slice(0, 10)).toBe('2026-08-10'); // inchangé
    expect(availability.releaseInventory).not.toHaveBeenCalled(); // ancien stock jamais touché
  });

  test('une réservation annulée/rejetée/expirée ne peut plus être modifiée', async () => {
    const res = { ...confirmedReservation(), status: 'cancelled' };
    await expect(updateReservation(res, { adults: 3 }, { id: USER_ID })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('modifier uniquement adults/children/specialRequests ne touche pas l\'inventaire', async () => {
    const res = confirmedReservation();
    await updateReservation(res, { adults: 2, specialRequests: 'Lit bébé' }, { id: USER_ID });
    expect(availability.reserveInventory).not.toHaveBeenCalled();
    expect(availability.releaseInventory).not.toHaveBeenCalled();
    expect(res.adults).toBe(2);
    expect(res.specialRequests).toBe('Lit bébé');
  });
});
