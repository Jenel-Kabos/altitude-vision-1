# HOTFIX-MONGO-ARCH2L-INDEX-ORDER-FLAKE-1 — Non-régression

| Surface | Preuve | Résultat |
|---|---|---|
| Query ARCH-2L owner A | attentes KPI exactes | PASS |
| Multi-owner | agrégation inchangée | PASS |
| PlatformOperator global | agrégation globale inchangée | PASS |
| Empty/partial/error | trois tests inchangés | PASS |
| Accommodation tenant | Admin A/B, sans tenant, operator, owner | 25/25 |
| Accommodation lifecycle/finance | concurrence, locks, allocations, refunds | 14/14 |
| Backend non-Mongo | totalité | 1566/1566 |
| Backend Mongo/replica | totalité | 1026/1026 |
| Architecture | baseline inchangée | PASS |

Frontend : NON modifié. Mobile : NON modifié. Production/DB production : NON mutées. Code AccommodationReservation : NON modifié. Logique métier ARCH-2L : NON modifiée. Aucun skip, retry, assertion affaiblie, contrainte supprimée, commit, push ou déploiement.
