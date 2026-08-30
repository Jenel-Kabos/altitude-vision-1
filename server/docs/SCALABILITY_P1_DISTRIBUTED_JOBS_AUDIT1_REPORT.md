# SCALABILITY-P1-DISTRIBUTED-JOBS-AUDIT-1 — Rapport final

## Executive summary

**DISTRIBUTED JOB READINESS SCORE : 48 / 100.**

**Verdict : C — SINGLE-INSTANCE SAFE, MULTI-INSTANCE NOT YET SAFE.**

| Indicateur | Résultat |
|---|---|
| Current topology | **CONDITIONAL** — sûre si une seule instance exécute les jobs |
| 2 instances, jobs actifs partout | **UNSAFE** |
| 10 instances, jobs actifs partout | **UNSAFE** |
| P0 | **0** |
| P1 | **4 jobs** |
| P2 | **3 jobs** |
| P3 | **0** |
| Most dangerous job | Expiration des réservations hôtelières |
| First likely failure | Amplification IMAP à chaque boot/tick, puis doublons d'emails de pénalité lorsque la fenêtre métier s'ouvre |
| Recommended phase 1 | Déploiement scheduler unique + leases Mongo par job + claims atomiques par ressource |
| Recommended target architecture | File durable Redis/BullMQ et worker dédié pour les effets externes critiques, monolithe modulaire conservé |

Sept jobs cron canoniques sont enregistrés par `server.js`. Facebook et IMAP ont en plus une invocation de démarrage après l'ouverture Mongo ; ce sont deux déclencheurs supplémentaires, pas deux handlers métier supplémentaires. Aucun cron n'a de lease, leader election ou mutex distribué. La variable `DISABLE_SCHEDULED_JOBS=1` permet une désignation opérationnelle d'une seule instance, documentée dans les runbooks, mais le code ne garantit pas qu'une seule réplique reste activée.

Aucun job planifié découvert ne débite un client, n'initie un paiement fournisseur, ne crée une allocation ou un remboursement. Les transactions financières protègent les primitives invoquées par les requêtes/webhooks, mais ne constituent pas un lock de scheduler. Aucun P0 de double débit ou de corruption financière n'est donc démontré.

Le risque P1 le plus fort est l'expiration hôtelière : plusieurs instances peuvent lire le même document `pending`, chacune libérer le même inventaire, puis sauvegarder son document périmé. Un crash après la libération mais avant le statut laisse également la réservation sélectionnable au prochain tick et peut provoquer une seconde libération. La contrainte `reservedUnits >= roomsCount` évite une valeur négative, mais pas la consommation erronée du stock réservé par une autre réservation.

## Baseline

| Élément | Valeur |
|---|---|
| Branche | `main` |
| HEAD | `f56774e317680aca1bb3992d8d03c0623215f451` |
| Worktree initial | Non vierge |
| Fichier non suivi préexistant | `server/docs/PLATFORM_HEALTH_AUDIT_360_V1_REPORT.md` |
| Fichiers suivis modifiés | Aucun |
| `git diff --stat` initial | Vide, car le rapport préexistant est non suivi |
| `git diff --check` initial | Vert |

Le rapport global de 333 lignes a été relu intégralement. Ses constats cron, IMAP, paiements, synchronisations, notifications, résilience et observabilité ont été repris puis vérifiés dans le code courant.

## Méthode et périmètre

- Recherche automatique de `node-cron`, `schedule`, timers, pollers, workers, queues, retry, cleanup, expiration, synchronisation et réconciliation.
- Inspection manuelle du bootstrap, des sept handlers, de leurs modèles, index et effets externes.
- Scripts manuels de migration/réconciliation inventoriés mais exclus des jobs runtime : ils ne sont ni enregistrés ni appelés par `server.js`.
- CRM automation et webhooks publics caractérisés comme effets asynchrones événementiels, pas comme jobs planifiés.
- Six suites unitaires ciblées exécutées sans réseau externe : **6/6 suites et 41/41 tests verts**.
- Aucun test de ce mandat n'a utilisé Zoho, Facebook, Cloudinary, un fournisseur de paiement ou une base de production.

## Inventaire canonique des jobs

