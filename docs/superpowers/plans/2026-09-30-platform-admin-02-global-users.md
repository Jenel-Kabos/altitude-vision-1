# PLATFORM-ADMIN-02 Global Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure, paginated platform-wide User registry at `/dashboard/users`, including membership context and protected lifecycle actions without conflating Users and tenant memberships.

**Architecture:** Keep `/api/users` as the canonical global resource and move query composition/projection into a focused service. Enrich paginated unique User rows through bounded batch queries for memberships, tenants, and PlatformOperators. Rebuild the existing `UsersPanel` around an explicitly platform-scoped service contract while leaving `MembersPanel` and `/api/members` independent.

**Tech Stack:** Node.js, Express, Mongoose/MongoDB transactions, Jest/Supertest, React 18, Next.js 15, Axios, Tailwind CSS, Testing Library/Vitest.

**Spec:** `docs/superpowers/specs/2026-09-30-platform-admin-02-global-users-design.md`

## Global Constraints

- Platform reads require active `PlatformOperator` plus exact `platform.users.read`; mutations require exact `platform.users.manage`.
- `User.role === "Admin"` and `OrgMembership.businessRole === "Admin"` never imply platform authority.
- `User` and `OrgMembership` remain separate; Global Users never creates or mutates memberships.
- Preserve users with no tenant and return one row for multi-tenant users.
- Use explicit safe projections and never return authentication secrets or `tokenVersion`.
- Reuse PLATFORM-ADMIN-01 self-action, hard-delete, and last viable operator protections.
- Global frontend calls use `{ platformScoped: true }` and do not depend on `selectedTenantId`.
- No new ban/unban semantics, production index migration, mobile changes, or PLATFORM-ADMIN-03/04 work.
- Preserve all pre-existing worktree changes.
- No commit, push, tag, deploy, EAS operation, Google Cloud mutation, or remote/production data mutation.
- Finish with the exact 27-section `PLATFORM_ADMIN_02_GLOBAL_USERS_REPORT` and `STOP`.

## Review Focus

- A regex-like search string (`.*`, brackets, backslashes) is escaped and treated as text rather than a Mongo expression; Task 1 tests this.
- A requested page beyond `totalPages` returns an empty `items` array with stable metadata rather than failing or repeating the last page; Task 1 tests this.
- Membership rows whose organization cannot resolve are represented safely without crashing or leaking internal identifiers; Task 1 tests this.
- A successful lifecycle mutation on the final item of a page triggers a bounded reload and cannot leave impossible pagination state; Task 5 tests this.
- A delayed search response cannot overwrite a later query’s results; Task 4 tests stale-response handling.

---

### Task 1: Global User Query Contract and Safe Projection

**Files:**
- Create: `server/services/globalUserAdministrationService.js`
- Create: `server/__tests__/platformAdminGlobalUsers.mongo.integration.test.js`
- Modify: `server/controllers/userController.js`
- Modify: `server/routes/userRoutes.js`

**Interfaces:**
- Consumes: `requireUsersReadScope`, `User`, `OrgMembership`, `OrgUnit`, `PlatformTenant`, `PlatformOperator`.
- Produces: `listGlobalUsers(query) -> { items, page, limit, total, totalPages, stats }`, `getGlobalUserDetail(userId) -> projectedUser`, and the paginated `GET /api/users` contract.

- [ ] **Step 1: Write failing Mongo integration tests for the registry populations**

Add tests proving an authorized reader receives tenant A, tenant B, unaffiliated, suspended, multi-tenant, and operator identities; the multi-tenant identity occurs once with two memberships; the unaffiliated identity has `memberships: []` and `tenantCount: 0`.

- [ ] **Step 2: Run the new backend suite and verify RED**

Run: `cd server && npx jest --runInBand __tests__/platformAdminGlobalUsers.mongo.integration.test.js`

Expected: FAIL because the response is the legacy unpaginated User array and has no membership/operator projection.

- [ ] **Step 3: Write failing tests for pagination, search, filters, and sorting**

Cover bounded `page`/`limit`, out-of-range pages, literal escaped search across `name`/`email`/`telephone`, `status`, `active`, `role`, `organization`, `tenantId`, `operator`, and accepted/rejected sort values. Assert totals after filtering.

