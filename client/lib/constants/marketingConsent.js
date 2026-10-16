// MARKETING-CONSENT-1 — Libellés de consentement marketing (web). Toute
// modification impose d'incrémenter CONSENT_TEXT_VERSION côté serveur
// (server/constants/marketingConsent.js) et de garder ces textes alignés sur
// l'application mobile (altimmo-app/src/constants/marketingConsent.js).
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
    consentLabel: 'J’accepte de recevoir des notifications promotionnelles dans l’application et sur mon compte (facultatif).',
    description: 'Offres et actualités affichées en notification dans l’application Altimmo et votre espace.',
  },
]);

export const OPERATIONAL_NOTICE = 'Ces choix ne concernent que les communications promotionnelles. '
  + 'Les messages nécessaires à votre compte (sécurité, réservations, paiements, contrats, visites) restent toujours envoyés.';

export const EMPTY_MARKETING_CONSENT = Object.freeze({ email: false, push: false });
