# TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-1 — Rapport final

## 1. Résumé

Cet audit final horizontal, read-only, a reconstruit l'inventaire des routes depuis `server.js` (72 routeurs vivants, 5 fichiers morts jamais montés, 657 handlers HTTP déclarés), revérifié le cluster HZ-01→HZ-07 (137/137 verts), confirmé HZ-08 (P2/DEFERRED) et HZ-09 (P3/RECLASSIFIED) inchangés, puis cherché activement les surfaces jamais couvertes par la nomenclature HZ. Cette recherche a mis au jour **HF-FINAL-01**, un P0 confirmé en conditions réelles (HTTP + Mongo réels) : un membre du staff appartenant à deux tenants, sans sélection explicite, peut lire, supprimer et écrire dans les conversations partagées d'un tenant tiers via `/api/conversations/staff-inbox` et les routes de détail associées — la messagerie n'avait jamais fait partie du périmètre nommé HZ. Un second finding RBAC (déjà connu, confirmé toujours actif) a également été revérifié : `GET /accommodations/:id/availability-blocks` reste accessible sans ownership à tout utilisateur authentifié. **Verdict : B — la campagne reste ouverte.** Aucun correctif n'a été appliqué, conformément au mandat.

## 2. Réponses aux 112 questions du mandat

1. **HEAD initial ?** `a04055f62952c782b92aeef2f100824a17a5f645`.
2. **Branche ?** `main`.
3. **Worktree initial ?** Non propre — 548 lignes `git status --short`, cumul de sprints antérieurs non commités de cette même session.
4. **Combien de routers trouvés ?** 77 fichiers de routeur sur disque (75 dans `routes/`, 2 dans `routes/publicApi/`).
5. **Combien réellement montés ?** 72 (71 préfixes distincts, `/api/public/v1` portant 2 routeurs) + 3 mounts non-API (`/uploads` ×2, `/uploads/*` catch-all).
6. **Combien de routes finales ?** 657 handlers HTTP déclarés (`router.get/post/put/patch/delete`) à travers tous les fichiers de `routes/`.
7. **Combien publiques ?** Non dénombré exhaustivement route-par-route (657 routes) ; au niveau routeur, au moins `altimmoSearchRoutes`, `contactRoutes`, `webhookRoutes`, une partie de `authRoutes`/`publiciteRoutes`/`facebookPostsRoutes`, et `/api/public/v1` sont sans authentification classique — **NON CONFIRMÉ exhaustivement au niveau endpoint**.
8. **Combien authentifiées ?** La majorité des 72 routeurs appliquent `protect`/`auth.protect` au niveau routeur (voir `_ROUTE_INVENTORY.md`) — **NON CONFIRMÉ exhaustivement au niveau endpoint** (certaines routes publiques sont déclarées avant le `router.use(protect)` dans le même fichier, ex. `accommodationRoutes.js:/public/:id`).
9. **Combien staff ?** Au moins 25 routeurs appliquent `restrictTo(...STAFF/ROLES_ALTIMMO/DIRECTION/...)` au niveau routeur (voir `_ROUTE_INVENTORY.md`) — décompte exact au niveau endpoint **NON CONFIRMÉ**.
10. **Combien admin ?** Au moins 6 routeurs restreignent explicitement à `'Admin'` seul au niveau routeur (`actionLogRoutes`, `apiPlatformAdminRoutes`, `erpRoutes`, `exportRoutes`, `platformTenantRoutes`, `platformOperatorRoutes`).
11. **Combien owner/client ?** Plusieurs routeurs mixtes incluent `'Proprietaire'` explicitement (`salePropertyRoutes`, `rentalPropertyRoutes`) ; decompte exact endpoint par endpoint **NON CONFIRMÉ**.
12. **Combien PlatformOperator spécifiques ?** 2 routeurs dédiés (`platformOperatorRoutes`, `platformTenantRoutes`) + logique PlatformOperator intégrée dans `reportingRoutes`/`dashboardAnalyticsRoutes`/`tenantContext.js`.
13. **Combien dead routes ?** 5 fichiers de routeur entiers jamais montés (`adminPropertyRoutes.js`, `projectRoutes.js`, `projetsRoutes.js`, `realisationsRoutes.js`, `unreadCountService.js`) — non exploitables en runtime.
14. **Combien unknown ?** 12 domaines/routeurs explicitement listés comme non ré-audités à profondeur suffisante ce sprint (voir `_ROUTE_INVENTORY.md` §"non ré-audités").
15. **Tous les domaines critiques ont-ils été inventoriés ?** Oui au niveau routeur (72/72 mounts vivants recensés) ; non au niveau exhaustif de chaque endpoint (657 handlers), par choix assumé de profondeur (voir §14 mandat).
16. **HZ-01 toujours fermé ?** Oui, revérifié vert.
17. **HZ-02 ?** Oui, revérifié vert.
18. **HZ-03 ?** Oui, revérifié vert.
19. **HZ-04 ?** Oui, revérifié vert.
20. **HZ-05 ?** Oui, revérifié vert.
21. **HZ-06 ?** Oui, revérifié vert.
22. **HZ-07 ?** Oui, revérifié vert.
23. **Cluster HZ exact ?** 8 suites / 137 tests, 100% PASS.
24. **HZ-08 état actuel ?** Inchangé — P2/DEFERRED, 376 ressources historiques (67 déterministes, 309 à valider), aucune correction, non retouché.
25. **HZ-08 amplifié par une autre surface ?** Non — HF-FINAL-01 est un mécanisme distinct (contexte tenant ambigu pour un acteur vivant, pas une ressource historique orpheline). Aucune amplification trouvée.
26. **HZ-09 état actuel ?** Inchangé — P3/RECLASSIFIED, 15 appels directs à `resolveTenantForUser`, aucune nouvelle preuve de fuite.
27. **HZ-09 reste-t-il P3 ?** Oui, aucune preuve trouvée ce sprint qui justifierait une reclassification.
28. **Nouveau P0 trouvé ?** **Oui — HF-FINAL-01.**
29. **Nouveau P1 trouvé ?** HF-FINAL-01 pourrait alternativement être qualifié P1 selon l'échelle retenue ; classé P0 ici du fait de la suppression cross-tenant réellement réussie (action destructive, pas seulement une lecture).
30. **Nouveau P2 trouvé ?** RBAC-FINAL-01 (`availability-blocks`), classé P1/P2.
31. **Nouveau P3 trouvé ?** Aucun nouveau P3 au-delà de HZ-09 (inchangé).
32. **Findings INFO ?** Les 5 dead routes (nettoyage de dette, non exploitable).
33. **Admin A→B possible quelque part ?** Oui — via HF-FINAL-01 (Messaging), pour un staff à contexte tenant ambigu. Non trouvé ailleurs dans les surfaces auditées en profondeur (Dev Portal, Dashboard Analytics, HZ-01→HZ-07).
34. **Admin B→A possible ?** Symétrique, même mécanisme, même finding (pas directionnel — les deux tenants sont mutuellement exposés).
35. **Staff sans tenant → global quelque part ?** Oui — exactement HF-FINAL-01. Recherché ailleurs (`tenant ? {...} : {}` et équivalents), toutes les autres occurrences trouvées sont protégées en amont par une garde routeur fail-closed (voir `_QUERY_AUDIT.md`).
36. **PlatformOperator global préservé ?** Oui — Reporting exécutif et Dashboard Analytics conservent leur portée globale légitime et documentée, non retouchée, non trouvée détournée ailleurs.
37. **PlatformOperator scopé isolé ?** Oui — résolution par ID seul quand un tenant est explicitement sélectionné, comportement inchangé.
38. **Ownership cross-user incorrect trouvé ?** Oui — RBAC-FINAL-01 (`availability-blocks`, ownership non vérifié pour `listBlocks`).
39. **IDOR cross-tenant trouvé ?** Oui — `Conversation` (HF-FINAL-01) via accès direct par ObjectId (`GET/DELETE /:conversationId`).
40. **findById dangereux trouvé ?** `Conversation.findById` dans `assertConversationAccess` (chaîne d'appel), dans le contexte précis de HF-FINAL-01.
41. **findByIdAndUpdate dangereux ?** Aucun trouvé sur un modèle tenant-scopé au-delà de HZ-01→HZ-07 déjà certifiés.
42. **findByIdAndDelete dangereux ?** `Conversation.findOneAndDelete` dans `deleteConversation`, protégé en amont par `assertConversationAccess` — c'est cette protection en amont qui est défaillante (HF-FINAL-01), pas l'ordre des opérations.
43. **create cross-tenant relation possible ?** Non trouvé — aucune création tenant/owner pilotable par le client (voir `_RELATION_AUDIT.md`).
44. **update tenant injection possible ?** Non trouvé.
45. **owner injection possible ?** Non trouvé.
46. **assignedTo injection possible ?** Non recherché spécifiquement au-delà des domaines déjà couverts — **NON CONFIRMÉ** pour les domaines hors périmètre approfondi.
47. **pagination cross-tenant ?** Non trouvée sur les domaines HZ-01→HZ-07 (revérifiés) ni Dev Portal/Dashboard Analytics.
48. **countDocuments incohérent ?** Non trouvé (`find` et `countDocuments` cohérents sur toutes les surfaces vérifiées en détail).
49. **aggregate non scoped ?** Non trouvé sur `dashboardAnalyticsController.js::accommodations` (vérifié en détail) ; les autres fonctions d'agrégation du même fichier suivent structurellement le même schéma mais **NON CONFIRMÉ** ligne à ligne.
50. **report non scoped ?** Reporting exécutif : portée globale intentionnelle et documentée pour PlatformOperator, pas un bug.
51. **analytics non scoped ?** Non — garde routeur fail-closed confirmée.
52. **document/download IDOR ?** Non trouvé sur `messageController.js::downloadAttachment` (vérifié CLEAN). Autres endpoints de documents **NON CONFIRMÉS**.
53. **finance cross-tenant read ?** Non trouvé sur `assertFinancialScope` (fail-closed confirmé). Agrégations financières détaillées **NON CONFIRMÉES**.
54. **finance cross-tenant mutation ?** Non auditée en profondeur ce sprint au-delà de l'autorisation d'accès par hôtel — **NON CONFIRMÉ**.
55. **Hotel surface restante ?** HZ-06 couvre les listes admin ; les surfaces financières hôtelières (`hotelFinancialDashboardController.js`) protégées par la même `financialAuthorizationService` fail-closed.
56. **Accommodation surface restante ?** HZ-01→HZ-04 couvrent l'essentiel ; aucune nouvelle surface Accommodation non couverte identifiée.
57. **HotelReservation surface restante ?** HZ-05 couvre l'admin/pending ; non ré-audité au-delà.
58. **AccommodationReservation surface restante ?** HZ-01/HZ-03 couvrent mutations/liste ; non ré-audité au-delà.
59. **Property surface restante ?** HZ-07 couvre la modération ; `transactions`/`visits`/`recommendations` **NON CONFIRMÉS** ce sprint.
60. **Rental surface restante ?** Domaine confirmé **hors périmètre tenant-scope** (aucun champ `tenant` sur `Contrat`/`Paiement`/`Locataire`/`Litige`/`Proprietaire`).
61. **Messaging surface restante ?** **C'est la surface du nouveau finding P0** — traitée en détail, blast radius caractérisé (voir `_FINDING_MATRIX.md`).
62. **Document surface restante ?** `documentRoutes.js` a une garde `requireTenantScope` au niveau routeur (fail-closed) — non ré-audité en détail au-delà de cette confirmation structurelle.
63. **Notification surface restante ?** `protect` simple au niveau routeur, non ré-audité en détail.
64. **User/staff surface restante ?** `userRoutes.js` a un sous-arbre `restrictTo('Admin'), requireTenantScope` — non ré-audité en détail au-delà.
65. **Publicités surface tenant pertinente ?** `Publicite` n'a pas de champ tenant identifié — probablement hors périmètre tenant-scope, **NON CONFIRMÉ** avec certitude absolue faute de vérification du modèle dans ce sprint.
66. **Routes publiques correctement classifiées ?** Les routes publiques identifiées (recherche Altimmo, contact, hébergements/hôtels publiés) correspondent à des données volontairement publiques (marketplace) — cohérent avec le mandat §31, aucun filtre tenant à leur appliquer.
67. **Dead routes sensibles ?** Les 5 dead routes n'ont pas été examinées pour leur contenu (non exploitables, donc non prioritaires) — **NON CONFIRMÉ** si leur code contient lui-même des défauts, sans conséquence runtime actuelle.
68. **GET /availability-blocks RBAC actuel ?** **Toujours vulnérable** — confirmé par lecture directe du code à la date de cet audit (RBAC-FINAL-01).
69. **Finding RBAC séparé nécessaire ?** Oui — documenté comme RBAC-FINAL-01, distinct du tenant.
70. **Tests security existants suffisants ?** Non pour Messaging (aucun test `*TenantScope*` dédié) — c'est exactement le gap qui a permis à HF-FINAL-01 de rester non détecté. Suffisants pour HZ-01→HZ-07 (8 fichiers dédiés, 137 tests).
71. **Quels gaps de tests restent ?** Messaging (prioritaire), Finance (agrégations détaillées), Dev Portal (aucun test dédié malgré un code CLEAN — risque de régression future non détectée).
72. **Des tests temporaires ont-ils été utilisés ?** Oui — un fichier `__tests__/_tmp_staffInboxCrossTenant.mongo.integration.test.js`, utilisé pour reproduire HF-FINAL-01 en conditions réelles (HTTP + Mongo).
73. **Ont-ils tous été supprimés ?** Oui, supprimé avant la fin de cet audit (`rm __tests__/_tmp_staffInboxCrossTenant.mongo.integration.test.js`, confirmé absent par `git status`).
74. **Backend complet résultat exact ?** **141 suites / 1579 tests — PASS.**
75. **Mongo exhaustif résultat exact ?** **109 suites / 1127 tests — 100% PASS** (durée ≈23 min), identique au dernier nombre connu (109/1127), confirmé réel et non forcé.
76. **Cluster HZ résultat exact ?** **8 suites / 137 tests — PASS.**
77. **Checker résultat exact ?** PASS, identique avant/après (voir Q80-87).
78. **Architecture initiale ?** 472 fichiers, 1531 edges, 0 cycle, 0 unresolved, PASS.
79. **Architecture finale ?** Identique — 472 fichiers, 1531 edges, 0 cycle, 0 unresolved, PASS.
80. **Files ?** 472 (initial = final).
81. **Edges ?** 1531 (initial = final).
82. **route→model ?** 12 edges / 11 routes (dette légale connue, inchangée).
83. **service→controller ?** 2 (inchangé).
84. **controller→controller ?** 1 (inchangé).
85. **cycles ?** 0 (inchangé).
86. **unresolved ?** 0 (inchangé).
87. **new violations ?** 0 (inchangé).
88. **lint ?** 0 erreur, 108 warnings (identique à l'état connu, aucun nouveau).
89. **diff-check ?** 3 avertissements CRLF pré-existants, aucun nouveau.
90. **Warnings préexistants ?** Oui, tous les 108 warnings lint et les 3 avertissements CRLF sont pré-existants, non générés par cet audit.
91. **Code production modifié ?** **NON** — aucun fichier `.js` de `controllers/`, `services/`, `routes/`, `models/`, `middleware/` modifié.
92. **Tests métier persistants modifiés ?** **NON** — le seul fichier de test créé (`_tmp_staffInboxCrossTenant...`) a été supprimé avant la fin.
93. **Frontend modifié ?** **NON.**
94. **Mobile modifié ?** **NON.**
95. **Schema modifié ?** **NON.**
96. **Migration ?** **NON.**
97. **Production lue ?** Non — tous les tests (cluster HZ, backend complet, reproduction HF-FINAL-01) utilisent `MongoMemoryReplSet` éphémère, jamais la base de production.
98. **Production mutée ?** **NON.**
99. **Commit ?** **NON.**
100. **Push ?** **NON.**
101. **Deploy ?** **NON.**
102. **Seuls les docs FINAL_AUDIT ont-ils été créés ?** Oui — vérifié par `git status --short server/docs/` : uniquement des fichiers `TENANT_SCOPE_HORIZONTAL_FINAL_AUDIT1_*.md` nouveaux, plus le fichier de test temporaire déjà supprimé.
103. **Risques résiduels ?** Voir `_RESIDUAL_RISKS.md` — HF-FINAL-01 (ouvert), RBAC-FINAL-01 (ouvert), HZ-08 (différé), HZ-09 (reclassifié), domaines non ré-audités (UNKNOWN).
104. **HZ-08 reste-t-il différé ?** Oui, inchangé.
105. **HZ-09 reste-t-il reclassifié ?** Oui, inchangé.
106. **Un hotfix sécurité est-il nécessaire avant clôture ?** **Oui — `HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1` (HF-FINAL-01) est un prérequis à toute clôture.**
107. **Un audit RBAC séparé est-il nécessaire ?** Oui — pour RBAC-FINAL-01 et pour compléter la classification RBAC des domaines non ré-audités.
108. **La campagne tenant-scope peut-elle être clôturée ?** **Non, pas dans son état actuel.**
109. **Quel niveau de confiance ?** Élevé pour HF-FINAL-01 (CONFIRMED_RUNTIME, reproduit en HTTP+Mongo réels) ; élevé pour HZ-01→HZ-07/Dev-Portal/Dashboard-Analytics (CLEAN, revérifiés) ; modéré pour RBAC-FINAL-01 (confirmé par lecture de code, non reproduit en HTTP par choix de budget) ; faible/NON CONFIRMÉ pour les 12 domaines listés comme non ré-audités.
110. **Quelles limites de l'audit ?** Pas d'audit endpoint-par-endpoint exhaustif des 657 routes ; Finance limitée à `assertFinancialScope` ; RBAC-FINAL-01 non reproduit dynamiquement ; domaines rental classique confirmés hors périmètre tenant (pas audités pour RBAC/ownership au-delà de cette constatation).
111. **Prochaine étape exacte ?** `HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1` en priorité, puis sprint RBAC pour `availability-blocks`, puis nouvel audit de clôture avant tout `RELEASE-CONSOLIDATION-SECURITY-1`.
112. **Verdict final ?** **B. AUDIT FINAL — NEW P0/P1 IDENTIFIED — CAMPAIGN REMAINS OPEN.**

## 3. Fichiers créés

`server/docs/TENANT_SCOPE_HORIZONTAL_FINAL_AUDIT1_INITIAL_STATE.md`, `_ROUTE_INVENTORY.md`, `_SECURITY_BOUNDARY_MATRIX.md`, `_ROLE_MATRIX.md`, `_OBJECT_ID_AUDIT.md`, `_QUERY_AUDIT.md`, `_RELATION_AUDIT.md`, `_EXISTING_TEST_COVERAGE.md`, `_FINDING_MATRIX.md`, `_RESIDUAL_RISKS.md`, `_FINAL_MATRIX.md`, `_GATE_MATRIX.md`, `_DECISION.md`, `_REPORT.md` (ce fichier) — les 13 documents requis, plus `_DECISION.md`. Un fichier de test temporaire (`__tests__/_tmp_staffInboxCrossTenant.mongo.integration.test.js`) a été créé puis supprimé avant la fin, conformément au mandat.

**Aucune mutation de production. Aucun commit, push ou déploiement. Aucun correctif appliqué.**

## 4. STOP

Conformément au mandat, cet audit s'arrête ici. Aucun correctif n'a été entrepris, aucun autre sprint n'a été démarré.
