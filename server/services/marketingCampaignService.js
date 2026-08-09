// MARKETING-AUTOMATION-1 (Phase 4) — Moteur de campagnes. RÈGLE DURE,
// vérifiée par le code (pas seulement documentée) : sendCampaign() refuse
// tout statut différent de 'approved' — aucun chemin ne permet d'envoyer
// une campagne 'draft'. La diffusion réutilise les canaux déjà existants
// (zohoMailService.sendEmail, notify() pour push/notification interne) —
// aucun nouveau transport n'est créé.
const MarketingCampaign = require('../models/MarketingCampaign');
const MarketingSend = require('../models/MarketingSend');
const MarketingUnsubscribe = require('../models/MarketingUnsubscribe');
const MarketingTemplate = require('../models/MarketingTemplate');
const CrmCustomer = require('../models/CrmCustomer');
const { resolveSegment } = require('./marketingSegmentService');
const { renderTemplate } = require('./marketingTemplateService');
const zohoMailService = require('./zohoMailService');
const { notify } = require('./notificationService');
const { logAction, buildAuteur } = require('./actionLogService');

class CampaignError extends Error {
  constructor(code, message, statusCode = 400) { super(message); this.name = 'CampaignError'; this.code = code; this.statusCode = statusCode; }
}
const fail = (code, message, statusCode) => { throw new CampaignError(code, message, statusCode); };

async function audit(event, { actor, campaign, req }) {
  await logAction({
    action: `marketing_campaign.${event}`,
    description: `Campagne ${campaign.name} (${campaign._id}) — ${event}`,
    module: 'Altcom',
    typeAction: event === 'cancelled' ? 'SUPPRESSION' : event === 'created' ? 'CRÉATION' : 'MODIFICATION',
    auteur: buildAuteur(actor),
    cible: { id: String(campaign._id), type: 'MarketingCampaign', nom: campaign.name },
    req,
  }).catch(() => {});
}

async function createCampaign({ name, channel, templateId, segmentKey, segmentParams, costMinor, actor, req } = {}) {
  if (!name || !channel || !templateId || !segmentKey) fail('CAMPAIGN_FIELDS_REQUIRED', 'name, channel, templateId et segmentKey sont requis.', 422);
  const template = await MarketingTemplate.findOne({ _id: templateId, status: 'active' });
  if (!template) fail('CAMPAIGN_TEMPLATE_INACTIVE', 'Le modèle doit être actif.', 422);
  if (template.channel !== channel) fail('CAMPAIGN_CHANNEL_MISMATCH', 'Le canal du modèle ne correspond pas au canal de la campagne.', 422);
  // Valide la clé de segment dès la création (échec rapide) sans encore
  // résoudre la liste — la résolution réelle n'a lieu qu'à l'envoi, pour
  // refléter l'audience la plus à jour possible.
  await resolveSegment(segmentKey, segmentParams || {});
  const campaign = await MarketingCampaign.create({
    name, channel, template: templateId, segmentKey, segmentParams: segmentParams || {},
    costMinor: costMinor ?? null, createdBy: actor?._id || actor?.id || null,
  });
  await audit('created', { actor, campaign, req });
  return campaign;
}

// Octroi humain explicite — jamais automatique, jamais implicite à la
// création. C'est la SEULE porte qui autorise sendCampaign() plus bas.
async function approveCampaign(id, { actor, req } = {}) {
  const campaign = await MarketingCampaign.findOne({ _id: id, status: 'draft' });
  if (!campaign) fail('CAMPAIGN_NOT_DRAFT', 'Seule une campagne en brouillon peut être approuvée.', 404);
  campaign.status = 'approved';
  campaign.approvedBy = actor?._id || actor?.id || null;
  campaign.approvedAt = new Date();
  await campaign.save();
  await audit('approved', { actor, campaign, req });
  return campaign;
}

async function cancelCampaign(id, { actor, reason, req } = {}) {
  const campaign = await MarketingCampaign.findOne({ _id: id, status: { $in: ['draft', 'approved'] } });
  if (!campaign) fail('CAMPAIGN_NOT_CANCELLABLE', 'Seule une campagne brouillon ou approuvée peut être annulée.', 404);
  campaign.status = 'cancelled';
  campaign.cancelledBy = actor?._id || actor?.id || null;
  campaign.cancelledAt = new Date();
  await campaign.save();
  await audit('cancelled', { actor, campaign, reason, req });
  return campaign;
}

