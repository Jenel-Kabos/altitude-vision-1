# ARCH-2J — Matrice sécurité

| Dimension | Preuve | Résultat |
|---|---|---|
| Auth/IAM | `getModuleAnalytics` et `ROLES_ALTIMMO` restent dans le controller | inchangé |
| Tenant | aucune décision tenant dans la query ; résolution org/tenant reste en amont | inchangé |
| Ownership | même `owner: {$in: scopeUserIds}` | inchangé |
| PlatformOperator | non impliqué par la candidate | non applicable |
| Cross-tenant | aucun fallback ou scope ajouté | aucune expansion |
| Finance | mêmes lectures Transaction et calculs | inchangé |
| Publication | prédicat exact conservé | inchangé |
| Vente/location | `status:'vente'` exact | inchangé |
| Production | Mongo mémoire uniquement, aucun provider/deploy | aucune mutation |

Les 9 edges route→model protégées, `runPropertySearch` et les autres modules reporting restent intacts.
