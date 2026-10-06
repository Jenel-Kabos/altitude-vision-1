# C2.8M Atomic Legacy Asset Regularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and certify an atomic preview/apply engine for the exact Mila Events legacy Property batch without executing the production mutation.

**Architecture:** A focused service performs preview and apply through one transaction-scoped validation pipeline and one batch transaction. A separate purpose-specific CLI enforces the immutable allowlist and layered production confirmations; discovery remains unchanged and read-only.

**Tech Stack:** Node.js, Mongoose transactions, MongoDB replica-set test harness, Jest.

**Spec:** `docs/superpowers/specs/2026-10-04-c2-8m-atomic-legacy-asset-regularization-design.md`

## Global Constraints

- No commit, push, deploy, EAS, production mutation, remote data mutation, legacy migration execution, Hotel repair, or full Mongo run.
- Preserve every pre-existing and concurrent worktree change; stop if a touched file changes after its Phase 0 hash.
- Never modify or add write capability to C2.8M discovery.
- `Property.tenant` is the only organizational provenance; `Property.owner` never changes.
- The apply CLI accepts exactly the two approved Property IDs and no scan-driven mutation.
- Every production change follows observed RED → GREEN → REFACTOR.

## Review Focus

- A batch containing duplicate IDs must be rejected rather than reducing its effective cardinality.
- A mixed `ALREADY_IN_TARGET`/eligible batch must reach a deterministic all-target state without rewriting the already-target Property.
- A PlatformOperator lacking `platform.properties.manage` must not preview or apply.
- A non-active target tenant or ambiguous owner history must fail before mutation.
- A write conflict retried by `withTransaction` must not create duplicate ActionLogs.
- End-to-end certification must call real projection contracts and must not duplicate their filters inside the test.

---

### Task 1: Atomic service contract and validation

**Files:**
- Create: `server/__tests__/assetProjectionConsistencyApply.mongo.integration.test.js`
- Create: `server/services/platformTenant/assetProjectionConsistencyApplyService.js`

**Interfaces:**
- Consumes: `classifyOrganizationAsset(...)`, canonical PlatformTenant/OrgMembership fields, `ActionLog.metadata.regularization`.
- Produces: `regularizeAssetProjectionBatch(input)` and `AssetProjectionRegularizationError`.

- [ ] Write RED integration tests APPLY-01 through APPLY-08 for candidate mutation, unchanged owner, already-target idempotence, other-tenant conflict, owner mismatch, ownership proof failure, newly appeared workflows, and historical state.
- [ ] Run only the new suite and verify failure because the service does not exist.
- [ ] Implement transaction-scoped actor, ownership, Property and blocker validation plus preview result generation.
- [ ] Implement the minimal apply CAS for a single candidate and same-transaction ActionLog.
- [ ] Re-run the suite GREEN and refactor shared preview/apply validation without changing behavior.

### Task 2: Batch atomicity, rollback, and concurrency

**Files:**
- Modify: `server/__tests__/assetProjectionConsistencyApply.mongo.integration.test.js`
- Modify: `server/services/platformTenant/assetProjectionConsistencyApplyService.js`

**Interfaces:**
- Consumes: `regularizeAssetProjectionBatch(input)` from Task 1.
- Produces: all-or-nothing multi-Property apply, failure injection, concurrency-safe results.

- [ ] Add RED tests APPLY-09 through APPLY-12: two concurrent calls, exact two-ID batch, and injected failure before first mutation, after first Property, before second Property, and before commit.
- [ ] Verify RED on missing batch atomicity/failure hooks.
- [ ] Move the whole batch, all CAS mutations, and all ActionLogs under one `session.withTransaction` boundary.
- [ ] Return `MIGRATED`, `ALREADY_IN_TARGET`, or explicit refusal details while preserving one logical event per mutation.
- [ ] Re-run the full apply suite GREEN, including owner/tenant field post-condition comparisons.

### Task 3: Purpose-specific preview/apply CLI and production guards