| ID | Job | Fichier / handler | Déclencheur | Fréquence | Effet métier | DB | Externe | Idempotence | Lock | Risque multi-instance |
|---|---|---|---|---|---|---|---|---|---|---|
| J1 | Synchronisation Facebook + nettoyage | `server.js` → `scripts/sync-facebook.js::syncFacebook` | `node-cron` + Mongo `open` | Horaire + une fois au boot | Upsert des 10 derniers posts/page, suppression > 5 jours | Oui | Facebook Graph (lecture) | **B** — unique/upsert DB | Aucun scheduler lock | P2, amplification appels |
| J2 | Polling boîte Zoho | `server.js` → `zohoImapService::pollZohoInbox` | `node-cron` + timer boot | 5 min + 10 s après Mongo open | Importe mails et pièces jointes, avance checkpoint | Oui | Zoho IMAP, stockage privé/Cloudinary | **C** — partielle | `isPolling` local + mailbox lock local/protocole | P1 |
| J3 | Rappels hébergements | `accommodationReservationReminderService` | `node-cron` | 15 min | Notifications arrivée J-1/J0 et départ | Oui | Socket/push/webhooks via `notify` | **B** — claim DB atomique | Aucun scheduler lock | P2 |
| J4 | Pénalités et alertes locatives | `alerteService` + `rentalFinancialAutomationService` | `node-cron` | Quotidien `0 6 * * *` | Calcule retard/pénalité, email locataire, alertes contrats/paiements | Oui | Zoho email, push/webhooks | **D** — email non idempotent | Aucun | P1 |
| J5 | Automatisation visites | `visiteAutomationService` | `node-cron` | 5 min | Rappels, expiration des demandes non confirmées | Oui | Socket/push/webhooks | **D** au niveau global | Claim atomique des rappels seulement | P1 |
| J6 | Expiration réservations hôtel | `hotelReservationExpiryService` | `node-cron` | 5 min | Statut expiré, libération inventaire/chambres, notification | Oui | Email invité ou push/webhooks | **D** | Aucun | **P1 — plus dangereux** |
| J7 | Expiration/rappels immobilier | `realEstateApplicationService` | `node-cron` | 5 min | Expire réservations/dossiers, libère bien, rappelle | Oui | Socket/push/webhooks | **B** — claims + déduplication DB | Aucun scheduler lock | P2 |

Légende idempotence : A strictement idempotent ; B effectivement idempotent par contrainte/claim DB ; C partiellement idempotent ; D non idempotent ; E non confirmé.

### Comptage exact

- Jobs canoniques planifiés : **7**.
- Jobs utilisant `node-cron` : **7**.
- Timers récurrents runtime hors cron : **0**.
- Timer one-shot métier : **1**, premier poll IMAP 10 secondes après Mongo `open`.
- Handlers également invoqués au démarrage : **2**, Facebook et IMAP.
- Verrous distribués réels sur ces sept jobs : **0**.
- A strictement idempotents : **0**.
- B protégés par contrainte/claim DB : **3** — Facebook, rappels hébergements, immobilier.
- C partiellement idempotents : **1** — IMAP.
- D non idempotents : **3** — pénalités/alertes, visites, expiration hôtel.
- E non confirmés : **0**.

Les TTL Mongo natifs de documents expirables ne sont pas comptés comme jobs applicatifs : ils sont exécutés par MongoDB, sans handler métier, email, notification ou transition applicative.

## Bootstrap et ordre réel

```text
node server.js
  → configuration DNS puis dotenv
  → import Express/Mongoose/services
  → connectDB() invoqué sans await
  → initializeCrmAutomation() enregistre l'observer notification
  → définition de DISABLE_SCHEDULED_JOBS
  → handler mongoose.connection.once('open') enregistré
  → 7 cron enregistrés immédiatement pendant l'évaluation du module
  → construction Express, routes et middlewares
  → création HTTP puis initSocket(httpServer)
  → httpServer.listen() sans attendre explicitement Mongo
  → ultérieurement Mongo open
      → syncFacebook() attendue
      → programmation du poll IMAP à +10 s
```

Conséquences :

- Les cron sont enregistrés avant la disponibilité Mongo et avant le `listen` HTTP. Un tick calendaire peut théoriquement partir pendant la connexion DB.
- Chaque processus évaluant `server.js` enregistre les sept cron, sauf si `DISABLE_SCHEDULED_JOBS === '1'`.
- Le cache CommonJS évite normalement une seconde évaluation dans le même processus. Aucun registre central ni garde globale ne protège toutefois contre un cache invalidé/hot reload atypique.
- En tests, l'environnement sûr positionne le flag de désactivation et de nombreuses suites mockent `node-cron`.
- Un rollout zero-downtime avec ancienne et nouvelle instance actives exécute les jobs dans les deux processus si le flag reste actif des deux côtés.

## Side effects d'import

| Module | Classe | Motif |
|---|---|---|
| `server/server.js` | **RISKY** | Connexion Mongo, observer CRM, cron, Socket et HTTP sont initialisés à l'évaluation |
| `scripts/sync-facebook.js` | **SAFE** pour l'import | Définit modèle/fonctions et capture le token ; ne synchronise pas seul |
| Services des sept jobs | **SAFE** | Exportent des handlers ; aucun cron interne découvert |
| Scripts `reconcile-*`, migrations et seeds | **RISKY si importés**, hors bootstrap | Plusieurs appellent `main()` au niveau module, mais aucun n'est importé par le serveur runtime |
| `notificationObservationPort` / CRM | **SAFE/explicite** | L'observer est enregistré par appel explicite, pas par simple import |

## Analyse détaillée

### J1 — Facebook

