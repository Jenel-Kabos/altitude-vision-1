# PA-04C Hosting & Hotel Explicit Platform Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Accommodation and Hotel administration to the canonical explicit administration scope without changing provenance or weakening owner/mobile contracts.

**Architecture:** Extend the PA-04B scope helpers with strict Accommodation/Hotel resource filters and assertions, then migrate the two Web pages and their analytics transports to `scope.mode` and `scope.key`. Existing-resource mutations load the resource before capability/scope authorization; creation remains tenant-only.

**Tech Stack:** Node.js, Express, Mongoose, Jest/Supertest, Next.js/React, Axios, Vitest/Testing Library, React Native/Jest.

**Spec:** `docs/superpowers/specs/2026-10-02-platform-admin-04c-hosting-hotel-design.md`

## Global Constraints

- Preserve PA-01, PA-03, PA-04A, PA-04B0, PA-04B Core and PA-04B1 authority primitives.
- No commit, push, deploy or remote-data mutation during the requested implementation unless separately authorized.
- PLATFORM authority never changes resource provenance.
- PLATFORM creation is deferred; admin creation requires a resolved TENANT scope.
- Public, owner and mobile self-service contracts must not become global implicitly.
- Accommodation, Hotel and Property remain distinct entities.

## Review Focus

- A `tenant:null` resource with an owner belonging to Tenant A must remain invisible to Tenant A.
- A late PLATFORM response must not replace Tenant B data after a context switch.
- A partial operator with `.manage` but without full PLATFORM eligibility must not enter PLATFORM.
- A forged target tenant in body/query must not affect existing-resource attribution.
- Hotel→Accommodation synchronization must preserve tenant on all linked records.

---

### Task 1: Strict administration attribution helpers

**Files:**
- Modify: `server/services/administrationScopeService.js`
- Test: `server/__tests__/platformAdministrationScope.test.js`

**Interfaces:**
- Produces: `accommodationScopeFilter(scope)`, `hotelScopeFilter(scope)`, `assertAccommodationInAdministrationScope(resource, scope)`, `assertHotelInAdministrationScope(resource, scope)`.

- [ ] Write RED tests for PLATFORM, Tenant A/B, `tenant:null`, UNRESOLVED and owner/manager fallback rejection.
- [ ] Run the focused Jest suite and verify the new assertions fail.
- [ ] Implement direct-tenant-only filters/assertions using the existing immutable scope.
- [ ] Run the focused suite and verify PASS.
- [ ] Refactor duplicate direct-tenant comparison without generalizing to unrelated domains.

### Task 2: Accommodation admin reads and analytics

**Files:**
- Modify: `server/routes/accommodationRoutes.js`
- Modify: `server/controllers/accommodationController.js`
- Modify: `server/services/accommodationService.js`
- Modify: `server/controllers/dashboardAnalyticsController.js`
- Test: create `server/__tests__/platformAccommodationAdministration.mongo.integration.test.js`
- Test: modify `server/__tests__/accommodationAdminListsTenantScope.mongo.integration.test.js`

**Interfaces:**
- Consumes: Task 1 Accommodation filters/assertions.
- Produces: explicit PLATFORM/TENANT/UNRESOLVED list, pending and analytics behavior.

- [ ] Write RED integration cases for full reader, wrong capability, inactive operator, legacy Admin, tenant A/B/null and forged scope inputs.
- [ ] Add RED analytics cases proving tenant A cannot aggregate B or null.
- [ ] Run both suites and capture expected failures.
- [ ] Attach canonical scope on all admin read routes and enforce exact read capability in PLATFORM.
- [ ] Pass `adminScope` into list/analytics queries; remove missing-tenant-as-global inference.
- [ ] Run focused suites and verify PASS.
- [ ] Refactor server pagination/filter construction while preserving response shape.

### Task 3: Accommodation mutations and P1-5/P1-7 closure

**Files:**
- Modify: `server/routes/accommodationRoutes.js`
- Modify: `server/controllers/accommodationController.js`
- Modify: `server/services/accommodationService.js`
- Test: create `server/__tests__/platformAccommodationMutations.mongo.integration.test.js`
- Test: modify `server/__tests__/securityClosureP1WaveAccommodationUpdateFullTenantAuthority.mongo.integration.test.js`

**Interfaces:**
- Consumes: Task 1 strict resource assertion.
- Produces: resource-first update/moderation/archive authorization and tenant-only admin creation.

- [ ] Write RED tests for read-without-manage denial, manage A/B/null, tenant cross-scope denial, UNRESOLVED denial and inactive/legacy actors.
- [ ] Add RED provenance snapshots for Accommodation and linked Property before/after each allowed mutation.
- [ ] Add RED creation tests: PLATFORM refused, TENANT target canonical, forged body tenant ignored/refused.
- [ ] Run focused suites and verify RED.
- [ ] Add dual-mode guards and replace `assertResourceTenantOrUnattributed` on admin paths with strict scope assertion.
- [ ] Require resolved TENANT for admin creation; preserve owner/mobile routes separately.
- [ ] Run focused suites and verify PASS.
- [ ] Refactor controller authorization into one resource-first helper without changing business transitions.

### Task 4: Hotel reads, portfolio and analytics

**Files:**
- Modify: `server/routes/hotelRoutes.js`
- Modify: `server/controllers/hotelController.js`
- Modify: `server/services/hotelService.js`
- Modify: `server/controllers/dashboardAnalyticsController.js`
- Test: create `server/__tests__/platformHotelAdministration.mongo.integration.test.js`
- Test: modify `server/__tests__/hotelAdminListsTenantScope.mongo.integration.test.js`
- Test: modify `server/__tests__/dashboardHotelOverviewKpis.mongo.integration.test.js`

