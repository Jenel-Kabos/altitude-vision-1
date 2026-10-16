// MARKETING-CONSENT-1 — Source unique de vérité du consentement marketing.
//
//   - Écriture des préférences : applyConsentChanges / revokeAllMarketingConsent
//     (seuls points d'écriture de User.marketingPreferences, chaque changement
//     effectif est historisé dans MarketingConsentEvent).
//   - Éligibilité d'un destinataire : resolveRecipient — utilisée à la
//     sélection ET juste avant chaque envoi (campagnes et workflows). Aucun
//     autre chemin d'envoi marketing ne doit contourner cette fonction.
//   - Désinscription par lien e-mail : jetons HMAC signés, sans expiration
//     (un lien de désinscription doit rester valable), sans donnée personnelle
//     en clair autre que l'identifiant opaque du compte.
//
// Les notifications OPÉRATIONNELLES (réservations, sécurité, contrats…) ne
// passent jamais par ce service et ne sont donc jamais affectées par un refus.
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const MarketingConsentEvent = require('../models/MarketingConsentEvent');
const MarketingUnsubscribe = require('../models/MarketingUnsubscribe');
const MarketingSend = require('../models/MarketingSend');
const CrmCustomer = require('../models/CrmCustomer');
const {
  CONSENT_CHANNELS,
  ACTIVE_CONSENT_CHANNELS,
  CONSENT_SOURCES,
  CONSENT_TEXT_VERSION,
  CAMPAIGN_CHANNEL_TO_CONSENT,
} = require('../constants/marketingConsent');

class MarketingConsentError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = 'MarketingConsentError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
const fail = (code, message, statusCode) => { throw new MarketingConsentError(code, message, statusCode); };

// Sources pour lesquelles une case NON cochée ne vaut pas retrait : à
// l'inscription, l'absence de coche laisse simplement le statut 'unknown'.
const OPT_IN_ONLY_SOURCES = new Set(['signup', 'profile_completion']);

const channelStatus = (user, channel) => user?.marketingPreferences?.[channel]?.status || 'unknown';

// N'accepte que de vrais booléens sur des canaux actifs : toute autre valeur
// (chaîne "true", 1, canal inconnu) est ignorée — jamais interprétée comme
// un consentement.
function normalizeConsentInput(input, { channels = ACTIVE_CONSENT_CHANNELS } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  for (const channel of channels) {
    if (typeof input[channel] === 'boolean') out[channel] = input[channel];
  }
  return out;
}

function publicPreferences(user) {
  const channels = {};
  for (const channel of ACTIVE_CONSENT_CHANNELS) {
    const pref = user?.marketingPreferences?.[channel] || {};
    channels[channel] = {
      status: pref.status || 'unknown',
      granted: pref.status === 'granted',
      updatedAt: pref.updatedAt || null,
    };
  }
  return { channels, textVersion: CONSENT_TEXT_VERSION };
}

async function loadUser(userId, session) {
  const query = User.findById(userId).select('status isActive isTechnical email marketingPreferences');
  return session ? query.session(session) : query;
}

// Applique des changements explicites. `changes` = { email: true|false, push: … }.
// Idempotent : un canal déjà dans l'état demandé ne produit ni écriture ni
// événement.
async function applyConsentChanges(userId, changes, { source, session = null } = {}) {
  if (!CONSENT_SOURCES.includes(source)) fail('MARKETING_CONSENT_SOURCE_INVALID', 'Source de consentement invalide.', 500);
  if (!mongoose.isValidObjectId(String(userId))) fail('MARKETING_CONSENT_USER_INVALID', 'Utilisateur invalide.', 400);
  const user = await loadUser(userId, session);
  if (!user) fail('MARKETING_CONSENT_USER_NOT_FOUND', 'Utilisateur introuvable.', 404);
  if (user.status === 'Supprimé') fail('MARKETING_CONSENT_ACCOUNT_DELETED', 'Compte supprimé.', 409);

  const now = new Date();
  const set = {};
  const events = [];
  for (const [channel, wanted] of Object.entries(changes || {})) {
    if (!CONSENT_CHANNELS.includes(channel) || typeof wanted !== 'boolean') continue;
    if (!wanted && OPT_IN_ONLY_SOURCES.has(source)) continue;
    const previousStatus = channelStatus(user, channel);
    const status = wanted ? 'granted' : 'withdrawn';
    if (previousStatus === status) continue;
    set[`marketingPreferences.${channel}`] = { status, updatedAt: now, source, textVersion: CONSENT_TEXT_VERSION };
    events.push({ user: user._id, channel, previousStatus, status, source, textVersion: CONSENT_TEXT_VERSION, at: now });
  }

  if (events.length) {
    await User.updateOne({ _id: user._id }, { $set: set }, session ? { session } : {});
    await MarketingConsentEvent.insertMany(events, session ? { session } : {});
  }
  const refreshed = await loadUser(user._id, session);
  return { changed: events.map((e) => e.channel), preferences: publicPreferences(refreshed) };
}

