# Matrice sécurité

| Propriété | Preuve | Statut |
|---|---|---|
| Authentication inchangée | `auth.protect` conservé en premier | PASS |
| RBAC inchangé | mêmes `ROLES_ALTIMMO`, `ROLES_GL`, `Proprietaire` | PASS |
| Isolation tenant | Admin A/B + quatre endpoints + sentinelles | PASS |
| Ownership inchangé | Proprietaire sans tenant/owned couvert | PASS |
| PlatformOperator global | A+B attendu et testé | PASS |
| PlatformOperator scoped | A puis B testés | PASS |
| Finance cross-tenant | Paiement/Transaction/allocations/documents/refunds indirectement bornés | PASS |
| Aucun nouveau privilège | le middleware ne fait que restreindre ou préserver un mode certifié | PASS |
| Autorisation non confiée au client | header validé par resolver membership/operator | PASS |
| Mutation production | aucune DB/provider/deploy | PASS |

Le seul mode multi-tenant restant est celui du PlatformOperator réellement reconnu par le resolver serveur. Admin ne devient jamais global.
