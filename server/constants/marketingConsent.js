// MARKETING-CONSENT-1 — Référentiel unique du consentement marketing.
//
// Règles :
//   - la création d'un compte n'est JAMAIS un consentement : statut initial
//     'unknown', traité exactement comme un refus pour toute campagne ;
//   - un consentement ne s'obtient que par une action explicite de
//     l'utilisateur (case non précochée, interrupteur dans les paramètres) ;
//   - aucun consentement rétroactif n'est fabriqué pour les comptes existants.
//
// Canaux de CONSENTEMENT (≠ canaux techniques de campagne) : 'push' couvre à
// la fois les notifications push Expo et les notifications in-app, puisque
// marketingCampaignService les délivre par le même notify().
const CONSENT_CHANNELS = Object.freeze(['email', 'push', 'sms', 'whatsapp']);

// Seuls ces canaux disposent d'un transport réellement implémenté
// (zohoMailService, notify()). SMS/WhatsApp restent stockables mais ne sont
// proposés dans aucune interface tant qu'aucun fournisseur n'est branché.
const ACTIVE_CONSENT_CHANNELS = Object.freeze(['email', 'push']);

const CONSENT_STATUSES = Object.freeze(['unknown', 'granted', 'withdrawn']);

const CONSENT_SOURCES = Object.freeze([
  'signup',
  'profile_completion',
  'mobile_settings',
  'web_settings',
  'email_unsubscribe_link',
  'account_deletion',
]);

// Version du texte présenté à l'utilisateur. Toute modification du libellé
// de consentement (mobile, web) doit incrémenter cette valeur : chaque
// changement de statut est historisé avec la version en vigueur.
const CONSENT_TEXT_VERSION = 'marketing-consent-2026-10-10';

const CAMPAIGN_CHANNEL_TO_CONSENT = Object.freeze({
  email: 'email',
  push: 'push',
  notification: 'push',
  sms: 'sms',
  whatsapp: 'whatsapp',
});

module.exports = {
  CONSENT_CHANNELS,
  ACTIVE_CONSENT_CHANNELS,
  CONSENT_STATUSES,
  CONSENT_SOURCES,
  CONSENT_TEXT_VERSION,
  CAMPAIGN_CHANNEL_TO_CONSENT,
};
