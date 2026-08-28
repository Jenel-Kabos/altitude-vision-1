# HOTFIX-ACCOMMODATION-ADMIN-LISTS-TENANT-SCOPE-1 — Rapport final

## Verdict

**CERTIFIÉ VERT.** HZ-04 était vivant sur deux routes et est fermé par la primitive canonique plus un prédicat direct `Accommodation.tenant`. RBAC et contrats métier restent identiques.

## Réponses obligatoires 1–131

1. HEAD : `a04055f62952c782b92aeef2f100824a17a5f645`. 2. Branche : `main`. 3. Worktree initial : fortement dirty, préservé. 4. Diff initial : 53 fichiers, +349/-424. 5. Architecture baseline : PASS, métriques ci-dessous.
6. HZ-04 : admin/list et status/pending Accommodation cross-tenant. 7. Routes candidates : 6 routes collectionnelles ou assimilées auditées, dont 3 retournent une collection d'`Accommodation`. 8. LIVE : 6. 9. DEAD_ROUTE : 0. 10. LEGACY : 0. 11. Endpoints HZ-04 : `GET /api/accommodations/admin/list`, `GET /api/accommodations/status/pending`. 12. Handlers : `listAdmin`, `pending`. 13. Service : `listAccommodationsForAdmin` pour la première ; query contrôleur pour la seconde. 14. Modèle : `Accommodation`. 15. Tenant : champ `tenant`. 16. Direct : oui. 17. Indirect : non requis.
18. Rôles avant : Admin, GestionnaireImmobilier, Collaborateur. 19. Admin : autorisé. 20. Autres staff : les deux rôles précités. 21. Proprietaire : non. 22. Client : non. 23. PlatformOperator : via rôle Admin. 24. RBAC avant : documenté. 25. Admin A obtenait B : oui. 26. Admin B obtenait A : oui. 27. staff sans tenant obtenait A+B : oui. 28. PO global avant : global. 29. PO scoped A avant : global indu. 30. PO scoped B avant : global indu.
31. Test rouge : oui. 32. Vrai router : oui. 33. Mongo de test réel : oui. 34. Production : aucune. 35. Tests rouges : 9. 36. Fuite : contenu Accommodation A+B et total global. 37. Data A : oui. 38. Data B : oui. 39. Total pagination : oui, 4 au lieu de 2. 40. Count : total calculé sur tableau global ; pending sans count. 41. Populate : propriétés B exposées parce que B sélectionné. 42. Aggregation : non. 43. `$lookup` : non.
44. Cause : garde absent + queries sans tenant. 45. Middleware manquant : oui. 46. Tenant optionnel : implicitement absent. 47. Fallback `{}` : oui dans service admin. 48. Query globale : oui. 49. Autre cause : non. 50. Primitive canonique : oui. 51. Applicable : oui. 52. Réutilisée : oui. 53. Sinon : N/A. 54. Fix minimal : deux guards, propagation de tenant, deux prédicats. 55. Fichiers production : 3.
56. Admin A après : A only. 57. Admin B : B only. 58. staff no-tenant : 403. 59. PO global : préservé. 60. PO scoped A : A only. 61. PO scoped B : B only. 62. Proprietaire : 403 préservé. 63. Client : 403 préservé. 64. Rôle ajouté : non. 65. Rôle supprimé : non. 66. Permission ajoutée : non. 67. Permission supprimée : non. 68. Règle métier : non. 69. Critère pending : non modifié. 70. Publication : non. 71. Modération : non. 72. Statut : non.
73. Pagination : préservée. 74. Total : tenant-scoped. 75. Filtres : préservés. 76. Sort : préservé. 77. Populate : préservé. 78. API shape : préservée. 79. Tenant valide vide : 200 liste vide. 80. Missing tenant : 403 fail-closed. 81. Read-only : confirmé. 82. Side effect : zéro. 83. Accommodation modifiée : non. 84. Reservation : non. 85. Calendar : non. 86. Finance : non. 87. Notification : non. 88. Email : non.
89. HZ-01 : vert. 90. HZ-02 : vert. 91. HZ-03 : vert. 92. HZ-03 : 15/15 vert. 93. availability-blocks RBAC : laissé hors scope. 94. Tests HZ-04 ciblés : oui. 95. Nombre : 17. 96. Mongo ciblé : oui. 97. Nombre : 17/17. 98. Backend complet : oui. 99. Suites : 141. 100. Tests : 1566. 101. Tous verts : oui. 102. Mongo exhaustif : oui. 103. Suites : 105. 104. Tests : 1073. 105. Tous verts : oui. 106. Replica set arrêté : oui.
107. Checker : vert. 108. Architecture : PASS. 109. service→controller : 2. 110. controller→controller : 1. 111. route→model : 12/11 routes. 112. cycles : 0. 113. unresolved : 0. 114. nouvelles violations : 0. 115. lint : vert. 116. warnings : 108 préexistants. 117. diff-check : code 0, trois warnings CRLF préexistants. 118. frontend modifié : non. 119. mobile : non. 120. schéma : non. 121. migration : non. 122. production : non. 123. commit : non. 124. push : non. 125. deploy : non.
126. Fuite connue restante sur ces listes : non selon inventaire et tests. 127. Nouveau finding RBAC : non. 128. Nouveau finding tenant : non dans le périmètre HZ-04. 129. Sévérité finale : P0 corrigé. 130. Verdict : **CERTIFIÉ VERT**. 131. Prochain P0 : revalider HZ-05 de la matrice horizontale, sans l'exécuter dans ce mandat.

## Changement

- Routes : garde `requireTenantScopeForStaffAllowPlatformWide` sur les deux endpoints.
- Controller/service : `tenantId` dérivé exclusivement de `req.platformTenant`, ajouté aux queries si scopé ; absence conservée uniquement pour PO global autorisé.
- Tests : reproduction Mongo A/B et matrice sécurité complète ; attente unitaire sécurisée mise à jour.

Aucun commit, push ou déploiement.
