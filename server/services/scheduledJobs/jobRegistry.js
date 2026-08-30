const mongoose = require('mongoose');
const { syncFacebook } = require('../../scripts/sync-facebook');
const { pollZohoInbox } = require('../zohoImapService');
const { processAccommodationReservationReminders } = require('../accommodationReservationReminderService');
const { verifierPaiementsEnRetard } = require('../alerteService');
const { runRentalFinancialAutomations } = require('../rentalFinancialAutomationService');
const { processVisitAutomation } = require('../visiteAutomationService');
const { processReservationExpiry } = require('../hotelReservationExpiryService');
const { expireReservations, sendExpirationReminders } = require('../realEstateApplicationService');

const BUSINESS_TIME_ZONE = 'Africa/Brazzaville';

async function facebookHandler() {
  const sync = await syncFacebook();
  const FacebookPost = mongoose.models.FacebookPost;
  let deleted = 0;
  if (FacebookPost) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 5);
    deleted = (await FacebookPost.deleteMany({ date_sync: { $lt: cutoff } })).deletedCount;
  }
  return { processed: sync.reduce((total, item) => total + (item.count || 0), 0), deleted };
}

async function rentalHandler() {
  const penalties = await verifierPaiementsEnRetard();
  const alerts = await runRentalFinancialAutomations();
  return { processed: penalties.verifies, failed: alerts.payments.errors + alerts.contracts.errors, penalties, alerts };
}

async function realEstateHandler() {
  const expired = await expireReservations();
  const reminders = await sendExpirationReminders();
  return { processed: expired.expired + expired.applicationsExpired + reminders.reminded, expired, reminders };
}

const JOB_REGISTRY = Object.freeze([
  { name: 'facebook-sync', schedule: '0 * * * *', leaseDurationMs: 15 * 60 * 1000, heartbeatMs: 60 * 1000, handler: facebookHandler, boot: true },
  { name: 'zoho-imap-poll', schedule: '*/5 * * * *', leaseDurationMs: 4 * 60 * 1000, heartbeatMs: 30 * 1000, handler: pollZohoInbox, bootDelayMs: 10000 },
  { name: 'accommodation-reminders', schedule: '*/15 * * * *', leaseDurationMs: 14 * 60 * 1000, heartbeatMs: 60 * 1000, handler: processAccommodationReservationReminders },
  { name: 'rental-penalties-alerts', schedule: '0 6 * * *', timezone: BUSINESS_TIME_ZONE, leaseDurationMs: 30 * 60 * 1000, heartbeatMs: 60 * 1000, handler: rentalHandler },
  { name: 'visit-automation', schedule: '*/5 * * * *', leaseDurationMs: 4 * 60 * 1000, heartbeatMs: 30 * 1000, handler: () => processVisitAutomation() },
  { name: 'hotel-reservation-expiry', schedule: '*/5 * * * *', leaseDurationMs: 4 * 60 * 1000, heartbeatMs: 30 * 1000, handler: () => processReservationExpiry() },
  { name: 'real-estate-expiry', schedule: '*/5 * * * *', leaseDurationMs: 4 * 60 * 1000, heartbeatMs: 30 * 1000, handler: realEstateHandler },
]);

const getJob = (name) => JOB_REGISTRY.find((job) => job.name === name);

module.exports = { BUSINESS_TIME_ZONE, JOB_REGISTRY, getJob, facebookHandler, rentalHandler, realEstateHandler };
