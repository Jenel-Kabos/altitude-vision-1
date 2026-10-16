# Lot F Certification and Final Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:verification-before-completion. No commits are permitted.

**Goal:** Produce evidence-backed cross-system certification and the required final report without performing any delivery operation.

**Architecture:** Run focused-to-broad verification, preserve exact command outputs/counts, classify failures, inspect final diffs, and generate a report whose verdict never exceeds executed evidence.

**Tech Stack:** Repository certification scripts, Jest, MongoDB test harness, Next.js build/lint, mobile Jest/Expo static verification, Git read-only inspection.

**Spec:** `docs/superpowers/specs/2026-10-10-altimmo-commercial-intermediation-hardening-design.md`

## Global Constraints

- Lots C, B, A, E, and D must meet their exit conditions before certification.
- Never report an unexecuted suite as passing.
- No real messaging, campaigns, production database, EAS build, AAB, commit, push, or deployment.
- Preserve the initial dirty-worktree inventory and distinguish pre-existing from task-created changes.

## Review Focus

- Tests may pass individually but fail together through shared Mongo lifecycle or leaked state.
- Marketing tests must not invoke real delivery adapters.
- Public payload spot checks must include approved snapshot fields, not only status flags.
- Mobile registration and privacy changes must be syntax/test verified without building an AAB.
- Final Git verification must prove no commit or branch movement occurred.

---

### Task 1: Per-lot evidence ledger

**Files:**
- Create: `docs/ALTIMMO_COMMERCIAL_INTERMEDIATION_HARDENING_REPORT.md`

- [ ] Record initial HEAD/status and the 26 modified + 21 untracked pre-spec inventory separately from new work.
- [ ] For each lot record files, endpoints, tests, exact passed/failed counts, discovered regressions, residual risk, and status.
- [ ] Add the before/after requirements matrix and data-compatibility section.

### Task 2: Targeted and adjacent regression suites

- [ ] Re-run all new lot suites in isolated Mongo test mode.
- [ ] Run existing messaging/notification, application/visit, property/moderation, marketing/consent, hotel/accommodation, tenant authority, rental, and financial suites selected in prior plans.
- [ ] Capture commands, exit codes, test counts, and named failures.
- [ ] For any code defect, return to RED/GREEN before repeating the affected verification; document environment failures separately.

### Task 3: Repository certifications

- [ ] Run `npm run certify:tenant` and record exact result.
- [ ] Run `npm run certify:architecture` and record exact result.
- [ ] Run `npm run certify:frontend` and record exact result.
- [ ] Run server unit suite and the relevant MongoDB suite; attempt the complete Mongo suite if resource limits permit.
- [ ] Run appropriate client and mobile tests, plus syntax/lint checks and the Next.js production build where the certification script requires it.
- [ ] Run the Client email-registration regression test explicitly.

### Task 4: Security and diff audit

- [ ] Search for remaining role-only guards on commercial moderation/marketing mutations and direct-message bypasses.
- [ ] Search response serializers for email/phone/evidence exposure and public queries for unsnapshotted mutable commercial fields.
- [ ] Inspect all changes against the original dirty inventory to ensure `MARKETING-CONSENT-1` was preserved.
- [ ] Verify `git rev-parse HEAD` still equals `5a54a135b61b30de9b8d298f2cdc2ae282eec330`, branch remains `main`, and no delivery operation occurred.

### Task 5: Google Play and final verdict

- [ ] Update the report and Data Safety documentation only where verified behavior changes require it.
- [ ] State that versionCode 4 lacks these changes and that a future AAB must use versionCode 5 or higher; do not build it.
- [ ] Give evidence-constrained verdicts for business conformity, intermediation security, tenant isolation, exclusive commercial CRM, direct reservations, tests, and controlled-delivery readiness.

**Completion condition:** the report exists, contains all 16 required sections and exact evidence, and clearly separates local implementation, executed tests, incomplete certification, and absent production delivery.

