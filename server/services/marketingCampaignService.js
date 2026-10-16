// MARKETING-AUTOMATION-1 (Phase 4) — Moteur de campagnes. RÈGLE DURE,
// vérifiée par le code (pas seulement documentée) : sendCampaign() refuse
// tout statut différent de 'approved' — aucun chemin ne permet d'envoyer
// une campagne 'draft'. La diffusion réutilise les canaux déjà existants
// (zohoMailService.sendEmail, notify() pour push/notification interne) —
// aucun nouveau transport n'est créé.
const MarketingCampaign = require('../models/MarketingCampaign');
const MarketingSend = require('../models/MarketingSend');
const MarketingTemplate = require('../models/MarketingTemplate');
const CrmCustomer = require('../models/CrmCustomer');
const { resolveSegment } = require('./marketingSegmentService');
const { renderTemplate } = require('./marketingTemplateService');
const zohoMailService = require('./zohoMailService');
const { notify } = require('./notificationService');
const { logAction, buildAuteur } = require('./actionLogService');
const { resolveRecipient, appendEmailUnsubscribeFooter } = require('./marketingConsentService');
const { assertPlatformMarketingAuthority, assertPlatformMarketingScope } = require('./marketingAuthorityService');

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

async function createCampaign({ name, channel, templateId, segmentKey, segmentParams, costMinor, actor, req, tenantId } = {}) {
  await assertPlatformMarketingAuthority(actor);
  assertPlatformMarketingScope(tenantId);
  if (!name || !channel || !templateId || !segmentKey) fail('CAMPAIGN_FIELDS_REQUIRED', 'name, channel, templateId et segmentKey sont requis.', 422);
  const template = await MarketingTemplate.findOne({ _id: templateId, status: 'active', ...(tenantId ? { tenant: tenantId } : {}) });
  if (!template) fail('CAMPAIGN_TEMPLATE_INACTIVE', 'Le modèle doit être actif.', 422);
  assertPlatformMarketingScope(template.tenant);
  if (template.channel !== channel) fail('CAMPAIGN_CHANNEL_MISMATCH', 'Le canal du modèle ne correspond pas au canal de la campagne.', 422);
  // Valide la clé de segment dès la création (échec rapide) sans encore
  // résoudre la liste — la résolution réelle n'a lieu qu'à l'envoi, pour
  // refléter l'audience la plus à jour possible.
  await resolveSegment(segmentKey, segmentParams || {}, { tenantId });
  const campaign = await MarketingCampaign.create({
    tenant: tenantId || null, name, channel, template: templateId, segmentKey, segmentParams: segmentParams || {},
    costMinor: costMinor ?? null, createdBy: actor?._id || actor?.id || null,
  });
  await audit('created', { actor, campaign, req });
  return campaign;
}

// Octroi humain explicite — jamais automatique, jamais implicite à la
// création. C'est la SEULE porte qui autorise sendCampaign() plus bas.
async function approveCampaign(id, { actor, req, tenantId } = {}) {
  await assertPlatformMarketingAuthority(actor);
  const campaign = await MarketingCampaign.findOne({ _id: id, status: 'draft', ...(tenantId ? { tenant: tenantId } : {}) });
  if (!campaign) fail('CAMPAIGN_NOT_DRAFT', 'Seule une campagne en brouillon peut être approuvée.', 404);
  assertPlatformMarketingScope(campaign.tenant);
  campaign.status = 'approved';
  campaign.approvedBy = actor?._id || actor?.id || null;
  campaign.approvedAt = new Date();
  await campaign.save();
  await audit('approved', { actor, campaign, req });
  return campaign;
}

async function cancelCampaign(id, { actor, reason, req, tenantId } = {}) {
  await assertPlatformMarketingAuthority(actor);
  const campaign = await MarketingCampaign.findOne({ _id: id, status: { $in: ['draft', 'approved'] }, ...(tenantId ? { tenant: tenantId } : {}) });
  if (!campaign) fail('CAMPAIGN_NOT_CANCELLABLE', 'Seule une campagne brouillon ou approuvée peut être annulée.', 404);
  campaign.status = 'cancelled';
  campaign.cancelledBy = actor?._id || actor?.id || null;
  campaign.cancelledAt = new Date();
  await campaign.save();
  await audit('cancelled', { actor, campaign, reason, req });
  return campaign;
}

