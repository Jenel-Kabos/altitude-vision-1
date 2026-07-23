// __tests__/checkInOutService.test.js — Sprint D
// checkInService/checkOutService — roomAssignmentService est mocké (déjà
// testé isolément, y compris la concurrence, dans roomAssignmentService.test.js).

jest.mock('../models/HotelReservation');
jest.mock('../models/Room');
jest.mock('../models/FinancialDocument');
jest.mock('../services/roomAssignmentService');
jest.mock('../services/finance/hotelBillingAdapter', () => ({ createHotelInvoiceDraftFromReservation: jest.fn() }));
jest.mock('../services/finance/hotelCheckoutFinancialReadinessService', () => ({ evaluateHotelCheckoutFinancialReadiness: jest.fn() }));
jest.mock('../services/finance/financialAuthorizationService', () => ({ CAPABILITIES: { HOTEL_CHECKOUT_OVERRIDE: 'override' }, authorizeFinancialAction: jest.fn() }));
jest.mock('../services/finance/financialLedgerService', () => ({ appendFinancialLedgerEntry: jest.fn() }));
// Sprint E — checkOutService crée désormais une HousekeepingTask
// automatiquement (mission §3) ; testé isolément dans
// housekeepingService.test.js / checkOutService.test.js dédié.
jest.mock('../services/housekeepingService', () => ({ createTask: jest.fn().mockResolvedValue({}) }));
jest.mock('../services/notificationService', () => ({ notify: jest.fn().mockResolvedValue(), notifyStaff: jest.fn().mockResolvedValue() }));
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const HotelReservation = require('../models/HotelReservation');
const Room = require('../models/Room');
const FinancialDocument = require('../models/FinancialDocument');
const roomAssignmentService = require('../services/roomAssignmentService');
const { createHotelInvoiceDraftFromReservation } = require('../services/finance/hotelBillingAdapter');
const { evaluateHotelCheckoutFinancialReadiness } = require('../services/finance/hotelCheckoutFinancialReadinessService');
const financialAuthz = require('../services/finance/financialAuthorizationService');
const financialLedger = require('../services/finance/financialLedgerService');
const housekeepingService = require('../services/housekeepingService');
const { performCheckIn } = require('../services/checkInService');
const { performCheckOut } = require('../services/checkOutService');

HotelReservation.ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'rejected', 'cancelled', 'expired'],
  confirmed: ['cancelled', 'checked_in'],
  checked_in: ['checked_out'],
  checked_out: [], cancelled: [], expired: [], rejected: [],
};

const RESERVATION_ID = '907f1f77bcf86cd799439077';
const ROOM_ID = 'a07f1f77bcf86cd799439088';
const USER_ID = '507f1f77bcf86cd799439012';

const confirmedReservation = (overrides = {}) => ({
  _id: RESERVATION_ID, status: 'confirmed', reference: 'RES-2026-000001',
  statusHistory: [], guestUser: null,
  save: jest.fn().mockResolvedValue(),
  ...overrides,
});

