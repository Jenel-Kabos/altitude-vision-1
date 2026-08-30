// __tests__/hotelReservationExpiryService.test.js — Sprint C §11

jest.mock('../models/HotelReservation');
jest.mock('../models/Hotel');
jest.mock('../models/RoomCategory');
jest.mock('../models/RatePlan');
jest.mock('../services/hotelAvailabilityService');
jest.mock('../services/roomAssignmentService', () => ({ releaseRoom: jest.fn(), releaseAllRooms: jest.fn() }));
jest.mock('../services/hotelReservationNotificationService', () => ({ notifyReservationGuest: jest.fn().mockResolvedValue() }));
jest.mock('../socket', () => ({ emitHotelEvent: jest.fn().mockResolvedValue() }));
jest.mock('../services/notificationService', () => ({ notify: jest.fn().mockResolvedValue(), notifyStaff: jest.fn().mockResolvedValue() }));
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const HotelReservation = require('../models/HotelReservation');
const { notifyStaff } = require('../services/notificationService');
const { processReservationExpiry } = require('../services/hotelReservationExpiryService');

HotelReservation.ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'rejected', 'cancelled', 'expired'],
  confirmed: ['cancelled'],
  cancelled: [], expired: [], rejected: [],
};

const pendingDoc = (id) => ({
  _id: id, status: 'pending', reference: `RES-2026-${id}`,
  roomCategory: 'CAT-1', checkInDate: new Date(), checkOutDate: new Date(), roomsCount: 1,
  statusHistory: [], guestUser: null,
  save: jest.fn().mockResolvedValue(),
});

describe('processReservationExpiry — Sprint C §11 — TEST DATA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('expire les réservations pending dont pendingExpiresAt est dépassé, et libère leur inventaire', async () => {
    const docs = [pendingDoc('1'), pendingDoc('2')];
    HotelReservation.find = jest.fn().mockResolvedValue(docs);

    const expireOne = jest.fn(async (id) => ({ _id: id, status: 'expired' }));
    const result = await processReservationExpiry(new Date('2026-08-20T00:00:00Z'), { expireOne });

    expect(result.expired).toBe(2);
    expect(expireOne).toHaveBeenCalledTimes(2);
    expect(notifyStaff).toHaveBeenCalled();
  });

  test('ne touche jamais une réservation confirmée (seule "pending" est ciblée par la requête)', async () => {
    HotelReservation.find = jest.fn().mockResolvedValue([]);
    await processReservationExpiry();
    expect(HotelReservation.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
    );
  });

  test('aucune réservation à expirer → 0, aucune notification envoyée', async () => {
    HotelReservation.find = jest.fn().mockResolvedValue([]);
    const result = await processReservationExpiry();
    expect(result.expired).toBe(0);
    expect(notifyStaff).not.toHaveBeenCalled();
  });

  test("une erreur sur une réservation n'empêche pas l'expiration des autres", async () => {
    const ok = pendingDoc('ok');
    const broken = pendingDoc('broken');
    broken.save = jest.fn().mockRejectedValue(new Error('DB error'));
    HotelReservation.find = jest.fn().mockResolvedValue([broken, ok]);

    const expireOne = jest.fn()
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({ _id: 'ok', status: 'expired' });
    const result = await processReservationExpiry(new Date(), { expireOne });
    expect(result.expired).toBe(1);
    expect(expireOne).toHaveBeenCalledTimes(2);
  });
});
