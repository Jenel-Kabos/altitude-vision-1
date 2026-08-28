# HZ-06 — Audit

- Branche `main`, HEAD initial `a04055f62952c782b92aeef2f100824a17a5f645`, worktree fortement dirty et préservé.
- Architecture initiale : PASS, 472 fichiers, 1 531 edges ; service→controller 2, controller→controller 1, route→model 12/11 routes, controller→model 192, cycles 0, unresolved 0, nouvelles violations 0.
- Audits lus : `HOTFIX_TENANT_SCOPE_HORIZONTAL_AUDIT1_*`, `HOTFIX_TENANT_SCOPE_HORIZONTAL_REAUDIT2_*` et contrats HZ-01→HZ-07 pertinents.
- HZ-06 confirmé sur trois GET LIVE : `/api/hotels/admin/list`, `/api/hotels/portfolio`, `/api/hotels/status/pending`.
- Cause statique confirmée : la branche `role === Admin` omettait les IDs accessibles et n’appliquait pas `req.platformTenant` ; `attachTenantScopeIfResolvable` ne bloquait pas un staff sans tenant.
- `Hotel.tenant` est un ObjectId canonique direct vers PlatformTenant.
- Public, owner, détail, mutations et racine `/api/hotels` ne font pas partie du finding historique HZ-06.
