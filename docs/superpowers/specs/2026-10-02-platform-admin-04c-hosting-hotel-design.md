# PA-04C Hosting & Hotel Explicit Platform Scope — Design

## Intent

Migrate Accommodation and Hotel administration to the canonical `PLATFORM | TENANT | UNRESOLVED` runtime established by PA-04B. Platform authority never changes resource provenance; tenant administration never sees `tenant:null` or another tenant.

## Scope

PA-04C migrates `/dashboard/hebergements`, `/dashboard/etablissements`, their list/detail/moderation and clearly defined lifecycle actions. Public discovery, owner self-service, reservations, room operations, inventory, housekeeping, maintenance and finance retain their current domain-specific guards unless a direct dependency must be adapted.

## Canonical authority and attribution

- `req.adminScope` remains the only administration-scope contract and is derived from canonical tenant context.
- PLATFORM actions require an active, PA-04A-eligible `PlatformOperator` and the exact domain capability.
- TENANT actions require the selected canonical tenant plus the existing tenant business authority or an explicitly allowed PlatformOperator tenant selection.
- UNRESOLVED sends no normal administration query and authorizes no normal mutation.
- Administrative attribution for Accommodation and Hotel is strict: `resource.tenant` is canonical. Property/owner/manager/createdBy fallbacks remain available only to explicitly preserved owner/self-service paths and must never turn `tenant:null` into a tenant resource.
- Existing-resource mutations derive tenant from the loaded resource, never from query/body/header.

## Read contracts

`GET /api/accommodations/admin/list`, `GET /api/accommodations/status/pending`, `GET /api/hotels/admin/list`, `GET /api/hotels/status/pending`, and `GET /api/hotels/portfolio` become explicit dual-mode administration reads:

- PLATFORM: exact `.read`, global result including `tenant:null`.
- TENANT: exact `resource.tenant === scope.tenantId`; no owner fallback.
- UNRESOLVED: 403 and no data.

Pagination, search, filters and sort remain server-side. Safe owner/tenant projections are informational only.

## Mutation contracts

Clearly defined lifecycle mutations—update, validate, reject, suspend, unsuspend, archive/reactivate and Hotel reconciliation—use resource-first authorization:

1. load resource;
2. derive canonical direct tenant from the resource;
3. require `platform.accommodations.manage` or `platform.hotels.manage` in PLATFORM;
4. require exact selected tenant and tenant authority in TENANT;
5. reject UNRESOLVED and forged scope inputs;
6. preserve Accommodation, Hotel and linked Property tenant values.

Physical deletion and duplication remain owner/self-service or deferred for global administration until their business semantics are separately approved. Operational subdomains keep `HOTEL_OPERATIONAL_CAPABILITIES` and resource-derived hotel access.

## Creation policy

Platform creation is deferred in PA-04C. PLATFORM pages hide/disable creation and the backend refuses admin creation without a resolved TENANT scope. A future platform creation workflow must require an explicit validated target tenant or an explicitly approved platform-native `tenant:null` creation contract. Absence of a tenant is never a creation instruction.

Tenant creation remains allowed and writes the same canonical tenant to Property, Accommodation and Hotel. Owner/mobile self-service remains ownership-scoped and must not become implicitly global.

## Web runtime

Both pages consume `PlatformTenantRuntimeContext.scope`:

- platform requests set `platformScoped:true` and never retain `X-Platform-Tenant-Id`;
- tenant requests rely on the validated tenant header;
- unresolved sends no business request;
- `scope.key` plus request epoch/cleanup prevents stale responses;
- read/manage UI follows exact capability in PLATFORM and existing tenant authority in TENANT.

Analytics requests use the same explicit scope and must not infer global mode from a missing tenant.

## Hotel boundaries

Hotel, Accommodation and Property remain distinct entities. Hotel lifecycle synchronization may update the linked Accommodation state but not tenant provenance. Rooms, categories, rates, reservations, inventory, housekeeping, maintenance, staff assignments and finance remain later migration domains unless required to render or safely execute a PA-04C action.

## Mobile compatibility

No mobile platform-admin UI is added. Public Hotel endpoints, owner reservation endpoints, owner cockpit operations and `/accommodations/mobile/full` preserve their current contracts. Admin-scope middleware is applied only to admin surfaces; self-service routes retain ownership/domain guards.

## Security invariants

- No `User.role === 'Admin'` platform authority.
- No `OrgMembership.businessRole === 'Admin'` platform authority.
- Read never implies manage.
- Partial or inactive operators do not obtain PLATFORM.
- `tenant:null` is visible/manageable only in PLATFORM with the exact capability.
- Forged header/query/body/`platformScoped`/mode cannot establish authority.
- Owner/manager/createdBy is not administrative tenant provenance.
- No provenance transfer is introduced.

## Deferred decisions

- Platform-native `tenant:null` creation versus mandatory target tenant belongs to a later approved workflow.
- Global physical deletion and duplication are deferred.
- Full operational Hotel subdomain migration is deferred.
- A broader removal of owner fallback from non-administrative legacy attribution is outside PA-04C.
