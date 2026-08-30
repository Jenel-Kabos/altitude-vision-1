const Visite = require('../models/Visite');
const { notify, notifyStaff } = require('./notificationService');
const { STATUS } = require('./visiteWorkflowService');

const REMINDERS = [
  ['twentyFourHours', 24 * 60 * 60 * 1000],
  ['twoHours', 2 * 60 * 60 * 1000],
  ['thirtyMinutes', 30 * 60 * 1000],
];

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
  return { reminders, expired: expiredCount };
}

module.exports = { REMINDERS, processVisitAutomation, expireVisitCandidate };
