# PA-04C2 Fast-track Batched Remediation Plan

**Spec:** `docs/superpowers/specs/2026-10-03-pa04c2-global-domain-map.md`

**Constraints:** no commit, push, deploy, remote write, production migration, new role/capability/model, or broad worktree cleanup. C2.0/C2.0b are regression-only.

## Task 1 — Batch A: Hotel authority

1. Add RED Mongo coverage for support-only operator, exact read/manage capabilities, tenant business-role matrix, inactive membership, CommunityManager denial, and cross-tenant 404.
2. Add RED architecture assertion forbidding `requireGlobalAdmin`.
3. Implement one Hotel administration authority helper using `req.adminScope`, active membership business role, and exact platform capabilities.
4. Remove `User.role` administrative classification and dead global-admin guard.
5. Run exact tests, Hotel authority suites and C2.0/C2.0b regressions.

## Task 2 — Batch B: direct Hotel attribution

1. Add RED tests proving direct `Hotel.tenant` wins and `tenant:null` is never administratively inferred.
2. Split strict organisational attribution from explicitly named legacy/self-service compatibility.
3. Preserve manager/assignment access to the exact Hotel only.
4. Reject new operational Hotel creation/duplication without a canonical tenant where the target is unambiguous.
5. Run Hotel, reservation and finance domain gates.

## Task 3 — Batch C: linked provenance and discovery

1. Add RED tests for Property/Accommodation equality, mobile non-Hotel publication, and existing-Hotel cross-tenant linking.
2. Enforce direct provenance before writes, returning resource-hiding 404 for foreign IDs and conflict for divergent local graphs.
3. Add a read-only, projected, cursor/batched discovery report with counts, timing and bounded memory.
4. Prove zero writes and refusal of write flags.

## Task 4 — Batch E: clients

1. RED Web tests for tenant business-role action visibility and partial-operator denial.
2. Align dashboard action visibility with runtime `tenantBusinessRole`; backend remains authoritative.
3. Add actionable owner Hotel organisation-required handling.
4. Verify mobile onboarding/error-code compatibility without adding PLATFORM UI.

## Task 5 — Certification and decision gate

1. Exact and batch test gates.
2. Backend unit, targeted/full Mongo when reasonably executable, Web, Mobile, lint, Next build, architecture and `git diff --check`.
3. Stop before Batch D writes and report the unresolved personal-versus-professional asset selection contract.