// Retrait global (suppression de compte, demande explicite) : tout canal non
// déjà 'withdrawn' passe à 'withdrawn', y compris 'unknown', pour qu'aucun
// réabonnement ne puisse être inféré plus tard.
async function revokeAllMarketingConsent(userId, { source, session = null } = {}) {
  const user = await loadUser(userId, session);
  if (!user) return { changed: [] };
  const now = new Date();
  const set = {};
  const events = [];
  for (const channel of CONSENT_CHANNELS) {
    const previousStatus = channelStatus(user, channel);
    if (previousStatus === 'withdrawn') continue;
    set[`marketingPreferences.${channel}`] = { status: 'withdrawn', updatedAt: now, source, textVersion: CONSENT_TEXT_VERSION };
    events.push({ user: user._id, channel, previousStatus, status: 'withdrawn', source, textVersion: CONSENT_TEXT_VERSION, at: now });
  }
  if (events.length) {
    await User.updateOne({ _id: user._id }, { $set: set }, session ? { session } : {});
    await MarketingConsentEvent.insertMany(events, session ? { session } : {});
  }
  return { changed: events.map((e) => e.channel) };
}

async function getPreferences(userId) {
  const user = await loadUser(userId);
  if (!user) fail('MARKETING_CONSENT_USER_NOT_FOUND', 'Utilisateur introuvable.', 404);
  return publicPreferences(user);
}

// ── Éligibilité ──────────────────────────────────────────────────────────
// Codes de raison volontairement non nominatifs : ils sont journalisés dans
// MarketingSend.error et ne doivent jamais contenir d'e-mail ni de nom.
function evaluateUserEligibility(user, consentChannel) {
  if (!user) return { eligible: false, reason: 'NO_LINKED_ACCOUNT' };
  if (user.status === 'Supprimé') return { eligible: false, reason: 'ACCOUNT_DELETED' };
  if (user.isTechnical) return { eligible: false, reason: 'TECHNICAL_ACCOUNT' };
  if (user.isActive === false || (user.status && user.status !== 'Actif')) return { eligible: false, reason: 'ACCOUNT_INACTIVE' };
  if (!CONSENT_CHANNELS.includes(consentChannel)) return { eligible: false, reason: 'CHANNEL_UNSUPPORTED' };
  if (channelStatus(user, consentChannel) !== 'granted') return { eligible: false, reason: 'CONSENT_NOT_GRANTED' };
  return { eligible: true, reason: null };
}

const linkedUserId = (customer) => {
  const key = (customer?.identityKeys || []).find((k) => typeof k === 'string' && k.startsWith('user:'));
  const id = key ? key.slice(5) : null;
  return id && mongoose.isValidObjectId(id) ? id : null;
};