**Files:**
- Create: `server/__tests__/assetProjectionConsistencyApplyCli.test.js`
- Create: `server/scripts/applyAssetProjectionConsistency.js`

**Interfaces:**
- Consumes: `regularizeAssetProjectionBatch(input)` from Tasks 1–2.
- Produces: `parseAndValidateArgs(argv, env)`, `describeMongoTarget(uri)`, and `main(argv, env)`.

- [ ] Write RED CLI tests for default preview/no writes, wrong database, wrong tenant, missing production confirmation, missing/additional/duplicate Property ID, invalid owner, missing actor/operation, and pre-connection refusal.
- [ ] Verify RED because the CLI does not exist.
- [ ] Implement immutable C2.8M constants, exact-set validation, non-secret target display, and a direct Mongoose connection with `autoIndex:false`, `autoCreate:false`.
- [ ] Require `--apply`, exact database/tenant/owner/property confirmations, `--confirm-production`, and `ALLOW_C2_8M_ASSET_REGULARIZATION_APPLY=true` for apply.
- [ ] Verify preview calls the service in preview mode and apply calls it only after every guard; run the CLI suite GREEN.

### Task 4: End-to-end business post-condition gate

**Files:**
- Create: `server/__tests__/assetProjectionConsistencyApplyPostConditions.mongo.integration.test.js`

**Interfaces:**
- Consumes: `regularizeAssetProjectionBatch(input)` plus the canonical owner Property route, tenant Property registry, sales/rentals query contracts, `listAccommodationsForAdmin`, and `listValidatedHotelPortfolio`/Hotel portfolio route.
- Produces: one local replica-set proof of the complete post-apply business state.

- [ ] Build the exact local fixture: canonical owner/Admin of Mila Events, Mila Hotel already in target, Bureau and Parcelle at `tenant:null`, one `tenant:null` sentinel owned by another user, one other-tenant sentinel, and two orphan Altitude Vision Hotels whose Property IDs do not exist.
- [ ] Write the RED post-condition test that invokes the actual owner-scoped `/mes-biens`, tenant registry, sales, rentals, independent Accommodation, and Hotel/Établissements contracts after the batch apply.
- [ ] Assert exact populations `3 / 3 / 1 / 1 / 0 / 1`, exact titles, zero sentinel leakage, zero new Accommodation/Hotel, one Mila Hotel, and unchanged owner for all three Properties.
- [ ] Assert both orphan Hotel IDs are absent from C2.8M inputs/results and every tested projection.
- [ ] Run the test RED before any production adjustment; if Tasks 1–3 already satisfy it, prove its effectiveness by temporarily exercising it before the apply call and observing the expected population mismatch, then restore the intended test.
- [ ] Apply only a demonstrated production correction if the real contracts fail, following a separate RED → GREEN cycle.
- [ ] Run the final post-condition gate GREEN on the local replica-set harness.

### Task 5: Targeted certification and real preview

**Files:**
- Modify: no production file unless a targeted RED proves a defect.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `C2_8M_APPLY_ENGINE_PREPRODUCTION_REPORT` and the absolute pre-apply stop.

- [ ] Re-hash every pre-existing touched file and stop on concurrent drift.
- [ ] Run apply tests, discovery C2.8M tests, C2.8 acceptance/classifier, organization ownership/provisioning neighbors, Property tenant scope, sales/rentals projections, and directly affected transaction/concurrency suites.
- [ ] Run lint only for touched files, architecture check, and `git diff --check`.
- [ ] Confirm tests use only the local replica-set harness and that no Atlas write path ran.
- [ ] Require the Task 4 end-to-end post-condition gate to be GREEN before any real preview connection.
- [ ] If and only if the CLI no-write guarantees are GREEN, run the real preview with `autoIndex:false` and `autoCreate:false`, never `--apply`.
- [ ] Verify the preview proposes exactly Bureau and Parcelle, reports Mila Hotel only as the prior discovery control, and then STOP.
- [ ] End `C2_8M_APPLY_ENGINE_PREPRODUCTION_REPORT` with exactly one readiness verdict and all mandated `=NO` declarations.
