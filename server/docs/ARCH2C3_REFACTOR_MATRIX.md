# ARCH-2C3 — Matrice de refactor

| Source | Target ancien | Symbole ancien | Nouvelle abstraction | Edge supprimée |
|---|---|---|---|---|
| propertyPortfolioController | userController | expandScopeWithUnaffiliatedUsersIfSoleTenant | unaffiliatedUserScopeService | oui |
| rentalContractRegularizationController | userController | même | unaffiliatedUserScopeService | oui |
| rentalManagementController | userController | même | unaffiliatedUserScopeService | oui |

`userController` et `userRoutes` consomment aussi le service canonique. L'export de controller a disparu. API minimale : un tableau optionnel en entrée, une Promise de tableau d'IDs stringifiés en sortie; aucun `req/res`.