// Une fiche CRM sans compte Altimmo/Altitude Vision lié (fiche saisie par le
// staff, formulaire de contact, devis…) n'a aucun consentement vérifiable :
// elle est exclue par défaut de toute campagne marketing.
async function resolveRecipient({ customer, campaignChannel, tenantId = null }) {
  if (!customer) return { eligible: false, reason: 'NO_CUSTOMER' };
  if (customer.status && customer.status !== 'active') return { eligible: false, reason: 'CUSTOMER_NOT_ACTIVE' };
  if (tenantId && String(customer.tenant || '') !== String(tenantId)) return { eligible: false, reason: 'OUT_OF_TENANT_SCOPE' };
  const consentChannel = CAMPAIGN_CHANNEL_TO_CONSENT[campaignChannel];
  if (!consentChannel) return { eligible: false, reason: 'CHANNEL_UNSUPPORTED' };
  const userId = linkedUserId(customer);
  if (!userId) return { eligible: false, reason: 'NO_LINKED_ACCOUNT' };
  const user = await User.findById(userId).select('status isActive isTechnical email marketingPreferences').lean();
  const verdict = evaluateUserEligibility(user, consentChannel);
  if (!verdict.eligible) return { ...verdict, userId };
  if (consentChannel === 'email') {
    if (!user.email) return { eligible: false, reason: 'NO_EMAIL', userId };
    const suppressed = await MarketingUnsubscribe.exists({ email: user.email, tenant: { $in: [null, ...(tenantId ? [tenantId] : [])] } });
    if (suppressed) return { eligible: false, reason: 'EMAIL_SUPPRESSED', userId };
  }
  return { eligible: true, reason: null, userId, user };
}

// Version groupée (prévisualisation de segment) : mêmes règles que
// resolveRecipient, sans requête par destinataire. Ne renvoie que des
// compteurs — jamais d'identité.
async function summarizeEligibility(customerIds, { campaignChannel, tenantId = null } = {}) {
  const consentChannel = CAMPAIGN_CHANNEL_TO_CONSENT[campaignChannel];
  const summary = { total: customerIds.length, eligible: 0, excluded: {} };
  const bump = (reason) => { summary.excluded[reason] = (summary.excluded[reason] || 0) + 1; };
  if (!consentChannel) { if (customerIds.length) summary.excluded.CHANNEL_UNSUPPORTED = customerIds.length; return summary; }
  const customers = await CrmCustomer.find({ _id: { $in: customerIds } }).select('identityKeys status tenant').lean();
  const userIds = [...new Set(customers.map(linkedUserId).filter(Boolean))];
  const users = new Map((await User.find({ _id: { $in: userIds } }).select('status isActive isTechnical email marketingPreferences').lean()).map((u) => [String(u._id), u]));
  const emails = [...users.values()].map((u) => u.email).filter(Boolean);
  const suppressed = consentChannel === 'email'
    ? new Set(await MarketingUnsubscribe.distinct('email', { email: { $in: emails }, tenant: { $in: [null, ...(tenantId ? [tenantId] : [])] } }))
    : new Set();
  const seen = new Set();
  for (const customer of customers) {
    if (customer.status && customer.status !== 'active') { bump('CUSTOMER_NOT_ACTIVE'); continue; }
    if (tenantId && String(customer.tenant || '') !== String(tenantId)) { bump('OUT_OF_TENANT_SCOPE'); continue; }
    const userId = linkedUserId(customer);
    const verdict = evaluateUserEligibility(userId ? users.get(userId) : null, consentChannel);
    if (!verdict.eligible) { bump(verdict.reason); continue; }
    const user = users.get(userId);
    if (consentChannel === 'email' && (!user.email || suppressed.has(user.email))) { bump(user.email ? 'EMAIL_SUPPRESSED' : 'NO_EMAIL'); continue; }
    if (seen.has(userId)) { bump('DUPLICATE_RECIPIENT'); continue; }
    seen.add(userId);
    summary.eligible += 1;
  }
  return summary;
}

