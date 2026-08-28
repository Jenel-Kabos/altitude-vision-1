# ARCH-2E — Matrice de testabilité

| Candidate | Tests existants pertinents | Manques avant refactor | Mongo / sécurité | Caractérisation |
|---|---|---|---|---|
| Reporting | `dashboardAnalyticsController`, `reporting.mongo`, organization/tenant reporting, finance/hotel dashboards | Parité de chacune des 4 query functions, erreurs 403 Hotel, snapshots KPI | Mongo exhaustif, tenant, HotelStaffAssignment, finance | Difficile/transversale |
| Route→Model | Nombreuses suites route/tenant adversarial ; peu de couverture directe `/dashboard/stats` | Pour le pilote : statut/payload exact, cinq compteurs, propagation 500 | Unitaires/API suffisent pour dashboard ; Mongo ciblé recommandé | Facile pour dashboard, difficile pour les 9 guards |
| Property globale | Environ 99 fichiers de tests mentionnent Property ; suites publication, visibilité, modération, tenant et mobile | Contrats unifiés par cas d'usage, absence de divergences Web/Mobile | Mongo, adversarial tenant/ownership, API web/mobile | Très difficile |
| `runPropertySearch` | `altimmoSearch.mongo`, `propertyApprovedVisibilityEndToEnd`, filtres Property | Public vs tous rôles STAFF_IMMO, aliases, tri/champs/pagination, mix hébergement, erreurs | Mongo ciblé obligatoire ; tests de non-exposition | Moyenne-difficile |

Le pilote dashboard doit commencer par des tests de caractérisation AVANT extraction. Aucun test n'est ajouté dans ARCH-2E.