**Interfaces:**
- Consumes: Task 1 Hotel filters/assertions.
- Produces: explicit list/portfolio/pending/analytics contracts.

- [ ] Write RED cases for PLATFORM A/B/null, tenant A-only, empty tenant, UNRESOLVED and partial/inactive/legacy actors.
- [ ] Add RED case proving owner/manager/createdBy cannot attach a `tenant:null` Hotel to Tenant A.
- [ ] Run focused suites and verify RED.
- [ ] Replace role/no-header inference with `adminScope` and exact `platform.hotels.read`.
- [ ] Keep safe Property projection informational; never use its owner as admin authorization.
- [ ] Run focused suites and verify PASS.
- [ ] Refactor list and KPI scope filtering to share exact hotel IDs derived from direct tenant provenance.

### Task 5: Hotel mutations and creation policy

**Files:**
- Modify: `server/routes/hotelRoutes.js`
- Modify: `server/controllers/hotelController.js`
- Modify: `server/services/hotel/hotelAccessScopeService.js`
- Modify: `server/services/hotelService.js`
- Test: create `server/__tests__/platformHotelMutations.mongo.integration.test.js`
- Test: modify `server/__tests__/hotelAccessFinalizationF263.mongo.integration.test.js`

**Interfaces:**
- Consumes: Task 1 strict Hotel assertion.
- Produces: explicit lifecycle authorization; owner operational access remains separate.

- [ ] Write RED tests for PLATFORM manage archive/reactivate/moderation/resync across A/B/null and read-only denial.
- [ ] Add RED tests for tenant A cross-tenant/null denial and forged hotel/tenant inputs.
- [ ] Add RED provenance tests across Hotel, Accommodation adapter and Property.
- [ ] Add RED creation tests requiring TENANT and rejecting PLATFORM/UNRESOLVED.
- [ ] Run focused suites and verify RED.
- [ ] Introduce an administration-specific Hotel guard; do not overload owner operational capability resolution.
- [ ] Preserve blocker checks and Hotel→Accommodation lifecycle synchronization.
- [ ] Run focused suites and verify PASS.
- [ ] Refactor repeated resource loading while retaining 404 anti-enumeration behavior.

### Task 6: Web transports and runtime-aware pages

**Files:**
- Modify: `client/lib/services/accommodationService.js`
- Modify: `client/lib/services/hotelService.js`
- Modify: `client/lib/services/dashboardAnalyticsService.js`
- Modify: `client/lib/pages/dashboard/ManageAccommodationsPage.jsx`
- Modify: `client/lib/pages/dashboard/ManageHotelsPage.jsx`
- Modify: `client/lib/navigation/dashboardRouteScope.js`
- Test: modify `client/lib/__tests__/ManageAccommodationsPage.test.jsx`
- Test: modify `client/lib/__tests__/ManageHotelsPage.test.jsx`
- Test: modify `client/lib/__tests__/DashboardPlatformScope.test.jsx`

**Interfaces:**
- Produces: transports accepting `{ platformScoped }`; pages consuming `scope.mode`, `scope.key` and exact `can()` checks.

- [ ] Write RED component tests for PLATFORM/TENANT/UNRESOLVED, read/manage UI, no creation in PLATFORM and no request in UNRESOLVED.
- [ ] Write RED transition tests for all PLATFORM/Tenant A/Tenant B directions with late responses.
- [ ] Run focused Vitest suites and verify RED.
- [ ] Add explicit transport options and route requirements for Accommodation/Hotel.
- [ ] Implement epoch/cleanup using the PA-04B pattern keyed by `scope.key`.
- [ ] Hide mutations without exact manage authority and disable platform creation.
- [ ] Run focused suites and verify PASS.
- [ ] Refactor shared scope-request behavior only if both pages can reuse it without obscuring domain logic.

### Task 7: Detail routes and direct dependencies

**Files:**
- Modify only as proven necessary: `client/lib/pages/dashboard/AccommodationDetailPage.jsx`, `client/lib/pages/dashboard/HotelDetailPage.jsx`, related reservation/calendar transports.
- Test: corresponding existing page tests.

**Interfaces:**
- Consumes: Tasks 2–6 contracts.

- [ ] Add RED tests that detail reads and directly exposed actions honor the current scope after navigation.
- [ ] Classify each dependency as migrated now or explicitly deferred.
- [ ] Implement only the minimum adapters needed for safe list→detail navigation.
- [ ] Run focused suites and verify PASS.
- [ ] Confirm rooms/reservations/inventory/finance retain their existing independent capability guards.

### Task 8: Mobile and authority regressions

**Files:**
- Tests only unless an actual compatibility defect is proven.

- [ ] Run owner/mobile publication, Hotel cockpit, reservation, analytics and tenant-header suites.
- [ ] Add a regression test if an admin-scope middleware affects a mobile self-service endpoint.
- [ ] Run PA-01/PA-03/PA-04A/PA-04B0/PA-04B/PA-04B1 targeted suites.
- [ ] Run full backend unit, targeted/full Mongo as reasonable, full Web and full Mobile.
- [ ] Run client/server/mobile lint, mobile typecheck, Next build, architecture certification and `git diff --check`.
- [ ] Inventory the worktree before/after and verify no unrelated file was removed or overwritten.
