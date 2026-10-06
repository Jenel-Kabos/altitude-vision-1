# PLATFORM-ADMIN-04B Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish explicit PLATFORM/TENANT/UNRESOLVED administration scope and migrate Dashboard Home, Properties, Sales, and Rentals to it without weakening authority or provenance.

**Architecture:** Derive a request scope from existing PA-04A tenant-context sources, expose an equivalent Web runtime scope, then make Core consumers choose their certified server contract by scope. Keep exact domain capabilities and tenant resource attribution as the authorization layer.

**Tech Stack:** Express, Mongoose, Jest/Supertest, Next.js 15, React 18, Axios, Vitest, Testing Library, Expo/Jest.

**Spec:** `docs/superpowers/specs/2026-10-02-platform-admin-04b-core-design.md`

## Global Constraints

- Preserve all dirty-worktree changes and PA-04B0 byte-for-byte outside deliberate overlapping hunks.
- No commit, push, deploy, remote mutation, EAS, or Google Play action.
- Never infer platform scope from missing tenant alone or from client-supplied mode/query/body.
- Preserve PA-04A eligibility and specialized partial-operator workflows.
- Preserve Property tenant provenance and exclude `tenant:null` from tenant scope.
- Do not migrate non-Core domains or add a mobile platform-admin UI.

## Review Focus

- An eligible operator with an invalid tenant header must be unresolved, never silently global.
- A partial operator without a tenant must retain specialized routes but never access Core platform routes.
- A stale platform response must not overwrite Tenant B after a fast context switch, and vice versa.
- A global Property mutation must preserve both a non-null tenant and `tenant:null` provenance.
- Property cockpit ID reads must not use owner membership as a substitute for exact Property tenant attribution.

---

### Task 1: Explicit backend administration scope

**Files:**
- Create: `server/services/administrationScopeService.js`
- Modify: `server/middleware/tenantContext.js`
- Test: `server/__tests__/platformAdministrationScope.test.js`
- Test: `server/__tests__/platformAdministrationScope.mongo.integration.test.js`

**Interfaces:**
- Produces: `deriveAdministrationScope(req) -> {mode, tenantId, source}`; `requireResolvedAdministrationScope`; `propertyScopeFilter`; `assertPropertyInAdministrationScope`.

- [ ] RED: test platform source, tenant selection, forbidden/ambiguous/missing/invalid selection, forged flags, partial operator, inactive operator, legacy Admin, and specialized workflow non-interference.
- [ ] Run the narrow unit/Mongo tests and confirm expected failures.
- [ ] GREEN: attach immutable `req.adminScope` only after canonical context resolution; implement Core Property helpers.
- [ ] Rerun targeted scope and PA-04A eligibility tests.
- [ ] REFACTOR without changing PA-04A authority primitives; rerun.

### Task 2: Canonical Home contracts

**Files:**
- Modify: `server/routes/dashboardRoutes.js`
- Modify: `server/services/dashboardKpiQueryService.js`
- Modify: `client/lib/services/dashboardService.js`
- Modify: `client/lib/pages/dashboard/DashboardHome.jsx`
- Test: relevant dashboard route/service and `DashboardHome` tests.

**Interfaces:**
- Consumes: Task 1 `req.adminScope`.
- Produces: tenant `/api/dashboard/stats`; platform `/api/admin/stats`; Web `getDashboardStats({scope})`.

- [ ] RED: prove PLATFORM global server stats, Tenant A-only stats, unresolved refusal, partial-operator refusal, and forged scope failure.
- [ ] RED: prove Home sends `platformScoped:true` only for platform, no request for unresolved, and ignores stale responses.
- [ ] GREEN: route/service Home through certified server endpoints and scope-key request ownership.
- [ ] Rerun Home, reporting, dashboard, eligibility, and transition suites.
- [ ] REFACTOR secondary platform widgets to omit uncertified calls rather than aggregate client-side.

### Task 3: Explicit Web runtime and route requirements

**Files:**
- Modify: `client/lib/context/PlatformTenantRuntimeContext.jsx`
- Modify: `client/lib/navigation/dashboardRouteScope.js`
- Modify: `client/app/dashboard/layout.jsx`
- Modify: `client/lib/components/dashboard/PlatformOperatorContextSwitcher.jsx` if required by observed import path.
- Test: `client/lib/__tests__/PlatformTenantRuntime.test.jsx`
- Test: dashboard layout/route-scope tests.

