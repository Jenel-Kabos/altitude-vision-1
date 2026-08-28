# ZOHO-INBOX-HEALTHCHECK-1 — ÉTAT INITIAL

## Baseline git

- Branche : `main`
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` ("Update Altimmo 40") — inchangé.
- `git status --short` : 425 lignes — travail parallèle déjà documenté (`ARCH2*`) plus mes hotfix non commités des sprints précédents. Aucun écrasement.
- `git diff --check` : propre.

## Nature de l'intervention

**Audit read-only complet, aucune modification de code, aucune mutation de donnée, aucune action sur la boîte Zoho** (aucun `mark seen`, `delete`, `move`, `send`, `reply`). Deux vérifications directes ont été effectuées en lecture seule :
1. Une connexion IMAP réelle vers Zoho (connect → auth → ouverture INBOX → lecture de métadonnées → `logout`), en réutilisant exactement la configuration du code existant (`imap.zoho.com:993`, `ZOHO_FROM_EMAIL`/`ZOHO_IMAP_PASSWORD`).
2. Une requête Mongoose en lecture seule (`.findOne`/`.find().lean()`, aucun `.save`/`.updateOne`/`.deleteOne`) sur `InternalMail`.

## Documents existants lus avant cet audit

`INBOX1_MIME_PIPELINE.md` (déjà très détaillé, preuve code:ligne du pipeline IMAP/MIME), `INBOX1_ARCHITECTURE.md`, `INBOX1_ENDPOINT_MATRIX.md`, `HOTFIX_MSG_STAFF_INBOX1_*.md` — aucun document dédié à un "deadlock IMAP" ou "UID checkpoint" n'a été trouvé sous ce nom exact ; le mécanisme de verrou anti-réentrance (`isPolling`) et l'ordre fetch→process→mark-seen (référencé en commentaire comme corrigeant un risque de deadlock ImapFlow) sont documentés directement dans le code source (`zohoImapService.js`, commentaires "INBOX-PRO-1") et couverts par `__tests__/zohoImapService.test.js` (10 tests, rejoués dans cet audit, tous verts).

## Résultat immédiat de la vérification IMAP en direct

Connexion réussie (TLS + authentification), INBOX ouverte, **0 message non lu (`UNSEEN`) actuellement dans la boîte**, 113 messages au total. Le message le plus récent (UID 113, reçu 2026-08-26T03:50, sujet "Fwd: 100 % thibaut", très probablement l'email de test mentionné dans le mandat) est déjà marqué `\Seen` **et n'existe pas dans `InternalMail`**. Voir `_ROOT_CAUSE.md` pour l'analyse complète — ce constat oriente directement l'investigation vers la frontière IMAP search/`\Seen`, pas vers le parsing, Mongo, l'API ou le frontend.
