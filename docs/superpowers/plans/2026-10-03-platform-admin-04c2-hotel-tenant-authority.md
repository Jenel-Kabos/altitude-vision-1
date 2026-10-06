# PA-04C2 Hotel Tenant Authority & Patrimony Invariant — Implementation Plan (rev. 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Status: BLOCKED on human validation** of D0–D15 (spec §9). Revision 3 adds phase C2.0b (PlatformOperator lifecycle, spec §8) and makes legacy founder backfill attestation-based (D15). Revision 2 superseded revision 1. Each phase lists the decisions it depends on; never start a phase whose decisions are not validated.

**Goal:** Canonical Hotel/Tenant authority, and `INDEPENDENT XOR TENANT` patrimony with `HOTEL ⇒ TENANT`, enforced at creation, at the independent → organisation transition, and audited for historical data.

**Architecture:** `patrimonyService.resolvePatrimonyTenant` (OrgMembership `roleInUnit:'owner'` only) drives creation guards; `approveApplication` gains a transactional `transferPatrimony` step; `assertHotelAdministrationAuthority` replaces role-based hotel authority; read-only discovery precedes any data write.

**Tech Stack:** Node.js, Express, Mongoose (replica-set transactions), Jest/Supertest + mongodb-memory-server, Next.js/Vitest, React Native/Jest.

**Spec:** `docs/superpowers/specs/2026-10-03-platform-admin-04c2-hotel-tenant-authority-design.md` (rev. 2)

## Global Constraints

- Preserve PA-01 … PA-04C1 and the PA-04C1 baseline (Mongo 208/2707, unit 1799, Web 1253, Mobile 628, Next build, architecture GREEN).
- No commit, push, deploy, production mutation or production migration.
- No new membership/role system, no pseudo-tenant, no OrgMembership for PlatformOperators, no new capability/businessRole.
- `createdBy` is never ownership proof; `Hotel.manager` never infers a tenant; no `updateMany({ owner })`.
- No user-specific exception. Self-service manager paths preserved. GL-ARCH-1.1 preserved unless D7 changes it.
- Every removed legacy behaviour gets an explicit replacement test.

## Dependency order

```text
C2.0 F2 containment ─> C2.0b operator lifecycle ┐
C2.1 Hotel operator authority (F1) ┼─> C2.2 businessRole authority ─> C2.3 operational + tenant:null hotel
C2.4 patrimony resolver ──────────┴─> C2.5 creation guards ─> C2.6 transition in approveApplication
C2.7 discovery dry-run (read-only, can start after C2.4) ─> C2.8 founder backfill tooling (local)
C2.9 Web/Mobile compatibility ─> C2.10 full certification
```

## C2.0 — Security containment F2 (D0)

Files: `server/services/platformTenant/tenantContextService.js`; test `server/__tests__/tenantHardening.mongo.integration.test.js`.

- [ ] RED H: suspended operator who created one tenant, no membership → `resolveEffectiveTenantContext` = `null` (today `legacy_fallback`); HTTP `GET /api/hotels/:id` and `PATCH /:id/deactivate` → 403, `active` unchanged.
- [ ] RED H: same for revoked operator.
- [ ] RED non-regression: genuine founder (never operator) still resolves `legacy_fallback`.
- [ ] GREEN: `resolveLegacyTenantForUser` returns `null` when `PlatformOperator.exists({ user })`.
- [ ] Neighbours: tenantHardening, hotfixUsersCount1, tenantScopeAudit*, platformViewEligibility, platformAdministrationScope.

## C2.0b — PlatformOperator lifecycle & authority separation (spec §8; D13, D14)

Files: `server/services/platformOperator/platformOperatorService.js` (reactivate: self-check, sentinel lock, transaction), `server/controllers/adminController.js` (self-check on ban/suspend), `server/controllers/userController.js` + `server/routes/userRoutes.js` (operator-holding target, D14); new `server/__tests__/platformOperatorLifecycle04C2.mongo.integration.test.js`. Existing coverage reused, not duplicated: `platformAdmin1.adversarial` (self-grant, self-suspend/revoke, suspended denied), `platformAdminAuthorityHardening` (last viable, concurrency).

