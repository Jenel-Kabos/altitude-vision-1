# HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1 — Stratégie de bootstrap

## Décision

Au premier démarrage (aucun document `ImapSyncCheckpoint` pour `(account, mailbox)`), la recherche utilise `{ all: true }` — réexamen complet de la mailbox — plutôt qu'une hypothèse arbitraire du type "ne considérer que les messages reçus depuis maintenant" ou "supposer que `lastProcessedUid = uidNext - 1`".

## Pourquoi ce choix est sûr ici (preuve, pas supposition)

1. **Taille réelle de la mailbox confirmée en direct** : `exists: 113` au moment de l'audit (lecture seule). Un réexamen complet de 113 messages est un coût négligeable (quelques secondes, un seul cycle), pas un risque de charge.
2. **Le filet de sécurité anti-duplication existe déjà et est prouvé fonctionnel** : `InternalMail.findOne({ zohoMessageId })` avant toute création. Cross-référencé positivement sur deux imports historiques réels (18/19 août) dont le `zohoMessageId` correspond exactement au `Message-ID` Zoho réel. Un bootstrap qui re-fetch un message déjà importé se contente de l'ignorer (`status: 'duplicate'`, `skipped++`) — jamais de doublon créé.
3. **Alternative rejetée : deviner un `lastProcessedUid` de départ** (ex. `uidNext - 1`, "ne rien réexaminer"). Rejetée car elle réintroduirait exactement le risque que ce mandat corrige : un message existant mais jamais vu par notre système (par exemple s'il a été marqué `\Seen` par un tiers avant même l'introduction de ce hotfix) resterait invisible pour toujours, cette fois sans même l'excuse d'un filtre `\Seen` — un vrai retour en arrière silencieux.
4. **Alternative rejetée : compléter `\Seen` par une fenêtre de date récente** (option "minimale" évoquée dans `ZOHO_INBOX_HEALTHCHECK1_ROOT_CAUSE.md`). Rejetée au profit du réexamen complet au bootstrap car elle n'aurait couvert que les messages récents, laissant un angle mort pour tout message plus ancien déjà `\Seen` avant l'introduction du hotfix — le réexamen complet couvre l'intégralité de l'historique, sans angle mort, avec un coût prouvé négligeable sur cette mailbox précise.

## Test de validation

`server/__tests__/zohoImapService.test.js` — test "bootstrap (aucun checkpoint) : réexamen complet, la déduplication empêche tout doublon pour les messages déjà ingérés" : simule 3 UID (111, 112 déjà en base, 113 nouveau), vérifie `client.search` appelé avec `{ all: true }`, `InternalMail.create` appelé **une seule fois** (pour 113), et le checkpoint avance bien à 113 malgré le réexamen complet.

## Limite explicitement documentée (non un défaut caché)

Ce choix est justifié pour **cette** mailbox à **cette** taille. Si la mailbox de production venait à contenir plusieurs dizaines de milliers de messages, un bootstrap par réexamen complet deviendrait coûteux (un seul cycle de polling traiterait alors un grand nombre de lots de 10). Ce mandat ne traite pas ce cas hypothétique — non pertinent à la taille réelle confirmée (113 messages) — et ne doit pas être extrapolé sans nouvelle mesure de la taille réelle de la mailbox au moment considéré.