- Deux déclencheurs possibles : Mongo `open` et cron horaire. Aucun `isRunning` local ; ils peuvent se chevaucher si l'ouverture arrive près de l'heure pleine.
- Appel Graph limité à 10 posts pour l'unique page configurée.
- `findOneAndUpdate({facebook_id}, ..., {upsert:true})` et index unique rendent l'état DB effectivement idempotent.
- `deleteMany` des posts anciens est idempotent.
- Deux ou dix instances multiplient les lectures Graph et les écritures upsert, sans double publication Facebook : le job lit Facebook, il n'y publie rien.
- Crash : prochain tick réconcilie ; sémantique effectively-once pour la DB, appels Graph at-least-once.

### J2 — IMAP Zoho

- Cadence : toutes les cinq minutes, plus un poll one-shot 10 secondes après `open`.
- `isPolling` empêche le chevauchement **dans un seul processus**. Il n'est pas partagé entre instances.
- `getMailboxLock('INBOX')` sérialise l'usage de la mailbox pour le client IMAP courant ; aucune preuve qu'il constitue un mutex distribué entre connexions/processus.
- Checkpoint : `(account, mailbox)` unique, `UIDVALIDITY` et `lastProcessedUid`, recherche `UID > checkpoint`, traitement par fetch batch de 10.
- Les UID sont d'abord chargés en tableau ; un bootstrap/reset peut donc charger une mailbox entière en mémoire avant les fetchs batchés.
- Anti-doublon principal : `InternalMail.zohoMessageId` unique+sparse. Deux inserts concurrents du même Message-ID ne persistent qu'un mail.
- Limite : si le message n'a pas de `Message-ID`, le fallback contient `UID + Date.now()`. Deux instances produisent des clés différentes et peuvent importer deux fois.
- Les pièces jointes sont uploadées **avant** l'insert unique. Le perdant d'une course E11000 peut laisser des assets externes orphelins.
- Le checkpoint est mis à jour sans comparaison monotone avec la valeur courante. Une instance plus lente peut réécrire un UID inférieur après une instance plus avancée ; cela provoque surtout du retraitement, neutralisé partiellement par `zohoMessageId`.
- Crash/retry : reprise au tick naturel ; aucun backoff. Un checkpoint non avancé entraîne un rejeu at-least-once.
- Sémantique : at-least-once à la lecture, effectively-once pour les mails ayant un Message-ID stable, non garantie pour fallback/assets.

### J3 — rappels hébergements

- Trois fenêtres de jour calculées explicitement en `Africa/Brazzaville` : arrivée demain, arrivée aujourd'hui, départ aujourd'hui.
- Chaque destinataire/rappel est revendiqué par `findOneAndUpdate` avec champ `...SentAt: null`. Une seule instance remporte le claim.
- Si `notify` échoue proprement, le champ est retiré conditionnellement pour permettre le retry.
- Si le processus meurt après le claim et avant la notification, le rappel peut rester marqué envoyé sans l'avoir été. La garantie privilégie at-most-once au risque d'une perte.
- Requêtes globales par date, non paginées ; isolation via les destinataires de la réservation, sans boucle explicite par tenant.

### J4 — pénalités et alertes locatives

Le cron agrège deux sous-traitements sous un seul déclencheur.

**Pénalité :**

- Charge tous les paiements `impayé/en_retard` avec contrat et parties, sans pagination.
- Calcule déterministiquement 3 %, pose `penaliteAppliquee`, `penaliteMontant` et `montantTotal`. Il ne fait pas `$inc` et ne crée pas de paiement : la DB ne double pas arithmétiquement la pénalité.
- La décision repose néanmoins sur un document lu avant update. Deux instances voient `penaliteAppliquee=false` et envoient toutes deux l'email **avant** `findByIdAndUpdate`.
- Crash après email et avant update : le prochain cron renvoie l'email.
- Résultat : montant effectivement idempotent, email non idempotent ; P1, pas P0.

**Alertes locatives :**

- Clés déterministes `rental_payment_overdue:*` et `rental_contract_expiring:*`.
- L'index unique `(recipient, dedupeKey)` de Notification absorbe la concurrence.
- `notifyStaff` résout le tenant depuis `RentalManagement`, puis limite les destinataires au scope tenant.
- Les collections candidates, contrats et dossiers sont chargés en mémoire par lots globaux non paginés.

Le cron utilise l'heure du serveur pour `0 6 * * *` sans option timezone de `node-cron`. Le calcul des échéances utilise le timezone local Node, contrairement aux rappels hébergements explicitement Brazzaville.

### J5 — visites

- Les rappels utilisent un claim atomique par `reminderStates.<key>` ; le test simule deux invocations concurrentes et une seule gagne.
- Après le claim, les notifications sont `Promise.allSettled`. Un crash ou échec après claim peut perdre le rappel ; il n'existe pas de rollback.
- L'expiration lit des documents Mongoose complets puis les sauvegarde sans filtre atomique sur l'ancien statut et sans optimistic concurrency explicite.
- Deux instances peuvent travailler sur deux copies périmées ; surtout, une confirmation concurrente peut être écrasée par un `save()` d'expiration démarré auparavant.
- `notifyStaff` reçoit seulement `data.screen`, sans tenant ni ressource attribuable. Il échoue fermé et ne diffuse normalement pas l'alerte batch ; aucune fuite globale n'a été trouvée.
- Requêtes globales et non paginées, mais bornées fonctionnellement par horizon/statut.