describe('checkInService.performCheckIn — TEST DATA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FinancialDocument.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    createHotelInvoiceDraftFromReservation.mockResolvedValue({ _id: 'f07f1f77bcf86cd799439010', status: 'draft' });
  });

  test('confirmed → checked_in avec une chambre déjà pré-affectée', async () => {
    const reservation = confirmedReservation();
    roomAssignmentService.getActiveAssignment.mockResolvedValue({ room: { _id: ROOM_ID, status: 'reserved', roomNumber: '101' } });
    Room.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'occupied', roomNumber: '101' });

    const result = await performCheckIn({ reservation, actingUser: { id: USER_ID } });
    expect(result.reservation.status).toBe('checked_in');
    expect(result.room.status).toBe('occupied');
    expect(result.financialDocument).toMatchObject({ status: 'draft', created: true, alreadyExisted: false });
    expect(Room.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: ROOM_ID, status: { $in: ['available', 'reserved'] } },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'occupied' }) }),
      { new: true },
    );
  });

  test('un brouillon existant est récupéré sans duplication', async () => {
    const reservation = confirmedReservation();
    roomAssignmentService.getActiveAssignment.mockResolvedValue({ room: { _id: ROOM_ID, status: 'reserved', roomNumber: '101' } });
    Room.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'occupied', roomNumber: '101' });
    FinancialDocument.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'f07f1f77bcf86cd799439010', status: 'draft' }) });
    const result = await performCheckIn({ reservation, actingUser: { id: USER_ID } });
    expect(result.financialDocument).toMatchObject({ created: false, alreadyExisted: true });
    expect(createHotelInvoiceDraftFromReservation).toHaveBeenCalledTimes(1);
  });

  test('un échec financier conserve le check-in et expose une reprise sûre', async () => {
    const reservation = confirmedReservation();
    roomAssignmentService.getActiveAssignment.mockResolvedValue({ room: { _id: ROOM_ID, status: 'reserved', roomNumber: '101' } });
    Room.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'occupied', roomNumber: '101' });
    createHotelInvoiceDraftFromReservation.mockRejectedValue(Object.assign(new Error('Mongo indisponible'), { code: 'FINANCIAL_DRAFT_TEMPORARY_FAILURE' }));
    const result = await performCheckIn({ reservation, actingUser: { id: USER_ID } });
    expect(result.reservation.status).toBe('checked_in');
    expect(result.financialDocument).toEqual({ status: 'creation_failed', retryable: true, code: 'FINANCIAL_DRAFT_TEMPORARY_FAILURE' });
  });

  test("affecte automatiquement une chambre au check-in si aucune n'était pré-affectée", async () => {
    const reservation = confirmedReservation();
    roomAssignmentService.getActiveAssignment.mockResolvedValue(null);
    roomAssignmentService.assignRoom.mockResolvedValue({
      room: ROOM_ID,
      populate: jest.fn().mockResolvedValue({ room: { _id: ROOM_ID, status: 'reserved', roomNumber: '102' } }),
    });
    Room.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'occupied', roomNumber: '102' });

    const result = await performCheckIn({ reservation, roomId: ROOM_ID, actingUser: { id: USER_ID } });
    expect(roomAssignmentService.assignRoom).toHaveBeenCalled();
    expect(result.reservation.status).toBe('checked_in');
  });

  test('422 si aucune chambre affectée et aucun roomId fourni', async () => {
    const reservation = confirmedReservation();
    roomAssignmentService.getActiveAssignment.mockResolvedValue(null);
    await expect(performCheckIn({ reservation, actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 422 });
  });

  test('409 si la réservation n\'est pas confirmed', async () => {
    const reservation = confirmedReservation({ status: 'pending' });
    await expect(performCheckIn({ reservation, roomId: ROOM_ID, actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('409 si la chambre affectée a été occupée entre-temps (course évitée)', async () => {
    const reservation = confirmedReservation();
    roomAssignmentService.getActiveAssignment.mockResolvedValue({ room: { _id: ROOM_ID, status: 'reserved', roomNumber: '101' } });
    Room.findOneAndUpdate = jest.fn().mockResolvedValue(null); // condition atomique échouée
    await expect(performCheckIn({ reservation, actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('historise la transition avec from/to/changedBy', async () => {
    const reservation = confirmedReservation();
    roomAssignmentService.getActiveAssignment.mockResolvedValue({ room: { _id: ROOM_ID, status: 'reserved', roomNumber: '101' } });
    Room.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'occupied', roomNumber: '101' });
    const result = await performCheckIn({ reservation, actingUser: { id: USER_ID } });
    expect(result.reservation.statusHistory[0]).toMatchObject({ from: 'confirmed', to: 'checked_in', changedBy: USER_ID });
  });

  // Correctif — garde-fou multi-chambres (§3) : performCheckIn délègue le
  // contrôle à roomAssignmentService.assertSingleRoom (source de vérité
  // unique, déjà testée en profondeur dans roomAssignmentService.test.js).
  // Ici on vérifie seulement le CÂBLAGE : l'appel a bien lieu, et une
  // exception levée par ce garde-fou est bien propagée sans être avalée.
  describe('garde-fou multi-chambres (câblage)', () => {
    test('assertSingleRoom est appelé avec la réservation avant toute autre opération', async () => {
      const reservation = confirmedReservation({ roomsCount: 1 });
      roomAssignmentService.getActiveAssignment.mockResolvedValue({ room: { _id: ROOM_ID, status: 'reserved', roomNumber: '101' } });
      Room.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'occupied', roomNumber: '101' });
      await performCheckIn({ reservation, actingUser: { id: USER_ID } });
      expect(roomAssignmentService.assertSingleRoom).toHaveBeenCalledWith(reservation);
    });

    test('une exception de assertSingleRoom (roomsCount > 1) est propagée, check-in refusé', async () => {
      const reservation = confirmedReservation({ roomsCount: 3 });
      const err = Object.assign(new Error('Cette réservation comporte plusieurs chambres et nécessite une affectation multiple, non encore prise en charge.'), { statusCode: 409 });
      roomAssignmentService.assertSingleRoom.mockImplementation(() => { throw err; });
      await expect(performCheckIn({ reservation, actingUser: { id: USER_ID } })).rejects.toBe(err);
      expect(roomAssignmentService.getActiveAssignment).not.toHaveBeenCalled();
    });
  });
});

describe('checkOutService.performCheckOut — TEST DATA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    housekeepingService.createTask.mockResolvedValue({});
    evaluateHotelCheckoutFinancialReadiness.mockResolvedValue({ allowed: true, status: 'ready', blockers: [], warnings: [], financialSnapshot: {} });
    financialAuthz.authorizeFinancialAction.mockResolvedValue({});
    financialLedger.appendFinancialLedgerEntry.mockResolvedValue({ _id: 'audit-1' });
  });

  const HOTEL_ID = '707f1f77bcf86cd799439055';

  const checkedInReservation = (overrides = {}) => ({
    _id: RESERVATION_ID, status: 'checked_in', reference: 'RES-2026-000001', hotel: HOTEL_ID,
    statusHistory: [], guestUser: null,
    save: jest.fn().mockResolvedValue(),
    ...overrides,
  });

  test('checked_in → checked_out libère la chambre en "cleaning" (jamais "available" directement)', async () => {
    const reservation = checkedInReservation();
    roomAssignmentService.getActiveAssignment.mockResolvedValue({ room: ROOM_ID });
    roomAssignmentService.releaseRoom.mockResolvedValue({ room: { _id: ROOM_ID, status: 'cleaning' } });

    const result = await performCheckOut({ reservation, actingUser: { id: USER_ID } });
    expect(result.reservation.status).toBe('checked_out');
    expect(roomAssignmentService.releaseRoom).toHaveBeenCalledWith(expect.objectContaining({ nextRoomStatus: 'cleaning' }));
    expect(result.room.status).toBe('cleaning');
  });

  // Sprint E — génération automatique d'une tâche de ménage au check-out (mission §3).
  describe('génération automatique de la tâche de ménage (Sprint E, câblage)', () => {
    test('createTask est appelé avec le type checkout_cleaning et la priorité normal', async () => {
      const reservation = checkedInReservation();
      roomAssignmentService.getActiveAssignment.mockResolvedValue({ room: ROOM_ID });
      roomAssignmentService.releaseRoom.mockResolvedValue({ room: { _id: ROOM_ID, status: 'cleaning' } });

      await performCheckOut({ reservation, actingUser: { id: USER_ID } });
      expect(housekeepingService.createTask).toHaveBeenCalledWith(expect.objectContaining({
        roomId: ROOM_ID, hotelId: HOTEL_ID, reservationId: RESERVATION_ID, type: 'checkout_cleaning', priority: 'normal',
      }));
    });

    test('une tâche déjà ouverte (409) est absorbée silencieusement — le check-out réussit quand même', async () => {
      const reservation = checkedInReservation();
      roomAssignmentService.getActiveAssignment.mockResolvedValue({ room: ROOM_ID });
      roomAssignmentService.releaseRoom.mockResolvedValue({ room: { _id: ROOM_ID, status: 'cleaning' } });
      const err = Object.assign(new Error('Une tâche de ménage est déjà ouverte pour cette chambre.'), { statusCode: 409 });
      housekeepingService.createTask.mockRejectedValue(err);

      const result = await performCheckOut({ reservation, actingUser: { id: USER_ID } });
      expect(result.reservation.status).toBe('checked_out');
    });

    test('une erreur non-409 de createTask remonte (jamais avalée silencieusement)', async () => {
      const reservation = checkedInReservation();
      roomAssignmentService.getActiveAssignment.mockResolvedValue({ room: ROOM_ID });
      roomAssignmentService.releaseRoom.mockResolvedValue({ room: { _id: ROOM_ID, status: 'cleaning' } });
      const boom = Object.assign(new Error('DB indisponible'), { statusCode: 500 });
      housekeepingService.createTask.mockRejectedValue(boom);

      await expect(performCheckOut({ reservation, actingUser: { id: USER_ID } })).rejects.toBe(boom);
    });

    test('pas de tâche créée si la réservation n\'avait pas de chambre affectée', async () => {
      const reservation = checkedInReservation();
      roomAssignmentService.getActiveAssignment.mockResolvedValue(null);
      await performCheckOut({ reservation, actingUser: { id: USER_ID } });
      expect(housekeepingService.createTask).not.toHaveBeenCalled();
    });
  });

  test('409 si la réservation n\'est pas checked_in', async () => {
    const reservation = checkedInReservation({ status: 'confirmed' });
    await expect(performCheckOut({ reservation, actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('fonctionne même sans affectation active (garde-fou défensif, ne plante jamais)', async () => {
    const reservation = checkedInReservation();
    roomAssignmentService.getActiveAssignment.mockResolvedValue(null);
    const result = await performCheckOut({ reservation, actingUser: { id: USER_ID } });
    expect(result.reservation.status).toBe('checked_out');
    expect(roomAssignmentService.releaseRoom).not.toHaveBeenCalled();
  });

  test('historise la transition', async () => {
    const reservation = checkedInReservation();
    roomAssignmentService.getActiveAssignment.mockResolvedValue({ room: ROOM_ID });
    roomAssignmentService.releaseRoom.mockResolvedValue({ room: { _id: ROOM_ID, status: 'cleaning' } });
    const result = await performCheckOut({ reservation, actingUser: { id: USER_ID }, reason: 'Départ anticipé' });
    expect(result.reservation.statusHistory[0]).toMatchObject({ from: 'checked_in', to: 'checked_out', reason: 'Départ anticipé' });
  });

  test('bloque avant toute mutation et expose CHECKOUT_BLOCKED_FINANCIAL', async () => {
    const reservation = checkedInReservation();
    evaluateHotelCheckoutFinancialReadiness.mockResolvedValue({ allowed: false, status: 'blocked', blockers: [{ code: 'FINANCIAL_BALANCE_REMAINING' }], warnings: [], financialSnapshot: { balanceMinor: 10000, currency: 'XAF' } });
    await expect(performCheckOut({ reservation, actingUser: { id: USER_ID, role: 'Collaborateur' } })).rejects.toMatchObject({ code: 'CHECKOUT_BLOCKED_FINANCIAL', statusCode: 409 });
    expect(roomAssignmentService.getActiveAssignment).not.toHaveBeenCalled(); expect(housekeepingService.createTask).not.toHaveBeenCalled(); expect(reservation.save).not.toHaveBeenCalled();
  });

  test('refuse la dérogation au gestionnaire', async () => {
    const reservation = checkedInReservation();
    evaluateHotelCheckoutFinancialReadiness.mockResolvedValue({ allowed: false, status: 'blocked', blockers: [{ code: 'FINANCIAL_BALANCE_REMAINING' }], warnings: [], financialSnapshot: { balanceMinor: 10000, currency: 'XAF' } });
    await expect(performCheckOut({ reservation, actingUser: { id: USER_ID, role: 'Collaborateur' }, financialOverride: { requested: true, reason: 'Validation exceptionnelle documentée' } })).rejects.toMatchObject({ code: 'FINANCIAL_OVERRIDE_FORBIDDEN', statusCode: 403 });
  });

  test('Admin déroge avec audit sans modifier les faits financiers', async () => {
    const reservation = checkedInReservation();
    evaluateHotelCheckoutFinancialReadiness.mockResolvedValue({ allowed: false, status: 'blocked', blockers: [{ code: 'FINANCIAL_BALANCE_REMAINING' }], warnings: [{ code: 'UNALLOCATED_CONFIRMED_PAYMENT' }], financialSnapshot: { documentId: '507f1f77bcf86cd799439099', documentTotalMinor: 100000, allocatedMinor: 90000, balanceMinor: 10000, paymentStatus: 'partially_paid', currency: 'XAF' } });
    roomAssignmentService.getActiveAssignment.mockResolvedValue(null);
    const result = await performCheckOut({ reservation, actingUser: { id: USER_ID, role: 'Admin' }, financialOverride: { requested: true, reason: 'Départ autorisé par la direction', ticket: 'INC-42' } });
    expect(result.financialCheckout).toMatchObject({ status: 'overridden', overrideApplied: true, overrideAuditId: 'audit-1' });
    expect(financialLedger.appendFinancialLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'hotel_checkout.financial_override', metadata: expect.objectContaining({ balanceMinor: 10000, reason: 'Départ autorisé par la direction' }) }), { session: null });
  });
});
