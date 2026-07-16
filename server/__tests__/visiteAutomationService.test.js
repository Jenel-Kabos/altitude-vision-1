jest.mock('../models/Visite', () => ({
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../services/notificationService', () => ({
  notify: jest.fn().mockResolvedValue({}),
  notifyStaff: jest.fn().mockResolvedValue({}),
}));

const Visite = require('../models/Visite');
const { notify } = require('../services/notificationService');
const { processVisitAutomation } = require('../services/visiteAutomationService');

const queryWith = (value) => ({ populate: jest.fn().mockResolvedValue(value) });

describe('visiteAutomationService — TEST DATA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Visite.findOneAndUpdate.mockResolvedValue({ _id: 'TEST-DATA-VISIT' });
  });

  test.each([
    ['twentyFourHours', 23 * 60 * 60 * 1000],
    ['twoHours', 90 * 60 * 1000],
    ['thirtyMinutes', 20 * 60 * 1000],
  ])('envoie le rappel %s une seule fois', async (key, offset) => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    const visite = {
      _id: { toString: () => 'TEST-DATA-VISIT' }, client: 'TEST-DATA-CLIENT',
      status: 'confirmee', scheduledStartAt: new Date(now.getTime() + offset),
      reminderStates: { twentyFourHours: key !== 'twentyFourHours', twoHours: key !== 'twoHours', thirtyMinutes: key !== 'thirtyMinutes' },
      property: { title: 'TEST DATA PROPERTY', owner: 'TEST-DATA-OWNER' },
    };
    Visite.find.mockReturnValueOnce(queryWith([visite])).mockReturnValueOnce([]);
    const result = await processVisitAutomation(now);
    expect(result.reminders).toBe(1);
    expect(Visite.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ [`reminderStates.${key}`]: { $ne: true } }),
      { $set: { [`reminderStates.${key}`]: true } },
      { new: true },
    );
    expect(notify).toHaveBeenCalledTimes(2);
  });

  test('une visite annulée ou terminée est exclue par la requête', async () => {
    Visite.find.mockReturnValueOnce(queryWith([])).mockReturnValueOnce([]);
    const result = await processVisitAutomation(new Date('2030-01-01T00:00:00.000Z'));
    expect(result.reminders).toBe(0);
    expect(Visite.find.mock.calls[0][0]).toMatchObject({ status: 'confirmee' });
    expect(Visite.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('deux exécutions concurrentes ne réservent le même rappel qu’une fois', async () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    const visite = {
      _id: { toString: () => 'TEST-DATA-VISIT' }, client: 'TEST-DATA-CLIENT',
      status: 'confirmee', scheduledStartAt: new Date(now.getTime() + 20 * 60 * 1000),
      reminderStates: { twentyFourHours: true, twoHours: true, thirtyMinutes: false },
      property: { title: 'TEST DATA PROPERTY', owner: 'TEST-DATA-OWNER' },
    };
    Visite.find.mockImplementation((query) => query.status === 'confirmee' ? queryWith([visite]) : []);
    Visite.findOneAndUpdate.mockResolvedValueOnce({ _id: visite._id }).mockResolvedValueOnce(null);
    const results = await Promise.all([processVisitAutomation(now), processVisitAutomation(now)]);
    expect(results.map((result) => result.reminders).sort()).toEqual([0, 1]);
    expect(notify).toHaveBeenCalledTimes(2);
  });
});
