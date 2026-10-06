# C2.8 Asset Projection Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close confirmed cross-projection inconsistencies without changing organizational provenance or mutating legacy data.

**Architecture:** Direct resource tenant fields remain authoritative. Shared query contracts determine list and counter populations, while a separate read-only discovery service reports legacy candidates and dangling relations.

**Tech Stack:** Node.js, Express, Mongoose, Jest, React/Next.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-c2-8-asset-projection-consistency-design.md`

## Global Constraints

- No commit, push, deploy, EAS, remote data mutation, backfill, or destructive migration.
- Preserve all pre-existing worktree changes.
- `Property.tenant` remains canonical organizational provenance.
- No owner/manager/createdBy/User.role fallback for tenant scope.
- Property, Accommodation, and Hotel remain distinct domains.
- Every production correction follows RED → GREEN → REFACTOR.

## Review Focus

- Tenant A must never receive a Hotel or Property from Tenant B through a shared owner.
- `tenant:null` owner assets remain visible to their owner but absent from tenant projections.
- Hotel records with missing Property anchors remain excluded and are reported, never repaired by inference.
- Platform-wide queries remain global only with their existing exact capability.
- List totals and KPIs must state and test whether they represent exhaustive, published, or operational populations.

---

### Task 1: Cross-projection acceptance contract

**Files:**
- Create: `server/__tests__/assetProjectionConsistencyC28.mongo.integration.test.js`
- Modify only if a RED failure proves it: relevant query service/controller.

**Interfaces:**
- Consumes: existing owner listing, registry, sales/rentals filters, Accommodation and Hotel contracts.
- Produces: one synthetic Mila Events fixture P1/P2/P3 and independent P4 proving every projection.

- [ ] Write the Mongo acceptance test for owner, tenant, sales, rentals, accommodation, hotel, and `tenant:null` isolation.
- [ ] Run it and confirm RED only for a demonstrated projection defect; document contracts already GREEN rather than changing them.
- [ ] Apply the minimum correction for demonstrated defects only.
- [ ] Re-run the exact suite and directly adjacent Property/Accommodation/Hotel scope suites.

### Task 2: Property portfolio Hotel tenant scope

**Files:**
- Modify: `server/services/propertyPortfolioService.js`
- Test: `server/__tests__/dashboardKpiQueryService.test.js` or a focused new service test.

**Interfaces:**
- Consumes: `listEligibleHotels({ tenantId, propertyOwnerIds, ... })`.
- Produces: tenant-scoped property portfolio in which Hotel selection requires the direct Hotel tenant.

- [ ] Write a failing Tenant A/Tenant B/shared-owner test showing the current Hotel leak/drift.
- [ ] Confirm RED because `tenantId` is not forwarded.
- [ ] Forward the canonical `tenantId` to `listEligibleHotels`; add no fallback.
- [ ] Confirm GREEN and run dashboard KPI plus PA-04C Hotel scope neighbors.

### Task 3: Counter population alignment

**Files:**
- Modify as proven necessary: `server/controllers/dashboardAnalyticsController.js`, `server/services/dashboardKpiQueryService.js`.
- Test: existing analytics/KPI suites plus focused C2.8 assertions.

**Interfaces:**
- Consumes: exact filters used by Property registry, independent Accommodation list, and eligible Hotel list.
- Produces: explicitly named/tested exhaustive, published, or operational counts without pretending different populations are identical.

- [ ] Write RED assertions for any UI counter labelled as the visible list total but using a broader population.
- [ ] Extract/reuse the smallest shared filter contract or rename the returned metric when populations intentionally differ.
- [ ] Confirm list and corresponding visible-count equality; preserve separate business analytics.
- [ ] Run affected backend and Web component tests.

### Task 4: Read-only legacy dry-run

**Files:**
- Create or extend: focused service under `server/services/platformTenant/`.
- Create: `server/scripts/discoverAssetProjectionConsistency.js` if the existing discovery cannot express the required report safely.
- Test: focused read-only service/script tests.

**Interfaces:**
- Consumes: C2 classifier, Property/Hotel direct tenant fields, existing read-only discovery conventions.
- Produces: counts and classifications for eligible `tenant:null` owner assets and dangling Hotel Property anchors; no apply interface.

- [ ] Write failing tests for two eligible Mila-style assets, already-target asset, blocker, and dangling Hotel anchor.
- [ ] Implement batched/minimally projected read-only discovery.
- [ ] Make `--apply`, `--write`, `--force`, `--backfill`, and mutation aliases fail before connection.
- [ ] Run tests and a local mocked dry-run only; never execute an apply or real migration.

### Task 5: Consolidated certification and handoff

**Files:**
- Modify: no production file unless a preceding RED test requires it.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: C2.8 report, manual checklist, exact migration candidates and blockers.

- [ ] Run the consolidated C2.8 backend/Mongo gate.
- [ ] Run targeted Web tests and Mobile tests only if a shared contract changed.
- [ ] Run server/client/mobile lint as applicable, architecture check, build, and `git diff --check`.
- [ ] Re-read the final diff against the spec and inventory pre-existing versus C2.8 changes.
- [ ] Report dry-run candidates separately from code correctness; request explicit apply authorization for any future migration.
