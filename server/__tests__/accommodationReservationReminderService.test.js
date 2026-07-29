jest.mock('../models/AccommodationReservation', () => ({ find: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() }));
jest.mock('../services/notificationService', () => ({ notify: jest.fn().mockResolvedValue({}) }));
const Reservation = require('../models/AccommodationReservation');
const { notify } = require('../services/notificationService');
const { brazzavilleDayBounds, processAccommodationReservationReminders } = require('../services/accommodationReservationReminderService');

const chain = (items) => ({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(items) }) });
describe('rappels des réservations hébergements', () => {
  beforeEach(() => jest.clearAllMocks());
  test('calcule le jour métier de Brazzaville autour de minuit UTC', () => {
    const bounds = brazzavilleDayBounds(new Date('2026-07-29T23:30:00.000Z'));
    expect(bounds.start.toISOString()).toBe('2026-07-29T23:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-07-30T23:00:00.000Z');
  });
  test('notifie client et propriétaire une seule fois grâce aux claims atomiques', async () => {
    const item = { _id: 'r1', guest: 'g1', owner: 'o1', status: 'confirmed' };
    Reservation.find.mockReturnValueOnce(chain([item])).mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([]));
    Reservation.findOneAndUpdate.mockResolvedValue({ get: () => new Date() });
    const result = await processAccommodationReservationReminders({ now: new Date('2026-07-29T10:00:00Z') });
    expect(result.sent).toBe(2); expect(notify).toHaveBeenCalledTimes(2);
    Reservation.find.mockReturnValueOnce(chain([item])).mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([])); Reservation.findOneAndUpdate.mockResolvedValue(null);
    const rerun = await processAccommodationReservationReminders({ now: new Date('2026-07-29T10:05:00Z') });
    expect(rerun.sent).toBe(0); expect(notify).toHaveBeenCalledTimes(2);
  });
});
