# PLATFORM-ADMIN-03 Global Properties UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/dashboard/properties` into a read-only, server-paginated property registry that safely switches between platform-wide and selected-tenant scopes.

**Architecture:** Keep `GET /api/properties` as the only canonical list endpoint. Add an explicitly requested dashboard-registry projection and bounded query normalization without changing PA-01 authority middleware, then isolate the read-only UI in a focused registry component rendered by `ManagePropertiesPage`. The shared Axios `platformScoped` option is the sole mechanism for removing the tenant header in platform mode.

**Tech Stack:** Node.js, Express, Mongoose, Jest/Supertest/Mongo integration harness, Next.js 15, React 18, Axios, Vitest, Testing Library, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-10-01-platform-admin-03-global-properties-design.md`

## Global Constraints

- `GET /api/properties` remains the canonical list endpoint; do not add a second global endpoint.
- Do not modify the PA-01 authority primitives or infer platform authority from `User.role` or `OrgMembership.businessRole`.
- Use `platformScoped: true` only in platform mode; tenant mode uses the validated shared Axios tenant context.
- `tenant:null` properties remain unattributed and never appear in a tenant result.
- Owner and tenant enrichment is a safe display projection only and never participates in authorization.
- `/dashboard/properties` remains read-only; add no create, edit, moderation, recommendation, or delete control.
- Preserve the existing `/dashboard/sales` and `/dashboard/rentals` workflows.
- Preserve all pre-existing worktree changes; inspect overlapping hunks before editing.
- No commit, push, deploy, EAS operation, remote API mutation, or production data mutation.
- Every production behavior is implemented through a witnessed RED → GREEN → REFACTOR cycle.

## Review Focus

- A stale Tenant A response arriving after a platform or Tenant B request must not repopulate Tenant A rows; Task 4 tests both directions with deferred promises.
- A malformed or excessive `page`/`limit` must fail safely rather than trigger an unbounded query; Task 1 tests zero, non-numeric, and limit above 100.
- A caller must not inject an arbitrary Mongo sort field; Task 1 tests an unknown sort key and literal whitelisted mappings.
- Missing owner or tenant display documents must not hide the property or broaden scope; Task 2 tests null-safe projection.
- A platform operator that loses the read capability while the component is mounted must purge rows and render forbidden without issuing another list request; Task 4 tests runtime capability change.

---

## File Map

### Existing files to modify

- `server/controllers/propertyController.js` — opt into bounded dashboard-registry query normalization and safe post-authority projection.
- `client/lib/services/propertyService.js` — add the normalized administrative list contract with explicit platform/tenant request configuration.
- `client/lib/pages/dashboard/ManagePropertiesPage.jsx` — delegate `readOnly` `/dashboard/properties` rendering to the focused dual-scope registry while preserving existing management modes.
- `client/lib/__tests__/ManagePropertiesPage.test.jsx` — adapt existing read-only expectations to the registry boundary without weakening sales/rentals coverage.
- `client/lib/__tests__/ManagePropertiesPageTenantSwitch.test.jsx` — preserve existing tenant management transition tests and remove obsolete expectations that platform mode must block the read-only route.

### Files to create

- `server/services/propertyRegistryQueryService.js` — validate page/limit/filter/sort inputs and project safe owner/tenant display metadata.
- `server/__tests__/platformAdminGlobalProperties.mongo.integration.test.js` — PA-03 authority, population, isolation, query, pagination, and projection integration suite.
- `client/lib/pages/dashboard/PropertyRegistry.jsx` — read-only platform/tenant registry, server controls, UX states, and stale-response protection.
- `client/lib/__tests__/propertyRegistryService.test.js` — service request/response contract and `platformScoped` behavior.
- `client/lib/__tests__/PropertyRegistry.test.jsx` — dual-context UI, transitions, UX states, pagination, and absence of mutation controls.

## Task 1: Bounded Administrative Query Contract

**Files:**

- Create: `server/services/propertyRegistryQueryService.js`
- Create: `server/__tests__/platformAdminGlobalProperties.mongo.integration.test.js`
- Modify: `server/controllers/propertyController.js:461-580`

**Interfaces:**

- Consumes: existing `runPropertySearch({ query, isAdmin, tenantId })` and `GET /api/properties` authority chain.
- Produces: `normalizePropertyRegistryQuery(rawQuery) -> { query, page, limit, sortKey }`; controller response metadata `{ page, limit, total, totalPages }` when `dashboardRegistry=1`.

- [ ] **Step 1: RED — add authority and population fixtures**

  Add literal fixtures for Tenant A properties A1/A2, Tenant B property B1, and independent property U1 with `tenant:null`. Add users for an active properties reader, wrong-capability operator, inactive operator, legacy Admin, Tenant A Admin, and Tenant B Admin.

  Tests must assert:

  - the active reader receives A1, A2, B1, and U1 exactly once;
  - wrong capability, inactive operator, and legacy Admin receive 403 globally;
  - Tenant A Admin receives only A1/A2;
  - Tenant B Admin receives only B1;
  - neither tenant receives U1;
  - Tenant Admin without PlatformOperator and without a selected tenant is denied global access.

- [ ] **Step 2: Run the authority/population tests and verify RED**

  Run: `cd server && npx jest --runInBand __tests__/platformAdminGlobalProperties.mongo.integration.test.js`

  Expected: existing PA-01 authority/population assertions may pass, but the new `dashboardRegistry` pagination metadata and validation assertions fail because the contract does not exist yet. Record which security cases are already satisfied by PA-01 rather than rewriting them.

- [ ] **Step 3: RED — add pagination, search, filter, and sort tests**

  Add tests with hand-derived expectations:

  - `page=2&limit=2` returns the expected two IDs, `total=4`, `page=2`, `limit=2`, `totalPages=2`;
  - `search=Indépendante` returns only U1;
  - `offerType=vente`, `propertyType=Villa`, and `city=Brazzaville` are applied before count/pagination;
  - `sort=newest|oldest|title|priceAsc|priceDesc|status` produces literal orderings;
  - invalid sort returns 400;
  - page zero/non-numeric and limit 101 return 400;
  - `tenant` supplied as a query parameter cannot override the server scope.

- [ ] **Step 4: Implement `normalizePropertyRegistryQuery(rawQuery)`**

  In `propertyRegistryQueryService.js`, accept only page 1+, limit 1–100, existing safe search/filter fields, and the six named sort keys. Translate sort keys to fixed Mongoose sort strings; remove `dashboardRegistry` from the query forwarded to `APIFeatures`; throw a typed 400 error for invalid paging or sort.

- [ ] **Step 5: Integrate normalization without changing PA-01 middleware**

  In `getAllProperties`, enable normalization only when `req.query.dashboardRegistry === '1'` and the request has an authenticated administrative context already resolved by existing middleware. Pass the normalized query into `runPropertySearch`; return metadata alongside the existing `data.properties` and `data.total`. Preserve the legacy/public response and behavior when the flag is absent.

- [ ] **Step 6: Run Task 1 tests and verify GREEN**

  Run: `cd server && npx jest --runInBand __tests__/platformAdminGlobalProperties.mongo.integration.test.js`

  Expected: all authority, population, pagination, search, filter, sort, invalid-query, and query-tenant-injection tests pass.

- [ ] **Step 7: REFACTOR**

  Remove duplicated parsing from the controller, keep normalization in the service, and rerun the Task 1 suite. Do not generalize or alter `APIFeatures` globally.

- [ ] **Step 8: Checkpoint without commit**

  Run `git diff --check` and record Task 1 files and test result in the local execution ledger. Do not stage or commit.

## Task 2: Safe Owner and Tenant Projection

**Files:**

- Modify: `server/services/propertyRegistryQueryService.js`
- Modify: `server/controllers/propertyController.js:553-580`
- Modify: `server/__tests__/platformAdminGlobalProperties.mongo.integration.test.js`

**Interfaces:**

- Consumes: Task 1 normalized result rows after authority and tenant filtering.
- Produces: `projectPropertyRegistryRows(properties) -> PropertyRegistryRow[]`, enriching only `{ owner: {_id,name}|null, tenant: {_id,name,status}|null }` while preserving safe property fields.

- [ ] **Step 1: RED — add projection and non-exposure tests**

  Assert A1 contains literal owner `_id`/name and Tenant A `_id`/name; U1 contains its owner and `tenant:null`. Assert a property whose referenced display document is missing remains in the response with a null fallback. Recursively assert no password, password-reset data, verification token, JWT, refresh token, tokenVersion, pushToken, operator capability, or secret field is returned.

- [ ] **Step 2: Run projection tests and verify RED**

  Run the PA-03 backend suite. Expected: owner and tenant are raw IDs or absent, so display-projection assertions fail.

- [ ] **Step 3: Implement batch safe projection**

  Implement `projectPropertyRegistryRows(properties)` with at most one batch User query and one batch PlatformTenant query for the returned page. Project only `_id name` for owner and `_id name status` for tenant. Do not feed projected values back into filtering or authority decisions.

- [ ] **Step 4: Integrate projection after scoped search**

  Apply projection only to authenticated `dashboardRegistry=1` responses after `runPropertySearch` has completed. Preserve raw/public list behavior for every other caller.

- [ ] **Step 5: Run Task 2 tests and verify GREEN**

  Run the PA-03 backend suite. Expected: all tests pass and no sensitive field is present.

- [ ] **Step 6: REFACTOR**

  Confirm deduplicated IDs and stable row order, then rerun the suite. Do not introduce per-property queries.

- [ ] **Step 7: Checkpoint without commit**

  Run `git diff --check`; do not stage or commit.

## Task 3: Frontend Service Scope Contract

**Files:**

- Create: `client/lib/__tests__/propertyRegistryService.test.js`
- Modify: `client/lib/services/propertyService.js`

**Interfaces:**

- Consumes: Task 1 response `{ data: { properties, total, page, limit, totalPages } }`.
- Produces: `listPropertyRegistry(params, { platformScoped = false } = {}) -> Promise<{ items, page, limit, total, totalPages }>`.

- [ ] **Step 1: RED — test the platform request contract**

  Assert `listPropertyRegistry({ page: 2, limit: 20, search: 'villa', offerType: 'vente', sort: 'newest' }, { platformScoped: true })` calls `/properties` with `dashboardRegistry: '1'`, the literal supported parameters, and Axios `platformScoped:true`. Assert `platformScoped` is not serialized into query parameters.

- [ ] **Step 2: RED — test the tenant request contract**

  Assert the same function with `{ platformScoped:false }` omits the `platformScoped` config property entirely, allowing the canonical Axios interceptor to attach the validated tenant header. Assert unsupported keys and caller-supplied `tenant`/`tenantId` are dropped.

- [ ] **Step 3: RED — test response normalization and error propagation**

  Assert the function returns literal `{items,page,limit,total,totalPages}` from the backend and rejects rather than converting 403/500 into an empty list.

- [ ] **Step 4: Run service tests and verify RED**

  Run: `cd client && npx vitest run lib/__tests__/propertyRegistryService.test.js`

  Expected: FAIL because `listPropertyRegistry` is not exported.

- [ ] **Step 5: Implement `listPropertyRegistry`**

  Add an allowlist for `page`, `limit`, `search`, `offerType`, `propertyType`, `city`, `arrondissement`, and `sort`. Always add `dashboardRegistry:'1'`; use `{ params, platformScoped:true }` only for platform mode and `{ params }` for tenant mode. Keep `getAllProperties` unchanged for existing consumers.

- [ ] **Step 6: Run service tests and verify GREEN**

  Run the service test file. Expected: all platform, tenant, sanitization, normalization, and error tests pass.

- [ ] **Step 7: REFACTOR**

  Keep query construction declarative and reuse no public-search helper that would alter legacy semantics. Rerun the service suite.

- [ ] **Step 8: Checkpoint without commit**

  Run `git diff --check`; do not stage or commit.

## Task 4: Dual-Scope Read-Only Registry and Context Transitions

**Files:**

- Create: `client/lib/pages/dashboard/PropertyRegistry.jsx`
- Create: `client/lib/__tests__/PropertyRegistry.test.jsx`
- Modify: `client/lib/pages/dashboard/ManagePropertiesPage.jsx:34-70,620-650`
- Modify: `client/lib/__tests__/ManagePropertiesPage.test.jsx`
- Modify: `client/lib/__tests__/ManagePropertiesPageTenantSwitch.test.jsx`

**Interfaces:**

- Consumes: `usePlatformTenantRuntime()` fields `tenantLoading`, `selectedTenantId`, `selectedTenant`, and `can`; Task 3 `listPropertyRegistry`.
- Produces: `<PropertyRegistry />`, rendered immediately by `ManagePropertiesPage` when `readOnly === true`; all non-read-only modes continue through the existing component unchanged.

- [ ] **Step 1: RED — authorized platform and forbidden platform tests**

  Test an active runtime where `selectedTenantId=null` and `can('platform.properties.read')` is true. Assert global rows A1, B1, and U1 render, the heading identifies platform scope, U1 displays `Aucune organisation`, and the tenant-selection blocker is absent. In a separate runtime with `can` false, assert an explicit forbidden state, zero list requests, and no stale rows.

- [ ] **Step 2: RED — tenant A and Tenant B tests**

  With selected Tenant A, assert only A1/A2 fixtures render and the visible context names Tenant A. With Tenant B, assert only B1 renders. The component must call the service in tenant mode and never locally merge or filter cross-tenant data.

- [ ] **Step 3: RED — bidirectional context-transition tests**

  Using complete runtime fixtures and deferred service promises, assert:

  - Tenant A → platform clears A rows immediately, then calls with `{platformScoped:true}` and renders A/B/U only from the global response;
  - platform → Tenant B clears global rows immediately, then calls without platform scope and renders B1 only;
  - a late Tenant A response after the platform response cannot overwrite global rows;
  - a late platform response after Tenant B cannot overwrite B1;
  - a runtime capability loss in platform mode purges rows and renders forbidden without another request.

- [ ] **Step 4: RED — server-control and UX-state tests**

  Assert observable behavior for:

  - loading indicator while unresolved;
  - successful empty state;
  - distinct no-search-result state;
  - API error state rather than zero results;
  - 403 forbidden state;
  - debounced search resets page to 1 and issues a server request;
  - offer type/property type/city filters reset page to 1 and issue server requests;
  - sort issues the named server sort key;
  - previous/next buttons use server `page`/`totalPages`;
  - no create/edit/delete/approve/reject/recommend/manage control exists, even when `can('platform.properties.manage')` is also true.

- [ ] **Step 5: Run UI tests and verify RED**

  Run: `cd client && npx vitest run lib/__tests__/PropertyRegistry.test.jsx lib/__tests__/ManagePropertiesPage.test.jsx lib/__tests__/ManagePropertiesPageTenantSwitch.test.jsx`

  Expected: new registry tests fail because the component and delegation do not exist; existing tenant management tests remain green except assertions intentionally superseded for `readOnly` platform mode.

- [ ] **Step 6: Implement `PropertyRegistry` scope state machine**

  Use an incrementing request sequence plus effect cleanup. Derive `platformMode = !selectedTenantId`, `canReadPlatform`, and a scope key. On scope/query change, increment the sequence, clear rows/error immediately, and request through Task 3 with `platformScoped:platformMode`. Commit a response only when its sequence remains current.

- [ ] **Step 7: Implement server-backed controls and read-only presentation**

  Render the approved platform/tenant indicators, safe property fields, organization fallback, debounced search, real filters, named sort options, and server pagination. Do not compute global statistics from current-page rows; display only the reliable total.

- [ ] **Step 8: Delegate the read-only route in `ManagePropertiesPage`**

  Return `<PropertyRegistry />` for `readOnly === true` before the legacy tenant-only management effects execute. Leave `/dashboard/sales`, `/dashboard/rentals`, creation forms, portfolio dashboard, and existing mutation flows untouched.

- [ ] **Step 9: Run Task 4 tests and verify GREEN**

  Run the three targeted frontend files. Expected: all registry, transition, read-only, and existing sales/rentals tests pass.

- [ ] **Step 10: REFACTOR**

  Extract only small presentational helpers within `PropertyRegistry.jsx` if necessary; keep request ownership in one component. Rerun targeted tests.

- [ ] **Step 11: Checkpoint without commit**

  Run `git diff --check`; do not stage or commit.

## Task 5: Security and Compatibility Regression

**Files:**

- Modify only if a witnessed regression is in PA-03 scope and a new RED test demonstrates it.

**Interfaces:**

- Consumes: completed Tasks 1–4.
- Produces: regression evidence for PA-01, PA-02, tenant members, and legacy property consumers.

- [ ] **Step 1: Run PA-03 backend with PA-01 property authority**

  Run:

  `cd server && npx jest --runInBand __tests__/platformAdminGlobalProperties.mongo.integration.test.js __tests__/platformAdminAuthorityHardening.mongo.integration.test.js __tests__/platformPropertyAdministration.mongo.integration.test.js __tests__/platformAuthorityTenantIsolation.mongo.integration.test.js`

  Expected: global read/manage separation, wrong capability, inactive operator, legacy Admin, tenant isolation, and `tenant:null` all pass.

- [ ] **Step 2: Run PA-02 and tenant-member regressions**

  Run:

  `cd server && npx jest --runInBand __tests__/platformAdminGlobalUsers.mongo.integration.test.js __tests__/tenantMemberApi.mongo.integration.test.js __tests__/tenantMemberLastAdminDistributed.mongo.integration.test.js __tests__/reporting.mongo.integration.test.js`

  Expected: global users, tenant members, last tenant Admin, reporting, and last PlatformOperator-related PA-01 coverage pass.

- [ ] **Step 3: Run legacy property unit regressions**

  Run:

  `cd server && npx jest --runInBand __tests__/propertyRoutes.test.js`

  Expected: public, owner, tenant staff, property filtering, and route contracts remain green.

- [ ] **Step 4: Run frontend targeted regressions**

  Run:

  `cd client && npx vitest run lib/__tests__/propertyRegistryService.test.js lib/__tests__/PropertyRegistry.test.jsx lib/__tests__/ManagePropertiesPage.test.jsx lib/__tests__/ManagePropertiesPageTenantSwitch.test.jsx lib/__tests__/GlobalUsersPanel.test.jsx lib/__tests__/PlatformTenantRuntime.test.jsx lib/__tests__/MembersPanel.test.jsx`

  Expected: PA-03 and PA-02 frontend suites pass together.

- [ ] **Step 5: Diagnose any failure before changing code**

  Use the systematic-debugging workflow. Never weaken a security assertion or reinterpret an infrastructure timeout as PASS.

- [ ] **Step 6: Checkpoint without commit**

  Record exact suite/test/pass/fail/skip counts. Do not stage or commit.

## Task 6: Full Verification and Final Report Evidence

**Files:**

- Modify only for in-scope failures proven through a new RED test.
- Final report is returned in the assistant response only.

**Interfaces:**

- Consumes: completed implementation and regression evidence.
- Produces: `PLATFORM_ADMIN_03_GLOBAL_PROPERTIES_REPORT` with the brief’s 24 sections and verdict A/B/C.

- [ ] **Step 1: Run complete backend unit tests**

  Run: `cd server && NODE_OPTIONS=--max-old-space-size=8192 npm run test:unit -- --runInBand`

  Record exact suites, tests, failures, skips, duration, and any retry. Do not claim the full Mongo suite was run unless it actually was.

- [ ] **Step 2: Run complete frontend tests**

  Run: `cd client && npm test -- --run`

  Record exact files, tests, failures, skips, and duration.

- [ ] **Step 3: Run static and build gates**

  Run:

  - `cd server && npm run lint -- --quiet`
  - `cd client && npm run lint`
  - `cd client && npm run build:next`
  - `npm run certify:architecture`
  - `git diff --check`

  Expected: zero errors, successful Next production build, no new architecture violation, and clean diff whitespace. Existing warnings must be reported accurately.

- [ ] **Step 4: Audit final request-scope behavior**

  Review the final code and test evidence for these concrete mutations: removing `platformScoped:true`, leaving it enabled in tenant mode, accepting a caller tenant query, committing a stale response, treating `tenant:null` as selected tenant, or showing a manage button. At least one test must fail for each mutation.

- [ ] **Step 5: Inventory the worktree**

  Run `git status --short`, `git diff --stat`, `git diff --cached --name-only`, and `git diff --check`. Separate pre-existing changes from PA-03 files and confirm no staged files, mobile changes, remote changes, commits, or deployment actions were introduced by PA-03.

- [ ] **Step 6: Produce the exact final report and stop**

  Fill all 24 sections from the brief, report full Mongo as `NOT_RUN` if not executed, use only verdict A/B/C, state `COMMIT=NO`, `PUSH=NO`, `DEPLOY=NO`, then stop before any later sprint.

## TDD Execution Order

For every task, preserve this exact order:

1. RED — add one observable failing behavior.
2. Run the narrowest relevant command and confirm the expected failure.
3. GREEN — implement only enough production behavior to satisfy it.
4. Rerun the narrow test and its nearest regression suite.
5. REFACTOR — remove duplication without adding behavior.
6. Rerun the same tests.
7. Record a no-commit checkpoint and continue.

No production implementation begins until this plan is approved.
