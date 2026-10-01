# PLATFORM-ADMIN-03 Global Properties UI Design

## 1. Purpose

`/dashboard/properties` becomes a dual-context property registry without weakening tenant isolation. An authorized active PlatformOperator can read the complete platform property population, including `tenant:null` properties, while a selected tenant continues to expose only properties canonically attributed to that tenant.

The page remains read-only in PA-03. It does not expose `platform.properties.manage`, add deletion, invent tenant attribution, modify remote data, or introduce a second global endpoint.

## 2. Existing Architecture and Reuse

The canonical list endpoint is `GET /api/properties`.

PA-01 already provides the required authority split:

- an unscoped active PlatformOperator needs `platform.properties.read` for a global read;
- a selected tenant is resolved server-side and constrains the query by `Property.tenant`;
- an unrelated capability, inactive operator, legacy `User.role === "Admin"`, or tenant Admin without PlatformOperator authority cannot receive the global catalogue;
- global reads include `tenant:null` properties;
- tenant reads exclude other tenants and `tenant:null` properties;
- `platform.properties.manage` remains distinct and protects existing mutation endpoints.

PA-03 must not change these authority primitives. `/api/properties/portfolio` is not the canonical registry contract because it is an unpaginated published-portfolio projection and omits administrative lifecycle states.

The dashboard layout already classifies `/dashboard/properties` as `GLOBAL_FIRST`. The remaining blocker is local to `ManagePropertiesPage`, which currently requires a non-null `selectedTenantId` before fetching.

## 3. Scope Modes

### 3.1 Platform mode

Platform mode applies when the runtime is ready, no tenant is selected, and `can('platform.properties.read')` is true.

The frontend calls `GET /api/properties` with `platformScoped: true`. The canonical Axios interceptor must remove any residual `X-Platform-Tenant-Id`. The backend remains the final authority and verifies the active PlatformOperator plus the exact read capability.

The response may contain properties belonging to any tenant and properties whose canonical `tenant` is `null`. A `tenant:null` property is displayed as `Aucune organisation`; PA-03 never creates a membership or assigns a tenant.

If the runtime has no selected tenant and lacks `platform.properties.read`, the page renders an explicit forbidden state and sends no property request.

### 3.2 Tenant mode

Tenant mode applies when `selectedTenantId` is non-null and the runtime is ready. The frontend calls the same service without `platformScoped: true`. The shared Axios client therefore attaches the validated tenant header normally.

The backend resolves the selected tenant and constrains the query by canonical `Property.tenant`. Tenant A must never receive Tenant B or `tenant:null` properties, and conversely for Tenant B.

### 3.3 Context transitions

Every scope change invalidates the previous request epoch and immediately clears visible rows, counts, errors, and page-specific state.

- Tenant to platform clears the validated tenant in the runtime, issues a new request with `platformScoped: true`, and ignores any late tenant response.
- Platform to tenant restores the validated tenant through the existing runtime, issues a normal tenant-scoped request without `platformScoped`, and ignores any late global response.
- Tenant A to Tenant B behaves identically: Tenant A data is cleared before Tenant B is requested.

The service configuration, not an ad hoc header mutation in the component, controls the scope.

## 4. Canonical List Contract

The frontend property service exposes a focused administrative list function backed by `GET /api/properties`.

Input parameters:

- `page`, default 1;
- `limit`, default 20 and bounded server-side;
- `search`;
- `offerType` for `vente`, `location`, or `hebergement` only when supported by the real Property contract;
- `propertyType`;
- `city`;
- `arrondissement`;
- `statusAdmin` or another existing lifecycle filter only if safely supported after audit;
- `sort`, restricted to a backend whitelist;
- `dashboardClassification=1` when the UI needs canonical detail navigation;
- `platformScoped`, used only to configure Axios and never serialized as a query parameter.

Normalized output:

```text
items
page
limit
total
totalPages
```

The compatibility response fields already used by public consumers remain intact. PA-03 must not break `getAllProperties` or public property search.

Search and filters are executed before the server-side count and pagination. React does not load the entire collection for local filtering or pagination.

## 5. Backend Hardening Boundary

The existing endpoint is reused. Backend changes are limited to gaps proven by failing tests:

- strict, bounded pagination parameters;
- a sort whitelist rather than arbitrary Mongo sort expressions;
- safe administrative projection for tenant and owner display;
- safe query filtering needed by the approved UI.

Administrative enrichment is informative only. It must occur after the authority and tenant scope have already been resolved and must never influence access decisions.