- [ ] A (guard test): active operator + capability → PLATFORM 200; same operator suspended → 403; revoked → 403.
- [ ] B (guard test): active operator without `platform.hotels.manage` → hotel mutation 403 (shared with C2.1).
- [ ] C (guard test): suspended operator `PATCH /api/platform-operators/:self/reactivate` → 403; RED: service-level `reactivateOperator({ userId: self, actor: self })` → `PLATFORM_OPERATOR_SELF_ACTION_FORBIDDEN` (today accepted).
- [ ] D: = C2.0 H tests (createdBy never restores authority).
- [ ] E (guard test): suspended operator with active `owner/Admin` membership on T → PLATFORM 403; `/api/users`, `/api/dashboard/stats` on T 200; membership untouched. Hotel variant RED until C2.2 (F3).
- [ ] F (guard test): `owner/Admin` member without active operator → every `/api/platform-*` and global registry 403.
- [ ] G (guard test): eligible operator with `operators.manage` reactivates B → B active; capabilities per D13 (today restored; RED only if D13 = explicit re-grant).
- [ ] H (guard test): tenant Admin, partial operator, operator with only `operators.manage` (not eligible) → reactivate 403.
- [ ] I (guard test): operator without `operators.manage` → self-grant 403; full operator self-grant 403.
- [ ] J (guard test): operator `POST /api/platform-tenants` for a customer → `createdBy` = operator, zero memberships for operator; tenant application approval → `owner/Admin` membership belongs to the applicant.
- [ ] RED F8 (D14): partial operator with `platform.users.manage` + tenant selection → `PATCH /api/users/:operatorMemberId/suspend` → 403, operator status unchanged.
- [ ] RED F9: eligible operator `PATCH /api/admin/owners/:self/ban|suspend` → 403 self-action, account and operator unchanged.
- [ ] GREEN: minimal changes in the files above; no new status, model or capability.

## C2.1 — Hotel operator authority in TENANT (F1; spec-compliance of PA-04C)

Files: `server/controllers/hotelController.js`; new `server/__tests__/hotelTenantAuthority04C2.mongo.integration.test.js`.

- [ ] RED G: operator `platform.support.read` + Tenant A (User.role Admin and Collaborateur) → GET 403, deactivate 403, unchanged.
- [ ] RED F: `platform.hotels.read` + A → GET 200, deactivate 403; `platform.hotels.manage` + A → deactivate 200.
- [ ] RED E: operator manage + A → Hotel B and `tenant:null` refused; inactive operator → 403.
- [ ] GREEN: TENANT branch requires the exact capability when `req.isPlatformOperatorContext`.

## C2.2 — businessRole authority (F3; D2, D4)

Files: `server/controllers/hotelController.js`, `server/constants/hotelAccessConstants.js` (`HOTEL_TENANT_ROLES`), reuse `server/services/tenantMembershipService.js`.

- [ ] RED I: `User.role Admin` + `businessRole null` member → 403 GET/deactivate.
- [ ] RED I: `User.role Client` + `businessRole Admin` active member → 200 GET/deactivate.
- [ ] RED: Collaborateur/GestionnaireImmobilier per D2; Secretaire/Communicant 403; CommunityManager per D2; ambiguous memberships 403; legacy founder without membership 403 on hotel administration.
- [ ] GREEN: `assertHotelAdministrationAuthority(req, hotel, { action })`; delete `isHotelAdministrationActor`; lists use the same decision.

## C2.3 — Operational access + tenant:null hotel elimination (F4)

Files: `server/services/hotel/hotelAccessScopeService.js`, `server/services/hotel/hotelStaffAssignmentService.js`, `server/controllers/hotelController.js` (`createFull` `/mine`, `duplicate`), `server/services/accommodationService.js` (`resolveHotel`), `server/models/Hotel.js` (create-only `tenant` requirement). Tests: the five F2.6 suites (align), `hotelTenantAuthority04C2`.

