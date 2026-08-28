# HOTFIX-DASHBOARD-ANALYTICS-TENANT-SCOPE-1 — Rapport final

## Verdict

**CERTIFIÉ VERT.** La vulnérabilité runtime est confirmée et corrigée sur les quatre endpoints. Les tests ciblés, le backend complet, la campagne Mongo exhaustive, le lint, le checker d'architecture et `git diff --check` sont verts.

## Résultat synthétique

Avant correction, Admin Tenant A recevait 888 (A=111 + B=777) sur sales, rentals, accommodations et hotels. Après correction, le middleware tenant canonique est exécuté entre `protect` et le contrôleur ; Admin A reçoit seulement 111, Admin B seulement 777, un scope hostile ou absent échoue en 403, tandis que PlatformOperator global/scopé et l'ownership Proprietaire restent conformes. Aucun KPI, rôle, format API ou calcul n'a changé.

## Réponses obligatoires

1. **HEAD actuel ?** `a04055f62952c782b92aeef2f100824a17a5f645` au démarrage ; aucun commit créé.
2. **Branche ?** `main`.
3. **Worktree initial ?** Fortement dirty avec changements préexistants, conservés.
4. **Architecture baseline ?** 471 fichiers, 1527 edges, 2 service→controller, 1 controller→controller, 12 route→model dans 11 routes, 192 controller→model, 0 cycle, 0 unresolved, 3 dangling connus, 0 nouvelle violation.
5. **`/api/dashboard-analytics` réellement monté ?** Oui.
6. **Où ?** `server/server.js`, `app.use('/api/dashboard-analytics', dashboardAnalyticsRoutes)`.
7. **Combien d'endpoints vivants ?** Quatre.
8. **Lesquels ?** GET sales, rentals, accommodations, hotels.
9. **Middlewares parent ?** Middleware Express global standard ; aucun resolver tenant parent sur ce montage.
10. **Middlewares router ?** Avant : `auth.protect`. Après : `auth.protect`, `requireTenantScopeForAnalytics`.
11. **Middlewares endpoint ?** Aucun ; rôle contrôlé dans `getModuleAnalytics`.
12. **Authentication présente ?** Oui, inchangée.
13. **RBAC présent ?** Oui, dans le contrôleur, inchangé.
14. **Quels rôles ?** sales/rentals : Admin, GestionnaireImmobilier, Collaborateur ; accommodations/hotels : les mêmes + Proprietaire.
15. **Admin autorisé ?** Oui.
16. **PlatformOperator autorisé ?** Oui lorsqu'il est reconnu par le resolver opérateur et possède par ailleurs l'acteur/rôle admis par le contrat existant.
17. **Où `req.user.platformTenant` est défini ?** Dans `resolveAndAttachTenantScope`, `server/middleware/tenantContext.js`.
18. **Source ?** `tenantContextService`, membership/tenant/operator lus et validés côté serveur.
19. **Garanti ?** Après fix pour le staff tenant-scopé ; non dans les modes PlatformOperator global et Proprietaire self-service.
20. **Autoritatif ?** Oui uniquement après enrichissement par le resolver canonique.
21. **Peut-il être absent ?** Oui dans les deux modes légitimes ci-dessus et avant fix pour toute requête.
22. **Le router résout-il un tenant ?** Oui après fix.
23. **Si non, pourquoi ?** Avant fix, il montait seulement `protect`, qui recharge le User mais ne résout pas le tenant.
24. **Middleware canonique existant ?** Oui, factory `createRequireTenantScope` et `resolveAndAttachTenantScope`.
25. **Lequel ?** Une exportation policy-specific `requireTenantScopeForAnalytics` de cette factory.
26. **Utilisé ailleurs ?** La factory et ses variantes le sont largement ; cette nouvelle policy est réservée au routeur analytics.
27. **Réutilisable ici ?** Oui, et réutilisé.
28. **Endpoints utilisant `platformTenant` ?** accommodations et hotels directement ; sales/rentals utilisent le scope utilisateurs dérivé.
29. **Directement ou transitivement ?** Les deux, selon l'endpoint.
30. **Models interrogés ?** Property, Transaction, Visite, RentalManagement, Contrat, Paiement, RentalMaintenanceTicket, Accommodation, AccommodationReservation, AccommodationNightLock, Hotel, Room, HotelReservation, HousekeepingTask, MaintenanceTicket, FinancialDocument, PaymentAllocation, FinancialRefund.
31. **Models avec tenant direct ?** Accommodation et Hotel dans les racines concernées ; les modèles financiers portent aussi leur attribution/établissement selon leur contrat.
32. **Models scopés indirectement ?** Tous les descendants via owner/property/contract/accommodation/hotel/establishment IDs, détaillés dans MODEL_MATRIX.
33. **Endpoints financiers ?** Les quatre.
34. **Sensibilité ?** sales HIGH, rentals CRITICAL, accommodations CRITICAL, hotels CRITICAL.
35. **`$lookup` ?** Oui.
36. **Lesquels ?** Accommodation→collection properties.
37. **Risque cross-tenant lookup ?** Maîtrisé : `$match` de la racine Accommodation est tenant-scopé avant lookup.
38. **Populate ?** Oui : Hotel→Property et Transaction récente→Property.
39. **Risque ?** Maîtrisé : les IDs racines sont bornés avant populate.
40. **Admin A voyait B avant ?** Oui.
41. **Preuve runtime ?** Test Mongo réel via route Express et JWT : quatre résultats 888 au lieu de 111.
42. **Sentinelles ?** Tenant A=111, Tenant B=777.
43. **Quels endpoints fuyaient ?** sales, rentals, accommodations, hotels.
44. **Tous ou certains ?** Tous les endpoints vivants.
45. **Fuite financière reproduite ?** Oui : salesAmount, rentCollected, grossAmountCollected.
46. **Sinon théorique ?** Sans objet, elle est reproduite.
47. **Admin A attendu ?** A seulement.
48. **Admin B ?** B seulement.
49. **PlatformOperator global ?** A+B légitime, préservé.
50. **PlatformOperator scoped ?** Tenant sélectionné seulement.
51. **Utilisateur sans tenant ?** Staff : 403 ; Proprietaire self-service : contrat ownership historique.
52. **Tenant invalide ?** 403 via resolver canonique.
53. **tenantId cross-tenant explicite ?** 403, testé avec Admin A demandant B.
54. **Fail-closed avant ?** Non, Admin sans tenant obtenait 200.
55. **Fail-closed attendu ?** Oui pour staff.
56. **Test rouge créé ?** Oui.
57. **Combien de rouges ?** 9 échecs sur la première exécution avant fix.
58. **Vrai code ?** Oui : vrai routeur, auth JWT, middlewares, contrôleur, services, modèles et Mongo replica set.
59. **Correction minimale ?** Resolver canonique au router + transmission du scope dérivé à sales/rentals.
60. **Pourquoi ?** C'est le point commun le plus étroit avant tous les handlers et les helpers supportaient déjà ce scope.
61. **Middleware existant réutilisé ?** Oui, factory et résolution canoniques.
62. **Nouveau middleware créé ?** Une nouvelle variante/export de policy, sans nouveau mécanisme de résolution.
63. **Pourquoi nécessaire ?** Aucune variante ne combinait staff obligatoire, PlatformOperator global autorisé et Proprietaire self-service non bloqué.
64. **Tenant avant controller ?** Oui.
65. **Helpers utilisent le tenant ?** Oui : tenantId/acteur enrichi/scopeUserIds.
66. **Query modifiée ?** Seulement le dispatch sales/rentals transmet le paramètre déjà supporté ; pipelines inchangés.
67. **Pourquoi ?** Sans ce paramètre, ces services interprètent `null` comme vue globale légitime PlatformOperator.
68. **KPI modifiés ?** NON.
69. **Formules ?** NON.
70. **Statuses ?** NON.
71. **Dates ?** NON.
72. **Owner scope ?** NON.
73. **IAM ?** NON.
74. **Admin globalisé ?** NON.
75. **PlatformOperator global cassé ?** NON.
76. **PlatformOperator scoped testé ?** Oui, A et B.
77. **Admin A/B testés ?** Oui.
78. **Cross-tenant tests ?** Oui.
79. **Finance cross-tenant tests ?** Oui.
80. **Anonymous ?** 401 testé.
81. **Unauthorized role ?** Client 403 testé.
82. **Missing tenant ?** Admin 403 testé.
83. **Invalid tenant ?** Tenant B inaccessible et tenant suspendu, 403 testés.
84. **Mongo ciblé ?** 14/14 vert.
85. **Mongo exhaustif ?** 101 suites, 1001/1001 vertes en 1166.051 s.
86. **Backend complet ?** 141 suites, 1566/1566 vert avec heap 8 GiB.
87. **Checker tests ?** 7/7 verts dans la campagne ciblée.
88. **architecture:check ?** PASS final, 471 fichiers et 1528 edges.
89. **service→controller final ?** 2, dette connue inchangée.
90. **controller→controller final ?** 1, dette connue inchangée.
91. **route→model final ?** 12 edges dans 11 routes, dette connue inchangée.
92. **cycles ?** 0.
93. **stale ?** Aucun stale/new violation signalé par le checker.
94. **unresolved imports ?** 0 ; 3 dangling internes restent la métrique progressive connue.
95. **new violations ?** 0.
96. **lint ?** 0 erreur, 108 warnings préexistants.
97. **git diff --check ?** Vert ; seulement les 3 warnings CRLF préexistants démontrés.
98. **Frontend modifié ?** NON.
99. **Mobile modifié ?** NON.
100. **DB production modifiée ?** NON.
101. **Provider appelé ?** NON.
102. **Commit ?** NON.
103. **Push ?** NON.
104. **Deploy ?** NON.
105. **Finding ARCH-2M confirmé runtime ?** Oui.
106. **Totalement ou partiellement ?** Totalement sur les quatre endpoints vivants.
107. **Cause racine ?** Absence de résolution tenant entre `protect` et les agrégateurs.
108. **Boundary de perte ?** Router-level, immédiatement après authentification.
109. **Correctif centralisé ?** Oui au routeur et dans la factory tenant canonique.
110. **Autres routes même pattern ?** NON CONFIRMÉ : une ressemblance syntaxique ne prouve pas le même défaut métier.
111. **Modifiées ?** NON, hors scope.
112. **Audit horizontal séparé ?** Pas requis pour ce hotfix ; recommandé seulement si l'on veut certifier ces autres routes.
113. **Deux service→controller HIGH/CRITICAL intacts ?** Oui.
114. **`runPropertySearch` intact ?** Oui.
115. **Nouvelle règle métier ?** NON.
116. **Règle supprimée ?** NON.
117. **Contrat API légitime préservé ?** Oui.
118. **Isolation tenant prouvée ?** Oui par tests runtime adversariaux.
119. **Isolation financière prouvée ?** Oui avec sentinelles monétaires sur les quatre domaines.
120. **Verdict final ?** **CERTIFIÉ VERT.**

Aucun commit, push ou déploiement n'a été effectué.
