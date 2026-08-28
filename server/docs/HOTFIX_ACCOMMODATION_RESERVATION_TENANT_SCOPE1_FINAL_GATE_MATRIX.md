# Matrice finale des gates

| Gate | Result | Pass/Fail | Notes |
|---|---|---|---|
| Targeted tenant Mongo | 25/25 | PASS | Admin A/B × 5, staff no tenant, operator global/scoped, owner |
| Lifecycle/finance ciblé | 14/14 | PASS | run précédent du même état de code |
| Backend complet non-Mongo | 141 suites, 1566 tests | PASS | premier lancement sandbox EPERM ; run autorisé intégral vert |
| Mongo exhaustif | 101/102 suites ; 1023/1026 tests | FAIL | 3 échecs ARCH-2L sur fixture/index unique, hors hotfix |
| Rerun suite ARCH-2L | 1 suite, 6/6 | PASS | prouve une dépendance à l'ordre/état des index du runner global |
| Checker | 7/7 | PASS | `architectureBoundaries.test.js` |
| Architecture | PASS | PASS | 471 fichiers, 1529 edges, 2/1/12, cycles 0, unresolved 0, violations 0 |
| Lint backend | 0 erreur, 108 warnings | PASS | warnings existants ; aucun warning dans le test de certification |
| Diff-check | 3 warnings CRLF connus | PASS | conversation/internalMail/emailRoutes |

Le gate Mongo exhaustif est factuellement rouge. Il est classé **FLAKE/ORDER-DEPENDENT HORS SCOPE**, non imputable au hotfix, mais empêche le verdict strict `CERTIFIÉ VERT` demandé par les critères.

