# HZ-04 — Matrice de non-régression

| Domaine | Suite | Résultat |
|---|---|---|
| HZ-01 mutations réservation | `accommodationReservationTenantScope...` | vert |
| HZ-02 calendar/blocks | `accommodationCalendarTenantScope...` | vert |
| HZ-03 liste réservations | `accommodationReservationListTenantScope...` | 15/15 vert |
| HZ-04 listes Accommodation | nouvelle suite | 17/17 vert |
| cluster HZ-01→04 | 4 suites | 72/72 vert |
| contrat unitaire Accommodation | `accommodationRoutes.test.js` | 86/86 vert |

Le premier full unit après changement a montré l'attente HZ-04 historique à aligner et un 401/403 hôtelier indépendant ; après alignement ciblé, le rerun complet est 1566/1566 vert, démontrant le caractère intermittent du second échec. Aucun code hôtelier n'a été modifié.

