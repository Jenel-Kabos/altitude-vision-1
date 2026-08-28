# HOTFIX-ACCOMMODATION-CALENDAR-TENANT-SCOPE-1 — Rapport final

## Verdict

**CERTIFIÉ VERT — P0 tenant-scope fermé.** Le finding HZ-02 a été reproduit sur Mongo de test, corrigé à la frontière minimale et validé par tous les gates. Le contrat RBAC historique est inchangé.

## Correction

- Réutilisation de `requireTenantScopeForStaffAllowPlatformWide` sur les quatre routes authentifiées.
- Résolution du parent par `_id + tenant` pour le staff scoped ; 404 avant toute lecture ou mutation enfant.
- Réutilisation du parent autorisé dans le service de création.
- Aucun frontend, mobile, schéma, migration, règle métier, commit, push ou déploiement.

## Réponses obligatoires 1–32

1. HEAD : `a04055f62952c782b92aeef2f100824a17a5f645`. 2. Branche : `main`. 3. Worktree initial : fortement dirty, préservé. 4. Architecture baseline : PASS, 471 fichiers/1 529 edges, 2/1/12, cycles et unresolved 0. 5. Finding : HZ-02 calendar/blocks cross-tenant. 6. Routes : public availability plus GET blocks, GET calendar, POST block, DELETE block. 7. Oui, toutes montées. 8. Les cinq sont LIVE. 9. DEAD_ROUTE : aucune. 10. LEGACY : aucune. 11. Models : Accommodation, AccommodationReservation, AccommodationAvailabilityBlock, AccommodationNightLock. 12. Tenant porté par Accommodation. 13. Directement sur Block : non. 14. Sur Accommodation : oui. 15. Relation : enfants via `accommodation`. 16. Lecture calendrier : GET calendar ; GET blocks lit les blocages. 17. Création : POST blocks. 18. Modification : aucune route, N/A. 19. Suppression : DELETE block. 20. Accès avant : tout authentifié pour GET blocks ; quatre rôles staff ou propriétaire pour les trois autres routes authentifiées. 21–24. Admin : read/create/delete oui, update N/A. 25–28. Autres rôles : Collaborateur, GestionnaireImmobilier, CommunityManager et propriétaire read/create/delete selon guards ; tout authentifié pour listBlocks ; update N/A. 29. Oui, middleware/guards/ownership. 30. Oui, listBlocks semble trop large. 31. Oui, RBAC-FINDING-01 séparé. 32. Oui, permission laissée inchangée.

## Réponses obligatoires 33–69

33. Résolution tenant avant handler avant fix : non. 34. Après fix : middleware route canonique. 35. Staff sans tenant testé. 36. Oui, 403 fail-closed. 37. PlatformOperator global testé et intact. 38. PlatformOperator scoped testé A/B et filtré. 39. Proprietaire concerné : oui. 40. Ownership historique sur l'Accommodation conservé. 41. ObjectId seul permettait read avant, plus après. 42. Il permettait create cross-tenant, plus après. 43. Update : N/A. 44. Il permettait delete cross-tenant, plus après. 45–48. Admin A pouvait lire/créer/supprimer B avant ; update N/A. 49. Oui, reproduction runtime rouge. 50. GET blocks, GET calendar, POST, DELETE, missing tenant et PlatformOperator scoped. 51. Oui, aucune production. 52. Cause : parent non scopé. 53. Middleware tenant manquant : oui. 54. Query non scopée : oui. 55. Parent Accommodation non scopé : oui. 56. Autre : seconde lookup service évitée après fix. 57. Correction : middleware + query parent tenant-scoped + parent autorisé transmis. 58. Oui, middleware canonique réutilisé. 59. Non, aucune nouvelle implémentation tenant. 60. N/A. 61. RBAC modifié : non. 62. Rôle ajouté : non. 63. Rôle supprimé : non. 64. Admin same-tenant intact. 65. Autres actions légitimes intactes. 66. Read cross-tenant fermé. 67. Create fermé. 68. Update N/A, aucune voie vivante. 69. Delete fermé.

## Réponses obligatoires 70–102

70–72. Cross-tenant retourne 404 `NOT_FOUND`, conforme au contrat canonique de ressource masquée. 73. Zéro block créé. 74. Zéro block modifié (N/A route, snapshots inchangés). 75. Zéro block supprimé. 76. Zéro disponibilité/night lock modifié. 77. Zéro réservation modifiée. 78. Zéro finance. 79. Zéro notification. 80. Zéro email. 81. Zéro webhook. 82. PlatformOperator global intact. 83. Scoped A intact dans A et refusé dans B. 84. Scoped B intact dans B et refusé dans A. 85. Staff sans tenant = 403. 86. Ownership intact. 87. Tests de caractérisation avant : oui. 88. 4 cas verts pré-fix dans la nouvelle suite. 89. Tests adversariaux : oui. 90. 11 attentes de sécurité rouges pré-fix puis vertes. 91. Mongo ciblé : oui. 92. 15/15 hotfix ; 54/54 combinés. 93. Tests Accommodation existants rejoués. 94. 3 suites/54 tests verts. 95. Backend complet : oui. 96. 141 suites. 97. 1 566 tests. 98. Tous verts. 99. Mongo exhaustif : oui. 100. 103 suites. 101. 1 041 tests. 102. Tous verts.

## Réponses obligatoires 103–127

103. Checker : 7/7. 104. Architecture PASS. 105. service→controller : 2. 106. controller→controller : 1. 107. route→model : 12. 108. cycles : 0. 109. unresolved : 0. 110. new violations : 0. 111. Lint : exit 0, 0 erreur. 112. 108 warnings préexistants. 113. Diff-check initial vert ; final reporté dans la matrice de livraison, mêmes trois warnings CRLF préexistants. 114. Frontend modifié : non. 115. Mobile : non. 116. Schéma : non. 117. Migration : non. 118. Production mutée : non. 119. Nouvelle règle métier : non. 120. Permissions élargies : non. 121. Permissions supprimées opportunistement : non. 122. Finding RBAC hors scope : oui. 123. Un. 124. Voie cross-tenant connue sur les quatre routes corrigées : non ; le risque RBAC listBlocks est distinct et documenté. 125. Sévérité finale : P0 corrigé ; finding RBAC résiduel à caractériser séparément. 126. Verdict : CERTIFIÉ VERT. 127. Prochain P0 : `HZ-03`, liste AccommodationReservation staff sans tenant/fallback global, à revalider dans un sprint distinct.

Les détails vérifiables figurent dans les dix matrices sœurs de ce rapport. Toute affirmation non couverte par code ou test aurait été notée NON CONFIRMÉ ; aucune n'est nécessaire au verdict.
