# ARCH-2C3 — Matrice des dépendances de scope

| Source | Target avant | Symbole | Usage | Type | Effets |
|---|---|---|---|---|---|
| propertyPortfolioController | userController | expandScopeWithUnaffiliatedUsersIfSoleTenant | scope owner du portefeuille | user scope legacy | lectures Mongo |
| rentalContractRegularizationController | userController | même | list/decide/revert | user scope legacy | lectures Mongo |
| rentalManagementController | userController | même | list/stats | user scope legacy | lectures Mongo |
| userController | fonction locale | même | listes users/owners | user scope legacy | lectures Mongo |
| userRoutes | export userController | même | garde `:id` | user scope legacy | lectures Mongo |

Les trois implémentations consommatrices étaient identiques : appel avec le scope brut puis `.catch(() => scope brut)`. Aucun autre helper tenant/ownership/operator/IAM n'a été fusionné.
