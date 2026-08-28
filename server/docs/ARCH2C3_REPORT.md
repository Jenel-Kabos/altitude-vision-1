# ARCH-2C3 — Rapport final

## Verdict

**CERTIFIÉ VERT.**

## Réponses aux 54 questions

1. Trois arêtes de controllers vers `userController`. 2. `expandScopeWithUnaffiliatedUsersIfSoleTenant`. 3. Il transforme une liste d'IDs users sans décider d'une ressource. 4. User list/owners/param, property portfolio, rental management et regularization. 5. Déduplication, garde mono-tenant, exclusion affiliations/operators/comptes inéligibles, ajout des non-affiliés. 6. Tableau d'IDs optionnel. 7. Tableau de chaînes. 8. Count tenant, deux distincts, find User filtré. 9. Extension seulement si exactement un tenant actif/trial. 10. Aucune ownership. 11. Operators exclus; sélection tenant gérée en amont. 12. Aucun rôle dans le helper. 13. Aucune capability. 14. Non. 15. Non. 16. Non. 17. Oui, les callers utilisent le même symbole et le même fallback. 18. Aucune implémentation différente fusionnée. 19. Non. 20. Non. 21. Non. 22. Non. 23. Non. 24. Non. 25. Oui, `unaffiliatedUserScopeService`. 26. Aucune abstraction équivalente existante n'était disponible. 27. Non. 28. Un tableau explicite suffisait déjà. 29. 8. 30. 5. 31. 6. 32. 6. 33. 17. 34. 17. 35. 0. 36. 0. 37. 0. 38. Oui, 4/4. 39. Oui, suites tenant ciblées. 40. Oui, suite PlatformOperator ciblée. 41. Oui, 133/133 suites et 1506/1506 tests. 42. Oui, 97/97 suites et 977/977 tests. 43. PASS. 44. 0 erreur, 106 warnings préexistants. 45. Vert. 46. Non. 47. Non. 48. Service/test/docs créés; cinq consommateurs et baseline modifiés. 49. Aucun. 50. Aucun. 51. Aucun. 52. 5 controller→controller, 6 service→controller, 17 route→model et 3 dangling restent. 53. ARCH-2C4 : auditer le cluster Property restant (5 arêtes controller→controller) et n'extraire qu'une façade prouvée commune. 54. CERTIFIÉ VERT.

## Gates

- Caractérisation service : 1 suite, 4 tests verts.
- Ciblés tenant/domaines/PlatformOperator : 7 suites, 53 tests verts.
- Backend unit complet : 133 suites, 1506 tests verts.
- Lint : 0 erreur, 106 warnings préexistants.
- Architecture : PASS; métriques dans `ARCH2C3_FINAL_BASELINE.md`.
- Mongo exhaustif : 97/97 suites, 977/977 tests verts (1211,559 s).
- `git diff --check` : vert.

Aucun commit, push ou déploiement. Aucun fichier frontend/mobile modifié. ARCH-2C4 n'a pas été exécuté.
