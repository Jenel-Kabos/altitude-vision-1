# Matrice des frontières de sécurité

| Domain | Read Scope | Mutation Scope | Missing Tenant | PO Global | PO Scoped | Ownership |
|---|---|---|---|---|---|---|
| AccommodationReservation | tenant/owner/guest selon route, certifié | tenant + ownership, certifié | 403 staff | global explicitement préservé par garde HZ | tenant respecté | Proprietaire/Client préservés |
| Accommodation Calendar | parent Accommodation tenant-scoped, certifié | parent tenant-scoped, certifié | 403 staff | préservé | tenant respecté | Proprietaire préservé |
| Accommodation admin lists | `Accommodation.tenant`, certifié | N/A | 403 staff | préservé | tenant respecté | N/A |
| HotelReservation admin lists | global `{}` ou `{status}` | N/A pour HZ-05 | fail-open | accès global courant ; légitimité non encodée explicitement | scope sélectionné ignoré | N/A admin list |
| Hotel lists | Admin global ; autres rôles via hôtels accessibles | N/A pour HZ-06 | Admin sans tenant reste global | accès global courant ; légitimité non confirmée | scope sélectionné ignoré par branche Admin | manager/assignment pour non-Admin |
| Property moderation/list | pending/count et vue staff globaux | mutations individuelles hors HZ-07 | fail-open | global courant ; légitimité non confirmée | aucun mécanisme sur ces listes | aucun sur listes ; owner PII exposée |
| Legacy attribution HZ-08 | refus si autre tenant, tolérance si inattribuable | idem selon consommateur | dépend de la ressource | dépend du routeur | dépend du routeur | parfois combiné |
| Inline drift HZ-09 | variable selon consommateur | variable | risque d'omission | variable | variable | variable |

## Primitives constatées

- Canonique : `requireTenantScope`, `requireTenantScopeAllowPlatformWide`, `requireTenantScopeForStaffOrPlatformOperator`, `requireTenantScopeForAnalytics`, `requireTenantScopeForStaffAllowPlatformWide`.
- Domaine Hotel : `resolveHotelAccessScope`, `listAccessibleHotels`, `assertOperationalHotelAccess`.
- Attribution : stricte `assertResourceTenant`, tolérante legacy `assertResourceTenantOrUnattributed`.
- Ad hoc : appels à `resolveTenantForUser` dans contrôleurs et `router.param`.
- Attach-only : `attachTenantContext` et `attachTenantScopeIfResolvable`, non suffisants seuls.

CAPABILITY et RESOURCE SCOPE sont séparés : `restrictTo('Admin')` donne une capacité, jamais une globalité multi-tenant implicite.
