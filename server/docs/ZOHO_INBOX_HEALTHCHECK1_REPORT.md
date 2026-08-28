ROOT CAUSE FOUND — B/D HYBRID RULED OUT, VERDICT: D (UID/CHECKPOINT ABSENCE) — NO CODE MODIFIED

## 1. Résumé

Le message de test existe bien dans la boîte Zoho (`INBOX`, UID 113, reçu 2026-08-26T03:50:21Z), mais il est **déjà marqué `\Seen`**. Le poller de production interroge exclusivement `search({ seen: false })` — il ne peut donc jamais voir ce message. Confirmé par recherche directe en base : **le message n'existe pas dans `InternalMail`**, et les deux causes alternatives possibles (doublon, échec de résolution du destinataire) ont été explicitement écartées par preuve. Les deux emails externes précédemment reçus (18 et 19 août) sont, eux, correctement stockés avec un `Message-ID` correspondant exactement à celui lu en direct dans Zoho — preuve positive que le pipeline complet (credentials, cron, parsing, persistance) fonctionne normalement. **Aucune modification de code n'a été effectuée** — cet audit est intégralement read-only, conformément au mandat.

## 2. Réponses aux 83 questions du mandat (§59)

1. **Quel service gère IMAP ?** `zohoImapService.js`.
2. **Quel fichier ?** `server/services/zohoImapService.js`.
3. **Quel cron/poller ?** `node-cron`, enregistré dans `server/server.js:91`.
4. **Fréquence ?** `*/5 * * * *` (toutes les 5 minutes), plus un déclenchement unique 10s après le démarrage/connexion Mongo.
5. **Est-il actif ?** En local, oui par défaut (`DISABLE_SCHEDULED_JOBS` absent). En production : **NON CONFIRMÉ directement** (pas d'accès Render), mais fortement probable — preuve indirecte via les imports réussis jusqu'au 19/08.
6. **Dernier run connu ?** NON CONFIRMÉ (pas de logs). Le dernier import réussi connu date du 2026-08-19T13:15:02Z.
7. **Dernier succès ?** Le message UID 112 (19/08), confirmé stocké en base.
8. **Dernière erreur ?** NON CONFIRMÉ (pas de logs de production accessibles).
9. **Host Zoho réel ?** `imap.zoho.com`.
10. **Port ?** `993`.
11. **TLS ?** Oui, `secure: true`, confirmé fonctionnel par connexion réelle.
12. **Auth réussit-elle ?** **Oui, confirmé par test de connexion réel effectué pendant cet audit.**
13. **Credential présent ?** Oui — `ZOHO_FROM_EMAIL`/`ZOHO_IMAP_PASSWORD`, tous deux non vides localement.
14. **App password ?** Probable (mot de passe simple, pas de flux OAuth référencé dans ce fichier).
15. **Secret exposé ?** Non — aucune valeur affichée dans aucun document ni log de cet audit.
16. **Mail test existe-t-il dans Zoho ?** **Oui**, confirmé (UID 113).
17. **Dans quel dossier ?** `INBOX` (le dossier exact interrogé par le poller).
18. **UID ?** 113.
19. **Message-ID ?** `<CAKXuA7CqTWmydp7Ktgc9uYrqHgf_xq7wZ9Hm0KrhaGW5qFDL+A@mail.gmail.com>`.
20. **Poller lit quel folder ?** `INBOX` exclusivement.
21. **Search criteria ?** `search({ seen: false })` — équivalent IMAP `SEARCH UNSEEN`.
22. **UNSEEN only ?** **Oui, confirmé.**
23. **UID checkpoint ?** Aucun — confirmé absent par recherche exhaustive du code.
24. **`lastUid` ?** N'existe pas dans le code.
25. **`UIDVALIDITY` géré ?** Non lu/comparé nulle part (`UIDVALIDITY` actuel : `1`, stable).
26. **Mail test est-il fetché ?** **Non** — jamais atteint `search({seen:false})` avec succès.
27. **Parsing réussit ?** Non applicable — jamais atteint.
28. **Fields extraits ?** Non applicable.
29. **Attachment parsing ?** Non applicable.
30. **Erreur parse ?** Non applicable, aucune trace possible (jamais atteint).
31. **Dédoublonnage ?** Vérifié — le message n'est pas un doublon (absent de la base).
32. **Message considéré duplicate ?** Non.
33. **Pourquoi ?** Non applicable (n'atteint jamais cette étape).
34. **Save Mongo tenté ?** **Non** — confirmé par absence totale en base.
35. **Save réussi ?** Non applicable.
36. **Validation error ?** Non applicable — jamais tenté.
37. **Duplicate key ?** Non applicable.
38. **Tenant issue ?** Non applicable — `InternalMail` n'a pas de tenant.
39. **Mail stocké en DB ?** **Non, confirmé.**
40. **Date stockée correcte ?** Non applicable.
41. **API le retourne ?** Non applicable — ne peut pas, n'existe pas en base.
42. **Quel endpoint ?** `GET /internal-mails/received` (contrat confirmé, non affecté).
43. **Pagination ?** Non pertinente ici, documentée pour référence (`_API_MATRIX.md`).
44. **Tri ?** `-createdAt`, non pertinent ici.
45. **Filters ?** Aucun filtre frontend suspecté ou nécessaire à auditer pour ce message.
46. **Auth API ?** Inchangée, non re-testée (non suspectée).
47. **Frontend appelle l'API ?** Oui, normalement, mais sans effet puisque le message n'existe pas en base.
48. **Response contient le mail ?** Non, ne peut pas.
49. **Frontend le masque ?** Non — il n'y a rien à masquer, le message n'a jamais été reçu par l'API.
50. **Cache impliqué ?** Non pour ce message précis.
51. **Refresh change quelque chose ?** Non — un rafraîchissement frontend ne peut pas faire apparaître un message qui n'a jamais été importé.
52. **Le pipeline marque Seen quand ?** Après persistance réussie (import), après confirmation de doublon, ou après rejet permanent pour absence de destinataire — jamais avant.
53. **Avant save ?** Non — l'ordre est fetch → parse → dédoublonnage → (upload pièces jointes) → résolution destinataire → **save** → puis, après tout le lot, mark-seen.
54. **Après save ?** Oui, confirmé par lecture du code (`pendingSeen`, traité après la boucle de traitement du lot entier).
55. **Risque de perte (pattern fetch→seen→save→échec) ?** **Non trouvé** — le code ne marque jamais `\Seen` avant un retour propre de `processFetchedMessage` ; une exception lève avant tout marquage, laissant le message `UNSEEN` pour le prochain cycle. Le risque de perte identifié dans ce rapport est d'une autre nature (marquage `\Seen` par un acteur EXTERNE à notre code, pas par notre propre logique).
56. **Lock IMAP bloqué ?** Non — `getMailboxLock`/`lock.release()` dans un bloc `finally`, `isPolling` remis à `false` dans le `finally` global. Confirmé sans changement, testé (`__tests__/zohoImapService.test.js`, "ignore un second cycle tant que le premier est actif", vert).
57. **Deadlock revenu ?** Non — le mécanisme fetch-terminé-avant-STORE (commenté explicitement dans le code comme prévention de deadlock ImapFlow) est intact et testé.
58. **Batch bloqué ?** Non — `search({seen:false})` renvoie 0 actuellement, aucune file d'attente, aucun message plus ancien en erreur bloquant le message de test.
59. **Poison message ?** Non trouvé — aucun message `UNSEEN` actuellement en attente (0 au total), donc aucun message ancien ne peut bloquer le mail de test derrière lui.
60. **Retry/backoff ?** Aucun mécanisme de retry explicite au-delà du prochain cycle cron naturel (5 minutes) — suffisant en temps normal, mais **inefficace pour ce cas précis** car le message ne redeviendra jamais `UNSEEN` de lui-même.
61. **Cause racine exacte ?** Voir `_ROOT_CAUSE.md` — message marqué `\Seen` avant que le poller ait pu l'interroger comme non lu, combiné à l'absence de tout checkpoint indépendant du flag `\Seen`.
62. **Première étape en échec ?** `search({ seen: false })` au niveau IMAP — le message n'y apparaît jamais.
63. **Zoho ?** Non en cause — le message est bien reçu et stocké côté Zoho.
64. **Auth ?** Non en cause — fonctionnelle, testée.
65. **Cron ?** Non en cause en tant que tel — fonctionne normalement (preuve : imports récents réussis), le problème n'est pas qu'il soit arrêté mais que le critère de recherche exclut ce message spécifique.
66. **Fetch ?** Non en cause — jamais atteint pour cette raison précise (le message n'entre pas dans le lot).
67. **Parser ?** Non en cause — jamais atteint.
68. **Mongo ?** Non en cause — jamais sollicité pour ce message.
69. **API ?** Non en cause.
70. **Frontend ?** Non en cause.
71. **Code doit-il être modifié ?** Recommandé pour l'avenir (`RECOMMENDED HOTFIX` dans `_ROOT_CAUSE.md`), **pas fait dans ce sprint** (mandat : STOP après preuve).
72. **Env doit-il être modifié ?** Non.
73. **Render doit-il être redémarré ?** Non nécessaire pour ce problème précis (le cron fonctionne, ce n'est pas un problème de process bloqué).
74. **Credential doit-il être régénéré ?** Non — authentification confirmée fonctionnelle.
75. **Rebuild nécessaire ?** Non (aucun code modifié).
76. **Frontend modifié ?** Non.
77. **Mobile modifié ?** Non.
78. **DB prod mutée ?** Non — toutes les requêtes Mongo de cet audit étaient en lecture seule (`.lean()`, `.findOne()`, `.countDocuments()`, jamais d'écriture).
79. **Messages Zoho modifiés ?** **Non** — aucune commande IMAP de mutation exécutée ; le message UID 113 reste exactement dans l'état où il a été trouvé (`\Seen`, non déplacé, non supprimé).
80. **Commit ?** Non.
81. **Push ?** Non.
82. **Deploy ?** Non.
83. **Verdict final ?** Voir §3.

## 3. Verdict

**D. UID/CHECKPOINT BUG** (absence structurelle de checkpoint indépendant du flag `\Seen`) — root cause du symptôme rapporté prouvée avec un haut niveau de confiance par preuve directe (connexion IMAP réelle + comparaison croisée Mongo/Zoho), sans avoir eu besoin ni pu obtenir les logs de production. Le pipeline lui-même (credentials, cron, parsing, persistance, API, frontend) est **sain** — prouvé par l'import réussi et vérifiable des deux emails externes précédents. Le message de test est resté piégé par un cas limite précis : il a été marqué `\Seen` (très probablement via une consultation dans l'interface Zoho elle-même, **NON CONFIRMÉ avec certitude absolue faute d'audit trail Zoho**) avant que le poller n'ait pu l'interroger comme non lu — et comme le système ne dispose d'aucun garde-fou indépendant de ce flag, ce message ne sera **jamais** récupéré automatiquement.

**Aucune correction n'a été appliquée**, conformément au mandat. Une piste de hotfix ciblée (`HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1`) est documentée dans `_ROOT_CAUSE.md` mais n'est pas démarrée.

## 4. Fichiers créés

**Documentation uniquement (10 fichiers dans `server/docs/`)** :
`ZOHO_INBOX_HEALTHCHECK1_ETAT_INITIAL.md`, `_FLOW.md`, `_ENV_MATRIX.md`, `_LOG_ANALYSIS.md`, `_IMAP_MATRIX.md`, `_STORAGE_MATRIX.md`, `_API_MATRIX.md`, `_FRONTEND_MATRIX.md`, `_ROOT_CAUSE.md`, `_REPORT.md` (ce fichier).

**Aucun fichier de code créé ou modifié. Aucune donnée Mongo mutée. Aucun message Zoho modifié, déplacé ou supprimé.**

## 5. STOP

Conformément au mandat, ce travail s'arrête à la preuve de la cause racine. Le `RECOMMENDED HOTFIX` documenté dans `_ROOT_CAUSE.md` n'est **pas démarré** — décision à la discrétion de l'utilisateur.

**En attente de validation de l'utilisateur avant tout commit** (aucun commit/push/deploy n'a de toute façon été effectué).
