# Matrice de reproduction

| Actor | Tenant | Target | Operation | Before fix | After fix |
|---|---|---|---|---|---|
| Admin A | A | Accommodation B | GET blocks | 200, fuite | 404 |
| Admin B | B | Accommodation A | GET blocks | 200, fuite | 404 |
| Admin A | A | Accommodation B | GET calendar | 200, fuite | 404 |
| Admin B | B | Accommodation A | GET calendar | 200, fuite | 404 |
| Admin A | A | Accommodation B | POST block | 201, bloc créé | 404, zéro création |
| Admin B | B | Accommodation A | POST block | 201, bloc créé | 404, zéro création |
| Admin A | A | Block B | DELETE block | 204, bloc supprimé | 404, zéro suppression |
| Admin B | B | Block A | DELETE block | 204, bloc supprimé | 404, zéro suppression |
| Staff sans tenant | aucun | Accommodation A | GET blocks | 200 | 403 |
| PlatformOperator scoped A | A | Accommodation B | GET blocks | 200 | 404 |
| PlatformOperator scoped B | B | Accommodation A | GET blocks | 200 | 404 |
| Admin A/B | même tenant | ressource propre | read/create/delete | succès | succès inchangé |
| PlatformOperator global | global | A et B | opérations autorisées | succès | succès inchangé |
| Proprietaire | ownership | ressource possédée/non possédée | opérations autorisées | succès/refus | inchangé |

Il n'existe aucun endpoint update vivant ; update est `NON APPLICABLE`.
