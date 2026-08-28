# Matrice d'attaque

| Acteur | Scope demandé | Data A | Data B | Attendu / observé après fix |
|---|---|---:|---:|---|
| Admin A | implicite A | Oui | Non | 200, A seulement |
| Admin B | implicite B | Non | Oui | 200, B seulement |
| Admin A | header B hostile | Non | Non | 403 |
| Admin sans tenant | aucun | Non | Non | 403 fail-closed |
| Admin tenant suspendu | tenant suspendu | Non | Non | 403 |
| PlatformOperator | global | Oui | Oui | 200, A+B légitime |
| PlatformOperator | A | Oui | Non | 200, A seulement |
| PlatformOperator | B | Non | Oui | 200, B seulement |
| Proprietaire sans tenant | accommodation owned | Oui/owned | Non | 200, ownership conservé |
| Client | quelconque | Non | Non | 403 rôle |
| Anonyme | quelconque | Non | Non | 401 |

Les quatre endpoints et les montants financiers distinctifs 111/777 sont couverts. Un tenant étranger explicite et un tenant suspendu couvrent les sélections invalides ; aucun identifiant fourni par le client n'est utilisé sans résolution d'autorisation serveur.