- [ ] RED J: `tenant:null` hotel managed by a Tenant A member → not operable by Tenant A administration (rooms/FAQ 404/403), absent from `/hotels/accessible` administration list.
- [ ] RED K: manager self-service → own hotel 200, other hotel 403, no tenant administration (`/admin/list` 403).
- [ ] RED B: independent (no `owner` membership) `POST /api/hotels/mine` → 403 `HOTEL_ORGANIZATION_REQUIRED`, nothing created (Property, Accommodation, Hotel all absent).
- [ ] RED: duplicate of a `tenant:null` hotel → refused; `Hotel.create` without tenant → ValidationError; saving an existing legacy `tenant:null` hotel still works.
- [ ] GREEN, then align F2.6 suites (canonical memberships, direct `tenant`), one replacement test per removed behaviour.

## C2.4 — Patrimony resolver (D7)

Files: new `server/services/platformTenant/patrimonyService.js`; new `server/__tests__/patrimonyService.mongo.integration.test.js`.

- [ ] RED A: user without membership + several `tenant:null` properties + no hotel → `independent`, `assertPatrimonyConsistency` valid.
- [ ] RED: active `owner` membership on one active tenant → `organisation` with that tenant; `member` only → `independent`; two `owner` tenants → `ambiguous`; suspended tenant / revoked membership → not organisation.
- [ ] RED D: holder with an own `tenant:null` Property → `assertPatrimonyConsistency` reports `HYBRID_HOLDER`.
- [ ] RED: mandated third-party owner (no membership, property `tenant:T` created by import) → valid (`MANDATE_OWNER`).
- [ ] GREEN (pure reads, no `createdBy`, no `User.role`, no `legacy_fallback`).

## C2.5 — Creation guards (prevent new hybrids)

Files: `server/controllers/propertyController.js` (`createProperty` owner path), `server/controllers/propertyMobileController.js`, `server/controllers/accommodationController.js` (`create`), `server/routes/propertyRoutes.js` only if a resolver middleware is needed. Tests: `propertyAuthorityFinal2E1XG`, `propertyTenantAuthority2E1X` (extend), new cases in `patrimonyService`.

- [ ] RED: holder `POST /api/properties` → `tenant = T`; `/mobile` → `T`; ambiguous holder → 409 `PATRIMONY_TENANT_AMBIGUOUS`; forged body/header ignored.
- [ ] RED: plain member and independent → `tenant:null` (PROPERTY-PERSONAL-03 / PROPERTY-OWN-05 unchanged).
- [ ] RED: owner `POST /api/accommodations` → `Accommodation.tenant === property.tenant` whatever the requester context; `User.role Admin` on another user's property → 403.
- [ ] GREEN.

## C2.6 — Independent → Organisation transition (D8, D9)

Files: `server/services/platformTenant/tenantApplicationService.js` (`approveApplication`), new `server/services/platformTenant/patrimonyTransferService.js`; tests `server/__tests__/tenantApplication*.mongo.integration.test.js` (extend), new `patrimonyTransfer04C2.mongo.integration.test.js`.

- [ ] RED C: approval → tenant + root + `owner/Admin` membership + eligible properties `tenant=T` + their accommodations `tenant=T` + manager-owned hotels `tenant=T` + RentalManagement followed, all in one transaction; one ActionLog per transferred document.
- [ ] RED L: property with in-progress Transaction / divergent RentalManagement / hotel with `manager ≠ createdBy` → approval 409 `PATRIMONY_TRANSFER_REVIEW_REQUIRED`, **nothing** committed (no tenant, no membership, no transfer).
- [ ] RED: sold/archived properties stay `tenant:null`; financial documents, payments, allocations, refunds, completed reservations unchanged; `RentalMaintenanceTicket` untouched.
- [ ] RED: idempotent re-run; failure injection after transfer → full rollback (`failurePoint` pattern already used by approveApplication).
- [ ] RED: concurrent personal creation after commit → `tenant=T` (C2.5 guard).
- [ ] GREEN: transfer by `_id` with CAS `{ _id, tenant: null }`; mismatch → abort.

## C2.7 — Historical discovery dry-run (read-only)

