# ARCH-2L — État initial

- Branche : `main`.
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645`.
- Worktree : sale avant ARCH-2L ; changements antérieurs préservés.
- `git diff --check` initial : exit 0, avec trois avertissements CRLF préexistants (`conversationController.js`, `internalMailController.js`, `emailRoutes.js`).

| Mesure initiale | Valeur |
|---|---:|
| fichiers analysés | 470 |
| edges statiques | 1 526 |
| service→controller | 3 |
| controller→controller | 1 |
| route→model | 12 sur 11 routes |
| controller→model | 197 |
| cycles | 0 |
| stale baseline | 0 |
| imports non résolus | 0 |
| nouvelles violations | 0 |

`architecture:check` initial : **PASS**. Edge revalidée : `services/reporting/domains/locationReport.js → controllers/dashboardAnalyticsController.js`, import destructuré `rentals`.