// MARKETING-CONSENT-1 — `recipient` provient TOUJOURS de
// marketingConsentService.resolveRecipient() (compte actif, consentement du
// canal, absence de désinscription). L'e-mail utilisé est celui du compte
// (User.email), jamais une adresse historique copiée dans la fiche CRM.
async function deliverToChannel({ channel, recipient, rendered, actor }) {
  const user = recipient?.user;
  if (!user?._id) return { status: 'failed', error: 'NO_LINKED_ACCOUNT' };
  if (channel === 'email') {
    if (!user.email) return { status: 'failed', error: 'NO_EMAIL' };
    try {
      await zohoMailService.sendEmail(process.env.ZOHO_FROM_EMAIL, user.email, rendered.subject || '(sans objet)', appendEmailUnsubscribeFooter(rendered.body, user._id));
      return { status: 'sent' };
    } catch (e) { return { status: 'failed', error: `DELIVERY_ERROR:${e?.code || e?.name || 'unknown'}` }; }
  }
  if (channel === 'push' || channel === 'notification') {
    try {
      await notify({
        recipient: String(user._id), sender: actor?._id || actor?.id || null,
        type: 'marketing_message',
        title: rendered.subject || 'Message', body: rendered.body, audience: 'user',
      });
      return { status: 'sent' };
    } catch (e) { return { status: 'failed', error: `DELIVERY_ERROR:${e?.code || e?.name || 'unknown'}` }; }
  }
  return { status: 'failed', error: 'CHANNEL_UNSUPPORTED' };
}

const exclusionStatus = (reason) => (['CONSENT_NOT_GRANTED', 'EMAIL_SUPPRESSED'].includes(reason) ? 'unsubscribed' : 'excluded');

async function sendCampaign(id, { actor, req, tenantId } = {}) {
  // Révocation/suspension vérifiée au moment de l'envoi, jamais depuis une
  // autorisation chargée lors de la création ou de l'approbation.
  await assertPlatformMarketingAuthority(actor);
  const campaign = await MarketingCampaign.findOne({ _id: id, status: 'approved', ...(tenantId ? { tenant: tenantId } : {}) }).populate('template');
  if (!campaign) fail('CAMPAIGN_NOT_APPROVED', 'La campagne doit être approuvée avant tout envoi.', 409);
  // Une campagne historique rattachée à un tenant reste en `approved`
  // (annulable) mais n'est jamais envoyée.
  assertPlatformMarketingScope(campaign.tenant);
  campaign.status = 'sending';
  await campaign.save();

  const scopeTenant = campaign.tenant || null;
  const customerIds = await resolveSegment(campaign.segmentKey, campaign.segmentParams, { tenantId: scopeTenant || tenantId });
  const customers = await CrmCustomer.find({ _id: { $in: customerIds }, ...(scopeTenant ? { tenant: scopeTenant } : {}) }).select('emails identityKeys displayName firstName status tenant').lean();
  // Reprise sûre : un destinataire déjà servi par cette campagne n'est
  // jamais resollicité (relance après interruption, double clic…).
  const alreadySent = new Set((await MarketingSend.find({ campaign: campaign._id, status: 'sent' }).distinct('recipientCustomer')).map(String));

  const servedUsers = new Set();
  let sentCount = 0; let failedCount = 0; let excludedCount = 0;
  const journal = (customer, status, error, userId = null) => MarketingSend.create({
    tenant: scopeTenant, campaign: campaign._id, template: campaign.template._id, channel: campaign.channel,
    recipientCustomer: customer._id, recipientUser: userId, recipientEmail: null, status, error,
  });

  for (const customer of customers) {
    if (alreadySent.has(String(customer._id))) continue;
    // Vérification au plus près de l'envoi : relit le compte à chaque
    // destinataire, de sorte qu'un retrait de consentement, une suppression
    // ou une suspension survenus pendant la campagne sont pris en compte.
    const recipient = await resolveRecipient({ customer, campaignChannel: campaign.channel, tenantId: scopeTenant });
    if (!recipient.eligible) {
      excludedCount += 1;
        await journal(customer, exclusionStatus(recipient.reason), recipient.reason, recipient.userId || null);
      continue;
    }
    const userKey = String(recipient.user._id);
    if (servedUsers.has(userKey)) {
      excludedCount += 1;
        await journal(customer, 'excluded', 'DUPLICATE_RECIPIENT', recipient.user._id);
      continue;
    }
    servedUsers.add(userKey);
    const rendered = renderTemplate(campaign.template, { prenom: customer.firstName || customer.displayName, nom: customer.displayName });
    const outcome = await deliverToChannel({ channel: campaign.channel, recipient, rendered, actor });
    if (outcome.status === 'sent') sentCount += 1; else failedCount += 1;
    await journal(customer, outcome.status, outcome.error || null, recipient.user._id);
  }

  campaign.status = 'sent';
  campaign.sentAt = new Date();
  campaign.stats = { totalRecipients: customers.length, sentCount, failedCount, excludedCount };
  await campaign.save();
  await audit('sent', { actor, campaign, req });
  return campaign;
}

async function listCampaigns({ tenantId } = {}) {
  return MarketingCampaign.find(tenantId ? { tenant: tenantId } : {}).sort({ createdAt: -1 }).populate('template', 'name channel').lean();
}

module.exports = {
  CampaignError, createCampaign, approveCampaign, cancelCampaign, sendCampaign, listCampaigns,
  // Réutilisé tel quel par crmAutomationActions.js (Phase 5, envoi
  // individuel déclenché par un workflow) — jamais une seconde
  // implémentation de la logique de diffusion par canal.
  deliverToChannel,
};
