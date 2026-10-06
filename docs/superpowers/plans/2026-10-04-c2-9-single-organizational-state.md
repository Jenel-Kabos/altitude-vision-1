# C2.9 Single Organizational State Invariant — Implementation Plan

**Spec authority:** user brief C2.9. **Audit:** `docs/superpowers/specs/2026-10-04-c2-9-single-organizational-state-audit.md`.

**Goal:** make canonical owner organizational state the single server-side source for Property provenance creation, detect legacy hybrid/conflict states, and preserve independent owners, ordinary members, provisioning, historical assets and subscription semantics.

## Constraints

- No remote mutation, C2.8M production apply, migration, commit, push, deploy, EAS or full Mongo.
- Preserve the dirty worktree and C2.8/C2.8M.
- RED before implementation; grouped corrections only.

## Task 1 — Canonical owner-state resolver and invariant inspector

**Files:** modify `organizationAssetInvariantService.js`; create `ownerOrganizationalStateInvariantC29.mongo.integration.test.js`.

- RED C29-01, 05–10 and C2.8M before/after consistency.
- Add `INDEPENDENT`, `ORGANIZATION_OWNER`, `AMBIGUOUS` resolution exclusively from owner/Admin membership → root tenant.
- Add read-only active-asset consistency inspection using the C2 classifier.
- Return explicit inconsistent and cross-tenant conflict codes; never mutate.

## Task 2 — Property creation gates Web/Mobile/portfolio and generic immutability

**Files:** modify invariant middleware, Property controllers/routes; extend C29 suite.

- RED C29-02–04 and C29-18 through real HTTP routes.
- Middleware derives `req.propertyCreationTenantId`; ambiguous/conflict/inconsistent fail before create.
- Web and Mobile ignore client tenant and use only the server result.
- Tenant portfolio context must be compatible with canonical owner ownership.
- Re-prove generic updates cannot alter tenant.

## Task 3 — Secondary creation paths and Hotel/provisioning

**Files:** minimally modify shared transaction/accommodation/hotel/onboarding/import services only where RED proves risk.

- RED C29-11–15 and clone provenance tests.
- Keep Hotel organization requirement.
- Reuse transactional tenant application asset transition and classifier.
- Fix clone Property provenance before its satellite.
- Owner/context conflicts fail before writes.

## Task 4 — Entitlement separation and global synthetic gate

**Files:** extend C29 suite; no production change unless RED demonstrates one.

- C29-16/17 prove independent and organization rental management retain their entitlement behavior.
- Run one synthetic fixture across independent, ordinary member, PlatformOperator/ex-operator, ambiguous owner, historical and workflow blocker.
- Assert no normal certified operation creates a non-legacy hybrid.

## Task 5 — Targeted certification and report

- C2.9, C2.4–C2.8M neighbors, Property provenance, tenant provisioning, Hotel organization requirement, rental management and PA-04B0.
- Web/mobile tests only if their contracts changed.
- Targeted lint, architecture and `git diff --check`.
- No full Mongo and no production/remote write.
- Produce `C2_9_SINGLE_ORGANIZATIONAL_STATE_INVARIANT_REPORT`.

## Review focus

- Ordinary membership never implies organizational ownership.
- PlatformOperator and `createdBy` never imply ownership.
- Multi-owner never selects the first tenant.
- Existing other-tenant Property is a conflict, not a migration candidate.
- Historical Properties do not make active-state consistency fail.
- C2.9 detects but never repairs Mila Events legacy state.
