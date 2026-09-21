# Global Admin Authority Separation Design

**Mission:** USER-GLOBAL-ROLE-ARCHITECTURE-2B  
**Date:** 2026-09-13  
**Status:** Design approved in chat; implementation not started

## Objective

Separate three independent authority dimensions without reducing the current `User.role` enum, migrating historical data, or retiring the legacy membership fallback:

1. `User.role === 'Admin'` is the global platform-administrator identity.
2. An active `PlatformOperator` carrying an existing capability authorizes sensitive global operations.
3. An active `OrgMembership.businessRole` authorizes operations inside one specific tenant.

`User.role` must never substitute for tenant membership, and tenant membership must never grant platform authority.

## Non-negotiable invariants

- `User.role='Proprietaire'` plus `OrgMembership.businessRole='Admin'` is valid and expected.
- Creating a tenant never changes the founder's `User.role`.
- A tenant Admin receives no implicit `PlatformOperator`.
- A global Admin receives no implicit tenant membership.
- A PlatformOperator receives no implicit tenant membership.
- Ownership and participation checks remain separate from tenant membership.
- Existing memberships and users are not migrated in 2B.
- `membership_legacy_user_role` remains available until 2D.
- `Prestataire` and the legacy `User.role` enum values remain untouched.

## Incremental scope

2B changes only boundaries whose semantics are proven by current code. It does not mechanically convert every `restrictTo('Admin')` or staff-role array.

### In scope

- Centralize the global-sensitive contract as `Admin` identity plus active PlatformOperator capability.
- Retain existing platform capabilities; introduce none unless an uncovered global-sensitive operation has no defensible existing capability.
- Prove the global negative cases with tests.
- Prove the tenant negative and multi-tenant cases with tests.
- Provision new tenant founders with `roleInUnit='owner'` and `businessRole='Admin'` while preserving `User.role='Proprietaire'`.
- Remove the frontend assumption that only `User.role='Admin'` may resolve/select accessible tenants.
- Migrate a bounded set of clearly tenant-scoped route families only after their complete endpoint and authorization chains are verified.
- Produce a route inventory that labels untouched mixed surfaces `NEEDS_ARCHITECTURE_DECISION`.

### Out of scope

- Historical backfill or production access.
- `User.role` enum reduction.
- Legacy fallback removal.
- `Prestataire` redesign.
- Mechanical migration of property moderation, mixed hotel/reservation finance, reviews/comments, visits, advertising, exports, ActionLog, or email fallback without conclusive authority evidence.

## Authority contracts

### Global identity

`User.role === 'Admin'` is necessary for a platform-administrator HTTP operation. It is not sufficient for a sensitive operation when a matching platform capability already exists.

An authenticated non-Admin with a `PlatformOperator` document is denied global admin HTTP operations in 2B. This establishes the explicit GLOBAL-05 expectation: PlatformOperator is an authorization layer attached to the global Admin identity, not an alternative global identity.

### Global baseline authority

An Admin may operate without a PlatformOperator only on routes explicitly classified as non-sensitive baseline/global UI or self-service behavior. 2B must inventory these routes exactly. Absence of a capability is not permission to classify a route as baseline; uncertain routes remain unchanged and receive `NEEDS_ARCHITECTURE_DECISION`.

### Global sensitive authority

Sensitive global routes use this sequence:

```text
protect
→ restrictTo('Admin')
→ requirePlatformOperatorCapability(existingCapability)
→ handler
```

Confirmed capability families include operator governance, tenant governance, tenant-application review, global user administration, and explicit cross-tenant read/manage operations.

### Tenant authority

Clearly tenant-internal routes use:

```text
protect
→ attachTenantContext
→ requireTenantMembershipRole(...allowedBusinessRoles)
→ resource scope/ownership checks where applicable
→ handler
```

These routes do not inspect `User.role` for tenant authorization. A global Admin without a membership is denied. A PlatformOperator bypass is allowed only on a separately designed cross-tenant route with an explicit capability; it is never implicit in `requireTenantMembershipRole`.

### Ownership authority

Own profile, Property owner, founder-owned assets, client reservations, and messaging participation retain their existing ownership/participation rules. Tenant membership is added only where an internal tenant actor is also supported. Ownership is never replaced merely to make authorization uniform.

## Founder provisioning

The approval transaction retains its present eligibility, idempotency, and rollback behavior. The only runtime change is that the newly created founder membership is passed `businessRole: 'Admin'` in addition to `roleInUnit: 'owner'`.

Expected result:

```text
before User.role = Proprietaire
after  User.role = Proprietaire
membership.roleInUnit = owner
membership.businessRole = Admin
PlatformOperator created = no
```

No historical membership is updated.

## Tenant discovery and switching

`resolveAvailableTenantsForUser(userId)` remains the backend source for tenant availability because it derives access from active organization membership and separately handles operator contexts. Frontend runtime providers must not stop resolution solely because `user.role !== 'Admin'`.

