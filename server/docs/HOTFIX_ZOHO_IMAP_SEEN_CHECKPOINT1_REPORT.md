# HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1 — Rapport final

## 1. Résumé

Le root cause certifié dans `ZOHO_INBOX_HEALTHCHECK1_ROOT_CAUSE.md` — perte silencieuse et définitive de tout message marqué `\Seen` par un acteur externe avant que le poller ne l'examine — est corrigé. `search({ seen: false })` est remplacé par un checkpoint UID/UIDVALIDITY persistant (`ImapSyncCheckpoint`), indépendant de tout état de lecture. Le flag `\Seen` reste posé après traitement mais devient purement cosmétique. La déduplication existante par `zohoMessageId` sert de filet de sécurité pour tout réexamen (bootstrap, reset UIDVALIDITY, retry après échec). 23/23 tests ciblés passent, 1579/1579 tests de la suite complète passent, architecture et lint sont verts. Aucune mutation de production (Zoho ou Mongo) n'a eu lieu à aucun moment de ce mandat. **Aucun commit/push/deploy n'a été effectué.**

## 2. Réponses aux 87 questions du mandat

1. **Quel était le mécanisme de sélection avant ce hotfix ?** `search({ seen: false })`, exclusivement.
2. **Pourquoi était-il dangereux ?** Le flag `\Seen` peut être modifié par n'importe quel client IMAP externe (webmail Zoho, autre app), pas seulement par notre poller — un message vu comme lu ailleurs devenait invisible pour toujours.
3. **Preuve du root cause ?** UID 113, `\Seen` en Zoho, absent de `InternalMail`, confirmé par connexion IMAP réelle et requête Mongo réelle (`ZOHO_INBOX_HEALTHCHECK1_ROOT_CAUSE.md`).
4. **Nouveau mécanisme ?** Checkpoint persistant `(account, mailbox) → (uidValidity, lastProcessedUid)`, recherche par plage d'UID.
5. **Où est-il stocké ?** Collection Mongo `ImapSyncCheckpoint` (nouveau modèle Mongoose).
6. **Une ligne par quoi ?** Par couple `(account, mailbox)`, index unique composite.
7. **`account` est-il un secret ?** Non — c'est `ZOHO_FROM_EMAIL`, une adresse email déjà publique (adresse de contact).
8. **`mailbox` actuel ?** `'INBOX'` exclusivement — le poller ne lit aucun autre dossier.
9. **Pourquoi `uidValidity` en `String` et pas `Number` ?** RFC 3501 ne garantit qu'un entier 32 bits non signé, potentiellement > `Number.MAX_SAFE_INTEGER` sur certains serveurs ; jamais utilisé arithmétiquement, donc `String` évite tout risque de perte de précision sans aucun coût.
10. **`lastProcessedUid` peut-il régresser ?** Non — la persistance en fin de cycle n'écrit que si un reset a eu lieu ou si une réelle avancée (`checkpointAdvanceUid > checkpointBaseUid`) a été constatée.
11. **UID est-il jamais traité comme global entre mailboxes ?** Non — la clé composite `(account, mailbox)` empêche toute confusion, et le poller n'opère aujourd'hui que sur `INBOX`.
12. **`resolveSyncOrigin` est-elle une fonction pure ?** Oui, sans effet de bord, testée indépendamment de toute connexion IMAP.
13. **Combien de branches ?** Trois : bootstrap, reset UIDVALIDITY, incrémental.
14. **Critère de recherche au bootstrap ?** `{ all: true }`.
15. **Critère au reset UIDVALIDITY ?** `{ all: true }`, identique au bootstrap.
16. **Critère nominal ?** `{ uid: '<lastProcessedUid+1>:*' }`.
17. **Syntaxe `SequenceString` validée comment ?** Test réel, en lecture seule, contre le serveur Zoho de production : `search({uid:'113:*'})` → `[113]`, `search({uid:'999999:*'})` → `[]`, aucune erreur.
18. **Pourquoi tester en direct plutôt que se fier à la doc TypeScript ?** Pour prouver le comportement réel du serveur Zoho, pas seulement la définition du client `imapflow` — une divergence entre les deux aurait invalidé toute la conception sans que les tests mockés ne puissent le détecter.
19. **Bootstrap = réexamen complet, est-ce arbitraire ?** Non — justifié par la taille réelle confirmée de la mailbox (113 messages, coût négligeable) et documenté explicitement dans `_BOOTSTRAP_STRATEGY.md`.
20. **Alternative "deviner un dernier UID" envisagée ?** Oui, explicitement rejetée — réintroduirait le même risque de perte silencieuse que ce hotfix corrige.
21. **Alternative "fenêtre de date récente" envisagée ?** Oui, explicitement rejetée — laisserait un angle mort sur les messages anciens déjà `\Seen`.
22. **Ce choix serait-il sûr sur une mailbox de 50 000 messages ?** Non garanti — limite explicitement documentée dans `_BOOTSTRAP_STRATEGY.md`, hors périmètre de ce mandat (mailbox réelle mesurée à 113).
23. **Changement d'UIDVALIDITY, option retenue ?** Option A — reset contrôlé, réexamen complet sous la nouvelle valeur.
24. **Options B et C envisagées et rejetées ?** Oui — voir `_UIDVALIDITY_MATRIX.md` (ignorer le changement = silent-skip-all interdit ; arrêter le polling = disproportionné).
25. **Changement d'UIDVALIDITY observé en production à ce jour ?** Non, `UIDVALIDITY` confirmée stable à `"1"` lors des deux audits. **NON CONFIRMÉ** en conditions réelles (comportement testé uniquement en mock).
26. **Le reset duplique-t-il les messages déjà importés ?** Non — même filet `zohoMessageId` que le bootstrap.
27. **Log émis lors d'un reset ?** Oui, `logger.warn('[IMAP] Réinitialisation du checkpoint de synchronisation', {reason, previousUidValidity, currentUidValidity})`.
28. **Le checkpoint avance-t-il seulement après succès ?** Oui, seulement pour les UID traités avec succès et de façon strictement contiguë depuis la base du cycle.
29. **Que se passe-t-il si un UID intermédiaire échoue ?** Le checkpoint se fige à la dernière valeur atteinte ; les UID suivants sont quand même traités (résilience pré-existante préservée) mais le checkpoint ne les dépasse pas.
30. **Ce comportement casse-t-il un test pré-existant ?** Non — le test "isole une erreur métier du premier email et importe le second" (résilience pré-existante) passe toujours sans modification.
31. **Un message en échec est-il perdu définitivement ?** Non — il sera réexaminé au cycle suivant (checkpoint non avancé au-delà).
32. **Un message en échec peut-il être dupliqué au prochain cycle s'il avait quand même été inséré avant l'échec ?** Non pertinent ici — l'échec est celui de l'insertion elle-même ou d'une étape antérieure ; s'il avait réussi, il ne serait pas classé en échec.
33. **Le batching (`FETCH_BATCH_SIZE=10`) est-il modifié ?** Non, inchangé.
34. **Le verrou anti-deadlock (fetch avant tout store) est-il modifié ?** Non, inchangé, testé (10/10 tests pré-existants toujours verts).
35. **`isPolling` est-il modifié ?** Non, inchangé, comportement de réentrance identique.
36. **Où le checkpoint est-il persisté dans le code ?** Dans le bloc `finally` de `pollZohoInbox`, indépendamment du succès ou de l'échec de la connexion IMAP.
37. **Pourquoi dans `finally` et pas dans le bloc `try` ?** Pour garantir que toute avancée réelle du checkpoint soit persistée même si une erreur réseau termine le cycle prématurément après un traitement partiel réussi.
38. **Condition d'écriture ?** `checkpointUidValidity !== null && (checkpointIsReset || checkpointAdvanceUid > checkpointBaseUid)`.
39. **Un cycle sans nouveau message écrit-il quelque chose ?** Non — testé explicitement ("aucun nouveau message : le checkpoint existant reste inchangé").
40. **Un bootstrap sur mailbox vide écrit-il un checkpoint ?** Oui — `lastProcessedUid: 0`, pour éviter un rescan complet infini à chaque cycle tant qu'aucun message n'arrive. Testé.
41. **Que se passe-t-il si la persistance du checkpoint échoue (Mongo indisponible) ?** `stats.errors++`, logué explicitement, le cycle se termine proprement (logout, libération du lock) — testé.
42. **Le cycle plante-t-il si le checkpoint ne peut pas être écrit ?** Non — l'échec de persistance du checkpoint ne bloque jamais la fin normale du cycle.
43. **Que se passe-t-il en cas de crash process avant la fin du `finally` ?** Le dernier checkpoint persisté avec succès reste la référence ; tout message traité mais non encore reflété au checkpoint sera réexaminé au redémarrage et filtré par déduplication. **NON CONFIRMÉ par test de crash réel** (non simulable de façon fiable en Jest), confirmé par raisonnement direct sur le code.
44. **Que se passe-t-il en cas de crash process après la persistance du checkpoint mais avant le logout IMAP ?** Sans effet sur l'intégrité des données — le logout est une opération de nettoyage de connexion, sans impact sur `InternalMail` ou `ImapSyncCheckpoint`.
45. **Gap d'UID (message supprimé côté serveur entre deux cycles) géré ?** Oui, testé — la recherche `UID > lastProcessedUid` retrouve normalement le prochain UID existant sans erreur.
46. **Redémarrage du service (restart) testé ?** Oui, via mock d'un document `ImapSyncCheckpoint` existant simulant un état post-redémarrage — le poller reprend correctement à `lastProcessedUid+1`.
47. **Concurrence entre deux pollers du même compte testée ?** Non testée en conditions réelles — `isPolling` reste un verrou en mémoire (mono-instance), pré-existant, non modifié, documenté comme hors périmètre dans `_IDEMPOTENCE_MATRIX.md`.
48. **Deux instances de process distinctes (au sens infra) sont-elles protégées contre le double traitement ?** Non garanti par ce hotfix — risque théorique pré-existant, non aggravé ni corrigé ici.
49. **Le flag `\Seen` est-il toujours posé ?** Oui, comportement inchangé, désormais purement cosmétique (signal de lecture pour un client IMAP externe).
50. **`\Seen` est-il encore lu comme critère de sélection quelque part ?** Non, nulle part dans le nouveau code.
51. **L'ordre fetch→parse→dédoublonnage→pièces jointes→destinataire→persist→mark-seen est-il modifié ?** Non, strictement inchangé.
52. **Le dédoublonnage `zohoMessageId` est-il modifié ?** Non, inchangé.
53. **La résolution destinataire (User puis fallback Admin) est-elle modifiée ?** Non, inchangée.
54. **Le rejet permanent (aucun destinataire résoluble) est-il modifié ?** Non, comportement identique (`markSeen:true, status:'permanent_rejection'`).
55. **Nouveaux tests couvrant le cas "message déjà `\Seen` mais ingéré quand même" ?** Oui — test "RÉGRESSION FERMÉE — un message déjà marqué `\Seen` (UID > checkpoint) est tout de même ingéré", reproduction directe du scénario UID 113 du healthcheck original.
56. **Ce test était-il rouge avant l'implémentation ?** Conceptuellement oui (c'est le scénario exact prouvé cassé par le healthcheck) ; il a été écrit après l'implémentation du fix, directement vert, la caractérisation du bug ayant déjà été établie avec un niveau de preuve suffisant lors de `ZOHO-INBOX-HEALTHCHECK-1` (connexion IMAP réelle) sans qu'il soit nécessaire de reproduire un test rouge contre l'ancien code pour ce mandat.
57. **Nombre total de nouveaux tests ajoutés ?** 13 (4 pour `resolveSyncOrigin`, 9 pour `pollZohoInbox`).
58. **Nombre de tests pré-existants toujours verts ?** 10/10, sans aucune modification de leur logique (seule une assertion de critère de recherche a changé, de façon attendue).
59. **Suite complète du backend verte ?** Oui, 141 suites / 1579 tests.
60. **`architecture:check` vert ?** Oui, 0 nouvelle violation.
61. **Lint vert ?** Oui, 0 erreur ; les 108 warnings sont tous pré-existants et étrangers à ce mandat (vérifié par grep ciblé).
62. **`git diff --check` propre sur les fichiers de ce mandat ?** Oui — les 3 avertissements CRLF concernent des fichiers non touchés par ce mandat.
63. **Une mutation Zoho a-t-elle eu lieu pendant les tests unitaires ?** Non — `imapflow` est entièrement mocké dans la suite Jest.
64. **Une mutation Zoho a-t-elle eu lieu à un autre moment de ce mandat ?** Oui, une seule : la validation en lecture seule de la syntaxe `SequenceString` contre le serveur réel (`search`), qui ne modifie aucun état de message (ni `\Seen`, ni suppression, ni déplacement).
65. **Une mutation Mongo de production a-t-elle eu lieu ?** Non — tous les modèles sont mockés dans les tests ; aucune commande d'écriture réelle n'a été exécutée contre la base de production à aucun moment de ce mandat.
66. **Des secrets ont-ils été loggés ?** Non — seul `account` (adresse email publique) apparaît dans les logs de checkpoint ; aucun mot de passe ni token.
67. **Le contenu des emails est-il loggé ?** Non, comportement hérité inchangé (seuls des métadonnées comme `uid`, `pollCycleId`, `step` sont loguées).
68. **Une vérification read-only post-implémentation de l'état réel de la mailbox a-t-elle été faite ?** Le mandat l'autorise explicitement (§68) ; elle n'a pas été jugée nécessaire au-delà de la vérification déjà faite lors du healthcheck et de la validation de syntaxe `search`, la correction reposant sur une logique déterministe déjà testée exhaustivement en mock plutôt que sur un nouvel état à observer.
69. **Le checkpoint a-t-il été avancé manuellement contre la production à un moment quelconque ?** Non, jamais.
70. **Un message Zoho a-t-il été modifié, déplacé ou supprimé pendant ce mandat ?** Non.
71. **Le code frontend (`client/`) a-t-il été modifié ?** Non.
72. **Le code mobile (`altimmo-app/`) a-t-il été modifié ?** Non.
73. **Un commit a-t-il été créé ?** Non.
74. **Un push a-t-il été effectué ?** Non.
75. **Un déploiement a-t-il été déclenché ?** Non.
76. **`git add`/`merge`/`rebase`/`reset --hard`/`clean` ont-ils été utilisés ?** Non, aucun.
77. **Le poller peut-il désormais perdre silencieusement un message déjà `\Seen` par un tiers ?** Non — c'est précisément le scénario corrigé et testé (§55).
78. **Le poller peut-il désormais dupliquer massivement des messages lors d'un reset ou d'un bootstrap ?** Non — protégé par la déduplication `zohoMessageId`, testé explicitement pour les deux cas.
79. **Le poller peut-il sauter silencieusement un message en échec métier ?** Non — le checkpoint ne dépasse jamais un UID en échec ; il sera réexaminé au cycle suivant.
80. **Les mécanismes de résilience et anti-deadlock pré-existants sont-ils préservés ?** Oui, prouvé par les 10 tests pré-existants toujours verts sans modification de leur logique.
81. **Le hotfix est-il rétro-compatible avec un déploiement sans downtime particulier ?** Oui — la collection `ImapSyncCheckpoint` est créée automatiquement au premier cycle, aucune migration de données préalable requise.
82. **Un rollback du code nécessite-t-il une action sur les données ?** Non — voir `_MIGRATION_MATRIX.md`, la collection resterait simplement inutilisée.
83. **Le message UID 113 du healthcheck original sera-t-il importé après déploiement ?** Oui, avec un haut niveau de confiance — le bootstrap déclenché au premier cycle post-déploiement le retrouvera via `{all:true}}` puisqu'il n'est pas dans `InternalMail`, indépendamment de son état `\Seen`. **Non revérifié par une nouvelle connexion IMAP réelle après déploiement dans ce mandat** (le déploiement lui-même n'a pas eu lieu, hors périmètre — voir §74/75) ; la preuve logique repose sur les tests mockés qui reproduisent exactement ce scénario.
84. **Toute la documentation requise a-t-elle été produite ?** Oui, les 10 fichiers requis (`_ETAT_INITIAL`, `_CURRENT_FLOW`, `_CHECKPOINT_DESIGN`, `_BOOTSTRAP_STRATEGY`, `_UIDVALIDITY_MATRIX`, `_IDEMPOTENCE_MATRIX`, `_FAILURE_MATRIX`, `_MIGRATION_MATRIX`, `_GATE_MATRIX`, `_REPORT` — ce fichier).
85. **Des éléments restent-ils marqués `NON CONFIRMÉ` ?** Oui, explicitement listés : comportement exact lors d'un crash process réel (§43), duplication éventuelle après crash entre persist et checkpoint (§65 de `_IDEMPOTENCE_MATRIX.md`), changement d'UIDVALIDITY jamais observé en conditions réelles (§25), confirmation post-déploiement réel du cas UID 113 (§83) — tous couverts par du raisonnement de code et/ou des tests mockés équivalents, mais non observés en conditions de production réelles dans le cadre de ce mandat.
86. **Le mandat autorisait-il de laisser de tels points `NON CONFIRMÉ` plutôt que de les résoudre à tout prix ?** Oui — le mandat exige explicitement d'étiqueter honnêtement toute affirmation non prouvée plutôt que de la présenter comme certaine.
87. **Verdict final ?** Voir §3.

## 3. Verdict

**CERTIFIÉ VERT.**

Toutes les portes obligatoires sont passées (tests, architecture, lint, diff-check), le root cause certifié est corrigé par une conception qui satisfait simultanément les quatre contraintes du mandat (zéro perte silencieuse, zéro duplication incontrôlée, préservation intégrale des mécanismes de résilience pré-existants, aucune modification frontend/mobile). Les points restant `NON CONFIRMÉ` (crash process réel, observation réelle d'un changement d'UIDVALIDITY, revérification post-déploiement) sont des scénarios non observables sans un déploiement réel en production — hors périmètre d'un mandat qui interdit explicitement toute mutation de production — et sont couverts par un raisonnement de code direct s'appuyant sur des chemins déjà testés.

## 4. Fichiers créés/modifiés

**Code** :
- `server/models/ImapSyncCheckpoint.js` (nouveau)
- `server/services/zohoImapService.js` (modifié)
- `server/__tests__/zohoImapService.test.js` (modifié, +13 tests)

**Documentation** (`server/docs/`, 10 fichiers, préfixe `HOTFIX_ZOHO_IMAP_SEEN_CHECKPOINT1_`) :
`_ETAT_INITIAL.md`, `_CURRENT_FLOW.md`, `_CHECKPOINT_DESIGN.md`, `_BOOTSTRAP_STRATEGY.md`, `_UIDVALIDITY_MATRIX.md`, `_IDEMPOTENCE_MATRIX.md`, `_FAILURE_MATRIX.md`, `_MIGRATION_MATRIX.md`, `_GATE_MATRIX.md`, `_REPORT.md` (ce fichier).

**Aucune mutation de production (Zoho ou Mongo). Aucun commit, push ou déploiement.**

## 5. STOP

Conformément au mandat, ce sprint s'arrête ici. **En attente de validation de l'utilisateur avant tout commit** (aucun commit/push/deploy n'a de toute façon été effectué).
