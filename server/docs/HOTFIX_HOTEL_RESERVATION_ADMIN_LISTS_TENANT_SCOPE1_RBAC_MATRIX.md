# HZ-05 — Matrice RBAC

| Role | Before | After | Changed? |
|---|---|---|---|
| Admin | accès aux deux listes | mêmes listes, tenant courant | Non |
| GestionnaireImmobilier | accès aux deux listes | mêmes listes, tenant courant | Non |
| Collaborateur | accès aux deux listes | mêmes listes, tenant courant | Non |
| PlatformOperator global/scoped avec rôle autorisé | accès selon contrat opérateur | global ou tenant sélectionné | Non |
| Client | 403 | 403 | Non |
| Proprietaire | 403 | 403 | Non |
| Anonyme | 401 | 401 | Non |

Aucune capacité de création, lecture légitime, modification, suppression, validation ou administration n'a été retirée. Seule la frontière des deux lectures HZ-05 est fermée.
