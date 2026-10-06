# PLATFORM-ADMIN-04B Core Design

## Intent

PA-04B Core introduces one explicit administration-scope contract shared by the backend and Web runtime. `PLATFORM` is a valid global administration context available only to a PA-04A-eligible active PlatformOperator; `TENANT` is a valid selected/resolved tenant; `UNRESOLVED` is the fail-closed absence of either. The scope changes, not the business domain. Home, Properties, Sales, and Rentals are the first consumers.

## Invariants

- Scope is derived from PA-01/PA-04A trusted context, never from query/body flags.
- `PLATFORM` requires `tenantContextSource === platform_operator_unscoped` and no resolved tenant.
- `TENANT` requires a server-resolved tenant; a forged header never suffices.
- `UNRESOLVED` never receives normal administrative data.
- Domain read/manage capabilities remain distinct and authoritative.
- Partial operators retain declared platform-native specialized workflows but never acquire dashboard `PLATFORM`.
- Tenant mode excludes other tenants and `tenant:null`.
- Platform Property operations preserve the resource's existing tenant, including `null`.
- PA-04B0's protected `Property.tenant` field remains immutable through generic updates.
- Mobile gains no platform-admin UI; existing mobile calls remain non-global unless the backend establishes valid authority.

## Backend scope contract

Add a focused administration-scope module with constants `platform`, `tenant`, and `unresolved`, plus pure derivation from the request fields already populated by `tenantContext`. Middleware attaches `req.adminScope` after canonical tenant-context resolution. It does not authenticate or authorize; route guards still require exact capabilities or tenant business roles.

The module supplies domain-local helpers for Core only:

- a Property query filter: platform `{}`, tenant `{tenant: tenantId}`, unresolved throws;
- a resource assertion: platform accepts an existing Property only after the route's platform capability guard; tenant requires exact `Property.tenant === scope.tenantId`; unresolved refuses;
- `tenant:null` is accepted only in platform mode.

No generic cross-domain attribution helper is introduced in Core.

## Web runtime contract

`PlatformTenantRuntimeContext` exposes `scope = {mode, tenantId, key}`. Platform derives from backend-provided `platformViewEligible` plus no selected tenant. Tenant derives from a selected tenant validated against the runtime list. Every other state is unresolved. Existing compatibility fields remain while Core consumers migrate.

Route requirements become explicit per branch rather than a binary global-first flag. Home, Properties, Sales, and Rentals support platform and tenant modes. The layout blocks only unresolved contexts. Specialized workflows keep their own route classification and authority.

## Dashboard Home

Home uses the same runtime scope. Platform requests server-computed global statistics through the already secured `/api/admin/stats` contract with `platformScoped:true`; tenant requests `/api/dashboard/stats` with the normal validated tenant header. Unresolved makes no request. Scope-key/epoch cancellation prevents stale results after transitions. Non-Core secondary widgets that lack certified global contracts are omitted or capability-gated in platform mode rather than aggregated client-side.

## Properties, Sales, and Rentals

The PA-03 registry remains the canonical paginated server list. Its rich presentation is expanded by reusing Property card/presentation primitives and safe projection fields. The same component handles all three routes using a fixed server filter (`vente` for Sales, `location` for Rentals) and the common scope.

Read-only operators see the full rich listing without mutation controls. Operators with `platform.properties.manage` receive only already-defined global Property actions whose backend routes enforce the exact capability and load the target resource. Tenant mutations retain canonical tenant-role checks and exact resource attribution. Platform creation is deferred because target-tenant provenance is not yet a validated workflow.

Property cockpit integration is enabled only after its ID reads use the Core resource assertion: platform with the read capability; tenant exact match; `tenant:null` denied in tenant mode. Legacy owner fallback is not used as tenant attribution.

## Transitions and transport

All Core data owners use the scope key plus request epoch/cleanup. Platform calls explicitly set Axios `platformScoped:true`, which removes residual tenant headers. Tenant calls omit that option and use the validated tenant selection. Context change dispatch remains compatible with sockets; Core socket consumers must reconnect or be absent from this phase. The staff inbox socket is characterized but not migrated because it is a specialized workflow outside Core.

## Mobile

The backend contract is shared. No mobile platform context or dashboard is added. Regression tests prove owner edits, property provenance, tenant headers, hotel/accommodation flows, and analytics do not become implicitly global. Mounting a mobile platform runtime is deferred to PA-04H.

## Deferred domains

Offers/applications, owners, rental management, documents, CRM, finance, organization, marketing, ERP, estimations/quotes, reviews, accommodation/hotel moderation, and staff inbox remain outside Core unless a direct dependency is required for a Core route. Their route classifications are inventoried for later migration.

## Test strategy

Every production change follows RED → GREEN → REFACTOR. Tests cover explicit scope derivation, full/partial/inactive/legacy/tenant actors, forged inputs, Tenant A/B/null, read/manage split, provenance, cockpit ID access, Home branches, rich Property/Sales/Rentals behavior, four context transitions, late responses, PA-01/03/04A and PA-04B0 regressions, full Web/mobile, lint, build, architecture, and diff checks.
