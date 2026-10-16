// MARKETING-CONSENT-1 — Libellés de consentement marketing présentés à
// l'utilisateur. Toute modification de ces textes impose d'incrémenter
// CONSENT_TEXT_VERSION côté serveur (server/constants/marketingConsent.js),
// qui historise la version en vigueur à chaque changement de statut.
export const MARKETING_CONSENT_TEXT_VERSION = 'marketing-consent-2026-10-10';

export const MARKETING_CHANNELS = Object.freeze([
  {
    key: 'email',
    title: 'Offres par e-mail',
    consentLabel: 'J’accepte de recevoir par e-mail les offres et actualités d’Altitude Vision (facultatif).',
    description: 'Nouveautés, offres immobilières et hôtelières, actualités d’Altitude Vision.',
  },
  {
    key: 'push',
    title: 'Notifications promotionnelles',
    consentLabel: 'J’accepte de recevoir des notifications promotionnelles dans l’application (facultatif).',
    description: 'Offres et actualités affichées en notification sur cet appareil et dans l’application.',
  },
]);

export const OPERATIONAL_NOTICE = 'Ces choix ne concernent que les communications promotionnelles. '
  + 'Les messages nécessaires à votre compte (sécurité, réservations, paiements, contrats, visites) restent toujours envoyés.';

export const EMPTY_MARKETING_CONSENT = Object.freeze({ email: false, push: false });