- [ ] **Step 4: Write failing tests for safe serialization and unresolved organization data**

Assert list and detail responses omit password, reset/verification tokens, refresh tokens, `tokenVersion`, 2FA secrets, credentials, and unknown schema fields. Assert an unresolved organization reference yields a safe membership label/state without a 500.

- [ ] **Step 5: Implement `globalUserAdministrationService`**

Implement allowlisted query parsing, escaped text search, whitelisted sort mapping, ID validation, bounded pagination, unique User query, batch membership/org/tenant/operator loading, stable grouping, statistics, and allowlisted output serialization. Do not add indexes.

- [ ] **Step 6: Adapt list and detail controllers**

Use the service only for global platform context. Preserve the existing tenant-scoped behavior for compatibility, but never let an invalid tenant context fall through to the global branch. Return the new data contract for global reads and enriched detail for authorized global reads.

- [ ] **Step 7: Run the Task 1 suite and verify GREEN**

Run: `cd server && npx jest --runInBand __tests__/platformAdminGlobalUsers.mongo.integration.test.js`

Expected: all Task 1 tests PASS.

- [ ] **Step 8: Record Task 1 completion without committing**

Update the execution ledger with changed files and RED/GREEN evidence. Do not stage or commit.

### Task 2: Global Authority and Lifecycle Invariants

**Files:**
- Modify: `server/__tests__/platformAdminGlobalUsers.mongo.integration.test.js`
- Modify: `server/controllers/userController.js`
- Modify: `server/routes/userRoutes.js`
- Reuse unchanged where possible: `server/services/platformOperator/platformOperatorService.js`

**Interfaces:**
- Consumes: Task 1 list/detail contract and PLATFORM-ADMIN-01 `guardUserViabilityMutation`, `assertNoPlatformOperatorForHardDelete`, and operator transitions.
- Produces: exact read/manage enforcement and secure suspend/activate/delete behavior for Global Users.

- [ ] **Step 1: Write failing authority matrix tests**

Assert read PASS for active `platform.users.read`; mutation PASS only for `platform.users.manage`; read-only mutation REFUS; wrong capability REFUS; inactive operator REFUS; legacy `User.role=Admin` REFUS; tenant Admin without operator REFUS; invalid explicit tenant context REFUS with no global fallback.

- [ ] **Step 2: Run authority cases and verify RED where behavior is incomplete**

Run the named authority tests from `platformAdminGlobalUsers.mongo.integration.test.js` with `--runInBand`.

Expected: at least one FAIL for incomplete Global Users behavior, while already-correct PLATFORM-ADMIN-01 guards remain green.

- [ ] **Step 3: Write failing lifecycle invariant tests**

Cover self-delete refusal, self-suspend refusal according to the canonical operator contract, final viable operator suspension refusal, one-of-two viable operator suspension success, ordinary-user reactivation without membership changes, and operator-history hard-delete refusal with the exact error code.

- [ ] **Step 4: Implement minimal controller/route corrections**

Remove any lifecycle decision based solely on historical `User.role === "Admin"`; rely on authenticated actor identity, exact capability, and PLATFORM-ADMIN-01 transactional viability guards. Preserve ordinary-account deletion semantics and membership rows unchanged.

- [ ] **Step 5: Run the full Global Users backend suite and verify GREEN**

Run: `cd server && npx jest --runInBand __tests__/platformAdminGlobalUsers.mongo.integration.test.js`

Expected: all tests PASS.

- [ ] **Step 6: Record Task 2 completion without committing**

Update the execution ledger with authority and lifecycle RED/GREEN evidence. Do not stage or commit.

### Task 3: Platform-Scoped Frontend Service and Runtime Authority

**Files:**
- Modify: `client/lib/services/userService.js`
- Modify: `client/lib/context/PlatformTenantRuntimeContext.jsx`
- Create: `client/lib/__tests__/globalUserService.test.js`
- Modify or create focused runtime test in: `client/lib/__tests__/PlatformTenantRuntime.test.jsx`

**Interfaces:**
- Consumes: Task 1 API response and existing Axios `platformScoped` option.
- Produces: `listGlobalUsers(params)`, `getGlobalUser(id)`, `suspendGlobalUser(id)`, `activateGlobalUser(id)`, `deleteGlobalUser(id)`, plus role-independent PlatformOperator runtime discovery.