// ── Jetons de désinscription ─────────────────────────────────────────────
function unsubscribeKey() {
  const secret = process.env.MARKETING_UNSUBSCRIBE_SECRET || process.env.JWT_SECRET;
  if (!secret) fail('MARKETING_UNSUBSCRIBE_SECRET_MISSING', 'Configuration de désinscription absente.', 500);
  // Clé dérivée : un jeton de désinscription n'est jamais un JWT valide et
  // inversement.
  return crypto.createHash('sha256').update(`marketing-unsubscribe:v1:${secret}`).digest();
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function createUnsubscribeToken({ userId, channel = 'email' }) {
  if (!mongoose.isValidObjectId(String(userId)) || !CONSENT_CHANNELS.includes(channel)) fail('MARKETING_UNSUBSCRIBE_TOKEN_INVALID', 'Paramètres de jeton invalides.', 500);
  const payload = b64url(JSON.stringify({ v: 1, u: String(userId), c: channel }));
  const signature = b64url(crypto.createHmac('sha256', unsubscribeKey()).update(payload).digest());
  return `${payload}.${signature}`;
}

function verifyUnsubscribeToken(token) {
  if (typeof token !== 'string' || token.length > 512 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
  const [payload, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', unsubscribeKey()).update(payload).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data?.v !== 1 || !mongoose.isValidObjectId(data.u) || !CONSENT_CHANNELS.includes(data.c)) return null;
    return { userId: data.u, channel: data.c };
  } catch {
    return null;
  }
}

// Réponse identique que le compte existe ou non (pas d'énumération de
// comptes) ; idempotent.
async function unsubscribeWithToken(token) {
  const claims = verifyUnsubscribeToken(token);
  if (!claims) fail('MARKETING_UNSUBSCRIBE_TOKEN_INVALID', 'Lien de désinscription invalide.', 400);
  const user = await loadUser(claims.userId);
  if (user && user.status !== 'Supprimé') {
    await applyConsentChanges(user._id, { [claims.channel]: false }, { source: 'email_unsubscribe_link' });
    if (claims.channel === 'email' && user.email) {
      await MarketingUnsubscribe.updateOne(
        { tenant: null, email: user.email },
        { $setOnInsert: { tenant: null, email: user.email, channel: 'email', source: 'campaign', unsubscribedAt: new Date() } },
        { upsert: true },
      );
    }
  }
  return { channel: claims.channel };
}

function frontendBaseUrl() {
  return (process.env.FRONTEND_URL || 'https://www.altitudevision.agency').replace(/\/+$/, '');
}

function buildUnsubscribeUrl(userId, channel = 'email') {
  return `${frontendBaseUrl()}/desinscription-marketing?token=${createUnsubscribeToken({ userId, channel })}`;
}

function appendEmailUnsubscribeFooter(html, userId) {
  const url = buildUnsubscribeUrl(userId, 'email');
  return `${html || ''}<hr style="margin-top:24px;border:none;border-top:1px solid #ddd"/>`
    + '<p style="font-size:12px;color:#666">Vous recevez ce message car vous avez accepté de recevoir les offres d’Altitude Vision par e-mail. '
    + `<a href="${url}">Se désinscrire</a> — vous pouvez aussi modifier vos préférences depuis votre compte.</p>`;
}

// MARKETING-CONSENT-1 — Suppression de compte : retire l'e-mail d'origine
// des journaux d'envoi et de la liste de suppression (le compte, anonymisé et
// en consentement 'withdrawn', est de toute façon inéligible). L'historique
// MarketingConsentEvent est conservé (preuve du retrait, sans donnée de
// contact).
async function purgeMarketingContactTraces({ userId, originalEmail = null, customerIds = [], session = null }) {
  const opts = session ? { session } : {};
  const or = [{ recipientUser: userId }];
  if (customerIds.length) or.push({ recipientCustomer: { $in: customerIds } });
  await MarketingSend.updateMany({ $or: or, recipientEmail: { $ne: null } }, { $set: { recipientEmail: null } }, opts);
  if (originalEmail) await MarketingUnsubscribe.deleteMany({ email: String(originalEmail).toLowerCase() }, opts);
}

module.exports = {
  MarketingConsentError,
  normalizeConsentInput,
  applyConsentChanges,
  revokeAllMarketingConsent,
  getPreferences,
  publicPreferences,
  evaluateUserEligibility,
  resolveRecipient,
  summarizeEligibility,
  linkedUserId,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  unsubscribeWithToken,
  buildUnsubscribeUrl,
  appendEmailUnsubscribeFooter,
  purgeMarketingContactTraces,
};
