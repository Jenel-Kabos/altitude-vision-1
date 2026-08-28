# HOTFIX-MONGO-ARCH2L-INDEX-ORDER-FLAKE-1 — Gates

| Gate | Before | After | Verdict |
|---|---:|---:|---|
| ARCH-2L isolated | 6/6, faux vert sans index | 6/6 avec index | PASS |
| conflicting order | 5/8 (ARCH-2L 3/6) | 8/8 | PASS |
| reverse order | non mesuré | 8/8 | PASS |
| Mongo exhaustive, premier run post-fix | 101/102 ; 1023/1026 | 102/102 ; 1026/1026 | PASS |
| backend complete | 141/141 ; 1566/1566 | 141/141 ; 1566/1566 | PASS |
| Accommodation tenant | 25/25 | 25/25 | PASS |
| lifecycle/finance | 14/14 | 14/14 | PASS |
| PlatformOperator global/scoped | inclus 25/25 | inclus 25/25 | PASS |
| checker | 7/7 | 7/7 | PASS |
| architecture | PASS 2/1/12 | PASS 2/1/12 | PASS |
| lint | 0 erreur, 108 warnings | 0 erreur, 108 warnings | PASS |
| diff-check | 3 CRLF connus | 3 CRLF identiques | ACCEPTABLE |

Un lancement backend intermédiaire en parallèle avec deux Replica Sets a atteint la limite mémoire V8 ; la relance canonique seule est verte et constitue le gate valide.
