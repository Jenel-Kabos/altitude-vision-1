# TEST-EXTERNAL-ISOLATION-1 — Audit initial

Date : 2026-08-13

## Incident et RCA Zoho

Suite : `hotelFinancialCheckoutF23.mongo.integration.test.js`, cas de check-out avec override. Chemin exact : `performCheckOut` → `notifyReservationGuest` → paramètre par défaut `sendEmailViaZoho` → `emailService` → singleton `zohoMailService` → `getAccessToken()`/`sendEmail()` → Axios vers `accounts.zoho.com` puis `mail.zoho.com`.

Le test utilisait `ada@example.test`, mais ne fournissait aucun fake au service de checkout. Jest fixait `NODE_ENV=test` et une URI Mongo locale, sans retirer les credentials fournisseurs hérités. Le runner Mongo propageait `{...process.env}` au child Jest. `dotenv.config()` dans plusieurs modules permettait en outre de charger les fichiers locaux. Le vrai adapter a donc été utilisé; l'appel Zoho Mail a atteint le fournisseur et a répondu 404. Aucun email n'a été livré.

Cause structurelle commune : isolation Mongo explicite, mais absence de politique egress globale, absence d'assainissement central des variables fournisseurs et injection du transport email non propagée jusqu'au checkout.

## Effets d'import et jobs

`server.js` connecte Mongo dès l'import et enregistre plusieurs crons. `DISABLE_SCHEDULED_JOBS=1` neutralise les jobs, et l'E2E le définit déjà. En test Jest, ce flag n'était pas centralisé. La synchronisation Facebook est déclenchée à l'ouverture Mongo lorsque les jobs ne sont pas désactivés; elle explique le mécanisme runtime capable de recréer `facebookposts` à partir de Graph API. Elle ne doit jamais démarrer dans les tests.

## Matrice egress initiale

| Provider | Adapter | Consumer | Tests actuels | Mocked? | Réseau possible avant correction? | Risque |
|---|---|---|---|---|---|---|
| Zoho Mail API / SMTP | Axios `zohoMailService`; Nodemailer `config/email` | auth, réservations, portail, CRM/marketing | plusieurs mocks, trou F2.3 | partiel | oui | UNSAFE |
| Zoho IMAP | ImapFlow | polling incoming mail | fake ImapFlow dédié | oui localement | oui si chemin non mocké | PARTIAL |
| Cloudinary | singleton SDK + services stockage | uploads, destroy, rename, URLs privées | nombreux mocks | partiel | oui si oubli | PARTIAL |
| Facebook Graph | Axios dans `sync-facebook` | startup, cron, route sync | souvent mocké | partiel | oui si jobs actifs | UNSAFE |
| CinetPay | Axios contrôleurs paiement | initiation/vérification | contrôleurs partiellement testés | partiel | oui si route appelée | PARTIAL |
| Google OAuth | `google-auth-library` | login Google backend | mock dans tests ciblés | oui ciblé | oui si oubli | PARTIAL |
| Google Maps | SDK/config client/mobile | rendu navigateur/mobile | mocks/config build | partiel | navigateur possible | NOT USED IN BACKEND TESTS |
| Webhooks sortants | `fetch(subscription.url)` | notification/public API | mocks ou DB locale | partiel | oui, URL utilisateur | UNSAFE |
| Push Expo | `fetch`/SDK utility | notifications | généralement mocké | partiel | oui si token réel | PARTIAL |
| Twilio | SDK | chemins SMS découverts à confirmer | peu/pas de tests | inconnu | oui | NOT USED IN TESTS / PARTIAL |
| HTTP générique | Axios, fetch, http/https | scripts et adapters | variable | non global | oui | UNSAFE |
| Socket.IO | serveur/client | temps réel | serveur local jetable | local | localhost seulement | SAFE si allowlist |

## Corrections prévues

1. Installer dans chaque processus de test un kill-switch réseau fail-closed autorisant uniquement loopback.
2. Faire échouer chaque test qui aurait déclenché un blocage inattendu, même si le code métier capture l'erreur.
3. Assainir centralement les credentials externes et les environnements des child processes.
4. Propager une injection de fake email dans le checkout fautif et en faire une régression permanente.
5. Ajouter les preuves adversariales Internet refusé, localhost autorisé et child env assaini.
6. Rejouer les suites provider, unitaires, Mongo, Web, Playwright et Mobile, puis revalider `altitudevision` en lecture seule.
