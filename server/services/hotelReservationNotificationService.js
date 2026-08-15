const mongoose = require('mongoose');
const HotelReservationNotification = require('../models/HotelReservationNotification');
const { notify } = require('./notificationService');
const { sendEmailViaZoho } = require('./emailService');
const logger = require('../utils/logger');

async function claim(reservation, eventKey, channel, recipient) {
  try { return await HotelReservationNotification.create({ reservation: reservation._id, eventKey, channel, recipient }); }
  catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await HotelReservationNotification.findOne({ reservation: reservation._id, eventKey, channel });
    return existing?.status === 'sent' || existing?.status === 'pending' ? null : existing;
  }
}

async function notifyReservationGuest({ reservation, eventKey, type, title, body, emailSender = sendEmailViaZoho }) {
  const channel = reservation.guestUser ? 'internal' : 'email';
  const recipient = reservation.guestUser ? String(reservation.guestUser) : reservation.guest?.email;
  if (!recipient) return { skipped: true };
  if (mongoose.connection.readyState === 0) return { skipped: true, reason: 'database_disconnected' };
  const event = await claim(reservation, eventKey, channel, recipient);
  if (!event) return { idempotent: true };
  try {
    event.attempts += 1;
    if (channel === 'internal') await notify({ recipient, type, title, body, entityType: 'HotelReservation', entityId: reservation._id, data: { reservationId: String(reservation._id), hotelId: String(reservation.hotel), screen: 'MesReservationsHotel' } });
    else await emailSender(process.env.ZOHO_FROM_EMAIL, recipient, title, `<p>${body}</p><p>Référence : <strong>${reservation.reference}</strong></p>`);
    event.status = 'sent'; event.sentAt = new Date(); event.lastError = ''; await event.save();
    return { sent: true, channel };
  } catch (error) {
    event.status = 'failed'; event.lastError = String(error.message || error).slice(0, 500); await event.save().catch(() => {});
    logger.error('hotel.reservation.notification_failed', { reservationId: String(reservation._id), eventKey, channel, error: error.message });
    return { sent: false, channel };
  }
}
module.exports = { notifyReservationGuest };
