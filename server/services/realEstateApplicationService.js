const mongoose = require('mongoose');
const Application = require('../models/RealEstateApplication');
const Reservation = require('../models/RealEstateReservation');
const Property = require('../models/Property');
const { notify } = require('./notificationService');

class RealEstateWorkflowError extends Error {
  constructor(code, message, statusCode = 409) {
    super(message); this.code = code; this.statusCode = statusCode;
  }
}

const acceptable = ['submitted', 'under_review'];
const reservationDurationMs = () => Math.max(15, Number(process.env.REAL_ESTATE_RESERVATION_MINUTES) || 72 * 60) * 60 * 1000;

async function acceptInSession({ applicationId, actorId, idempotencyKey, session }) {
  const opts = session ? { session } : {};
  const application = await Application.findById(applicationId).session(session || null);
  if (!application) throw new RealEstateWorkflowError('APPLICATION_NOT_FOUND', 'Dossier introuvable.', 404);
  if (application.reservation) {
    const existing = await Reservation.findById(application.reservation).session(session || null);
    if (existing?.idempotencyKey === idempotencyKey) return { application, reservation: existing, idempotent: true };
    throw new RealEstateWorkflowError('APPLICATION_ALREADY_DECIDED', 'Ce dossier a déjà été décidé.');
  }
  if (!acceptable.includes(application.status) || application.validUntil <= new Date()) {
    throw new RealEstateWorkflowError('APPLICATION_NOT_ACCEPTABLE', 'Ce dossier n’est plus acceptable.');
  }
  const property = await Property.findById(application.property).session(session || null);
  if (!property || property.statusAdmin !== 'Validée' || !property.isPublished || property.availability !== 'Disponible' || property.reservationLock?.reservation) {
    throw new RealEstateWorkflowError('PROPERTY_NOT_AVAILABLE', 'Le bien n’est plus disponible.');
  }
  const expectedStatus = application.kind === 'purchase_offer' ? 'vente' : 'location';
  if (property.status !== expectedStatus) throw new RealEstateWorkflowError('APPLICATION_TYPE_MISMATCH', 'Le dossier ne correspond pas au type du bien.');

  const now = new Date();
  const reservation = await Reservation.create([{
    property: property._id,
    client: application.applicant,
    application: application._id,
    type: application.kind === 'purchase_offer' ? 'sale' : 'rental',
    expiresAt: new Date(now.getTime() + reservationDurationMs()),
    idempotencyKey,
    history: [{ from: null, to: 'active', action: 'created_from_acceptance', actor: actorId, at: now }],
  }], opts).then(([row]) => row);

  const locked = await Property.updateOne(
    { _id: property._id, availability: 'Disponible', 'reservationLock.reservation': null },
    { $set: { availability: 'Réservé', hasReservationHistory: true, reservationLock: { reservation: reservation._id, lockedAt: now, expiresAt: reservation.expiresAt } } },
    opts,
  );
  if (locked.modifiedCount !== 1) throw new RealEstateWorkflowError('PROPERTY_RESERVATION_CONFLICT', 'Une autre réservation a remporté la concurrence.');

  const previousStatus = application.status;
  application.status = 'accepted';
  application.reservation = reservation._id;
  application.decidedBy = actorId;
  application.decidedAt = now;
  application.history.push({ from: previousStatus, to: 'accepted', action: 'accepted', actor: actorId, at: now });
  await application.save(opts);
  await Application.updateMany(
    { _id: { $ne: application._id }, property: property._id, status: { $in: acceptable } },
    { $set: { status: 'not_selected', decidedBy: actorId, decidedAt: now }, $push: { history: { from: 'submitted', to: 'not_selected', action: 'competing_application_accepted', actor: actorId, at: now } } },
    opts,
  );
  return { application, reservation, idempotent: false };
}

async function acceptApplication(input) {
  if (!input.idempotencyKey || input.idempotencyKey.length > 200) throw new RealEstateWorkflowError('IDEMPOTENCY_KEY_REQUIRED', 'Une clé d’idempotence valide est requise.', 400);
  const existing = await Reservation.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) {
    if (String(existing.application) !== String(input.applicationId)) throw new RealEstateWorkflowError('IDEMPOTENCY_KEY_REUSED', 'Cette clé d’idempotence appartient à une autre opération.');
    return { application: await Application.findById(input.applicationId), reservation: existing, idempotent: true };
  }
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await acceptInSession({ ...input, session }); });
    return result;
  } catch (error) {
    const unsupported = /Transaction numbers are only allowed|replica set|does not support transactions/i.test(error.message || '');
    if (!unsupported) {
      if (error.code === 11000) throw new RealEstateWorkflowError('PROPERTY_RESERVATION_CONFLICT', 'Une autre réservation a remporté la concurrence.');
      throw error;
    }
    // Mode Mongo autonome : les écritures sont compensées et les index uniques
    // restent le verrou de concurrence. Le Replica Set demeure le mode certifié.
    try {
      const result = await acceptInSession({ ...input, session: null });
      return result;
    } catch (fallbackError) {
      const partial = await Reservation.findOne({ idempotencyKey: input.idempotencyKey, status: 'active' });
      if (partial) {
        await Property.updateOne(
          { _id: partial.property, 'reservationLock.reservation': partial._id },
          { $set: { availability: 'Disponible', reservationLock: { reservation: null, lockedAt: null, expiresAt: null } } },
        ).catch(() => {});
        await Application.updateOne(
          { _id: partial.application, reservation: partial._id },
          { $set: { status: 'under_review', reservation: null, decidedBy: null, decidedAt: null } },
        ).catch(() => {});
        await Reservation.deleteOne({ _id: partial._id, status: 'active' }).catch(() => {});
      }
      if (fallbackError.code === 11000) throw new RealEstateWorkflowError('PROPERTY_RESERVATION_CONFLICT', 'Une autre réservation a remporté la concurrence.');
      throw fallbackError;
    }
  } finally { await session.endSession(); }
}

