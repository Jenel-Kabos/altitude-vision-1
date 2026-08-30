jest.mock('node-cron', () => ({ schedule: jest.fn(() => ({ stop: jest.fn() })) }));
jest.mock('../scripts/sync-facebook', () => ({ syncFacebook: jest.fn() }));
jest.mock('../services/zohoImapService', () => ({ pollZohoInbox: jest.fn() }));
jest.mock('../services/accommodationReservationReminderService', () => ({ processAccommodationReservationReminders: jest.fn() }));
jest.mock('../services/alerteService', () => ({ verifierPaiementsEnRetard: jest.fn() }));
jest.mock('../services/rentalFinancialAutomationService', () => ({ runRentalFinancialAutomations: jest.fn() }));
jest.mock('../services/visiteAutomationService', () => ({ processVisitAutomation: jest.fn() }));
jest.mock('../services/hotelReservationExpiryService', () => ({ processReservationExpiry: jest.fn() }));
jest.mock('../services/realEstateApplicationService', () => ({ expireReservations: jest.fn(), sendExpirationReminders: jest.fn() }));

const cron = require('node-cron');
const { JOB_REGISTRY } = require('../services/scheduledJobs/jobRegistry');
const { registerScheduledJobs } = require('../services/scheduledJobs/schedulerService');

beforeEach(() => jest.clearAllMocks());

test('registre canonique préserve les sept jobs et leurs cadences', () => {
  expect(JOB_REGISTRY.map(({ name, schedule }) => [name, schedule])).toEqual([
    ['facebook-sync', '0 * * * *'],
    ['zoho-imap-poll', '*/5 * * * *'],
    ['accommodation-reminders', '*/15 * * * *'],
    ['rental-penalties-alerts', '0 6 * * *'],
    ['visit-automation', '*/5 * * * *'],
    ['hotel-reservation-expiry', '*/5 * * * *'],
    ['real-estate-expiry', '*/5 * * * *'],
  ]);
  expect(JOB_REGISTRY.find(({ name }) => name === 'rental-penalties-alerts').timezone).toBe('Africa/Brazzaville');
});

test('DISABLE_SCHEDULED_JOBS reste un kill switch complet', () => {
  expect(registerScheduledJobs({ disabled: true })).toEqual([]);
  expect(cron.schedule).not.toHaveBeenCalled();
});

test('chaque job est enregistré une seule fois et le timezone quotidien est explicite', () => {
  registerScheduledJobs({ disabled: false });
  expect(cron.schedule).toHaveBeenCalledTimes(7);
  expect(cron.schedule).toHaveBeenCalledWith('0 6 * * *', expect.any(Function), { timezone: 'Africa/Brazzaville' });
});
