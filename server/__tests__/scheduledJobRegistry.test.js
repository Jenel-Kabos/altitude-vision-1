jest.mock('node-cron', () => ({ schedule: jest.fn(() => ({ stop: jest.fn() })) }));
jest.mock('../scripts/sync-facebook', () => ({ syncFacebook: jest.fn() }));
jest.mock('../services/zohoImapService', () => ({ pollZohoInbox: jest.fn() }));
jest.mock('../services/accommodationReservationReminderService', () => ({ processAccommodationReservationReminders: jest.fn() }));
jest.mock('../services/accommodationReservationExpiryService', () => ({ processAccommodationReservationExpiry: jest.fn() }));
jest.mock('../services/alerteService', () => ({ verifierPaiementsEnRetard: jest.fn() }));
jest.mock('../services/rentalFinancialAutomationService', () => ({ runRentalFinancialAutomations: jest.fn() }));
jest.mock('../services/finance/billing/rentCollectionService', () => ({ runRentCollectionCycle: jest.fn(async () => ({ checked: 2, penalties: 1, cases: 0, errors: 0 })) }));
jest.mock('../services/visiteAutomationService', () => ({ processVisitAutomation: jest.fn() }));
jest.mock('../services/hotelReservationExpiryService', () => ({ processReservationExpiry: jest.fn() }));
jest.mock('../services/realEstateApplicationService', () => ({ expireReservations: jest.fn(), sendExpirationReminders: jest.fn() }));

const cron = require('node-cron');
const { JOB_REGISTRY } = require('../services/scheduledJobs/jobRegistry');
const { registerScheduledJobs } = require('../services/scheduledJobs/schedulerService');

beforeEach(() => jest.clearAllMocks());

test('registre canonique : huit jobs historiques + cycle locatif F-U2.11, cadences préservées', () => {
  expect(JOB_REGISTRY.map(({ name, schedule }) => [name, schedule])).toEqual([
    ['facebook-sync', '0 * * * *'],
    ['zoho-imap-poll', '*/5 * * * *'],
    ['accommodation-reminders', '*/15 * * * *'],
    ['accommodation-reservation-expiry', '*/5 * * * *'],
    ['rental-penalties-alerts', '0 6 * * *'],
    ['rental-collection-cycle', '30 6 * * *'],
    ['visit-automation', '*/5 * * * *'],
    ['hotel-reservation-expiry', '*/5 * * * *'],
    ['real-estate-expiry', '*/5 * * * *'],
  ]);
  expect(JOB_REGISTRY.find(({ name }) => name === 'rental-penalties-alerts').timezone).toBe('Africa/Brazzaville');
  expect(JOB_REGISTRY.find(({ name }) => name === 'rental-collection-cycle').timezone).toBe('Africa/Brazzaville');
});

test('DISABLE_SCHEDULED_JOBS reste un kill switch complet', () => {
  expect(registerScheduledJobs({ disabled: true })).toEqual([]);
  expect(cron.schedule).not.toHaveBeenCalled();
});

test('chaque job est enregistré une seule fois et le timezone quotidien est explicite', () => {
  registerScheduledJobs({ disabled: false });
  expect(cron.schedule).toHaveBeenCalledTimes(9);
  expect(cron.schedule).toHaveBeenCalledWith('0 6 * * *', expect.any(Function), { timezone: 'Africa/Brazzaville' });
});

describe('F-U2.11 — un seul moteur de pénalités actif', () => {
  const { rentalHandler, rentalCollectionHandler } = require('../services/scheduledJobs/jobRegistry');
  const { verifierPaiementsEnRetard } = require('../services/alerteService');
  const { runRentCollectionCycle } = require('../services/finance/billing/rentCollectionService');
  const { runRentalFinancialAutomations } = require('../services/rentalFinancialAutomationService');
  const previous = process.env.RENT_PENALTY_ENGINE;
  afterEach(() => { if (previous === undefined) delete process.env.RENT_PENALTY_ENGINE; else process.env.RENT_PENALTY_ENGINE = previous; });
  beforeEach(() => {
    verifierPaiementsEnRetard.mockResolvedValue({ verifies: 0, penalites: 0 });
    runRentalFinancialAutomations.mockResolvedValue({ payments: { errors: 0 }, contracts: { errors: 0 } });
  });

  test('par défaut (LEGACY) : cycle canonique inerte', async () => {
    delete process.env.RENT_PENALTY_ENGINE;
    expect(await rentalCollectionHandler()).toMatchObject({ skipped: 1, engine: 'LEGACY' });
    expect(runRentCollectionCycle).not.toHaveBeenCalled();
  });

  test('CANONICAL : cycle exécuté ; valeur inconnue : aucun moteur', async () => {
    process.env.RENT_PENALTY_ENGINE = 'canonical';
    expect(await rentalCollectionHandler()).toMatchObject({ processed: 2, engine: 'CANONICAL' });
    process.env.RENT_PENALTY_ENGINE = 'les-deux';
    expect(await rentalCollectionHandler()).toMatchObject({ skipped: 1, engine: 'DISABLED' });
    expect(runRentCollectionCycle).toHaveBeenCalledTimes(1);
  });

  test('le job historique reste inscrit (alertes de contrats) ; sa partie pénalités est arrêtée par alerteService', async () => {
    process.env.RENT_PENALTY_ENGINE = 'CANONICAL';
    await rentalHandler();
    expect(verifierPaiementsEnRetard).toHaveBeenCalledTimes(1);
  });
});
