# HZ-07 — Matrice des effets de bord

| Scénario refusé cross-tenant | Property update | Publication | Notification | Transaction/finance | Owner | Recommendation |
|---|---:|---:|---:|---:|---:|---:|
| GET liste/pending/count | 0 | 0 | 0 | 0 | 0 | 0 |
| PATCH validate | 0 | 0 | 0 | 0 | 0 | 0 |
| PATCH reject | 0 | 0 | 0 | 0 | 0 | 0 |

Les lectures corrigées n’exécutent aucune mutation. Les tests adversariaux de validate/reject comparent l’état Property et le nombre de Notification avant/après : aucun changement. Les branches de notification, publication, transaction, commission, owner et recommandation ne sont pas modifiées.
