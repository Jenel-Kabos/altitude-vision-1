# HZ-05 — Matrice de sécurité

| Actor | Tenant Context | Resource Tenant | /admin/list | /pending | Expected |
|---|---|---|---|---|---|
| Admin A | A | A | visible | visible si pending | autorisé |
| Admin A | A | B | absent | absent | isolé |
| Admin B | B | A | absent | absent | isolé |
| Admin B | B | B | visible | visible si pending | autorisé |
| Staff autorisé | aucun | A/B | 403 | 403 | fail-closed |
| PlatformOperator | global | A+B | global | global | contrat conservé |
| PlatformOperator | scoped A | A/B | A seul | A seul | isolé A |
| PlatformOperator | scoped B | A/B | B seul | B seul | isolé B |

Les assertions couvrent identifiants, compteurs, PII synthétiques, montants sentinelles et demandes spéciales. `?tenant=B` est ignoré comme source de sécurité et `?hotelId=<hotelB>` sous Admin A retourne une liste vide et `total:0`.
