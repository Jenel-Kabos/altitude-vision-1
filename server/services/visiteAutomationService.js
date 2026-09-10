const Visite = require('../models/Visite');
const { notify, notifyStaff } = require('./notificationService');
const { STATUS } = require('./visiteWorkflowService');

const REMINDERS = [
  ['twentyFourHours', 24 * 60 * 60 * 1000],
  ['twoHours', 2 * 60 * 60 * 1000],
  ['thirtyMinutes', 30 * 60 * 1000],
];

// VISITS-AUTO-EXPIRY-1 — Une visite confirmée dont l'heure planifiée est
// dépassée de plus de 3 heures sans qu'un signalement métier (started/completed/
// client_absent/owner_absent/annulée) ait été enregistré est automatiquement
// clôturée par le cron. Le motif interne `auto_no_show` distingue cette
// clôture d'une annulation manuelle.
const POST_SCHEDULED_EXPIRY_MS = 3 * 60 * 60 * 1000;

async function expireVisitCandidate(visite, now = new Date()) {
  return Visite.findOneAndUpdate(
    { _id: visite._id, status: visite.status, requestedDate: { $lt: now } },
    {
      $set: {
        status: STATUS.EXPIRED,
        cancelledAt: now,
        cancellationActor: 'cron',
        cancellationReason: 'Créneau demandé dépassé sans confirmation.',
      },
      $push: {
        workflowHistory: {
          from: visite.status,
          to: STATUS.EXPIRED,
          action: 'expire_unconfirmed',
          role: 'system',
          source: 'cron',
          comment: 'Créneau demandé dépassé sans confirmation.',
          at: now,
        },
      },
    },
    { new: true },
  );
}

async function processVisitAutomation(now = new Date()) {
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 5 * 60 * 1000);
  const visites = await Visite.find({
    status: STATUS.CONFIRMED,
    scheduledStartAt: { $gt: now, $lte: horizon },
  }).populate('property', 'title owner');
  let reminders = 0;

  for (const visite of visites) {
    const remaining = new Date(visite.scheduledStartAt).getTime() - now.getTime();
    const due = REMINDERS.find(([key, threshold]) => remaining <= threshold && !visite.reminderStates?.[key]);
    if (!due) continue;
    const [key] = due;
    const updated = await Visite.findOneAndUpdate(
      { _id: visite._id, status: STATUS.CONFIRMED, [`reminderStates.${key}`]: { $ne: true } },
      { $set: { [`reminderStates.${key}`]: true } },
      { new: true },
    );
    if (!updated) continue;
    reminders += 1;
    const payload = {
      type: 'visite_rappel', title: 'Rappel de rendez-vous de visite',
      body: `Votre rendez-vous pour « ${visite.property?.title || 'un bien'} » approche.`,
      entityType: 'Visite', entityId: visite._id,
      data: { screen: 'Visites', visiteId: visite._id.toString(), route: 'Visites' },
    };
    await Promise.allSettled([
      notify({ recipient: visite.client, ...payload }),
      visite.property?.owner ? notify({ recipient: visite.property.owner, ...payload, link: '/mes-biens/visites' }) : Promise.resolve(),
    ]);
  }

  const expired = await Visite.find({
    status: { $in: [STATUS.REQUESTED, STATUS.AWAITING_CONFIRMATION] },
    requestedDate: { $lt: now },
  });
  let expiredCount = 0;
  for (const visite of expired) {
    const claimed = await expireVisitCandidate(visite, now);
    if (claimed) expiredCount += 1;
  }
  if (expiredCount) await notifyStaff({ type: 'visite_status', title: 'Demandes de visite expirées', body: `${expiredCount} demande(s) non confirmée(s) ont expiré.`, data: { screen: 'AdminVisites' } });

  // Auto-clôture des visites confirmées dont le créneau est dépassé de plus
  // de 3h sans signalement (VISITS-AUTO-EXPIRY-1). On restreint volontairement
  // à `CONFIRMED` : `IN_PROGRESS` implique déjà un check-in métier et n'est
  // donc jamais auto-expiré ici. Le guard atomique de `findOneAndUpdate`
  // empêche le double traitement en cas d'exécutions concurrentes du cron.
  const staleCutoff = new Date(now.getTime() - POST_SCHEDULED_EXPIRY_MS);
  const staleConfirmed = await Visite.find({
    status: STATUS.CONFIRMED,
    scheduledStartAt: { $ne: null, $lte: staleCutoff },
  }).populate('property', 'title owner');
  let autoExpiredCount = 0;
  for (const visite of staleConfirmed) {
    const claimed = await Visite.findOneAndUpdate(
      { _id: visite._id, status: STATUS.CONFIRMED, scheduledStartAt: { $lte: staleCutoff } },
      {
        $set: {
          status: STATUS.EXPIRED,
          cancelledAt: now,
          cancellationActor: 'cron',
          cancellationReason: 'auto_no_show',
        },
        $push: {
          workflowHistory: {
            from: STATUS.CONFIRMED,
            to: STATUS.EXPIRED,
            action: 'auto_expire_post_scheduled',
            role: 'system',
            source: 'cron',
            comment: 'Créneau confirmé dépassé de plus de 3h sans signalement.',
            at: now,
          },
        },
      },
      { new: true },
    );
    if (!claimed) continue;
    autoExpiredCount += 1;
    const payload = {
      type: 'visite_status',
      title: 'Visite clôturée automatiquement',
      body: `La visite prévue pour « ${visite.property?.title || 'un bien'} » a été clôturée sans signalement.`,
      entityType: 'Visite',
      entityId: visite._id,
      data: { screen: 'Visites', visiteId: visite._id.toString(), route: 'Visites' },
    };
    await Promise.allSettled([
      notify({ recipient: visite.client, ...payload }),
      visite.property?.owner ? notify({ recipient: visite.property.owner, ...payload, link: '/mes-biens/visites' }) : Promise.resolve(),
    ]);
  }
  if (autoExpiredCount) {
    await notifyStaff({
      type: 'visite_status',
      title: 'Visites clôturées automatiquement',
      body: `${autoExpiredCount} visite(s) confirmée(s) sans signalement ont été clôturées.`,
      data: { screen: 'AdminVisites' },
    });
  }

  return { reminders, expired: expiredCount, autoExpired: autoExpiredCount };
}

module.exports = { REMINDERS, POST_SCHEDULED_EXPIRY_MS, processVisitAutomation, expireVisitCandidate };
