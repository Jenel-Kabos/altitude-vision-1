# HZ-07 — Matrice de non-régression

| Contrat | Preuve |
|---|---|
| Admin A/B isolés, totaux 2/3 | suite HZ-07 Mongo |
| pending/count isolés | suite HZ-07 Mongo |
| no-tenant fail-closed | Admin, GestionnaireImmobilier, Collaborateur couverts |
| PO global/scoped | global, scoped A et scoped B couverts |
| query-param attack | `tenant` et `owner` adversariaux |
| PII/private/amount | absence de données B dans réponse A |
| public/Client/Proprietaire | catalogue public inchangé |
| vente/location/Parcelle | fixtures et filtres explicites |
| filtres/pagination/sort/payload | assertions ciblées et suites Property |
| approve/reject | 404 cross-tenant, zéro effet de bord |
| Property ciblé | 20 suites, 289 tests verts |
| HZ-01→HZ-05 + HZ-07 | 6 suites, 107 tests verts |
| backend unitaire | 141 suites, 1 579 tests verts |

HZ-06 Hotel lists, HZ-08 et HZ-09 restent hors périmètre.