### J6 — expiration hôtel

- Charge toutes les réservations `pending` expirées, sans pagination.
- Appelle `transitionStatus` avec un document lu. La transition libère l'inventaire puis sauvegarde le statut.
- Aucun compare-and-set `status: pending → expired` n'est effectué avant la libération.
- Deux instances peuvent donc libérer deux fois la même quantité. Le filtre `reservedUnits >= roomsCount` empêche seulement de descendre sous zéro ; si d'autres réservations consomment la même catégorie/nuit, leur stock peut être libéré à tort.
- Crash `releaseInventory → process exit → save status` : statut encore pending, prochain tick relibère.
- La notification invité est mieux protégée : `HotelReservationNotification` possède une unicité `(reservation,eventKey,channel)`. Un seul email/push de statut doit être réclamé.
- La notification batch staff ne fournit ni tenant ni ressource ; `notifyStaff` échoue fermé.
- Aucun check-in/check-out/night audit/housekeeping/invoice cron supplémentaire n'a été découvert.
- Sémantique : at-least-once pour la sélection, non idempotente sur l'inventaire ; P1 majeur.

### J7 — immobilier

- Expiration d'une réservation revendiquée par `findOneAndUpdate({_id,status:'active',expiresAt...})`. Une seule instance change le statut.
- La libération du bien filtre aussi `reservationLock.reservation` et `availability:'Réservé'`.
- Notifications avec `dedupeKey`, contraintes uniques par destinataire.
- Dossiers candidats expirés via `updateOne` conditionnel sur l'ancien statut ; rappel revendiqué par `expirationReminderSentAt:null`.
- Crash après statut réservation mais avant libération du bien : la réservation ne sera plus sélectionnée au tick suivant et le bien peut rester bloqué. La concurrence est bien protégée, la récupération de panne ne l'est pas complètement.
- Requêtes globales non paginées/distinct ; aucune boucle tenant, mais les écritures restent attachées aux ressources sélectionnées.

## Effets externes

| Job | Système externe | Effet | Protection duplication |
|---|---|---|---|
| Facebook | Graph API | Lecture uniquement | Aucune limitation distribuée ; pas de publication |
| IMAP | Zoho IMAP | Lecture + marquage `Seen` | Checkpoint et Message-ID partiels |
| IMAP | Stockage privé/Cloudinary | Upload pièces jointes | Pas de claim avant upload |
| Hébergements | Expo/Socket/webhook | Notification | Claim réservation atomique |
| Pénalités | Zoho email | Email de retard | **Aucune clé/claim avant envoi** |
| Alertes locatives | Expo/Socket/webhook | Notification | `dedupeKey` unique par destinataire |
| Visites | Expo/Socket/webhook | Rappels | Claim atomique, perte crash possible |
| Hôtel | Zoho email ou notification interne | Statut invité | Claim unique HotelReservationNotification |
| Immobilier | Expo/Socket/webhook | Rappel/expiration | Claims + dedupeKey |

Aucun job planifié n'appelle directement CinetPay, Yabetoo, MTN, Airtel, SMS ou WhatsApp. Les webhooks sortants déclenchés par `notify` sont fire-and-forget ; lorsqu'une notification dupliquée est absorbée par son index unique, `notify` retourne avant Socket/push/webhook, ce qui réduit aussi la duplication externe.

## Finance et pénalités

- Les primitives du Financial Core disposent d'idempotency keys, journal append-only, contraintes d'allocation et transactions.
- Aucun des sept jobs ne crée un `FinancialPayment`, une allocation, un débit, un remboursement ou une finalisation fournisseur.
- Le modèle legacy `Paiement` de pénalité n'a pas d'index/clé d'idempotence pour le traitement cron ; le job met à jour le document existant de façon déterministe.
- Les transactions financières ne garantissent donc pas la single execution du scheduler ; elles protègent d'autres chemins métier.
- Double débit démontrable : **non**.
- Double allocation démontrable : **non**.
- Double email de pénalité : **oui**.

## Garanties de niveau

| Job | Level actuel | Level requis à 2 instances | Level requis à 10 instances |
|---|---:|---:|---:|
| Facebook | 2 | 2 ou 3 pour quotas | 3 |
| IMAP | 2 partiel | 3 + claim par message | 4 |
| Rappels hébergements | 2 | 2 | 3/4 si volume élevé |
| Pénalités/alertes locatives | 1–2 mixte | 3 + outbox email | 4 |
| Visites | 1–2 mixte | 3 + transitions atomiques | 4 si volumétrie |
| Expiration hôtel | 1 | 3 + claim ressource atomique | 4 |
| Immobilier | 2 | 2 avec récupération | 3/4 |

Niveaux : 0 aucune garantie ; 1 idempotence métier ; 2 atomicité/unique DB ; 3 lock/lease distribué ; 4 queue durable, ownership worker et idempotence.

## Simulation de deux instances

