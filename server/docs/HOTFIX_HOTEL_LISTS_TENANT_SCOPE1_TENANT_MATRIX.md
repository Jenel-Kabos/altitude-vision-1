# HZ-06 — Matrice tenant avant/après

| Acteur | Avant | Après |
|---|---|---|
| Admin A | A+B sur les 3 GET | A uniquement |
| Admin B | A+B sur les 3 GET | B uniquement |
| Staff A autorisé | hôtels manager/assignment A | inchangé |
| Staff B autorisé | hôtels manager/assignment B | inchangé |
| Staff autorisé sans tenant | 200, liste accessible vide | 403 fail-closed |
| PlatformOperator global | global | global préservé |
| PlatformOperator scoped A | global | A uniquement |
| PlatformOperator scoped B | global | B uniquement |
| Proprietaire/Client | RBAC/ownership historique | inchangé |

Fixtures : deux hôtels A et deux hôtels B ; un `soumis` et un `publie` par tenant, propriétés ancrées, sentinelles 111/112 contre 777/778.
