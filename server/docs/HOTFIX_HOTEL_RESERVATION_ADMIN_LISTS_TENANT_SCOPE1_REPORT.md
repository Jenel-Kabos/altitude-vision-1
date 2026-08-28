# HOTFIX-HOTEL-RESERVATION-ADMIN-LISTS-TENANT-SCOPE-1 — Rapport final

## Verdict

**CERTIFIÉ VERT.** HZ-05 est fermé sur les deux endpoints, records et compteur compris. Le patch minimal ajoute le guard canonique aux deux routes et propage `req.platformTenant` aux requêtes Mongo et au compteur. Tous les gates obligatoires sont verts.

## Réponses obligatoires 1–110

1. HEAD : `a04055f62952c782b92aeef2f100824a17a5f645`.
2. Branche : `main`.
3. Worktree initial : fortement dirty, 55 fichiers versionnés (+361/-429) et des non suivis préexistants, préservés.
4. Architecture initiale PASS : OUI.
5. Compteurs : 471 fichiers, 1 530 edges, service→controller 2, controller→controller 1, route→model 12/11 routes, controller→model 192, cycles 0, unresolved 0, dangling 3, nouvelles violations 0.
6. Routes HZ-05 montées : OUI, sous `/api/hotel-reservations`.
7. Handler `/admin/list` : `hotelReservationController.listAdmin`.
8. Handler `/pending` : `hotelReservationController.pending`.
9. RBAC list : Admin, GestionnaireImmobilier, Collaborateur.
10. RBAC pending : identique.
11. Tenant resolver présent : OUI.
12. Où : `attachTenantContext`, router-wide après `auth.protect`; résultat dans `req.platformTenant`.
13. Tenant propagé avant fix : NON dans les queries des deux handlers.
14. Query list avant : `HotelReservation.find(query)` avec base `{}` puis hotel/status/reference.
15. Query pending avant : `HotelReservation.find({status:'pending'})`.
16. Count : `HotelReservation.countDocuments(query)`, global avant, tenant-scoped après.
17. Pagination : page 1/limit 20 par défaut, skip/limit ; préservée.
18. Populate : hotel `name manager`, roomCategory `name`; préservé.
19. Fuite statique confirmée : OUI.
20. Runtime rouge exécuté : OUI.
21. Tests rouges : 18 exécutés, 11 échecs.
22. Admin A voyait B : OUI avant fix.
23. Admin B voyait A : OUI avant fix.
24. Pending fuit : OUI avant fix.
25. Admin list fuit : OUI avant fix.
26. Counts fuient : OUI, total 5 au lieu de 2/3.
27. PII potentielles : prénom, nom, email, téléphone, pays et dates de séjour.
28. Montants exposés : OUI avant fix (prix/sous-total/total et champs financiers sérialisés).
29. Special requests exposées : OUI avant fix.
30. Query param tenant permet contournement : il n'était pas interprété, mais la réponse était déjà globale ; après fix il ne contrôle jamais le scope.
31. `hotelId` B permet contournement : OUI avant fix ; NON après (0 résultat/total 0).
32. Root cause : résolution tenant non bloquante + handlers ignorant `req.platformTenant` + queries/count globaux.
33. Primitive canonique : `requireTenantScopeForStaffAllowPlatformWide`.
34. Réutilisée : OUI.
35. Pourquoi : contrat exact staff fail-closed / PO global ou scoped.
36. Nouveau middleware créé : NON.
37. Pourquoi : sans objet.
38. Filtre tenant : dans la query de chaque handler, dérivé de `req.platformTenant`.
39. Niveau Mongo : OUI.
40. Admin A uniquement A après fix : OUI, 2 records/total 2.
41. Admin B uniquement B : OUI, 3 records/total 3.
42. Staff sans tenant : les trois rôles autorisés sont couverts.
43. 403 : OUI sur les deux endpoints.
44. PO global : couvert.
45. Global préservé : OUI, 5 records/total 5 et 3 pending.
46. PO scoped A : A seul, 2/1 pending.
47. PO scoped B : B seul, 3/2 pending.
48. Ownership concerné : NON sur ces routes.
49. Ownership préservé : OUI, RBAC inchangé.
50. Client concerné : refusé 403 avant/après.
51. Proprietaire concerné : refusé 403 avant/après.
52. RBAC modifié : NON.
53. Pourquoi : sans objet.
54. Capacités Admin retirées : NON.
55. Création Admin affectée : NON.
56. Modification Admin affectée : NON.
57. Suppression Admin affectée : NON.
58. Validation Admin affectée : NON.
59. Pending semantics modifiée : NON, toujours `status:'pending'`.
60. Status modifiés : NON.
61. Calculs de montant modifiés : NON.
62. Shape pagination modifiée : NON.
63. Sort modifié : NON (`-1` list, `+1` pending).
64. Response shape modifiée : NON.
65. Error contract modifié : uniquement le cas requis de staff autorisé sans tenant devient 403 fail-closed.
66. HZ-01 modifié : NON.
67. HZ-02 modifié : NON.
68. HZ-03 modifié : NON.
69. HZ-04 modifié : NON.
70. HZ-06 corrigé : NON.
71. HZ-07 corrigé : NON.
72. Nouveau finding : NON.
73. Tests HZ-05 : suite Mongo/Supertest adversariale, 18 cas.
74. Résultat : 18/18 verts après fix.
75. Cluster HZ-01→HZ-05 : cinq suites Mongo.
76. Résultat : 90/90 verts.
77. HotelReservation tests : huit suites pertinentes.
78. Résultat : 165/165 verts.
79. Backend complet : exécuté.
80. Résultat : 141 suites, 1 579/1 579 verts.
81. Mongo exhaustif : exécuté sur replica set contrôlé.
82. Résultat : 106 suites, 1 091/1 091 tests verts, exit 0.
83. Checker : exécuté.
84. Résultat : 7/7 vert.
85. Architecture finale : PASS ; 472 fichiers, 1 531 edges, dette connue inchangée (2/1/12/192), dangling 3.
86. Cycles : 0.
87. Unresolved : 0.
88. New violations : 0.
89. Lint : exit 0, 0 erreur, 108 warnings préexistants/hors patch.
90. Diff-check : exit 0 ; seulement les trois avertissements CRLF préexistants déjà relevés au baseline.
91. Frontend modifié : NON.
92. Mobile modifié : NON.
93. Schema modifié : NON.
94. Migration : NON.
95. Production DB utilisée : NON.
96. Production mutée : NON.
97. Commit : NON.
98. Push : NON.
99. Deploy : NON.
100. Root cause fermée : OUI dans les tests ciblés.
101. Cross-tenant list fermée : OUI.
102. Cross-tenant pending fermée : OUI.
103. Count leakage fermée : OUI.
104. PlatformOperator préservé : OUI.
105. RBAC préservé : OUI.
106. Admin métier préservé : OUI.
107. CERTIFIÉ VERT : OUI.
108. Prochaine priorité : réaudit comparatif HZ-07/HZ-06, sans correction dans ce sprint.
109. Ordre actuel : HZ-07 Property/modération avant HZ-06 Hotel lists ; aucune preuve HZ-05 ne change cet ordre.
110. STOP respecté : OUI, scope limité à HZ-05 ; arrêt après certification et rapport.

## Fichiers HZ-05

- production : `controllers/hotelReservationController.js`, `routes/hotelReservationRoutes.js` ;
- test : `__tests__/hotelReservationAdminListsTenantScope.mongo.integration.test.js` ;
- preuves : les dix documents `HOTFIX_HOTEL_RESERVATION_ADMIN_LISTS_TENANT_SCOPE1_*`.

Aucun commit, push ou déploiement.
