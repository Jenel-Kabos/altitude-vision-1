# ZOHO-INBOX-HEALTHCHECK-1 — MATRICE IMAP (preuve directe, lecture seule)

Vérification effectuée : `connect()` → `getMailboxLock('INBOX')` → lecture de métadonnées (`search`, `fetch` ENVELOPE/FLAGS uniquement, jamais le corps complet) → `logout()`. **Aucune commande de mutation exécutée** (`STORE`, `EXPUNGE`, `MOVE`, `COPY`, `DELETE` — jamais utilisées).

| Vérification | Résultat |
|---|---|
| DNS/TCP `imap.zoho.com:993` | OK |
| TLS | OK (`secure: true`, aucune erreur de certificat) |
| Authentification | **Réussie** — `ZOHO_FROM_EMAIL`/`ZOHO_IMAP_PASSWORD` valides au moment du test |
| Ouverture `INBOX` | OK |
| `UIDVALIDITY` | `1` (stable — aucun changement de mailbox/compte détecté) |
| `UIDNEXT` | `114` |
| Nombre total de messages (`EXISTS`) | `113` |
| Nombre de messages **non lus** (`search({seen:false})`) | **0** |
| Message le plus récent (UID 113) | Reçu `2026-08-26T03:50:21Z` (date interne serveur), sujet "Fwd: 100 % thibaut", expéditeur `@gmail.com`, destinataire `contact@altitudevision.agency`, **déjà marqué `\Seen`** |
| Type d'authentification | Mot de passe (probable app password Zoho, cohérent avec la longueur observée) — **pas OAuth** (aucun `ZOHO_REFRESH_TOKEN`/`ZOHO_CLIENT_ID` référencé par `zohoImapService.js`) |

## Dossier IMAP interrogé par le poller (mandat §16)

`INBOX` exactement (`zohoImapService.js:213`, `client.getMailboxLock('INBOX')`) — confirmé identique au dossier interrogé pendant ce healthcheck. Aucun autre dossier (Spam/Junk/Other/Archive) n'est jamais consulté par le code — **si un message arrivait dans un dossier autre qu'INBOX (ex. classé Spam par Zoho), il ne serait jamais vu par le poller**. Pour le message de test (UID 113), il a été trouvé **dans INBOX lui-même** — ce n'est donc pas la cause dans ce cas précis, mais reste une fragilité générale documentée pour référence future.

## Search criteria réel (mandat §17)

`client.search({ seen: false })` — traduit en IMAP `SEARCH UNSEEN`. **Aucun autre critère** (pas de `SINCE`, pas de `UID >`, pas de filtrage par expéditeur). Confirmé par lecture directe de `zohoImapService.js:218`, cohérent avec le comportement observé (0 UNSEEN actuellement, alors que 113 messages existent).

## UID / checkpoint (mandat §19/§20)

**Aucun mécanisme de checkpoint UID n'existe dans le code** (confirmé par recherche exhaustive de `lastUid`/`checkpoint`/`cursor` dans `server/` — zéro résultat pertinent). Le système repose **exclusivement** sur le flag `\Seen` comme unique marqueur de progression. `UIDVALIDITY` n'est ni lu ni comparé nulle part — non pertinent ici puisqu'il n'y a pas de checkpoint à invalider, mais cela signifie aussi qu'**aucun garde-fou n'existe si le flag `\Seen` est modifié par un acteur externe au pipeline** (voir `_ROOT_CAUSE.md`).