- [ ] **Step 1: Write failing service contract tests**

Assert every global list/detail/mutation call uses `{ platformScoped: true }`, forwards only supported query parameters, returns pagination metadata, and rejects API errors rather than converting them to `[]`.

- [ ] **Step 2: Write failing runtime authority test**

Assert an authenticated non-Admin historical role still calls `getMyOperatorStatus`, retains an active operator, and resolves `can('platform.users.read')` from exact operator capabilities.

- [ ] **Step 3: Run focused frontend tests and verify RED**

Run: `cd client && npx vitest run lib/__tests__/globalUserService.test.js lib/__tests__/PlatformTenantRuntime.test.jsx`

Expected: FAIL because current `getAllUsers` suppresses errors and runtime operator discovery is gated by `globalRole === 'Admin'`.

- [ ] **Step 4: Implement the service and runtime corrections**

Add the exact exported functions, preserve unrelated legacy exports for existing consumers, remove the historical-role precondition from operator discovery, and keep capability evaluation fail-closed.

- [ ] **Step 5: Run focused frontend tests and verify GREEN**

Run the Task 3 command again. Expected: all tests PASS.

- [ ] **Step 6: Record Task 3 completion without committing**

Update the execution ledger. Do not stage or commit.

### Task 4: Read-Only Global Users Registry UI

**Files:**
- Modify: `client/app/dashboard/users/page.jsx`
- Rewrite within existing file: `client/lib/pages/dashboard/UsersPanel.jsx`
- Create: `client/lib/__tests__/GlobalUsersPanel.test.jsx`
- Modify: `client/lib/__tests__/MembersPanelNoLegacyUsersImport.test.jsx`

**Interfaces:**
- Consumes: Task 3 `listGlobalUsers`, `getGlobalUser`, and `usePlatformTenantRuntime().can`.
- Produces: platform-only registry UI with query state, server pagination, filters, statistics, and detail dialog/drawer.

- [ ] **Step 1: Write failing route and initial-state tests**

Assert `/dashboard/users` renders `UsersPanel`, not `MembersPanel`; the title is “Utilisateurs de la plateforme”; loading uses non-zero placeholders; and error, forbidden, empty, and search-no-result states are distinct.

- [ ] **Step 2: Write failing population and detail tests**

Assert unaffiliated users show “Aucune organisation”, multi-tenant users render once with both memberships, suspended users show the real status, operator status is indicated, and opening a row displays identity/status/memberships without sensitive fields.

- [ ] **Step 3: Write failing query interaction tests**

Assert debounced search, supported filters, sort, and pagination issue server calls with the expected parameters; `selectedTenantId` changes do not enter the request; stale responses cannot replace newer results.

- [ ] **Step 4: Run the Global Users component tests and verify RED**

Run: `cd client && npx vitest run lib/__tests__/GlobalUsersPanel.test.jsx lib/__tests__/MembersPanelNoLegacyUsersImport.test.jsx`

Expected: FAIL because the route still renders `MembersPanel` and the legacy panel filters client-side.

- [ ] **Step 5: Implement the read-only registry**

Point the route to `UsersPanel`; simplify/rebuild the component around server state; reuse existing dashboard visual primitives; implement accessible table/cards, membership rendering, statistics, filters, pagination, detail UI, and explicit UX states. Exclude create, KYC, owner-contract, and direct membership mutations.

- [ ] **Step 6: Run the Task 4 tests and verify GREEN**

Run the Task 4 command again. Expected: all tests PASS.

- [ ] **Step 7: Run MembersPanel focused regression tests**

Run: `cd client && npx vitest run lib/__tests__/MembersPanel.test.jsx lib/__tests__/MembersPanelNoLegacyUsersImport.test.jsx`

Expected: tenant Members tests PASS after updating only the route-separation assertion.

- [ ] **Step 8: Record Task 4 completion without committing**

Update the execution ledger. Do not stage or commit.

### Task 5: Managed Actions, Confirmations, and Precise Errors

**Files:**
- Modify: `client/lib/pages/dashboard/UsersPanel.jsx`
- Modify: `client/lib/__tests__/GlobalUsersPanel.test.jsx`

