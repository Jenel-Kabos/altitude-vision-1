# HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1 — Flux actuel (après implémentation)

## Séquence par cycle de polling (`pollZohoInbox`)

1. Garde de réentrance : si `isPolling === true`, le cycle est ignoré (`{imported:0, skipped:0, errors:0}`), inchangé.
2. Connexion IMAP (`client.connect()`), inchangé.
3. Ouverture de `INBOX` via `getMailboxLock`, inchangé.
4. **Nouveau** : lecture de `client.mailbox.uidValidity` (valeur réelle du serveur, pas une supposition) et chargement du document `ImapSyncCheckpoint` pour `{account: ZOHO_FROM_EMAIL, mailbox: 'INBOX'}`.
5. **Nouveau** : `resolveSyncOrigin(checkpointDoc, currentUidValidity)` détermine le critère de recherche IMAP :
   - Aucun checkpoint → `{ all: true }` (bootstrap).
   - UIDVALIDITY différente → `{ all: true }` (reset contrôlé).
   - UIDVALIDITY identique → `{ uid: '<lastProcessedUid+1>:*' }` (incrémental strict).
6. `client.search(searchCriteria)` remplace l'ancien `client.search({ seen: false })`.
7. Les UID trouvés sont triés puis traités par lots de `FETCH_BATCH_SIZE` (10), **inchangé**.
8. Pour chaque lot : toutes les commandes `fetchAll` du lot se terminent avant toute commande `messageFlagsAdd` du même lot (anti-deadlock ImapFlow), **inchangé**.
9. Pour chaque message du lot, `processFetchedMessage` est appelé (parsing, dédoublonnage par `zohoMessageId`, upload pièces jointes, résolution destinataire, persistance) — **la logique métier interne est totalement inchangée**.
10. **Nouveau** : après chaque message traité avec succès (sans exception), si aucun échec n'a encore eu lieu dans ce cycle (`!checkpointStalled`), `checkpointAdvanceUid = max(checkpointAdvanceUid, uid)`. Dès qu'une exception métier survient sur un message, `checkpointStalled = true` — plus aucune avancée du checkpoint pour le reste du cycle, même si des UID suivants réussissent. Ces UID suivants sont malgré tout traités (résilience pré-existante préservée) et marqués `\Seen` si pertinent, mais le checkpoint ne les dépasse pas.
11. Marquage `\Seen` des messages traités, inchangé dans son ordre (après fetch, jamais avant).
12. **Nouveau**, dans le bloc `finally` (indépendant du succès/échec de la connexion IMAP) : si un reset a eu lieu OU si `checkpointAdvanceUid > checkpointBaseUid`, `ImapSyncCheckpoint.findOneAndUpdate` persiste `{uidValidity, lastProcessedUid: checkpointAdvanceUid}` avec `upsert:true`. Un cycle sans nouveau message et sans reset n'écrit rien.
13. Libération du lock, logout/close, remise de `isPolling` à `false` — inchangé.

## Ce qui n'a pas changé

- `\Seen` reste posé après traitement — désormais un signal cosmétique de lecture pour un client IMAP externe, plus jamais la source de vérité de la synchronisation.
- Dédoublonnage par `zohoMessageId` (`InternalMail.findOne({zohoMessageId})`) — c'est le filet de sécurité qui rend le bootstrap/reset (réexamen complet) sûr sans jamais dupliquer un message déjà importé.
- Résolution destinataire (`User.findOne({email})` puis repli Admin actif), rejet permanent si aucun des deux ne résout.
- Aucune modification de `client/` ni `altimmo-app/`.
