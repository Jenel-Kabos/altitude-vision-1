const Reservation = require('../models/AccommodationReservation');
const { notify } = require('./notificationService');

const TIME_ZONE = 'Africa/Brazzaville';
const OFFSET_MS = 60 * 60 * 1000;

function brazzavilleDayBounds(now = new Date(), dayOffset = 0) {
  const local = new Date(now.getTime() + OFFSET_MS);
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayOffset) - OFFSET_MS);
  return { start, end: new Date(start.getTime() + 86400000) };
}

async function sendOnce({ reservation, reminder, recipientKind, type, title, message }) {
  const field = `reminders.${reminder}.${recipientKind}SentAt`;
  const claimed = await Reservation.findOneAndUpdate(
    { _id: reservation._id, status: { $in: reminder === 'checkoutToday' ? ['confirmed', 'checked_in'] : ['confirmed'] }, [field]: null },
    { $set: { [field]: new Date() } }, { new: true },
  );
  if (!claimed) return false;
  const recipient = recipientKind === 'guest' ? reservation.guest : reservation.owner;
  try {
    await notify({ recipient, sender: reservation.owner, type, title, message, link: '/dashboard/hebergements', entityType: 'AccommodationReservation', entityId: reservation._id, metadata: { reminder, timeZone: TIME_ZONE } });
    return true;
  } catch (error) {
    await Reservation.updateOne({ _id: reservation._id, [field]: claimed.get(field) }, { $unset: { [field]: 1 } });
    throw error;
  }
}

async function processWindow({ dateField, dayOffset, reminder, type, title, now }) {
  const { start, end } = brazzavilleDayBounds(now, dayOffset);
  const statuses = reminder === 'checkoutToday' ? ['confirmed', 'checked_in'] : ['confirmed'];
  const reservations = await Reservation.find({ status: { $in: statuses }, [dateField]: { $gte: start, $lt: end } }).select('guest owner checkInDate checkOutDate status reminders').lean();
  let sent = 0;
  for (const reservation of reservations) {
    for (const recipientKind of ['guest', 'owner']) {
      const ok = await sendOnce({ reservation, reminder, recipientKind, type, title, message: reminder === 'checkoutToday' ? 'Le départ est prévu aujourd’hui.' : reminder === 'arrivalToday' ? 'L’arrivée est prévue aujourd’hui.' : 'L’arrivée est prévue demain.' });
      if (ok) sent += 1;
    }
  }
  return { matched: reservations.length, sent };
}

async function processAccommodationReservationReminders({ now = new Date() } = {}) {
  const results = await Promise.all([
    processWindow({ dateField: 'checkInDate', dayOffset: 1, reminder: 'arrival24h', type: 'accommodation_arrival_reminder', title: 'Arrivée demain', now }),
    processWindow({ dateField: 'checkInDate', dayOffset: 0, reminder: 'arrivalToday', type: 'accommodation_checkin_today', title: 'Arrivée aujourd’hui', now }),
    processWindow({ dateField: 'checkOutDate', dayOffset: 0, reminder: 'checkoutToday', type: 'accommodation_checkout_today', title: 'Départ aujourd’hui', now }),
  ]);
  return { timeZone: TIME_ZONE, matched: results.reduce((n, item) => n + item.matched, 0), sent: results.reduce((n, item) => n + item.sent, 0) };
}

module.exports = { TIME_ZONE, brazzavilleDayBounds, processAccommodationReservationReminders };
