# PLATFORM-ADMIN-02 Global Users Administration Design

**Date:** 2026-09-30\
**Status:** Proposed for human review\
**Depends on:** `PLATFORM_ADMIN_01_REPORT` verdict A

## 1. Purpose and scope

`/dashboard/users` becomes the platform-wide registry of `User` identities. It must represent users independently of tenant membership: unaffiliated users, single-tenant users, multi-tenant users, suspended users, individual owners, clients, and PlatformOperators.

This sprint does not rebuild the global properties UI, the complete platform overview, reporting dashboards, tenant administration, or mobile. It does not change the established physical-deletion policy.

## 2. Canonical domain separation

- `User` is the global account identity.
- `OrgMembership` is an association between a user and an organizational unit, with its own `businessRole` and lifecycle.
- `PlatformOperator` grants platform authority and never follows from `User.role` or `OrgMembership.businessRole`.
- `PlatformTenant` supplies the tenant associated with a root organization unit.

The Global Users registry reads `User` records and decorates them with membership summaries. It never creates, mutates, or embeds memberships into `User`. Tenant member administration remains in `MembersPanel`, `/api/members`, and the canonical membership services.

## 3. Authority model

Global reads require all of:

1. authenticated `User`;
2. linked `PlatformOperator` with `status=active`;
3. exact capability `platform.users.read`.

Global mutations require the same conditions with `platform.users.manage`.

Neither `User.role === "Admin"` nor a tenant membership with `businessRole === "Admin"` is sufficient. A read-only operator sees the registry and details but receives no mutation controls. Backend authorization remains final regardless of frontend visibility.

Global requests are sent with the canonical Axios `platformScoped: true` option, which removes `X-Platform-Tenant-Id`. An explicit invalid tenant context must fail closed and never broaden access.

The frontend runtime must resolve operator status for every authenticated identity rather than pre-filtering by historical `User.role`.

## 4. Backend API contract

The existing `/api/users` resource remains canonical.

### `GET /api/users`

Supported query parameters:

- `page`: positive integer, default 1;
- `limit`: bounded positive integer with a conservative default and maximum;
- `search`: normalized search across the real `name`, `email`, and `telephone` fields;
- `status`: whitelist from the real User status enum;
- `active`: `true` or `false` mapped to `isActive`;
- `role`: whitelist from the real User role enum;
- `organization`: `with` or `without`;
- `tenantId`: valid PlatformTenant identifier;
- `operator`: `true` or `false`;
- `sort`: whitelist of newest, oldest, name, and status ordering.

Conceptual response:

```json
{
  "status": "success",
  "data": {
    "items": [],
    "page": 1,
    "limit": 25,
    "total": 0,
    "totalPages": 0,
    "stats": {
      "total": 0,
      "active": 0,
      "suspended": 0,
      "withoutOrganization": 0
    }
  }
}
```

Compatibility aliases may be retained only where needed by existing consumers, but the Global Users UI consumes the paginated contract.

### `GET /api/users/:id`

Returns one safely projected User with all real membership summaries and minimal PlatformOperator status. It does not expose operator capabilities unless an existing, explicitly authorized contract requires them; the registry only needs status/indicator information.

### Mutations

The existing routes remain canonical:

- `PATCH /api/users/:id/suspend`;
- `PATCH /api/users/:id/activate`;
- supported role/update operations already protected by `platform.users.manage`;
- `DELETE /api/users/:id`.

No new ban/unban semantics are introduced. The UI exposes only actions whose backend semantics are established and verified.

## 5. Safe query and serialization design

A focused global-user query service owns validation, filters, sort mapping, pagination, batching, and output projection. Controllers remain HTTP adapters.

The User projection is an allowlist containing only useful administrative fields such as identifier, name, email, telephone, photo/avatar, role, status, `isActive`, verification state where relevant, and timestamps. It must exclude password data, reset and verification tokens, refresh tokens, token version, two-factor secrets, credentials, keys, and other internal authentication fields.

Membership loading uses a bounded batch strategy:

1. query and paginate unique User documents;
2. fetch all `OrgMembership` rows for the returned user IDs in one query;
3. fetch related organizational/tenant display data in batch;
4. group memberships in memory by user ID;
5. fetch matching PlatformOperator status records in one query;
6. serialize exactly one registry row per User.

This guarantees no N+1 behavior and no duplicated user rows for multi-tenant identities.

Filtering by organization, tenant, or operator status first resolves matching distinct user IDs and intersects them with the User query. Counts and pagination are calculated after all filters.

No new index is added unless explainable evidence from existing indexes shows it is necessary. No production migration is part of this sprint.

## 6. Lifecycle and destructive actions

Suspension and deletion reuse the PLATFORM-ADMIN-01 transaction and `PlatformAuthorityLock` protections.