The frontend behavior becomes:

- any authenticated user may request their accessible tenant list;
- a Proprietaire with an Admin membership can select that tenant;
- a user with no accessible tenant gets no tenant context;
- a global Admin without membership gets no artificial tenant;
- platform-wide operator behavior stays capability-derived and distinct from membership;
- post-auth destinations remain based on global identity, while tenant entry is an explicit runtime-context action.

## Route migration policy

Every Admin/staff-protected endpoint receives one classification:

- `GLOBAL`: platform-wide governance or cross-tenant operation.
- `TENANT`: internal operation in one resolved tenant.
- `OWNERSHIP`: actor owns or participates in the target resource.
- `MIXED`: explicit alternative authorities exist and each branch is independently checked.
- `AMBIGUOUS`: code and domain evidence do not prove the intended authority.

The inventory records file, HTTP endpoint, current authority, target authority, capability, tenant-context requirement, and migration status.

Migration status values are:

- `MIGRATED_2B`
- `ALREADY_COMPLIANT`
- `OWNERSHIP_PRESERVED`
- `DEFERRED_DEPENDENCY`
- `NEEDS_ARCHITECTURE_DECISION`

## Candidate route sequencing

1. Verify and retain already-compliant global-sensitive routes: PlatformOperator management, platform tenants, tenant-application review, and global user administration.
2. Verify `/api/members` as already compliant tenant authority.
3. Fix founder provisioning and its tests.
4. Fix web/mobile tenant discovery and switching guards.
5. Select only complete tenant route families whose controllers/services already consume canonical tenant scope. Add membership guards and remove their `User.role` authorization checks as one atomic family.
6. Leave partial or mixed route families unchanged and record their blockers.

This sequencing avoids adding a membership gate to a route whose downstream query still behaves globally or whose legitimate ownership branch would be lost.

## Frontend design

The backend remains authoritative. Frontend changes are navigation and affordance changes only.

- `PlatformTenantRuntimeContext` derives eligibility from authenticated identity and the accessible-tenants response, not global Admin role.
- `AuthContext` continues exposing global identity. Existing tenant-derived `can*` helpers are not globally redefined until a canonical current-membership role is available to their consumers.
- `AdminDashboard`, role utilities, and individual pages are migrated only with their corresponding backend route family.
- `MembersPanel` remains based on membership `businessRole`.
- Post-auth routing remains `Admin → global admin surface`, `Proprietaire → owner surface`, `Client → client surface`.

## Test design

### Global matrix

- GLOBAL-01: Admin + active operator + required capability is allowed.
- GLOBAL-02: Admin without operator is denied on a capability-gated route.
- GLOBAL-03: Proprietaire + tenant Admin membership is denied globally.
- GLOBAL-04: Client is denied globally.
- GLOBAL-05: non-Admin + PlatformOperator capability is denied because global Admin identity is mandatory.

### Tenant matrix

- TENANT-01: Proprietaire + tenant `businessRole=Admin` is allowed to administer its tenant.
- TENANT-02: global Admin without membership is denied tenant administration.
- TENANT-03: Client without membership is denied.
- TENANT-04: Proprietaire without membership is denied.
- TENANT-05: Secretaire membership receives only routes assigned to Secretaire.
- TENANT-06: one User can be Admin in tenant A and Collaborateur in tenant B without role leakage.

### Founder matrix

- FOUNDER-01: provisioning preserves `User.role='Proprietaire'`.
- FOUNDER-02: new founder membership is owner/Admin.
- FOUNDER-03: provisioning creates no PlatformOperator.
- FOUNDER-04: founder tenant Admin cannot access global admin operations.

Tests follow red-green TDD. Existing Mongo integration patterns and static route tests are reused; no production database is contacted.

## Error behavior

- Missing global identity: 403 through the existing role guard.
- Missing/inactive/wrong PlatformOperator capability: 403.
- Missing tenant context or active membership: canonical tenant middleware 403 codes.
- Ambiguous active memberships: fail closed with `AMBIGUOUS_ACTIVE_TENANT_MEMBERSHIP`.
- Wrong tenant business role: `INSUFFICIENT_TENANT_MEMBERSHIP_ROLE`.
- No frontend-accessible tenant: empty state, never fabricated context.

## Verification

Verification must include targeted backend suites for platform administration, tenant membership, tenant members, founder provisioning, affected ownership/messaging/hotel/rental routes, and frontend/mobile tenant runtime plus post-auth routing. The final pass also includes relevant lint/static architecture checks and `git diff --check`.

Failures outside the modified authority paths are reported, not hidden by unrelated test changes.

## Safety and delivery

- Production reads: 0
- Production writes: 0
- Historical migrations: none
- Existing User and OrgMembership documents: untouched
- Commit/push/deploy: none
- Existing dirty-worktree changes: preserved
- Stop after the 2B final report; do not start 2C
