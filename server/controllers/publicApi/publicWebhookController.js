// API-PUBLIC-1 (Phase 8) — Gestion des abonnements webhook par le
// partenaire lui-même (scope `webhooks:manage`), scopée à SA clé
// (`req.apiKey`) — jamais un partenaire ne peut lister/modifier les
// abonnements d'un autre.
const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const WebhookSubscription = require('../../models/WebhookSubscription');
const { ALLOWED_WEBHOOK_EVENTS } = require('../../models/WebhookSubscription');

exports.list = asyncHandler(async (req, res) => {
  const subscriptions = await WebhookSubscription.find({ apiKey: req.apiKey._id }).select('-secret').lean();
  res.json({ status: 'success', data: { subscriptions, allowedEvents: ALLOWED_WEBHOOK_EVENTS } });
});

exports.create = asyncHandler(async (req, res) => {
  const { url, events } = req.body;
  if (!url) return res.status(422).json({ status: 'fail', message: 'url est requis.' });
  const invalidEvents = (events || []).filter((e) => !ALLOWED_WEBHOOK_EVENTS.includes(e));
  if (!events?.length || invalidEvents.length) {
    return res.status(422).json({ status: 'fail', message: `events invalide(s) : ${invalidEvents.join(', ') || 'aucun événement fourni'}.` });
  }
  const secret = crypto.randomBytes(24).toString('hex');
  const subscription = await WebhookSubscription.create({ tenant: req.apiKey.tenant, apiKey: req.apiKey._id, url, events, secret, createdBy: req.apiKey.createdBy });
  // Le secret de signature n'est retourné qu'à la création — jamais relu ensuite.
  res.status(201).json({ status: 'success', data: { subscription: { ...subscription.toObject(), secret } } });
});

exports.disable = asyncHandler(async (req, res) => {
  const subscription = await WebhookSubscription.findOneAndUpdate(
    { _id: req.params.id, apiKey: req.apiKey._id },
    { status: 'disabled' },
    { new: true },
  ).select('-secret');
  if (!subscription) return res.status(404).json({ status: 'fail', message: 'Abonnement introuvable.' });
  res.json({ status: 'success', data: { subscription } });
});