| Job | A exécute ? | B exécute ? | Duplicate effect ? | Protection actuelle |
|---|---|---|---|---|
| Facebook | Oui | Oui | Appels Graph et upserts doublés | Unique/upsert DB |
| IMAP | Oui | Oui | Connexions/fetch/uploads doublés possibles | Message-ID unique partiel |
| Hébergements | Oui | Oui | Un seul claim par rappel | CAS Mongo |
| Pénalités | Oui | Oui | Deux emails possibles | Montant déterministe seulement |
| Visites | Oui | Oui | Rappel revendiqué une fois ; expiration concurrente | CAS rappel uniquement |
| Hôtel | Oui | Oui | Double libération inventaire possible | Notification seulement protégée |
| Immobilier | Oui | Oui | Un seul changement de statut | CAS + dedupe notification |

Avec dix instances, chaque tick produit jusqu'à 10× les requêtes de sélection et les appels non revendiqués. Les effets revendiqués par CAS restent uniques, mais la contention augmente. IMAP peut ouvrir dix connexions, Facebook multiplier les quotas, les pénalités envoyer jusqu'à dix emails et l'hôtel tenter dix libérations.

## Overlap, restart et horloge

| Job | Overlap même process | Crash/restart | Horloge/timezone |
|---|---|---|---|
| Facebook | Possible boot + heure, ou job > 1 h | Réconciliation au prochain tick | Nettoyage avec heure locale Date |
| IMAP | Bloqué par `isPolling` | Rejeu checkpoint au prochain tick | UID, peu dépendant du temps |
| Hébergements | Possible si > 15 min, effets claimés | Claim peut laisser rappel perdu | Brazzaville explicite |
| Pénalités | Possible si > 24 h, improbable | Email peut être rejoué | Cron et dates en timezone serveur |
| Visites | Possible si > 5 min | Reprend candidats ; état partiel possible | Instants UTC, champ timezone non utilisé par le job |
| Hôtel | Possible si > 5 min | Double libération possible après crash | `pendingExpiresAt` instant absolu |
| Immobilier | Possible si > 5 min | Bien peut rester réservé après statut expiré | Instants absolus, seuil 24 h |

Node-cron n'utilise aucune option `timezone` dans `server.js`. Le cron quotidien dépend donc du timezone du conteneur. Aucun clock-skew extrême n'est compensé. Les jobs à seuil absolu tolèrent généralement un petit décalage par exécution tardive, mais pas une horloge avancée.

## Volume, mémoire et performance

| Job | Bornage | Mémoire | Classe |
|---|---|---|---|
| Facebook | 10 posts/page, 1 page | Faible | LIGHT |
| IMAP | Fetch 10, mais tableau complet des UID au reset | Variable | MEDIUM/HEAVY au bootstrap |
| Hébergements | Requêtes de fenêtres non paginées | Tous les candidats d'une journée | MEDIUM |
| Pénalités/alertes | Toutes échéances ouvertes + populate/maps | Potentiellement élevée | HEAVY |
| Visites | Tous candidats horizon/expirés | Potentiellement élevée | MEDIUM |
| Hôtel | Tous `pending` expirés | Potentiellement élevée | MEDIUM |
| Immobilier | Tous IDs/dossiers candidats | Potentiellement élevée | MEDIUM |

Des jobs non bornés existent : J2 au reset, J3, J4, J5, J6 et J7. Aucun algorithme O(n²) n'a été trouvé **dans les sept handlers planifiés**. Le rapprochement CRM O(n²) mentionné par l'audit global n'est pas un cron runtime.

## Tenant et contexte système

- Les sept jobs sont des workers système hors requête ; ils ne disposent pas de `req.user` ni de PlatformOperator.
- Ils interrogent globalement les collections au lieu de boucler explicitement tenant par tenant.
- Aucune écriture cross-tenant directe n'a été démontrée : chaque mutation utilise l'identifiant de la ressource candidate.
- Les alertes locatives résolvent le tenant depuis `RentalManagement` avant `notifyStaff`.
- Les notifications directes utilisent client/propriétaire/guest de la ressource.
- Les deux alertes batch `visite_status` et `hotel_reservation_expired_batch` ne transmettent pas assez de contexte tenant ; `notifyStaff` échoue fermé. C'est une perte d'observabilité, pas une fuite cross-tenant.
- Un futur lock global unique serait mauvais : il bloquerait tous les tenants et domaines pour un job lent. Préférer lease par job pour le scan et claim par ressource/tenant pour le traitement.

## Observabilité, erreurs et retry

Tous les callbacks cron ont un `try/catch`, journalisent l'erreur et laissent le processus vivre. Les handlers importants continuent souvent après une erreur par ressource. Le serveur journalise également les rejets non gérés sans quitter.

| Capacité | État |
|---|---|
| Nom de job dans les logs | Partiel |
| Start/end | Facebook/IMAP bons, autres partiels |
| Durée | IMAP détaillée ; absente globalement ailleurs |
| Processed/skipped/error counts | Partiel |
| Job run/correlation ID | IMAP local `pollCycleId` seulement |
| Lock state | Aucun lock scheduler à exposer |
| Retry count/backoff | Absent ; tick naturel seulement |
| Prometheus/OpenTelemetry/APM | Non trouvé côté serveur |
| Métriques/alertes de retard | Non trouvées |
| Crash recovery garantie | Non |
| Dead-letter queue | Absente |