async function releaseReservation(reservation, { status, actorId, reason = '', session = null }) {
  const opts = session ? { session } : {};
  if (reservation.status !== 'active') return false;
  const now = new Date();
  reservation.status = status;
  reservation.cancellationReason = reason;
  reservation.history.push({ from: 'active', to: status, action: status, actor: actorId, reason, at: now });
  await reservation.save(opts);
  await Property.updateOne(
    { _id: reservation.property, 'reservationLock.reservation': reservation._id, availability: 'Réservé' },
    { $set: { availability: 'Disponible', reservationLock: { reservation: null, lockedAt: null, expiresAt: null } } }, opts,
  );
  return true;
}

async function expireReservations(now = new Date()) {
  const ids = await Reservation.find({ status: 'active', expiresAt: { $lte: now } }).distinct('_id');
  let expired = 0;
  for (const id of ids) {
    const reservation = await Reservation.findOneAndUpdate(
      { _id: id, status: 'active', expiresAt: { $lte: now } },
      { $set: { status: 'expired' }, $push: { history: { from: 'active', to: 'expired', action: 'expired', at: now } } },
      { new: true },
    );
    if (!reservation) continue;
    await Property.updateOne(
      { _id: reservation.property, 'reservationLock.reservation': reservation._id, availability: 'Réservé' },
      { $set: { availability: 'Disponible', reservationLock: { reservation: null, lockedAt: null, expiresAt: null } } },
    );
    const property = await Property.findById(reservation.property).select('owner');
    const recipients = [...new Set([String(reservation.client), String(property?.owner)].filter(Boolean))];
    await Promise.all(recipients.map((recipient) => notify({ recipient, type: 'real_estate_reservation_expired', title: 'Réservation expirée', body: 'La réservation immobilière a expiré et le bien est de nouveau disponible.', entityType: 'RealEstateReservation', entityId: reservation._id, dedupeKey: `reservation:${reservation._id}:expired:${recipient}` })));
    expired += 1;
  }
  const applications = await Application.find({ status: { $in: acceptable }, validUntil: { $lte: now } }).select('_id applicant status');
  let applicationsExpired = 0;
  for (const application of applications) {
    const previous = application.status;
    const changed = await Application.updateOne(
      { _id: application._id, status: previous, validUntil: { $lte: now } },
      { $set: { status: 'expired' }, $push: { history: { from: previous, to: 'expired', action: 'expired', at: now } } },
    );
    if (!changed.modifiedCount) continue;
    await notify({ recipient: application.applicant, type: 'real_estate_application_rejected', title: 'Dossier expiré', body: 'La période de validité de votre dossier immobilier est terminée.', entityType: 'RealEstateApplication', entityId: application._id, dedupeKey: `application:${application._id}:expired` });
    applicationsExpired += 1;
  }
  return { expired, applicationsExpired };
}

async function sendExpirationReminders(now = new Date()) {
  const threshold = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const reservations = await Reservation.find({ status: 'active', expiresAt: { $gt: now, $lte: threshold }, expirationReminderSentAt: null });
  let reminded = 0;
  for (const reservation of reservations) {
    const claimed = await Reservation.updateOne({ _id: reservation._id, status: 'active', expirationReminderSentAt: null }, { $set: { expirationReminderSentAt: now }, $push: { history: { from: 'active', to: 'active', action: 'expiration_reminder_sent', at: now } } });
    if (!claimed.modifiedCount) continue;
    await notify({ recipient: reservation.client, type: 'real_estate_reservation_expiring', title: 'Réservation bientôt expirée', body: 'Votre réservation immobilière expire dans moins de 24 heures.', entityType: 'RealEstateReservation', entityId: reservation._id, dedupeKey: `reservation:${reservation._id}:expiring` });
    reminded += 1;
  }
  return { reminded };
}

module.exports = { RealEstateWorkflowError, acceptApplication, releaseReservation, expireReservations, sendExpirationReminders };
