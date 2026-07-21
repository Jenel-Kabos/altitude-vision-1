// __tests__/hotelReservationExpiryService.test.js — Sprint C §11

jest.mock('../models/HotelReservation');
jest.mock('../models/Hotel');
jest.mock('../models/RoomCategory');
jest.mock('../models/RatePlan');
jest.mock('../services/hotelAvailabilityService');
jest.mock('../services/notificationService', () => ({ notify: jest.fn().mockResolvedValue(), notifyStaff: jest.fn().mockResolvedValue() }));
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const HotelReservation = require('../models/HotelReservation');
const availability = require('../services/hotelAvailabilityService');
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
    availability.releaseInventory.mockResolvedValue();
  });

  test('expire les réservations pending dont pendingExpiresAt est dépassé, et libère leur inventaire', async () => {
    const docs = [pendingDoc('1'), pendingDoc('2')];
    HotelReservation.find = jest.fn().mockResolvedValue(docs);

    const result = await processReservationExpiry(new Date('2026-08-20T00:00:00Z'));

    expect(result.expired).toBe(2);
    expect(docs[0].status).toBe('expired');
    expect(docs[1].status).toBe('expired');
    expect(availability.releaseInventory).toHaveBeenCalledTimes(2);
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

    const result = await processReservationExpiry();
    expect(result.expired).toBe(1);
    expect(ok.status).toBe('expired');
  });
});