La sémantique globale est **at-least-once non durable et non coordonnée** : un tick peut être exécuté par chaque instance, mais un tick manqué pendant un arrêt n'est pas rejoué. Certains effets deviennent effectively-once grâce à Mongo ; d'autres restent at-least-once ou peuvent être perdus après un claim. `Exactly once` n'est pas garanti.

## Tests existants et lacunes

### Forces

- IMAP : 19 tests environ sur connexion, batch, doublons, cycle concurrent local, UIDVALIDITY, checkpoint, reprise et timeout.
- Visites : test de deux invocations concurrentes pour le claim de rappel.
- Alertes locatives : deux invocations produisent la même clé métier.
- Hébergements : relecture après claim démontre l'envoi unique ; timezone testée.
- Hôtel : candidats, statut confirmé ignoré et isolation d'erreur testés.
- Immobilier/finance/hôtel : suites Mongo de concurrence réutilisables conceptuellement.
- Campagne ciblée de cet audit : **41/41 tests verts**.

### Manques déterminants

- Aucun test d'enregistrement réel avec deux processus serveur.
- Aucun test de lease contention, car aucun lease scheduler n'existe.
- Aucun test concurrent de deux expirations hôtelières sur le même inventaire.
- Aucun crash injecté entre libération inventaire et sauvegarde statut.
- Aucun test concurrent du job de pénalité et de l'email sortant.
- Le test hébergement est séquentiel/mocked, pas deux workers Mongo réels.
- Aucun test de régression monotone du checkpoint IMAP entre deux instances.
- Aucune métrique de job ou test de deadline/overlap global.

## Top 10 des risques

| Rang | Job/scénario | Impact | Probabilité | Niveau actuel | Niveau requis |
|---:|---|---|---|---:|---:|
| 1 | Hôtel : double libération inventaire | Stock/réservation incohérent | Moyenne-haute à 2+ instances | 1 | 3/4 |
| 2 | Hôtel : crash entre release et save | Libération répétée au retry | Moyenne | 1 | 3/4 |
| 3 | Pénalité : email avant claim/update | Emails multiples au locataire | Haute à 2+ instances | 1 | 3/4 |
| 4 | IMAP : fallback sans Message-ID | Mail importé plusieurs fois | Faible-moyenne | 2 partiel | 3/4 |
| 5 | IMAP : upload avant insert unique | Assets orphelins/coût externe | Moyenne | 1 | 3/4 |
| 6 | Visite : save expiré sur copie périmée | Transition concurrente écrasée | Moyenne | 1 | 3 |
| 7 | Immobilier : crash après claim statut | Bien bloqué après expiration | Faible-moyenne | 2 | 3/4 |
| 8 | IMAP : checkpoint régressif | Rejeu et charge amplifiée | Moyenne | 2 partiel | 3 |
| 9 | Facebook : 10× appels Graph | Quota/bruit/coût | Haute à 10 instances | 2 | 3 |
| 10 | Scans globaux non paginés | Mémoire/latence/overlap | Croissante | 1–2 | 3/4 |

Cause infrastructure commune : tous les processus enregistrent le même scheduler. Les impacts métier ci-dessus ne sont pas sept causes différentes ; ils dépendent du degré d'idempotence de chaque handler.

## Score spécifique

| Sous-score | Note /100 | Justification |
|---|---:|---|
| Job discovery | 95 | Bootstrap compact, 7 cron centralisés et tests identifiables |
| Single execution | 20 | Aucun lock/leader scheduler ; flag opérationnel seulement |
| Idempotence | 62 | Trois jobs Level 2, un partiel, trois non idempotents |
| Failure recovery | 35 | Tick naturel, pas de replay durable ; fenêtres de crash critiques |
| Observability | 45 | Logs utiles mais pas de métriques/run IDs/SLO |
| Multi-tenant safety | 70 | Mutations par ressource, notifications scoped ; scans globaux |
| External side-effect safety | 45 | Dedupe notifications, mais email pénalité et uploads IMAP fragiles |
| 10× readiness | 15 | Amplification systématique et aucune ownership distribuée |
| **Score synthétique** | **48** | Moyenne arrondie des huit axes |

Score estimé après phase 1 bien testée : **72–78 / 100**. La fourchette dépend de la récupération de crash et de l'outbox email, pas seulement de l'acquisition d'un lock.

## Comparaison des architectures futures

