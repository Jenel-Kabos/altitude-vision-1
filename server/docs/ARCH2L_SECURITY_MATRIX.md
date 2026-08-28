# ARCH-2L — Matrice sécurité

| Invariant | Avant | Après | Preuve |
|---|---|---|---|
| Auth Dashboard | `auth.protect` | Identique | Route/handler intacts |
| RBAC rentals | `ROLES_GL` dans controller | Identique | Aucun contrôle déplacé |
| Auth Reporting | protect + Direction | Identique | Routes/controller intacts |
| Tenant | Résolu avant DomainReport | Identique | Query ne reçoit pas tenant |
| Owner | Property.owner `$in` | Identique | déplacement textuel + Mongo A/B |
| PlatformOperator | absence scope = global | Identique | test global dédié |
| Cross-owner | IDs Property/Contrat filtrés | Identique | fixture contaminante B exclue |
| Finance | lectures Paiement uniquement | Identique | aucune mutation/formule modifiée |
| Mutation/provider | aucun | aucun | inspection source |
| Production | aucune opération | aucune | tests Mongo mémoire uniquement |

Aucune capability, règle IAM, fallback tenant/owner, status HTTP ou message n'a été créé ou déplacé.