Safe enrichment may include:

- owner `_id` and display name;
- tenant `_id` and display name/status;
- existing property fields required by the registry.

It must not expose passwords, tokens, operator capabilities, membership internals, private keys, or unrelated personal data. Owner email is not required for this UI.

If tenant or owner records are missing, the row remains visible with a safe fallback. Missing display metadata never broadens scope.

## 6. User Interface

`ManagePropertiesPage` keeps its existing tenant workflows for `/dashboard/sales` and `/dashboard/rentals`, while `/dashboard/properties` uses the new read-only registry behavior.

The platform header states:

- `Biens de la plateforme`;
- `Vue globale des biens publiés sur Altitude Vision` or an equivalent accurate subtitle;
- a compact platform-context indicator.

The tenant header states the selected tenant name and does not imply a global view.

Each property row or card uses only available fields:

- primary image;
- title;
- property type and listing type;
- price in the existing currency convention;
- city and arrondissement/neighborhood where available;
- availability and administrative status;
- safe owner name when available;
- tenant name or `Aucune organisation`;
- creation date;
- canonical detail navigation.

PA-03 exposes no create, edit, delete, approval, rejection, recommendation, suspension, or other manage control on `/dashboard/properties`, even when the operator also has `platform.properties.manage`.

## 7. Search, Filters, Sorting, and Pagination

The registry provides server-backed controls only for real fields supported by the endpoint:

- search over the existing title, description, arrondissement, and type contract;
- listing type;
- property type;
- city;
- administrative/publication state if the audited backend can support it safely;
- newest/oldest, title, price, and status sorts only if present in the whitelist.

Changing search or filters returns to page 1. Search is debounced. Pagination uses the server `total` and `totalPages` and never derives global statistics from the current page.

The top area may display only totals returned by a reliable global or tenant-scoped server response. PA-03 does not fabricate sales, rental, accommodation, or pending totals from the current page.

## 8. UX States and Errors

The page handles these states distinctly:

- runtime loading;
- list loading;
- empty registry;
- no search results;
- generic API error;
- forbidden platform access;
- tenant context failure.

An API error never renders as an empty successful registry. A context transition clears stale errors as well as stale data.

## 9. Security Invariants

- Platform authority is exclusively an active `PlatformOperator` with `platform.properties.read`.
- `User.role === "Admin"` is not global authority.
- `OrgMembership.businessRole === "Admin"` is not global authority.
- A wrong capability or inactive operator fails closed.
- `platform.properties.read` never implies manage controls.
- `platform.properties.manage` is not consumed by this page in PA-03.
- The tenant header is absent in a platform-scoped request.
- The tenant header is restored only through the validated runtime for tenant requests.
- Query parameters cannot override the server-resolved tenant boundary.
- `tenant:null` remains null and is never included in a tenant result.
- No physical deletion is introduced or exposed.
- No email address is hardcoded as an authority exception.

## 10. TDD and Verification

Backend tests cover:

- active operator plus `platform.properties.read` global success;
- unrelated capability, inactive operator, legacy Admin, and tenant Admin global refusal;
- Tenant A, Tenant B, and `tenant:null` fixtures;
- global inclusion without duplication;
- strict tenant isolation and exclusion of `tenant:null`;
- server pagination, search, filters, and sort whitelist;
- safe owner/tenant projection and absence of sensitive data;
- read capability not granting mutation authority.

Frontend tests cover:

- authorized platform registry;
- explicit forbidden state without the read capability;
- normal tenant registry;
- Tenant A to Tenant B;
- tenant to platform with `platformScoped: true` and no retained tenant header behavior;
- platform to tenant with normal tenant scope restored;
- late-response suppression in both directions;
- loading, empty, no-result, error, forbidden, pagination, filters, search, and `tenant:null` display;
- absence of the `Sélectionnez un tenant à administrer` blocker in authorized platform mode;
- absence of manage and delete controls.

Non-regression covers PA-01 and PA-02 authority, global users, tenant members, reporting, last PlatformOperator, last tenant Admin, property public consumers, lint, Next build, architecture certification, and `git diff --check`.

## 11. Repository and Operational Constraints

- Preserve every pre-existing worktree change.
- Inspect overlapping hunks before modifying shared files.
- No reset, restore, clean, or automatic stash.
- No commit, push, tag, deploy, EAS operation, or remote/production data mutation.
- Use local fixtures only.
- Finish with `PLATFORM_ADMIN_03_GLOBAL_PROPERTIES_REPORT` and stop before PLATFORM-ADMIN-04.