**Interfaces:**
- Consumes: Task 3 mutation functions and Task 4 registry state.
- Produces: capability-aware suspend/reactivate/delete controls with confirmation and safe backend error mapping.

- [ ] **Step 1: Write failing capability visibility tests**

Assert `platform.users.read` without manage hides/disables every mutation; `platform.users.manage` exposes only supported actions; no ban/unban action appears without an established backend contract.

- [ ] **Step 2: Write failing confirmation tests**

Assert suspension requires explicit confirmation and deletion requires reinforced confirmation identifying the target; neither API call occurs on the first click or cancel.

- [ ] **Step 3: Write failing mutation-result tests**

Assert success refreshes the server page; deleting the last item of a non-first page requests the previous valid page; `LAST_PLATFORM_OPERATOR`, `PLATFORM_OPERATOR_HARD_DELETE_REQUIRES_HUMAN_DECISION`, and self-action codes render precise safe messages and keep the dialog usable.

- [ ] **Step 4: Run action tests and verify RED**

Run the matching Task 5 tests in `GlobalUsersPanel.test.jsx`.

Expected: FAIL because the rebuilt read-only registry has no mutation UI.

- [ ] **Step 5: Implement supported action UI**

Add capability-aware controls, accessible dialogs, pending-state duplicate prevention, exact safe error mapping, and bounded page reload logic. Do not perform optimistic membership changes.

- [ ] **Step 6: Run all Global Users frontend tests and verify GREEN**

Run: `cd client && npx vitest run lib/__tests__/GlobalUsersPanel.test.jsx lib/__tests__/globalUserService.test.js lib/__tests__/PlatformTenantRuntime.test.jsx`

Expected: all tests PASS.

- [ ] **Step 7: Record Task 5 completion without committing**

Update the execution ledger. Do not stage or commit.

### Task 6: Non-Regression, Static Checks, Build, and Report Evidence

**Files:**
- Modify only if a failing test reveals an in-scope regression, following a new RED test first.
- Produce final report in the assistant response only; do not create a release artifact unless requested.

**Interfaces:**
- Consumes: completed Tasks 1–5.
- Produces: verified PLATFORM-ADMIN-02 implementation and exact report evidence.

- [ ] **Step 1: Run tenant-membership backend regression**

Run focused tenant member API, cross-tenant, and last-admin suites discovered in `server/__tests__`, including `tenantMemberApi.mongo.integration.test.js` and `tenantMemberLastAdminDistributed.mongo.integration.test.js`.

Expected: PASS for own-tenant access, cross-tenant refusal, and last tenant Admin protection.

- [ ] **Step 2: Run PLATFORM-ADMIN-01 regression**

Run `platformAdminAuthorityHardening.mongo.integration.test.js` plus the targeted property, reporting, tenant-isolation, and `tenant:null` suites used in PLATFORM-ADMIN-01.

Expected: PASS.

- [ ] **Step 3: Run complete backend unit tests**

Run the repository’s server unit command with adequate Node heap if required. Record exact suites/tests/pass/fail/skip/duration and every infrastructure retry.

- [ ] **Step 4: Run frontend full tests when reasonably executable**

Run the client full test command. Do not convert timeouts or infrastructure failures into PASS; record exact outcomes.

- [ ] **Step 5: Run lint, build, architecture, and diff checks**

Run:

- `cd server && npm run lint -- --quiet`
- `cd client && npm run lint`
- `cd client && npm run build:next`
- `npm run certify:architecture`
- `git diff --check`

Expected: all PASS.

- [ ] **Step 6: Inspect final worktree classification**

Capture `git status --short`, `git diff --stat`, and separate pre-existing files from files changed or created by PLATFORM-ADMIN-02. Verify no staged files and no production/mobile scope expansion.

- [ ] **Step 7: Self-review security and report contract**

Review the final diff for unsafe projections, authority bypass, tenant-header leakage, membership mutations, N+1 behavior, destructive-action bypass, and accidental secret logging. Fill every field in the exact 27-section report, mark full Mongo `NOT_RUN` if not executed, give only verdict A/B/C/D/E, then `STOP`.

- [ ] **Step 8: Do not commit**

Leave all PLATFORM-ADMIN-02 changes unstaged and uncommitted as explicitly required.
