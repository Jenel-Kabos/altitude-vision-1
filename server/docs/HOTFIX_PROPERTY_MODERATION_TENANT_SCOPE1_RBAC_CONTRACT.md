# HZ-07 — Contrat RBAC

| Endpoint | Role | Before | Source | After expected |
|---|---|---|---|---|
| GET `/` | anonyme, Client, Proprietaire | catalogue public | optionalAuth + branche controller | identique |
| GET `/` | Admin, GestionnaireImmobilier, Collaborateur | liste staff | `STAFF_IMMO` | identique, tenant-scoped |
| GET `/status/pending` | Admin | autorisé | `restrictTo('Admin')` | identique, tenant-scoped |
| GET `/status/pending-count` | Admin, Collaborateur | autorisé | `restrictTo('Admin','Collaborateur')` | identique, tenant-scoped |
| PATCH `/admin/:id/:action` | Admin | autorisé | `restrictTo('Admin')` | identique ; contrôle ressource déjà sûr |
| routes de modération | Client, Proprietaire | refusé | routes | identique |
| trois GET HZ-07 | PlatformOperator global | global | contexte opérateur canonique | global préservé |
| trois GET HZ-07 | PlatformOperator scoped | tenant sélectionné | contexte opérateur canonique | tenant sélectionné |

Aucun rôle n’a été ajouté ou retiré. Le patch limite uniquement l’ensemble de ressources sur lequel les capacités existantes s’exercent.
