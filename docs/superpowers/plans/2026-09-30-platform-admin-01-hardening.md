# Platform Admin 01 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make active `PlatformOperator` records with exact capabilities the canonical authority for every platform-scoped property, reporting, statistics, activity, operator-lifecycle, and administrative-deletion operation in this sprint.

**Architecture:** Keep tenant membership and ownership paths unchanged. Centralize platform capability checks in the existing authority middleware, protect global route branches explicitly, and serialize viability-reducing operator transitions with the existing Mongo transaction/lock patterns.

**Tech Stack:** Node.js, Express, Mongoose, Jest, mongodb-memory-server.

**Spec:** User-supplied `SPRINT PLATFORM-ADMIN-01 — AUTHORITY / CAPABILITIES / SECURITY HARDENING` and the approved in-chat design.

## Global Constraints

- `PlatformOperator.status=active` plus the exact capability is the canonical platform-scoped authority.
- `User.role` and `OrgMembership.businessRole` never independently grant platform authority.
- Preserve tenant isolation and personal `Property.tenant=null` records.
- Do not change production or remote data, hardcode an administrator email, rebuild platform UI, commit, push, or deploy.
- Preserve all user-preexisting worktree changes.

## Review Focus

- An active operator with an unrelated capability must be denied before any global query or mutation.
- An inactive operator and an Admin without an operator record must be denied identically.
- Concurrent viability-reducing transitions must never leave zero viable platform administrators.
- Tenant staff must retain tenant access without receiving global access.
- Administrative user deletion must not bypass self-protection or last-operator protection.

---

### Task 1: Exact platform capability boundaries

**Files:**
- Modify: `server/routes/propertyRoutes.js`
- Modify: `server/routes/adminRoutes.js`
- Modify: `server/routes/reportingRoutes.js`
- Test: `server/__tests__/platformAdminAuthorityHardening.mongo.integration.test.js`

**Interfaces:**
- Consumes: `requirePlatformOperatorCapability(capability)` and tenant-context middleware.
- Produces: explicit global read/manage/reporting authorization boundaries.

- [ ] Write failing tests for correct, missing, unrelated, inactive, Admin-only, and tenant-Admin-only authority.
- [ ] Run the focused tests and confirm security assertions fail before implementation.
- [ ] Add exact capability middleware only to platform-wide branches while preserving tenant paths.
- [ ] Run focused tests and confirm all authority cases pass.

### Task 2: Last viable platform operator protection

**Files:**
- Modify: `server/models/PlatformOperator.js` or the existing platform lock model used by services.
- Modify: `server/services/platformOperator/platformOperatorService.js`
- Test: `server/__tests__/platformAdminAuthorityHardening.mongo.integration.test.js`

**Interfaces:**
- Produces: a transaction-safe viability assertion used by suspend, revoke, capability replacement, and user lifecycle guards.

- [ ] Write failing sequential and concurrent last-operator tests.
- [ ] Run them and confirm the current service permits unsafe transitions.
- [ ] Implement serialized transactional protection using an existing durable singleton lock pattern.
- [ ] Run the focused tests and confirm one viable operator always remains.

### Task 3: Administrative deletion safety

**Files:**
- Modify: `server/controllers/userController.js`
- Modify: `server/controllers/adminController.js`
- Modify: platform operator service/helper only as needed.
- Test: `server/__tests__/platformAdminAuthorityHardening.mongo.integration.test.js`

**Interfaces:**
- Consumes: last-operator viability assertion.
- Produces: consistent self-delete and platform-operator deletion rejection before destructive writes.

- [ ] Write failing tests for self-deletion and deletion of the last viable operator through every administrative route.
- [ ] Confirm failures precede implementation.
- [ ] Add common preflight guards without inventing a new physical-deletion policy.
- [ ] Run focused tests and document remaining physical deletion as `HUMAN_DECISION_REQUIRED` if applicable.

### Task 4: Tenant/property isolation and regression verification

**Files:**
- Test: `server/__tests__/platformAdminAuthorityHardening.mongo.integration.test.js`
- Modify only existing test files already dirty when strictly required.

**Interfaces:**
- Verifies: tenant A cannot read tenant B or foreign `tenant=null`, while correctly authorized global reads include tenant A, tenant B, and `tenant=null`.

- [ ] Add and run cross-tenant and `tenant=null` assertions.
- [ ] Run targeted auth, membership, property, reporting, deletion, stats/activity, and tenant-context suites.
- [ ] Run reasonable backend unit/Mongo non-regression, frontend relevant tests, lint/typecheck where available, and `git diff --check`.
- [ ] Record exact passes, failures, timeouts, blockers, and final worktree delta.
