# ARCH-2H — Matrice sécurité

| Dimension | Preuve | Résultat |
|---|---|---|
| Authentication | `protect` demeure dans `staffOnly` ; test 401 sans query | Inchangée |
| Authorization | `restrictTo(...ROLES_ESTIMATION)` demeure ; Client 403, staff autorisé | Inchangée |
| Tenant | aucun champ/filtre tenant dans ce flux | Non applicable, aucune expansion |
| Ownership | aucune règle d'ownership existante | Non applicable |
| PlatformOperator | absent du flux | Inchangé |
| IAM/capabilities | aucun middleware déplacé ou ajouté | Inchangé |
| Guards | tous restent dans la route | Inchangés |
| Mutations | mêmes affectations et même ordre save/populate | Aucune nouvelle mutation |
| API | tests de caractérisation avant/après | Inchangée |
| Production | providers mockés, Mongo mémoire, aucun déploiement | Aucune mutation production |

Les neuf edges KEEP d'ARCH-2G sont restées dans la baseline ; aucune edge de sécurité n'a été modifiée.
