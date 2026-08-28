# HOTFIX-ACCOMMODATION-RESERVATION-LIST-TENANT-SCOPE-1 — Rapport final

## Verdict

**CERTIFIÉ VERT — HZ-03 P0 fermé.** Les quatre rôles staff sans tenant échouent désormais en 403 avant le handler. Admin A/B, PlatformOperator global/scoped, Proprietaire, Client, pagination, filtres, tri, populate et forme API sont préservés. La seule ligne de production ajoutée monte le middleware tenant canonique sur le GET de liste.

## Réponses obligatoires 1–25

1. HEAD : `a04055f62952c782b92aeef2f100824a17a5f645`. 2. Branche : `main`. 3. Worktree : fortement dirty, préservé sans stash/reset/clean. 4. Architecture baseline : PASS, 471 fichiers, 1 530 edges, métriques 2/1/12, cycles/unresolved/new violations à 0. 5. HZ-03 exact : GET list global si staff non affilié sans tenant. 6. Endpoints de liste LIVE : un. 7. `GET /api/accommodation-reservations`. 8. Handler : `accommodationReservationController.list`. 9. Rôles autorisés : tout authentifié, avec scopes staff/owner/guest historiques. 10. RBAC avant : auth seulement, branches staff, Proprietaire, guest. 11. RBAC après identique : oui. 12. Query exacte : base `{}`, filtres `accommodation/status`, puis `{tenant}` pour staff résolu, `{owner}` ou `{guest}`. 13. Tenant appliqué dans `query.tenant`. 14. Avant fix il était optionnel. 15. Oui, absence tenant conservait `{}`. 16. Oui, query globale. 17. Staff sans tenant reproduit pour Admin, Collaborateur, GestionnaireImmobilier, CommunityManager. 18. HTTP pré-fix 200. 19. Quatre réservations reçues. 20. Tenant A présent : oui, A1/A2. 21. Tenant B présent : oui, B1/B2. 22. P0 runtime confirmé : oui. 23. Test rouge archivé : oui, 4 failed/11 passed. 24. Fixtures A/B : deux réservations sentinelles par tenant. 25. Admin A ne voyait que A avant : oui avec tenant valide.

## Réponses obligatoires 26–55

26. Admin B seulement B : oui. 27. PO global : liste globale légitime, préservée. 28. PO scoped A : A seulement. 29. PO scoped B : B seulement. 30. Proprietaire concerné : oui. 31. Ownership préservé : oui, `owner=self`. 32. Client concerné : oui, `guest=self`. 33. Source canonique : résolution serveur `OrgMembership`/`PlatformTenant`. 34. Middleware : `requireTenantScopeForStaffAllowPlatformWide`. 35. Même primitive que HZ-01/HZ-02 : oui. 36. Parce qu'elle distingue déjà staff fail-closed, PO global et PO scoped sans modifier le self-service. 37. Cause racine : filtre tenant optionnel après `query={}`. 38. Fail-open confirmé : oui, HTTP 200 A+B. 39. Correction minimale : middleware sur la seule route GET. 40. Staff sans tenant après fix : refusé avant handler. 41. Oui, 403. 42. Aucun fallback global staff classique. 43. Admin A après : A seulement. 44. Admin B : B seulement. 45. PO global préservé : oui. 46. PO scoped préservé : oui A/B. 47. Pagination préservée. 48. Filtres status/accommodation préservés. 49. Sort `createdAt:-1` préservé. 50. Populate Accommodation/Property, guest, owner préservé. 51. Tenant valide sans data : 200 liste vide préservé. 52. API shape identique pour accès légitime. 53. Status same-tenant identique, 200. 54. Autre rôle authentifié inchangé : scope guest historique. 55. Anonymous inchangé : 401.

## Réponses obligatoires 56–77

56. Mutations Reservation modifiées : NON. 57. Calendar/Blocks modifiés : NON. 58. Finding RBAC availability-blocks modifié : NON. 59. Nouvelle permission : NON. 60. Permission supprimée : NON ; le droit de liste reste, seul un contexte tenant requis manque désormais aux staff scoped. 61. Nouveau rôle ajouté : NON. 62. Rôle retiré : NON. 63. Side effect découvert : NON. 64. Endpoint vraiment read-only : oui, snapshot complet Reservation avant/après identique et aucun save/update/provider. 65. Tests ciblés : oui. 66. 15 scénarios, 15 verts après fix. 67. Mongo ciblé : oui. 68. 15/15 HZ-03 ; Calendar isolé 15/15. 69. Mutation regression : verte dans le gate combiné et Mongo exhaustif. 70. Calendar regression : isolée 15/15 et exhaustive verte. 71. Backend complet : oui. 72. 141 suites. 73. 1 566 tests. 74. Mongo exhaustif : oui. 75. 104 suites. 76. 1 056 tests. 77. Tous verts : oui ; replica set arrêté.

## Réponses obligatoires 78–100

78. Checker : 7/7. 79. Architecture PASS. 80. service→controller : 2. 81. controller→controller : 1. 82. route→model : 12. 83. cycles : 0. 84. unresolved : 0. 85. new violations : 0. 86. Lint : exit 0, 0 erreur. 87. 108 warnings préexistants ; ciblé 0 warning. 88. Diff-check : exit 0, mêmes trois avertissements CRLF préexistants. 89. Frontend modifié : NON. 90. Mobile : NON. 91. Schéma : NON. 92. Migration : NON. 93. Production mutée : NON. 94. Commit : NON. 95. Push : NON. 96. Deploy : NON. 97. Fuite connue sur ce GET list : NON après les scénarios couverts ; les autres endpoints HZ restent des findings distincts. 98. Severity finale : P0 corrigé. 99. Prochain finding P0 : HZ-04, listes admin/pending Accommodation, à reproduire séparément. 100. Verdict final : CERTIFIÉ VERT.

## Classification du timeout intermédiaire

Le gate combiné HZ-01/HZ-02/HZ-03 a produit 54/55 tests avec un timeout de 180 s sur un scénario ownership Calendar, sans assertion fonctionnelle rouge. La même suite isolée a fait 15/15 en 22 s et le gate exhaustif officiel, qui inclut les trois suites, a fait 104/104 et 1 056/1 056. Classification : **FLAKE d'orchestration/ressources**, documenté et non masqué.

Aucun commit, push ou déploiement n'a été effectué.
