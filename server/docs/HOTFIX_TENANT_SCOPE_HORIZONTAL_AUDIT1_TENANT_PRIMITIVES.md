# Primitives tenant

| Primitive | Type | Purpose | Used by | Authoritative? |
|---|---|---|---|---|
| `resolveEffectiveTenantContext` | Service | Résoudre membership, fallback legacy ou PlatformOperator sélectionné/global | middleware canonique | Oui, serveur |
| `resolveAvailableTenantsForUser` | Service | Énumérer les tenants accessibles | middleware, plateforme | Oui, serveur |
| `resolveTenantForUser` | Service | Résolution inline d'un tenant demandé | contrôleurs/`router.param` legacy | Oui si le sélecteur est transmis et validé |
| `resolveTenantScope` | Service | Calculer root org unit et utilisateurs du tenant | middleware, reporting | Oui, serveur |
| `resolveAndAttachTenantScope` | Middleware interne | Attacher tenant, source, scope et capacités opérateur | variantes `requireTenantScope` | Oui |
| `requireTenantScope` | Middleware | Tenant obligatoire, fail-closed | CRM, Documents, Rental, Users, ERP… | Oui, canonique |
| `requireTenantScopeAllowPlatformWide` | Middleware | Tenant obligatoire sauf vrai mode PlatformOperator global | Reporting | Oui, canonique |
| `requireTenantScopeForStaffOrPlatformOperator` | Middleware | Staff/opérateur obligatoirement scopé, self-service préservé | unread conversations | Oui |
| `requireTenantScopeForAnalytics` | Middleware | Staff scopé, opérateur global/scopé, owner self-service | Dashboard Analytics | Oui |
| `attachTenantScopeIfResolvable` | Middleware | Enrichissement non bloquant, ownership aval obligatoire | Hotel, Finance | Oui pour le contexte, pas une autorisation |
| `attachTenantContext` | Middleware | Tenant optionnel sans enrichissement complet | Messaging, HotelReservation | Oui pour la sélection, pas une autorisation |
| `assertResourceTenant` | Authorization | Attribution stricte d'une ressource au tenant | Hotel/Finance | Oui, fail-closed |
| `assertResourceTenantOrUnattributed` | Authorization | Refus si autre tenant, tolérance si historique inattribuable | Property/Rental/Documents | Partiel par design legacy |
| `resolveHotelAccessScope` | Domain authorization | Scope tenant + assignments + manager legacy | Hotel/HotelReservation/Finance | Oui dans le domaine Hotel |
| Ownership direct | Authorization | owner/guest/manager/participant | self-service | Oui pour la ressource ciblée |
| Headers `X-Platform-Tenant-Id`/`X-Tenant-Id` | Client selector | Choisir un tenant accessible | middleware et checks inline | Non seuls ; validés par les services |

La primitive générale canonique suffisante existe : factory tenant + services `tenantContextService`, complétée par l'attribution de ressource et les gardes d'ownership. Le problème horizontal n'est pas l'absence de primitive, mais son contournement par certains handlers et branches `Admin`.
