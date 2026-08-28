# ARCH-2I — Matrice sécurité

| Candidate | Auth | Tenant | Ownership | PlatformOperator | Security sensitivity |
|---|---|---|---|---|---|
| Estimation | `optionalAuth` sur POST ; `protect+ROLES_ESTIMATION` sur GET | non | non | non | MEDIUM : public upload + inbox staff |
| Realisation | aucun middleware dans le fichier ; route non montée | non | non | non | LOW runtime, HIGH si remontée sans design |
| Projet | aucun middleware dans le fichier ; route non montée | non confirmé | non confirmé | non | LOW runtime, HIGH si restaurée |

Estimation ne cache pas un guard Model : sa classification applicative reste valide. Les deux routes mortes ne sont pas des frontières de sécurité actives ; leur absence d'auth devient toutefois un motif de ne jamais les remonter telles quelles.
