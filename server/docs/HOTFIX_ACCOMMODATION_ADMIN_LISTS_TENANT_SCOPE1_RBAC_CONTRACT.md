# HZ-04 — Contrat RBAC

| Endpoint | Role | Allowed before | Middleware/Guard | Expected after |
|---|---|---:|---|---:|
| les deux | Admin | oui | `restrictTo(...ROLES_ALTIMMO)` | oui |
| les deux | GestionnaireImmobilier | oui | idem | oui |
| les deux | Collaborateur | oui | idem | oui |
| les deux | Proprietaire | non | idem | non |
| les deux | Client | non | idem | non |
| les deux | anonymous | non | `protect` | non |
| les deux | PlatformOperator (compte Admin) | oui | RBAC Admin + primitive tenant | oui |

RBAC avant = RBAC après. Aucun rôle ni permission ajouté ou retiré. Proprietaire/Client : ownership non applicable car refusés avant le handler. Aucun finding RBAC nouveau ; le finding distinct `availability-blocks` reste hors scope.