| Option | Complexité | Fiabilité/retry | Infrastructure/coût | Observabilité | Tenant/concurrence | Compatibilité Render | Avis |
|---|---|---|---|---|---|---|---|
| A. Lease Mongo par job | Faible-moyenne | Single owner, reprise par expiration ; pas de DLQ | Mongo existant | À construire | Bonne si clés fines | Excellente | **Phase 1 préférée** |
| B. Lock Redis | Moyenne | Bon mutex, travail non durable | Redis requis | Moyenne | Bonne | Bonne | Inutile seul immédiatement |
| C. BullMQ/Redis | Moyenne-haute | Queue durable, retry/backoff/DLQ | Redis + workers | Bonne | Excellente par job/ressource | Bonne | Cible effets externes/100× |
| D. Worker dédié sans queue | Faible | Un seul owner opérationnel, SPOF | Service Render supplémentaire | Moyenne | Correcte | Excellente | Quick win opérationnel, pas cible finale |
| E. Hybride | Progressive | Lease pour scans, queue/outbox pour effets | Évolutive | Meilleure | Meilleure | Bonne | **Cible recommandée** |

### Architecture recommandée maintenant

Conserver le monolithe. Déployer les instances HTTP avec jobs désactivés et une seule commande/processus scheduler désignée. Ajouter ensuite des leases Mongo **par job**, avec owner token, expiration, heartbeat, timeout et métriques. Dans chaque handler P1, revendiquer atomiquement la ressource avant l'effet et utiliser une outbox/idempotency key pour l'email ou l'appel externe. Mongo est déjà disponible : Redis n'est pas nécessaire immédiatement.

Un lease ne suffit pas à réparer un crash au milieu d'un effet. Pour l'hôtel, la transition et la libération doivent former une opération cohérente ou réconciliable. Pour la pénalité, la décision d'envoi doit être persistée avant l'email et reprendre explicitement les statuts `pending/unknown/failed`.

### Architecture recommandée à 100×

Scheduler léger qui publie des travaux durables dans BullMQ/Redis ; workers dédiés déployés séparément mais réutilisant les modules du monolithe ; idempotency key par effet ; retry borné avec backoff et DLQ ; partitionnement tenant/ressource ; outbox transactionnelle pour les événements DB→externes ; métriques de lag, tentative et verrou.

Les jobs impérativement candidats à la queue durable à forte croissance sont IMAP/attachments, emails de pénalité, notifications externes critiques et transitions d'expiration avec effets multiples. Facebook et les simples scans/reconciliations peuvent rester sous lease Mongo plus longtemps.

## Future hotfix plan — trois blocs

### Block A — scheduler infrastructure

Registre central futur `{name,schedule,handler,lease,timeout,retry,metrics}`, service scheduler unique, lease Mongo par job, désactivation explicite des cron dans les instances HTTP, readiness séparée du scheduler et métriques de lag/ownership.

### Block B — jobs P1 métier

Claims/transactions/reconciliation pour expiration hôtel ; claim persistant/outbox pour pénalité email ; checkpoint IMAP monotone et claim avant upload ; transition Visite compare-and-set. Ne pas utiliser un lock global unique.

### Block C — tests et observabilité

Deux processus/invocations Mongo réels, contention lease, expiration lease, crash après chaque checkpoint, retry, duplicate prevention, isolation tenant, panne API externe, overlap, rollout old+new, compteurs start/end/duration/processed/skipped/retry et alertes.

## Réponses obligatoires 1–68

