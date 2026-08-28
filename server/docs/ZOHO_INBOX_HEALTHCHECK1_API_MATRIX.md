# ZOHO-INBOX-HEALTHCHECK-1 — MATRICE API

## Non applicable au message de test — mais documenté pour complétude (mandat §39-43)

Le message UID 113 n'ayant jamais été persisté (voir `_STORAGE_MATRIX.md`), il ne peut par construction pas apparaître dans une réponse API — **cette couche n'est pas la cause pour ce message précis**. Ce document confirme néanmoins l'état de cette couche (inchangée, non suspectée) et sert de référence si un futur message rencontrait un problème à ce niveau.

## Endpoint réel consommé par `InternalMessagingPage`

`client/lib/services/messageService.js::getReceivedMessages()` → `GET /internal-mails/received` (confirmé par lecture directe, cohérent avec `HOTFIX_INBOX_SECURITY1_ENDPOINT_MATRIX.md`, déjà audité et certifié).

## Auth / RBAC (mandat §40 — ne pas modifier, revalider seulement)

`server/routes/internalMailRoutes.js` : `router.use(authController.protect)` — inchangé depuis `HOTFIX-INBOX-SECURITY-1`/`INBOX-1`. **Non modifié dans cet audit, non re-testé** (aucun changement suspecté à ce niveau, le message n'atteint jamais l'API).

## Pagination / tri (mandat §42/§43)

`internalMailController.js::getInbox` : `.sort({ createdAt: -1 }).limit(parseInt(limit)).skip(skip)`, `limit` par défaut `20` — tri par `createdAt` (date d'ingestion serveur, PAS la date d'en-tête `Date:` de l'email, confirmé par `INBOX1_MIME_PIPELINE.md` : `parsed.date` n'est jamais lu). Si un futur message avait une date d'ingestion très éloignée de sa date d'envoi réelle, il resterait néanmoins trié correctement par `createdAt` (date d'insertion Mongo) — pas de risque de "tri qui l'enterre loin dans l'historique" pour un message fraîchement importé, celui-ci recevrait toujours un `createdAt` proche de l'instant présent.

## Réponse API réelle pour le message de test

Non applicable — n'existe pas en base, ne peut donc apparaître dans aucune réponse `GET /internal-mails/received`. Aucune requête de vérification API n'a été faite pour ce message précis (inutile, la cause est déjà établie à une couche antérieure).