- Administrative self-deletion is refused.
- Administrative self-suspension follows the existing secure contract and must not bypass operator self-protection.
- Suspending or deleting the final viable operator is refused.
- Suspending one of two viable operators is allowed when all existing rules permit it.
- An identity with PlatformOperator history cannot be physically deleted and returns `PLATFORM_OPERATOR_HARD_DELETE_REQUIRES_HUMAN_DECISION`.
- Ordinary-account deletion retains its current behavior.
- Reactivation changes the User lifecycle only and does not create or alter memberships.

The historical blanket rule that blocks suspension solely because `User.role === "Admin"` must not replace the canonical operator/self/last-operator invariants. Any adjustment is pinned by tests before implementation.

## 7. Frontend architecture and UX

The existing `/dashboard/users` route renders a rebuilt `UsersPanel` as the global registry. `MembersPanel` remains available only through tenant-member navigation and is not repurposed.

The page includes:

- heading “Utilisateurs de la plateforme” and an explanatory subtitle;
- genuine server-backed statistics;
- debounced global search;
- supported status, role, organization, tenant, and operator filters;
- server-side sort and pagination;
- one row per User with identity, account role/status, organizations, and operator indicator;
- an accessible detail drawer/modal with identity, status, memberships, operator status, and available actions;
- “Aucune organisation” for users with no memberships;
- distinct loading, empty, no-search-result, error, unauthorized, and forbidden states.

Loading statistics display skeletons or `—`, never fabricated zero values. API failures do not render as an empty registry.

Mutation controls appear only with `platform.users.manage`. Suspension requires explicit confirmation. Physical deletion uses reinforced confirmation identifying the target. Safe backend codes such as `LAST_PLATFORM_OPERATOR`, `PLATFORM_OPERATOR_HARD_DELETE_REQUIRES_HUMAN_DECISION`, and self-action errors are translated into precise user-facing explanations rather than a generic failure.

Changing tenant selection must not affect Global Users data because its calls are explicitly platform-scoped.

## 8. Existing UI reuse and retirement

The current `UsersPanel` supplies useful visual primitives but cannot be retained unchanged because it:

- checks historical `isAdmin`;
- loads and filters the full collection client-side;
- lacks membership summaries and server pagination;
- calculates incomplete statistics in React;
- invokes some owner-specific admin endpoints;
- exposes create/role workflows outside the minimal registry goal.

Reusable presentation pieces may be extracted or simplified. Obsolete behavior is removed rather than layered underneath the new contract. Account creation and unrelated KYC/contract operations are excluded unless existing product tests prove they are required on this page.

## 9. Error handling

Backend query validation rejects malformed IDs, unsupported filters, invalid enum values, excessive limits, and non-whitelisted sorts with a safe 4xx response. It never interpolates user input into Mongo operators.

Frontend state preserves the last deliberate query parameters, disables duplicate mutations while pending, refreshes the affected row after success, and leaves the dialog open with a precise message after a rejected destructive action.

## 10. Testing strategy

Implementation follows strict red-green-refactor TDD.

Backend Mongo integration tests cover:

- tenant A, tenant B, unaffiliated, multi-tenant, suspended, and PlatformOperator users;
- one row for a multi-membership user;
- membership summaries and tenant filter;
- search, filters, sort whitelist, bounds, and pagination totals;
- absence of every sensitive field;
- `platform.users.read` and `platform.users.manage` separation;
- wrong capability, inactive operator, legacy Admin, and tenant Admin refusals;
- invalid tenant context without global fallback;
- self-action and final viable operator protections;
- allowed suspension when another viable operator remains.

Frontend tests cover list rendering, all explicit UX states, search, filters, pagination, unaffiliated and multi-tenant presentation, suspended status, detail opening, read-only behavior, manage controls, confirmations, precise backend errors, and independence from `selectedTenantId`.

Non-regression covers tenant Members, last tenant Admin, PLATFORM-ADMIN-01 authority, global properties, reporting, tenant isolation, and `tenant:null` properties. Final checks include backend and frontend lint, frontend build, architecture certification, and `git diff --check`. Full Mongo is reported `NOT_RUN` if its multi-hour duration remains unreasonable.

## 11. Worktree and delivery constraints

All pre-existing changes remain untouched unless a file must be deliberately extended for this sprint. PLATFORM-ADMIN-02 changes are tracked separately.

No commit, push, tag, deployment, EAS operation, Google Cloud mutation, remote-data mutation, or production-data mutation is authorized. The target email is never hardcoded and its production authority remains `UNVERIFIED`.

Delivery ends with the exact 27-section `PLATFORM_ADMIN_02_GLOBAL_USERS_REPORT` and then `STOP`. PLATFORM-ADMIN-03 does not begin automatically.