async function deliverToChannel({ channel, customer, rendered, actor }) {
  const email = customer.emails?.[0];
  if (channel === 'email') {
    if (!email) return { status: 'failed', error: 'Aucun email pour ce destinataire.' };
    try {
      await zohoMailService.sendEmail(process.env.ZOHO_FROM_EMAIL, email, rendered.subject || '(sans objet)', rendered.body);
      return { status: 'sent' };
    } catch (e) { return { status: 'failed', error: e.message }; }
  }
  if (channel === 'push' || channel === 'notification') {
    // Push/notification exigent un compte User lié (identityKeys 'user:<id>')
    // — un CrmCustomer sans compte (ex: fiche Proprietaire sans connexion)
    // est légitimement ignoré, jamais une erreur.
    const userKey = customer.identityKeys.find((k) => k.startsWith('user:'));
    if (!userKey) return { status: 'failed', error: 'Aucun compte utilisateur lié pour ce destinataire.' };
    try {
      await notify({
        recipient: userKey.slice(5), sender: actor?._id || actor?.id || null,
        type: 'marketing_message',
        title: rendered.subject || 'Message', body: rendered.body, audience: 'user',
      });
      return { status: 'sent' };
    } catch (e) { return { status: 'failed', error: e.message }; }
  }
  return { status: 'failed', error: `Canal non supporté pour l'envoi direct : ${channel}.` };
}

async function sendCampaign(id, { actor, req } = {}) {
  const campaign = await MarketingCampaign.findOne({ _id: id, status: 'approved' }).populate('template');
  if (!campaign) fail('CAMPAIGN_NOT_APPROVED', 'La campagne doit être approuvée avant tout envoi.', 409);
  campaign.status = 'sending';
  await campaign.save();

  const customerIds = await resolveSegment(campaign.segmentKey, campaign.segmentParams);
  const customers = await CrmCustomer.find({ _id: { $in: customerIds } }).select('emails identityKeys displayName firstName').lean();
  const suppressed = new Set((await MarketingUnsubscribe.find({ email: { $in: customers.flatMap((c) => c.emails) } }).distinct('email')));

  let sentCount = 0; let failedCount = 0;
  for (const customer of customers) {
    if (campaign.channel === 'email' && customer.emails?.some((e) => suppressed.has(e))) {
      failedCount += 1;
      // eslint-disable-next-line no-await-in-loop
      await MarketingSend.create({ campaign: campaign._id, template: campaign.template._id, channel: campaign.channel, recipientCustomer: customer._id, recipientEmail: customer.emails[0], status: 'unsubscribed', error: 'Adresse désabonnée — envoi bloqué.' });
      continue;
    }
    const rendered = renderTemplate(campaign.template, { prenom: customer.firstName || customer.displayName, nom: customer.displayName });
    // eslint-disable-next-line no-await-in-loop
    const outcome = await deliverToChannel({ channel: campaign.channel, customer, rendered, actor });
    if (outcome.status === 'sent') sentCount += 1; else failedCount += 1;
    // eslint-disable-next-line no-await-in-loop
    await MarketingSend.create({
      campaign: campaign._id, template: campaign.template._id, channel: campaign.channel,
      recipientCustomer: customer._id, recipientEmail: customer.emails?.[0] || null,
      status: outcome.status, error: outcome.error || null,
    });
  }

  campaign.status = 'sent';
  campaign.sentAt = new Date();
  campaign.stats = { totalRecipients: customers.length, sentCount, failedCount };
  await campaign.save();
  await audit('sent', { actor, campaign, req });
  return campaign;
}

async function listCampaigns() {
  return MarketingCampaign.find().sort({ createdAt: -1 }).populate('template', 'name channel').lean();
}

module.exports = {
  CampaignError, createCampaign, approveCampaign, cancelCampaign, sendCampaign, listCampaigns,
  // Réutilisé tel quel par crmAutomationActions.js (Phase 5, envoi
  // individuel déclenché par un workflow) — jamais une seconde
  // implémentation de la logique de diffusion par canal.
  deliverToChannel,
};
