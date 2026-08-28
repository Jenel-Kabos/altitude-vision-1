# Matrice des patterns sûrs

| Route family | Canonical resolver | Fail-closed | PlatformOperator aware | Ownership aware |
|---|---|---|---|---|
| Dashboard Analytics | `requireTenantScopeForAnalytics` | staff oui | global + scoped | oui |
| Reporting | `requireTenantScopeAllowPlatformWide` | oui hors opérateur global | oui | N/A |
| CRM / CRM Automation / Marketing | `requireTenantScope` | oui | sélection requise | N/A |
| ERP | `requireTenantScope` | oui | sélection requise | N/A |
| Documents | `requireTenantScope` + attribution | oui | sélection requise | selon ressource |
| Rental Management/Maintenance | `requireTenantScope` + scope IDs | oui | sélection requise | oui |
| Users Admin | `requireTenantScope` + `router.param` | oui | sélection requise | N/A |
| Hotel operational | attach + `resolveHotelAccessScope` | garde domaine oui | sélection tenant | manager/assignment |
| Finance Hotel | attach + `assertFinancialScope` | garde domaine oui | capacités read/manage explicites | manager |
| Messaging ciblé | attach + participants/attribution | ressource oui | pas de global implicite observé | oui |

Patterns à conserver : résolution serveur avant query, tenant selector validé, scope indirect par IDs racines, gardes domaine fail-closed, ownership self-service séparé, et globalité uniquement lorsque `tenantContextSource === platform_operator_unscoped` sur une route qui l'autorise explicitement.
