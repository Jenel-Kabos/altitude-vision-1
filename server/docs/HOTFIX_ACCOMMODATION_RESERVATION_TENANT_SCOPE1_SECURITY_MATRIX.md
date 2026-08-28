# Matrice sécurité

| Acteur | Sans tenant | Scoped A sur A | Scoped A sur B | Global |
|---|---|---|---|---|
| Staff | 403 | autorisé | 404 | interdit |
| PlatformOperator | autorisé | autorisé | 404 | autorisé |
| Proprietaire/Client | ownership | ownership | ownership | n/a |
| Anonyme | 401 | 401 | 401 | 401 |