**Interfaces:**
- Produces: `scope = {mode:'platform'|'tenant'|'unresolved', tenantId, key}` and branch-aware route requirements.

- [ ] RED: test full operator platform, selected Tenant A/B, partial/inactive/legacy/ambiguous unresolved, and runtime capability loss.
- [ ] RED: test layout allows Core platform/tenant and blocks only unresolved while specialized routes remain independent.
- [ ] GREEN: expose scope with compatibility fields; migrate layout and Core route declarations.
- [ ] Rerun switcher, runtime, layout, and PA-04A frontend tests.
- [ ] REFACTOR duplicated `!selectedTenantId` decisions out of Core consumers.

### Task 4: Rich scoped Properties/Sales/Rentals reads

**Files:**
- Modify: `client/lib/pages/dashboard/PropertyRegistry.jsx`
- Modify: `client/lib/pages/dashboard/ManagePropertiesPage.jsx`
- Modify: `client/lib/services/propertyService.js`
- Modify/Create: focused reusable Property presentation component if extraction is required.
- Modify: PA-03 and ManageProperties frontend tests.
- Modify: `server/services/propertyRegistryQueryService.js` and controller only if safe fields/filters are missing.

**Interfaces:**
- Consumes: Task 3 scope; PA-03 paginated registry.
- Produces: one rich scoped domain with optional fixed offer type for Sales/Rentals.

- [ ] RED: platform A/B/null, tenant A/B isolation, unresolved no request, server filters/pagination, images/status/owner/organization/cockpit presentation.
- [ ] RED: four bidirectional transitions plus delayed response and capability-loss cases.
- [ ] GREEN: adapt the registry to rich shared presentation and route filters; never restore global client-side loading.
- [ ] Rerun PA-03 backend/frontend and legacy Sales/Rentals tests.
- [ ] REFACTOR shared presentation without duplicating platform and tenant applications.

### Task 5: Property manage and cockpit scope

**Files:**
- Modify: `server/routes/propertyRoutes.js`, `server/controllers/propertyController.js` only in PA-04B0-safe hunks.
- Modify: `server/routes/propertyAssetRoutes.js`, `server/controllers/propertyAssetController.js` and focused service helpers.
- Modify: Web Property actions/cockpit services and components required by Core.
- Test: new global Property manage and Property Asset adversarial Mongo suites.
- Test: `server/__tests__/propertyTenantProvenance.mongo.integration.test.js`.

**Interfaces:**
- Consumes: Task 1 scope assertions.
- Produces: exact-capability global mutations and exact-resource-scope cockpit reads.

- [ ] RED: read-without-manage denial; manage success across Tenant A/B/null; tenant A→B/null denial; unresolved denial; forged header/query/body/mode denial.
- [ ] RED: assert tenant provenance before/after every allowed mutation and PA-04B0 attempts.
- [ ] RED: cockpit platform read, tenant exact read, tenant cross/null denial, owner-fallback denial.
- [ ] GREEN: globalize only existing well-defined Property operations; defer platform creation and generic deletion if contract is ambiguous.
- [ ] Rerun PA-04B0, PA-01/03/04A, property routes, asset, tenant isolation, accommodation/hotel regressions.
- [ ] REFACTOR shared resource loading so authority precedes mutation and provenance never comes from payload/header.

### Task 6: Transport, mobile compatibility, and full certification

**Files:**
- Modify only if a witnessed Core regression requires a TDD fix.
- Tests: Core socket characterization, Web full, mobile relevant/full, backend unit/Mongo.

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: final evidence and remaining-domain inventory.

- [ ] Characterize Core Socket.IO consumers on context change; migrate only if a stale Core socket is demonstrated.
- [ ] Run targeted PA-01/03/04A, PA-04B0, partial workflow, Tenant A/B/null, forged-scope, Home, Properties, Sales/Rentals suites.
- [ ] Run full backend unit and affected Mongo suites; run full Mongo if reasonably executable, otherwise report exact omission.
- [ ] Run full Web and mobile suites, backend/frontend lint, Next isolated build, architecture certification, and `git diff --check`.
- [ ] Inventory exact pre-existing/PA-04B0/Core hunks and verify hashes for untouched parallel files.
- [ ] Answer the ten-question gate from evidence; report READY only if all ten are YES.