Files: new `server/scripts/patrimonyInvariantDiscovery.js` (reuse 1H `resolveReadOnlyConnection`), test `server/__tests__/patrimonyInvariantDiscovery.mongo.integration.test.js`.

- [ ] RED: classifies INDEPENDENT_CLEAN, TENANT_CLEAN, HYBRID_HOLDER, LEGACY_FOUNDER, EX_OPERATOR_DANGEROUS_FALLBACK, HOTEL_TENANT_NULL, ACCOMMODATION_TENANT_DIVERGENT, MEMBER_WITH_ORG_HOTEL_AND_PERSONAL_ASSETS, MANDATE_OWNER, AMBIGUOUS on fixtures.
- [ ] RED: zero writes (collection write spies), refuses `--commit/--apply/--write/--execute`, output has counts + truncated SHA-256 ids only.
- [ ] GREEN.

## C2.8 — Founder canonical backfill tooling (local/test only; D1, D5, D15)

Files: `server/scripts/backfillTenantMembershipsDryRun.js`, `server/scripts/backfillTenantMembershipsApply.js` (founder step), tests of both.

- [ ] RED: discovery classifies createdBy-only founders as `REVIEW_ATTESTATION_REQUIRED` (never automatic, D15); founder step applies only to human-attested candidates listed in an explicit input file, creates `owner/Admin` membership (CAS "still zero memberships"), ActionLog, transaction, `--live --commit` required, idempotent; ex-operators skipped; then `transferPatrimony` dry-run report for that founder.
- [ ] RED: last-admin — `countActiveAdmins` ≥ 1 after; rollback via `tenantMemberService` cannot remove the last Admin.
- [ ] GREEN. No execution against any non-test database.

## C2.9 — Web/Mobile compatibility (D10)

- [ ] Web: `/mes-hotels` creation surfaces `HOTEL_ORGANIZATION_REQUIRED` with a link to the applicant flow (new applicant page only if D10 = parity); Vitest for the message.
- [ ] Mobile: verify `ChoixTypeAnnonceScreen` → `FirstOrganizationOnboardingScreen` path still matches backend codes; Jest.
- [ ] No PLATFORM UI on mobile.

## C2.10 — Full certification

- [ ] `npm run test:mongo` (8/8 shards), `npm run test:unit`, client `npx vitest run`, mobile `npx jest`, ESLint JSON (no new warnings in touched files), isolated Next build, `certify:architecture`, `certify:tenant`, `git diff --check`, worktree hash preservation.
- [ ] Run discovery on the local dev database only if the user authorises it; never production.

## Expected production files

`tenantContextService.js`, `platformOperatorService.js`, `adminController.js`, `userController.js`/`userRoutes.js` (D14), `hotelController.js`, `hotelAccessScopeService.js`, `hotelStaffAssignmentService.js`, `hotelAccessConstants.js`, `accommodationService.js`, `models/Hotel.js`, `propertyController.js`, `propertyMobileController.js`, `accommodationController.js`, `tenantApplicationService.js`, new `patrimonyService.js`, new `patrimonyTransferService.js`, new `scripts/patrimonyInvariantDiscovery.js`, `scripts/backfillTenantMemberships{DryRun,Apply}.js`; Web `HotelPropertyForm.jsx`/`hotelService.js` (error surfacing) per D10.

## Expected test files

New: `platformOperatorLifecycle04C2`, `hotelTenantAuthority04C2`, `patrimonyService`, `patrimonyTransfer04C2`, `patrimonyInvariantDiscovery` (all `.mongo.integration.test.js`). Extended/aligned: `tenantHardening`, `propertyAuthorityFinal2E1XG`, `propertyTenantAuthority2E1X`, tenant application suites, five F2.6 hotel suites, `hotelAdminListsTenantScope`, `platformAdminCert1.domains`, `tenantScopeAudit2bHotel`, `tenantCert2.adversarial`, `mobileAccommodationPublication*`, backfill suites, unit `hotelAccessScopeService.test.js`, `hotelOperationsRoutes.test.js`, `hotelRoutes.test.js`; client tests for hotel creation errors.
