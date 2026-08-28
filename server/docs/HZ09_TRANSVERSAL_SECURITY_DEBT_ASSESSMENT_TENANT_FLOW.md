# HZ-09 — Flux tenant

## Flux canonique

Header `X-Platform-Tenant-Id` ou `X-Tenant-Id` → `requestedTenant(req)` → `resolveEffectiveTenantContext` → validation membership ou PlatformOperator actif → `req.platformTenant`, source, capacités et scope utilisateurs → controller/service → filtre ou garde de ressource.

## Flux inline HZ-09

Header extrait localement → `resolveTenantForUser` → `resolveEffectiveTenantContext` → tenant validé côté serveur → `assertResourceTenantOrUnattributed`, racine d'organisation ou filtre de liste. Le client contrôle le header, mais jamais le résultat : un tenant hors membership renvoie `null`; un PlatformOperator scoped est vérifié comme opérateur actif.

## Branches

- 13/15 appels : deux alias d'en-tête acceptés.
- 2/15 appels : seul `x-platform-tenant-id` est lu ; `X-Tenant-Id` est ignoré et le chemin échoue fermé si le contexte est ambigu.
- Membership unique : dérivation implicite légitime.
- Multi-membership sans sélection : `null`, pas de `findOne` arbitraire.
- Staff sans tenant : `null`; aucun fallback global attribuable au resolver.
- PlatformOperator scoped : tenant choisi par ID après reconnaissance opérateur.
- PlatformOperator global : le resolver retourne `null`; seul un middleware `allowPlatformWide` peut encoder le mode global. Les gardes inline simples ne fabriquent pas de globalité.

`req.platformTenant` n'est pas utilisé par les appels inline eux-mêmes, d'où redondance possible lorsque le middleware l'a déjà peuplé. HZ-01 à HZ-07 ont ajouté ce flux canonique sur certaines routes mais pas sur toutes les références.
