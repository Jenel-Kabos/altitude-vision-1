# ZOHO-INBOX-HEALTHCHECK-1 — FLUX RÉEL (preuve code:ligne)

## Fichiers réels

| Rôle | Fichier |
|---|---|
| Connexion IMAP + polling | `server/services/zohoImapService.js` (`pollZohoInbox`) |
| Déclencheur cron | `server/server.js:89-96` (`node-cron`, `*/5 * * * *`) + un déclenchement unique 10s après connexion Mongo (`server.js:48-56`) |
| Parsing MIME | `mailparser`, `simpleParser(message.source)`, `zohoImapService.js:47`, sans option |
| Persistance | `server/models/InternalMail.js`, création via `InternalMail.create(...)` (`zohoImapService.js:119-136`) |
| Stockage pièces jointes | `server/services/storage/secureStorageService.js::uploadPrivateAsset` → Cloudinary asset privé |
| API frontend | `server/routes/internalMailRoutes.js` → `server/controllers/internalMailController.js` (`getInbox`, `/internal-mails/received`) |
| Page frontend | `client/lib/pages/dashboard/InternalMessagingPage.jsx` → `client/lib/services/messageService.js::getReceivedMessages()` → `GET /internal-mails/received` |

## Chaîne complète (telle qu'exécutée par le code, confirmée par lecture directe)

```
cron */5 * * * * (server.js:91)
  → pollZohoInbox() (zohoImapService.js:160)
    → garde de réentrance isPolling (ligne 161-164)
    → connect() IMAP (imap.zoho.com:993, TLS, ZOHO_FROM_EMAIL/ZOHO_IMAP_PASSWORD)
    → getMailboxLock('INBOX')
    → search({ seen: false })                    ← NE RENVOIE QUE LES UID NON MARQUÉS \Seen
    → par lots de 10 (FETCH_BATCH_SIZE) :
        → fetchAll(uidBatch, { source: true })
        → pour chaque message :
            → simpleParser(message.source)
            → dédoublonnage par zohoMessageId (Message-ID de l'en-tête, ou repli imap-uid-...)
            → si doublon : { markSeen: true, status: 'duplicate' }
            → upload pièces jointes (Cloudinary, best-effort, erreurs individuelles loguées sans bloquer le message)
            → résolution destinataire : User.findOne({email: to}) puis repli User.findOne({role:'Admin', isActive:true})
            → si aucun destinataire résolu : { markSeen: true, status: 'permanent_rejection' } (JAMAIS persisté)
            → sinon : InternalMail.create({...}) → { markSeen: true, status: 'imported' }
        → APRÈS le traitement de tout le lot : messageFlagsAdd(['\\Seen']) pour chaque message ayant retourné markSeen:true
    → logout()
```

## Point de rupture identifié pour le mail de test

Le message n'atteint **jamais** l'étape `search({ seen: false })` avec succès car il est déjà marqué `\Seen` au moment où le poller l'aurait cherché — voir `_ROOT_CAUSE.md`. Toutes les étapes en aval (fetch, parse, dédoublonnage, résolution destinataire, persist, API, frontend) sont donc **hors de cause pour ce message précis**, car jamais atteintes.