1. **Branche ?** `main`.
2. **HEAD ?** `f56774e317680aca1bb3992d8d03c0623215f451`.
3. **Worktree ?** Non vierge : rapport global non suivi préexistant ; aucun fichier suivi modifié.
4. **Diff-check initial ?** Vert.
5. **Combien de jobs ?** 7 canoniques ; 2 invocations startup supplémentaires de handlers existants.
6. **Node-cron ?** 7.
7. **setInterval/autre ?** 0 récurrent ; 1 `setTimeout` one-shot IMAP.
8. **Démarrent au bootstrap HTTP ?** Les 7 sont enregistrés pendant l'import de l'entrypoint ; deux handlers partent après Mongo open.
9. **Lock distribué réel ?** 0 sur les jobs.
10. **Strictement idempotents ?** 0 en classe A.
11. **Protégés uniquement par DB ?** 3 en classe B.
12. **Non idempotents ?** 3 en classe D.
13. **Non confirmés ?** 0 ; un job est partiellement idempotent.
14. **Chaque instance exécute ?** Oui, sauf `DISABLE_SCHEDULED_JOBS=1`.
15. **Leader election ?** Non.
16. **Queue durable ?** Non.
17. **Redis utilisé ?** Non trouvé dans les dépendances/runtime serveur.
18. **Bull/BullMQ ?** Non.
19. **Worker séparé ?** Non.
20. **IMAP multi-instance safe ?** Non entièrement.
21. **Notifications ?** Souvent Level 2 via dedupe/claims ; pas universel.
22. **Visites ?** Rappels protégés, expirations non atomiques.
23. **Paiements ?** Aucun paiement fournisseur planifié ; alertes seulement.
24. **Pénalités ?** Montant déterministe, email duplicable.
25. **Réservations ?** Hébergement reminders et immobilier bien protégés ; hôtel non sûr.
26. **Synchronisations externes ?** Facebook et IMAP sont amplifiées par instance.
27. **Double débit possible ?** Non démontré par un job.
28. **Double email possible ?** Oui, pénalité locative.
29. **Double notification possible ?** Fortement réduit par claims/dedupe ; batch non scoped échoue fermé.
30. **Double transition possible ?** Oui conceptuellement Visite/Hôtel sur copies périmées.
31. **Double libération disponibilité ?** Oui, hôtel ; immobilier est conditionnellement protégé.
32. **Transactions financières suffisantes ?** Non, elles ne lockent pas le scheduler.
33. **Deux instances correctes ?** Non si jobs actifs partout ; conditionnel si une seule instance scheduler.
34. **Trois instances ?** Même verdict.
35. **Dix instances ?** Non sûres sans ownership distribuée.
36. **Premier job susceptible de casser ?** IMAP par fréquence/boot ; email pénalité au premier lot éligible.
37. **Plus dangereux ?** Expiration hôtel.
38. **Déjà suffisamment protégé ?** Rappels hébergements pour concurrence normale, hors crash après claim ; immobilier pour duplication normale.
39. **Principal overlap mono-instance ?** Facebook boot+heure ; hôtel devient le plus impactant si durée > 5 min.
40. **Jobs non bornés ?** Oui, six ont au moins une sélection non paginée/reset global.
41. **Jobs O(n²) ?** Aucun parmi les sept.
42. **Logs suffisants ?** Non, partiels.
43. **Metrics suffisantes ?** Non.
44. **Retry observable ?** Non ; tick naturel sans compteur/backoff.
45. **Crash recovery garantie ?** Non.
46. **Sémantique réelle ?** Mélange at-least-once non durable, at-most-once après certains claims et effectively-once par DB ; jamais exactly-once.
47. **Architecture maintenant ?** Scheduler unique + leases Mongo par job + claims/outbox P1.
48. **À 100× ?** Hybride BullMQ/Redis + workers dédiés + outbox/idempotence.
49. **Redis nécessaire immédiatement ?** Non.
50. **Queue nécessaire immédiatement ?** Non pour les sept si phase 1 disciplinée ; oui avant forte croissance des effets externes.
51. **Commencer avec Mongo lease ?** Oui, mais pas sans corriger les claims métier/crash windows.
52. **Jobs impérativement en queue à terme ?** IMAP/assets, emails critiques et transitions multi-effets ; Facebook peut rester lease.
53. **P0 ?** 0.
54. **P1 ?** 4.
55. **P2 ?** 3.
56. **P3 ?** 0.
57. **Blocker horizontalisation ?** Oui : scheduler non possédé et expiration hôtel non atomique.
58. **Score actuel ?** 48/100.
59. **Après phase 1 ?** 72–78/100 estimés, à certifier par tests.
60. **Code fonctionnel modifié ?** Non.
61. **Données modifiées ?** Non.
62. **Package installé ?** Non.
63. **Commit ?** Non.
64. **Push ?** Non.
65. **Deploy ?** Non.
66. **Rapport créé ?** Oui, le présent fichier uniquement pour ce mandat.
67. **Diff-check final ?** Vert ; aucun défaut d'espacement détecté.
68. **Verdict final ?** C — single-instance safe, multi-instance not yet safe.

## Matrice finale

| Job | Schedule | Idempotence | Lock | Effet externe | 2 instances | 10 instances | Sévérité |
|---|---|---|---|---|---|---|---|
| Facebook | Horaire + boot | B | Non | Graph read | Conditionnel | Non optimisé | P2 |
| IMAP | 5 min + boot | C | Local seulement | IMAP + assets | Unsafe | Unsafe | P1 |
| Hébergements | 15 min | B | Claim ressource | Push/webhook | Safe concurrence, crash conditionnel | Conditionnel volume | P2 |
| Pénalités/alertes | 06:00 | D | Non | Email + push | Unsafe | Unsafe | P1 |
| Visites | 5 min | D mixte | Claim rappel seulement | Push/webhook | Unsafe transitions | Unsafe | P1 |
| Hôtel expiry | 5 min | D | Non | Email/push | **Unsafe** | **Unsafe** | **P1** |
| Immobilier | 5 min | B | Claims ressources | Push/webhook | Safe duplication, crash conditionnel | Conditionnel volume | P2 |

## Verdict final

**Altitude Vision ne doit pas faire tourner les jobs activés sur 2, 3 ou 10 instances backend simultanément dans l'état courant.** Elle peut faire tourner plusieurs instances HTTP uniquement si les jobs sont désactivés sur toutes sauf une instance explicitement désignée, ce qui reste une mitigation opérationnelle et non une garantie de code.

Le minimum d'architecture distribuée requis avant horizontalisation automatisée est : ownership unique du scheduler, lease par job, claim atomique par ressource, récupération de crash et idempotency/outbox pour tout effet externe. Redis et BullMQ ne sont pas nécessaires pour la phase 1 ; ils deviennent la cible rationnelle lorsque le volume, les retries et les effets externes imposent une queue durable.

**DISTRIBUTED JOB READINESS SCORE : 48 / 100.**

**VERDICT C — SINGLE-INSTANCE SAFE, MULTI-INSTANCE NOT YET SAFE.**

Aucun code fonctionnel, donnée, package, cron, workflow, migration, commit, push ou déploiement n'a été modifié.
