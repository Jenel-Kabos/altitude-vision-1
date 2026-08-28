# Matrice sécurité finale

| Acteur | Cible | Read | Create | Update | Delete |
|---|---|---|---|---|---|
| Admin A | A | autorisé | autorisé | N/A | autorisé |
| Admin A | B | 404 | 404 | N/A | 404 |
| Admin B | B | autorisé | autorisé | N/A | autorisé |
| Admin B | A | 404 | 404 | N/A | 404 |
| Staff autorisé sans tenant | A/B | 403 | 403 | N/A | 403 |
| PlatformOperator global | A/B | contrat global intact | intact | N/A | intact |
| PlatformOperator scoped A | A/B | autorisé/404 | autorisé/404 | N/A | autorisé/404 |
| PlatformOperator scoped B | B/A | autorisé/404 | autorisé/404 | N/A | autorisé/404 |
| Proprietaire | possédée/non possédée | contrat ownership intact | intact | N/A | intact |

La connaissance d'un ObjectId d'Accommodation ou de Block ne constitue plus une autorisation pour le staff tenant-scoped.
