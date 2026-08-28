# ARCH-2C3 — État initial

- Branche `main`, HEAD `a04055f62952c782b92aeef2f100824a17a5f645`; worktree déjà sale, préservé.
- `git diff --check` initial vert (deux avertissements CRLF préexistants).
- Architecture : 464 fichiers, 1513 arêtes, service→controller 6, controller→controller 8, route→model 17, controller→model 202, cycles 0, unresolved 0, dangling 3, violations nouvelles 0.
- Trois arêtes forment le cluster : `propertyPortfolioController`, `rentalContractRegularizationController` et `rentalManagementController` importent `expandScopeWithUnaffiliatedUsersIfSoleTenant` depuis `userController`.
- Les documents ARCH-1 demandés sont absents du tree. Les politiques ARCH-2A, inventaires/rapports ARCH-2C1/C2 et rapports RBAC disponibles ont été consultés.

Le périmètre est une compatibilité locale mono-tenant. Ce n'est ni `resolveTenantScope`, ni ownership, IAM, HotelStaffAssignment ou finance.
