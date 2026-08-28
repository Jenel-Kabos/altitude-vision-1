# HOTFIX-PROPERTY-MODERATION-TENANT-SCOPE-1 — Rapport final

## Verdict

**CERTIFIÉ VERT.** HZ-07 est fermé sur les routes LIVE auditées. Tous les gates ciblés, complets, Mongo, architecture et lint sont verts. Un timeout Reporting/ERP indépendant au premier passage Mongo a réussi isolément puis lors d’un second passage exhaustif entièrement vert.

## Correction

Trois routes de lecture LIVE ont reçu le guard canonique `requireTenantScopeForStaffAllowPlatformWide`. `req.platformTenant` est propagé jusqu’aux `find` et `countDocuments`; le paramètre HTTP `tenant` est neutralisé. Approve/reject, déjà sûrs via `assertPropertyTenantAccess`, n’ont pas été modifiés. Aucun workflow, RBAC, frontend, mobile, schéma ou migration n’a changé.

## Réponses obligatoires 1–117

1. HEAD ? `a04055f62952c782b92aeef2f100824a17a5f645`.
2. Branche ? `main`.
3. Worktree ? Sale avant sprint ; modifications utilisateur préservées, aucun nettoyage.
4. Architecture initiale ? PASS, 472 fichiers, 1 531 edges, métriques 2/1/12, 0 cycle/unresolved/new violation.
5. HZ-07 exact ? Fuite cross-tenant sur trois GET Property staff/admin.
6. Routes candidates ? Ensemble Property admin, pending, count, validate/reject, publication/recommandation inventorié.
7. Routes LIVE ? Toutes celles de la matrice endpoint ; surface HZ-07 = `GET /`, `/status/pending`, `/status/pending-count`.
8. Routes mortes ? Aucune route morte HZ-07 trouvée.
9. Endpoints exacts vulnérables ? Les trois GET précédents.
10. Admin list concernée ? Oui, branche staff de `GET /api/properties`.
11. Pending concerné ? Oui.
12. Approve concerné ? Non : déjà sûr.
13. Reject concerné ? Non : déjà sûr.
14. Publication concernée ? Non.
15. RBAC actuel ? Root optional/public avec branche STAFF_IMMO ; pending Admin ; count Admin/Collaborateur ; mutation Admin.
16. Admin ? Capacités identiques, ressources limitées au tenant.
17. autres staff ? GestionnaireImmobilier/Collaborateur sur root ; Collaborateur sur count selon contrat existant.
18. PlatformOperator ? Global si global, tenant sélectionné si scoped.
19. Proprietaire ? Catalogue public root seulement ; aucun accès modération ajouté.
20. Client ? Même contrat public ; aucun accès modération ajouté.
21. Tenant resolver présent ? Oui, middleware canonique.
22. Tenant réellement propagé ? Avant non ; après oui via `req.platformTenant`.
23. Query liste exacte ? `Property.find(baseFilter)` via APIFeatures, avec `baseFilter.tenant` pour staff scoped.
24. Query pending ? Filtre de modération classique + `tenant` si scoped.
25. Count query ? Même filtre via `countDocuments`, tenant inclus si scoped.
26. Mutation query approve ? `findById`, puis contrôle canonique de ressource avant mutation.
27. Mutation query reject ? Identique.
28. Property porte le tenant directement ? Oui, ObjectId `tenant` vers PlatformTenant.
29. Sinon relation ? Sans objet.
30. Admin A voit B avant fix ? Oui.
31. Admin B voit A ? Oui.
32. staff sans tenant voit global ? Oui avant ; 403 après.
33. PO global comportement ? Global, préservé.
34. PO scoped ? Global avant à tort ; A/B seulement après.
35. Test rouge exécuté ? Oui, Mongo/Supertest avant patch.
36. Combien d'échecs ? 13/17 après correction des seules attentes 404 historiques.
37. Liste fuit ? Oui avant.
38. Pending fuit ? Oui avant.
39. Count fuit ? Oui avant.
40. Approve cross-tenant possible ? Non, 404 déjà sûr.
41. Reject cross-tenant possible ? Non, 404 déjà sûr.
42. PII concernée ? Oui : populate owner `name email photo role phone` sur pending.
43. données financières concernées ? Prix/montants Property exposables ; aucune mutation financière.
44. notifications concernées ? Aucun effet sur GET ; mutation refusée produit zéro Notification.
45. Cause racine exacte ? Guard absent + tenant non propagé + queries/count globaux ; query HTTP `tenant` acceptée.
46. Primitive canonique disponible ? Oui, `requireTenantScopeForStaffAllowPlatformWide`.
47. Réutilisée ? Oui sur les trois GET LIVE.
48. Tenant appliqué au niveau Mongo ? Oui.
49. Count tenant-scoped après fix ? Oui.
50. Admin A = A only ? Oui, 2 records/total 2.
51. Admin B = B only ? Oui, 3 records/total 3.
52. staff no tenant = 403 ? Oui sur chaque surface RBAC-accessible testée.
53. PO global préservé ? Oui, 5 records, 2 pending/count dans fixtures.
54. PO scoped préservé ? Oui, A=2/B=3 et pending/count tenant.
55. RBAC inchangé ? Oui.
56. Capacités Admin inchangées ? Oui.
57. Workflow validation inchangé ? Oui.
58. Workflow publication inchangé ? Oui.
59. approved vs published inchangé ? Oui.
60. listingType inchangé ? Oui.
61. vente/location inchangés ? Oui.
62. Parcelle couverte ? Oui, fixture, filtre et suites Property.
63. owner scope intact ? Oui ; `?owner=B` ne contourne pas le tenant.
64. notifications publication intactes ? Oui, code inchangé et régressions vertes.
65. recommendation intacte ? Oui, code inchangé.
66. commissions intactes ? Oui, code inchangé.
67. transactions intactes ? Oui, code inchangé.
68. filters inchangés ? Oui, tenant serveur ajouté en intersection ; attaque tenant neutralisée.
69. pagination inchangée ? Oui, assertions record/total et pagination.
70. sort inchangé ? Oui ; pending reste `-createdAt`, liste conserve APIFeatures.
71. payload inchangé ? Oui.
72. 404/403 conforme ? Oui : no-tenant 403, ressource adverse 404.
73. zéro side effect cross-tenant ? Oui, Property et Notification comparées ; autres branches non touchées.
74. Tests HZ-07 ? 17.
75. Résultat ? 17/17 verts.
76. Tests Property ciblés ? 20 suites.
77. Résultat ? 289/289 verts.
78. Parcelle tests ? Oui, ciblés et suites Property verts.
79. HZ cluster ? HZ-01→HZ-05 + HZ-07, 6 suites.
80. Résultat ? 107/107 verts.
81. Backend complet ? Oui.
82. Suites ? 141.
83. Tests ? 1 579/1 579.
84. Mongo exhaustif ? Oui ; second passage entièrement vert après classification du timeout initial.
85. Suites ? 108/108 vertes.
86. Tests ? 1 111/1 111 verts.
87. Checker ? 7/7 vert.
88. Architecture PASS ? Oui.
89. service→controller ? 2.
90. controller→controller ? 1.
91. route→model ? 12 edges, 11 routes.
92. cycles ? 0.
93. unresolved ? 0.
94. new violations ? 0.
95. lint ? Vert, 0 erreur.
96. warnings ? 108, préexistants.
97. diff-check ? Vert ; seuls 3 warnings CRLF préexistants documentés.
98. frontend modifié ? NON.
99. mobile modifié ? NON.
100. schema modifié ? NON.
101. migration ? NON.
102. production utilisée ? NON.
103. commit ? NON.
104. push ? NON.
105. deploy ? NON.
106. HZ-01 intact ? Oui, cluster vert.
107. HZ-02 intact ? Oui.
108. HZ-03 intact ? Oui.
109. HZ-04 intact ? Oui.
110. HZ-05 intact ? Oui.
111. HZ-06 corrigé ? NON.
112. Nouveau finding ? Aucun nouveau finding dans le périmètre HZ-07.
113. HZ-07 entièrement fermé ? Oui, sur toute la surface LIVE démontrée.
114. Reste-t-il une modération Property cross-tenant connue ? Non sur les routes LIVE auditées.
115. Severity finale ? P0 initial, risque connu fermé ; résiduel HZ-07 faible sous les contrats testés.
116. Verdict final ? CERTIFIÉ VERT.
117. Prochaine priorité confirmée ? HZ-06 Hotel lists P0, sans l’exécuter ici.

## Git

Aucun commit, push, déploiement ou opération destructive n’a été effectué.
