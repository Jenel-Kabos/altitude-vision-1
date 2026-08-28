# ZOHO-INBOX-HEALTHCHECK-1 — MATRICE DES VARIABLES D'ENVIRONNEMENT

Aucune valeur secrète écrite dans ce document — uniquement noms, présence, et longueur (jamais le contenu).

| Variable | Utilisée par | Présente localement (`server/.env`) ? | Environnement concerné |
|---|---|---|---|
| `ZOHO_FROM_EMAIL` | `zohoImapService.js` (auth IMAP `user`, et repli destinataire) | **Oui**, non vide (30 caractères — cohérent avec `contact@altitudevision.agency`) | Local confirmé ; production (Render) **NON CONFIRMÉ directement** (pas d'accès dashboard/logs Render dans cet environnement), mais **fonctionnement indirectement prouvé** : la connexion IMAP réelle testée dans cet audit a réussi avec ces identifiants, et l'historique Mongo (`InternalMail`, emails jusqu'au 2026-08-19) prouve que le pipeline complet a fonctionné avec cette configuration |
| `ZOHO_IMAP_PASSWORD` | `zohoImapService.js` (auth IMAP `pass`) | **Oui**, non vide | Idem |
| `ZOHO_CLIENT_ID`/`ZOHO_CLIENT_SECRET`/`ZOHO_REFRESH_TOKEN`/`ZOHO_ACCOUNT_ID`/`ZOHO_API_DOMAIN` | Non utilisées par `zohoImapService.js` — servent à l'API HTTP Zoho Mail pour l'envoi sortant (`zohoMailService`), hors périmètre de ce healthcheck (réception uniquement) | Présentes localement | Hors périmètre |
| `EMAIL_HOST`/`EMAIL_PORT`/`EMAIL_USERNAME`/`EMAIL_PASSWORD`/`EMAIL_FROM` | Non référencées par `zohoImapService.js` (grep confirmé) — appartiennent à un mécanisme distinct (probablement `utils/email.js`, hors périmètre IMAP) | Présentes localement | Hors périmètre de ce healthcheck |
| `DISABLE_SCHEDULED_JOBS` | `server.js:36` — si `'1'`, désactive TOUS les cron (Facebook + IMAP) | **Absente localement** (donc jobs actifs par défaut en local) | **Production : NON CONFIRMÉ** — aucun accès à la configuration Render dans cet environnement. Preuve indirecte que les cron tournent en production : des emails ont été importés avec succès jusqu'au 2026-08-19 (voir `_STORAGE_MATRIX.md`) |

## Host Zoho réellement configuré (mandat §7 — ne pas supposer)

**`imap.zoho.com`, port 993, TLS** — valeur codée en dur dans `zohoImapService.js:185-187` (pas une variable d'environnement pour le host/port). Confirmé fonctionnel par connexion réelle réussie pendant cet audit.
