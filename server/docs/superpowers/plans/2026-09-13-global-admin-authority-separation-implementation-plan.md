# Global Admin Authority Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not use subagents unless the user explicitly authorizes delegation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate global Admin identity, sensitive PlatformOperator capabilities, tenant membership authority, and resource ownership without migrating historical data or reducing `User.role`.

**Architecture:** Global-sensitive HTTP operations require `protect → restrictTo('Admin') → requirePlatformOperatorCapability(capability)`. Tenant-internal operations require a canonically resolved tenant and `OrgMembership.businessRole`; ownership branches remain independent. Delivery is incremental: certify existing primitives, fix new-founder provisioning, migrate only complete tenant families, then make web/mobile tenant discovery membership-based.

**Tech Stack:** Node.js 20+, Express 4, Mongoose 8, Jest/Supertest/MongoMemoryReplSet, Next.js 15/React 18/Vitest, React Native/Expo/Jest.

**Spec:** `docs/superpowers/specs/2026-09-13-global-admin-authority-separation-design.md`

## Global Constraints

- Exactly three target global roles: `Admin`, `Proprietaire`, `Client`; do not reduce the current enum in 2B.
- `PlatformOperator` is a capability layer for a global Admin, never a fourth global role.
- GLOBAL-05 is fixed: active PlatformOperator + correct capability + `User.role !== 'Admin'` is denied.
- Tenant authority comes only from active `OrgMembership.businessRole` in the resolved tenant.
- Do not use `User.role='Admin'` or PlatformOperator as an implicit tenant-admin bypass.
- Do not infer membership, tenant, or business role from request body or an unvalidated header.
- Keep `roleInUnit` and `businessRole` as separate dimensions.
- Preserve ownership/participant authority; do not convert it artificially into membership authority.
- Do not change historical User or OrgMembership documents; do not backfill or access production.
- Do not remove `allowLegacyRoleFallback`; retirement belongs to 2D.
- Do not redesign `Prestataire`; cleanup belongs to 2F.
- Do not commit, push, deploy, reset, restore, checkout, clean, or stash during this mission.
- Preserve all pre-existing dirty-worktree changes and re-read overlapping files immediately before editing.

---

## 1. Initial repository state

The 2B.1 audit was performed from `server/` on 2026-09-13. The worktree was already heavily modified across backend, client, and mobile. In particular, future 2B files already dirty or untracked include:

- `models/OrgMembership.js`, `constants/organizationConstants.js`, `routes/userRoutes.js`, `server.js`;
- untracked `middleware/tenantMembershipRole.js`, `services/tenantMembershipService.js`, `routes/tenantMemberRoutes.js`, `services/tenantMemberService.js` and their tests;
- `client/lib/pages/dashboard/AdminDashboard.jsx` plus untracked `MembersPanel.jsx`, its service and tests.

The implementation session must snapshot `git status --short` and `git diff -- <file>` before every overlapping edit. It must add only 2B hunks and never normalize or overwrite surrounding user changes.

Verified current model contracts:

- `models/User.js`: enum still contains ten values; default `Client`.
- `models/OrgMembership.js`: `businessRole` is nullable and enumerated from `TENANT_BUSINESS_ROLES`.
- `constants/organizationConstants.js`: canonical roles are Admin, Collaborateur, Secretaire, GestionnaireImmobilier, CommunityManager, Communicant.
- `models/PlatformOperator.js`: one auditable operator record per User with active/suspended/revoked status and fine capabilities.
- `models/PlatformTenant.js`: tenant points to a unique root OrgUnit and records `createdBy`.
- `models/TenantApplication.js`: records applicant, provisioned tenant and provisioned membership.

No production service or database was accessed during planning.

## 2. Current authority inventory

| Primitive | Current behavior | 2B treatment |
|---|---|---|
| `authMiddleware.protect` | Authenticates User and attaches `req.user` | Keep |
| `authMiddleware.restrictTo` | Compares allowed values directly with `req.user.role` | Use only for global identity and temporarily on deferred legacy routes |
| `middleware/platformAuthority.js` | Resolves active operator and checks one capability, but does not itself require global Admin identity | Compose after `restrictTo('Admin')`; add contract tests |
| Inline capability guards in `platformTenantRoutes.js` and `platformOperatorRoutes.js` | Duplicate the canonical middleware | Replace with shared middleware after RED tests |
| `utils/iamArchitecture.js` | Projects legacy `User.role`, including `Admin → ['*']` | Keep for deferred legacy RBAC; never treat as PlatformOperator or membership authority |
| `middleware/capabilityMiddleware.js` | Authorizes named capabilities from legacy User.role projection | Replace only in fully migrated tenant families; do not globally rewrite in 2B |
| `middleware/tenantContext.js` | Validates requested tenant; also recognizes operator selection and a bounded legacy founder fallback | Keep; membership role guard remains separate |
| `resolveTenantMembership` | Membership businessRole first; optional User.role fallback | Keep fallback, explicitly disable it on new/migrated routes |
| `requireTenantMembershipRole` | Canonical tenant role guard; fallback off by default; no operator bypass | Reference implementation |
| `/api/members` | Canonical tenant Admin surface | Already compliant; certify |
| `PlatformTenantRuntimeContext` web/mobile | Runs only for global Admin and requires active operator before listing tenants | Migrate to accessible-tenant discovery independent of global role/operator |

## 3. Route and surface classification

Counts below are classification rows (coherent route families/surfaces), not Mongo records: **GLOBAL 5, TENANT 15, OWNERSHIP 7, MIXED 8, NEEDS_ARCHITECTURE_DECISION 10**.

| Class | File / mounted surface | Endpoints | Current authority | Target authority / capability | Tenant context | Status |
|---|---|---|---|---|---|---|
| GLOBAL | `routes/platformOperatorRoutes.js` `/api/platform-operators` | `GET /me`; list/grant/suspend/reactivate/revoke | Admin then inline `platform.operators.manage`; `/me` Admin-only | Admin + shared `platform.operators.manage`; `/me` Admin identity baseline | No | Existing contract; deduplicate |
| GLOBAL | `routes/platformTenantRoutes.js` application review | list/read/start-review/request-changes/approve/reject/review-document | Service checks operator capabilities, but routes only `protect` | Admin + matching existing `platform.tenant_applications.*` guard at route boundary; keep service defense | No | Migrate 2B |
| GLOBAL | `routes/platformTenantRoutes.js` tenant governance | list/create and cross-tenant `:id` operations | Admin + inline operator or own-tenant branch | Global list/create: Admin + `platform.tenants.read/manage`; cross-tenant: same. Own-tenant administration must move to a separate membership route before removing legacy branch | No for global; explicit selected tenant for scoped global | Partial; split/defer own-tenant branch |
| GLOBAL | `routes/adminRoutes.js` owner/user administration | `/owners*` | Admin + canonical `platform.users.read/manage` | Keep | No | Already compliant |
| GLOBAL | `routes/userRoutes.js` global identity mutation | create/suspend/activate/role/update/delete | Admin + `platform.users.manage`; additional tenant scoping remains | Admin + capability; remove accidental tenant dependency only after adversarial tests | No for global mutation | Certify before any simplification |
| TENANT | `routes/tenantMemberRoutes.js` `/api/members` | all | tenant context + membership Admin | Keep `requireTenantMembershipRole('Admin')` | Required | Already compliant |
| TENANT | `routes/crmRoutes.js` | all `/api/crm` | User.role STAFF + tenant scope + legacy capability | membership roles mapped from existing STAFF/MANAGER sets | Required | Candidate wave 1 after controller query audit |
| TENANT | `routes/crmAutomationRoutes.js` | rules/runs/score/cockpit | User.role STAFF/MANAGERS + tenant scope | membership role guard | Required | Candidate wave 1 |
| TENANT | `routes/marketingRoutes.js` | templates/campaigns | User.role STAFF/MANAGERS + tenant scope | membership role guard | Required | Candidate wave 1 |
| TENANT | `routes/reportingRoutes.js` | reporting reads | User.role direction + tenant or operator-wide mode | tenant membership for tenant mode; Admin + `platform.reporting.read` for global mode | Required except explicit global operator mode | Mixed implementation task |
| TENANT | `routes/dashboardRoutes.js` | stats | User.role staff + tenant scope | membership roles | Required | Candidate wave 1 |
| TENANT | `routes/documentRoutes.js`, `dossierRoutes.js` | documents/dossiers | tenant scope + legacy capabilities/User.role | membership Secretaire/Collaborateur/Admin as proven; keep resource adapter checks | Required | Deferred until adapter role reads migrate atomically |
| TENANT | `routes/rentalLeaseLifecycleRoutes.js` | lifecycle | User.role STAFF_IMMO | membership Admin/GestionnaireImmobilier/Collaborateur + resource tenant scope | Required | Candidate only with full service audit |
| TENANT | `routes/rentalContractRegularizationRoutes.js` | reconstruct/revert | User.role and tenant scope | membership roles; Admin businessRole for revert | Required | Candidate only with service role-check migration |
| TENANT | `routes/rentalManagementRoutes.js` internal branch | onboarding/admin CRUD/lifecycle | legacy capabilities and User.role | membership roles | Required | Deferred: route mixes owner branch |
| TENANT | `routes/transactionRoutes.js` internal branch | transaction management | STAFF_DOC/Admin | membership roles | Required | Deferred pending finance policy |
| TENANT | `routes/companyEmailRoutes.js` | company email config | all staff/Admin, no proven tenant boundary on all handlers | membership role plus tenant-scoped persistence | Required | NEEDS data-scope proof before migration |
| TENANT | `routes/erpRoutes.js` | ERP center | Admin + tenant scope | membership Admin | Required | Candidate after ERP service scope audit |
| TENANT | `routes/apiPlatformAdminRoutes.js` | keys/call logs/webhooks | Admin + tenant scope | membership Admin if keys are tenant-owned; otherwise global capability needed | Required currently | Do not migrate until ownership of API keys is proven |
| TENANT | `routes/actionLogRoutes.js` | logs/stats/recent/export | Admin + tenant scope | membership Admin for tenant logs | Required | Deferred because global audit-log capability also exists |
| OWNERSHIP | `routes/platformTenantRoutes.js` application applicant branch | `/applications/me*`, create/update/documents/submit | authenticated Proprietaire + applicant checks in service | Global Proprietaire + application ownership | No tenant before provisioning | Preserve |
| OWNERSHIP | `routes/propertyRoutes.js` owner branches | create/mine/update/delete/submit/duplicate | Proprietaire/owner mixed with staff | Property.owner for external owner; tenant membership for staff branch | Optional for owner; required for staff | Preserve/split later |
| OWNERSHIP | `routes/rentalManagementRoutes.js` owner branch | `/owner/payments`, `/owner/my`, `/:id/owner/:action` | Proprietaire + owner checks | Proprietaire + resource ownership | No implicit membership | Preserve |
| OWNERSHIP | `routes/visiteRoutes.js` owner branch | owner list/count/actions | Proprietaire or Admin plus controller ownership | Proprietaire + ownership; remove Admin ownership substitute only after policy decision | No for owner | Preserve owner branch; Admin ambiguous |
| OWNERSHIP | `routes/accommodationReservationRoutes.js` guest branch | create/get/cancel/refund | authenticated guest/owner mixed with staff | reservation guest/owner participation | No for client branch | Preserve |
| OWNERSHIP | `routes/conversationRoutes.js` participant branch | start/my-inbox/get/messages/read | authenticated participant checks | participant authority | No for external branch | Preserve |
| OWNERSHIP | `routes/authRoutes.js`, self branch of `userRoutes.js` | profile/password/me/contract | authenticated self | global identity + self ownership | No | Preserve |
| MIXED | `routes/conversationRoutes.js` staff inbox and conversation access | staff-inbox and staff access to conversations | ALL_STAFF + tenant context plus participant logic | membership role for staff, participation for external, explicit platform support capability for global | Branch-specific | Deferred; recent dirty messaging changes |
| MIXED | `routes/accommodationRoutes.js` | owner CRUD, admin moderation, staff calendar | User.role staff/Proprietaire + scope/ownership/operator | ownership + membership + explicit platform capabilities | Branch-specific | Deferred |
| MIXED | `routes/hotelRoutes.js` | owner/staff/moderation operations | User.role, Hotel.manager, assignments, tenant/operator scope | ownership/assignment + membership + explicit platform capability | Branch-specific | Deferred |
| MIXED | `routes/hotelReservationRoutes.js` | admin lists and reservation operations | staff role, hotel assignment, operator capability, guest | membership/assignment/guest + operator capability | Branch-specific | Deferred |
| MIXED | `routes/accommodationReservationRoutes.js` finance/staff operations | payments/refunds/deductions/transitions | User.role accounting/admin, ownership, operator context | membership accounting roles + guest ownership + platform finance capability | Branch-specific | Deferred; files already dirty |
| MIXED | `routes/contratRoutes.js`, `paiementRoutes.js` | leases/payments | legacy capability, staff role, owner/tenant resource | membership + ownership + platform capability where explicitly global | Branch-specific | Deferred |
| MIXED | `routes/platformTenantRoutes.js :id` | overview/settings/theme/domain/features/subscription | Admin identity + own-tenant membership existence OR operator capability | separate tenant-admin and global-operator entry contracts | Yes for tenant branch | Must split before migration |
| MIXED | `routes/userBusinessProfileRoutes.js` | self/staff/global mutations | self, staff role, Admin | self ownership; tenant staff membership for scoped read; Admin + users capability for global mutation | Branch-specific | Deferred |
| NEEDS_ARCHITECTURE_DECISION | `routes/propertyRoutes.js`, `adminPropertyRoutes.js`, property part of `adminRoutes.js` | moderation/recommend/delete/admin CRUD | Admin/staff plus partial tenant scope | Decide global moderation vs tenant moderation vs dual-mode | Unknown | Leave unchanged |
| NEEDS_ARCHITECTURE_DECISION | `controllers/hotelController.js`, hotel services | Admin bypass versus owner/manager/tenant | User.role Admin often broad | Decide global moderation versus tenant operation per endpoint | Unknown | Leave unchanged |
| NEEDS_ARCHITECTURE_DECISION | reservation/finance controllers and `financialAuthorizationService.js` | override, reverse, approve/refund | Admin/accounting/operator/ownership hybrid | Decide tenant finance Admin vs platform finance override | Unknown | Leave unchanged |
| NEEDS_ARCHITECTURE_DECISION | review/comment routes/controllers | moderation/delete/respond | Admin direct and author ownership | Decide platform content moderation versus tenant moderation | Unknown | Leave unchanged |
| NEEDS_ARCHITECTURE_DECISION | `routes/visiteRoutes.js` Admin alternatives | owner actions and global staff lists | Admin accepted beside Proprietaire/staff | Decide support override vs tenant staff vs owner | Unknown | Leave Admin paths unchanged |
| NEEDS_ARCHITECTURE_DECISION | `routes/publiciteRoutes.js` | create/update/delete | Admin only | Decide global marketing governance or tenant marketing | Unknown | Leave unchanged |
| NEEDS_ARCHITECTURE_DECISION | `routes/exportRoutes.js` and marketing export UI | exports | Admin only | Decide platform-wide export capability versus tenant export | Unknown | Leave unchanged |
| NEEDS_ARCHITECTURE_DECISION | `routes/actionLogRoutes.js` global possibility | log export/read | Admin + required tenant | Decide whether platform audit uses `platform.audit.read` on separate route | Unknown | Leave unchanged |
| NEEDS_ARCHITECTURE_DECISION | `services/zohoImapService.js` fallback recipient | first active User.role Admin | role-based operational fallback | Decide configured account/capability/tenant recipient | No route context | Leave unchanged |
| NEEDS_ARCHITECTURE_DECISION | `routes/contactRoutes.js`, quote/service/portfolio moderation | contact and cross-pole backoffice | heterogeneous Admin/staff sets | Decide global agency backoffice versus tenant ownership | Unknown | Leave unchanged |

## 4. Future files by responsibility

### Backend files to modify in certain tasks

- `middleware/platformAuthority.js`: expose the single capability guard; keep capability check independent but always compose with Admin at global routers.
- `routes/platformOperatorRoutes.js`: replace inline operator capability guard.
- `routes/platformTenantRoutes.js`: add Admin identity to application-review routes, use canonical capability guard, remove duplicate guard for global list/create; do not rewrite ambiguous `:id` tenant branch in the same task.
- `services/platformTenant/tenantApplicationService.js`: pass `businessRole:'Admin'` to founder membership creation only.
- `routes/tenantMemberRoutes.js`, `middleware/tenantMembershipRole.js`, `services/tenantMembershipService.js`: normally test-only certification; runtime edits only if a failing invariant exposes a defect.
- First certain tenant wave after preflight: `routes/crmRoutes.js`, `routes/crmAutomationRoutes.js`, `routes/marketingRoutes.js`, `routes/dashboardRoutes.js`, plus their controllers/services only where direct User.role authorization remains.
- `utils/iamArchitecture.js`, `middleware/capabilityMiddleware.js`, `utils/roles.js`: do not globally rewrite; document as legacy bridge. Change only if extracting a membership-aware helper becomes necessary for the selected complete route family.

### Frontend/mobile files to modify

- `client/lib/context/PlatformTenantRuntimeContext.jsx`
- `client/lib/services/platformTenantService.js`
- `client/lib/services/platformOperatorService.js` only if response composition changes
- `client/lib/components/dashboard/PlatformOperatorContextSwitcher.jsx` (rename/generalize UI only if tests show operator-specific copy blocks members)
- `client/lib/pages/dashboard/AdminDashboard.jsx` only for displaying the selector to eligible tenant members, not for global authorization
- `client/lib/context/AuthContext.jsx`: no global can-helper rewrite in the first wave
- `client/lib/navigation/postAuthDestination.js`: regression only; preserve global redirects
- `altimmo-app/src/context/PlatformTenantRuntimeContext.jsx`
- `altimmo-app/src/services/platformTenantService.js`
- mobile selector/navigation consumer if one exists at execution time; do not create a new screen merely for parity.

### Tests to create or extend

- Create `__tests__/globalAdminAuthority2B.mongo.integration.test.js`.
- Extend `__tests__/tenantApplicationPhase1.mongo.integration.test.js` for founder assertions.
- Extend `__tests__/tenantMembershipRole.mongo.integration.test.js` and `tenantMemberApi.mongo.integration.test.js` for the complete TENANT matrix.
- Add per-family integration tests before each tenant route migration, e.g. `__tests__/crmTenantMembershipAuthority2B.mongo.integration.test.js`.
- Extend `client/lib/__tests__/PlatformTenantRuntimeContext.test.jsx` if present; otherwise create it.
- Extend `altimmo-app/src/context/__tests__/PlatformTenantRuntimeContext.test.jsx`.
- Extend `client/lib/__tests__/postAuthDestination.test.js`.

## 5. Ordered implementation tasks

### Task 1: Freeze the route inventory and certify the global authority primitive

**Objective:** Make GLOBAL-01..08 executable against a minimal Express probe and selected live global routes before changing production code.

**Files:**
- Create: `__tests__/globalAdminAuthority2B.mongo.integration.test.js`
- Inspect/possibly modify after RED: `middleware/platformAuthority.js`
- Test live composition: `routes/platformOperatorRoutes.js`, `routes/platformTenantRoutes.js`, `routes/adminRoutes.js`

**Current verified behavior:** `requirePlatformOperatorCapability` checks an active operator/capability but does not check `User.role`; some routers compose it after Admin, tenant-application review routes rely on service checks, and two routers duplicate local guards.

- [ ] Write GLOBAL-01 non-authenticated request test expecting 401.
- [ ] Write GLOBAL-02 Client test expecting 403 before operator lookup can authorize.
- [ ] Write GLOBAL-03 Proprietaire test, including a tenant Admin membership, expecting 403.
- [ ] Write GLOBAL-04 Admin with no operator test expecting 403 on `platform.tenants.manage` or `platform.users.manage`.
- [ ] Write GLOBAL-05 non-Admin PlatformOperator with the correct capability expecting 403.
- [ ] Write GLOBAL-06 Admin + active operator + correct capability expecting the probe/live operation to reach a harmless test handler.
- [ ] Write GLOBAL-07 Admin + wrong capability expecting 403.
- [ ] Write GLOBAL-08 Admin + suspended/revoked operator expecting 403.
- [ ] Run RED: `npx jest --runInBand __tests__/globalAdminAuthority2B.mongo.integration.test.js`; GLOBAL-05 must fail for the expected missing Admin composition, not fixture/setup errors.
- [ ] Minimal implementation: create or compose a named global-sensitive chain from existing `protect`, `restrictTo('Admin')`, and `requirePlatformOperatorCapability`; do not add capabilities.
- [ ] Run GREEN with the same command.
- [ ] Regression: `npx jest --runInBand __tests__/platformAdmin1.adversarial.mongo.integration.test.js __tests__/platformAdminCert1.vulnerabilities.mongo.integration.test.js`.

**GO:** all eight cases pass and non-Admin operator is denied. **NO-GO:** middleware alone would need tenant membership or a new capability; stop and revise design.

### Task 2: Migrate only certain global-sensitive routes to the canonical chain

**Objective:** Eliminate duplicate/hiding global guards while preserving capability names and endpoint responses.

**Files:**
- Modify: `routes/platformOperatorRoutes.js`
- Modify: `routes/platformTenantRoutes.js`
- Modify only if tests demand: `controllers/tenantApplicationController.js`, `services/platformTenant/tenantApplicationService.js` authorization entry points
- Test: `__tests__/globalAdminAuthority2B.mongo.integration.test.js`, `__tests__/tenantApplicationPhase1.mongo.integration.test.js`, existing platform suites

**Target mapping:**

- operator mutations → Admin + `platform.operators.manage`;
- tenant list/read → Admin + `platform.tenants.read`;
- tenant create/mutate cross-tenant → Admin + `platform.tenants.manage`;
- application list/read/document → Admin + `platform.tenant_applications.read`;
- start-review → Admin + `.review`;
- request changes → Admin + `.request_changes`;
- approve → Admin + `.approve`;
- reject → Admin + `.reject`.

- [ ] Add RED route tests for non-Admin operator on each capability family and an Admin with the exact capability.
- [ ] Run targeted RED; verify current service-only routes reach service or differ from the target route-boundary refusal.
- [ ] Replace inline guards with `middleware/platformAuthority.js` and place `restrictTo('Admin')` before them.
- [ ] Do not alter applicant-owned `/applications/me*` routes.
- [ ] Do not convert own-tenant `/:id` administration in this task; record it as mixed.
- [ ] Run GREEN: global test plus `tenantApplicationPhase1.mongo.integration.test.js` and `platformAdmin1.adversarial.mongo.integration.test.js`.

**GO:** exact capabilities are enforced at routes and service defense remains compatible. **NO-GO:** an applicant route becomes Admin-only or own-tenant behavior changes.

### Task 3: Provision new founders as tenant Admin without global mutation

**Objective:** Change only new approval-time membership creation.

**Files:**
- Modify: `services/platformTenant/tenantApplicationService.js` around `organizationService.grantMembership`
- Test: `__tests__/tenantApplicationPhase1.mongo.integration.test.js`

- [ ] Add FOUNDER-01: reload applicant after approval and expect `role === 'Proprietaire'`.
- [ ] Add FOUNDER-02/03/04: provisioned membership is `roleInUnit='owner'`, `businessRole='Admin'`, `status='active'`.
- [ ] Add FOUNDER-05: no User with an implicitly promoted global Admin identity is created/updated.
- [ ] Add FOUNDER-06: `PlatformOperator.countDocuments({user: applicant}) === 0` after approval.
- [ ] Add FOUNDER global-denial assertion using a sensitive route.
- [ ] Run RED: `npx jest --runInBand __tests__/tenantApplicationPhase1.mongo.integration.test.js`; FOUNDER-03 must report `null` versus `Admin`.
- [ ] Minimal implementation: add `businessRole: 'Admin'` to the existing `grantMembership` arguments; change no model/default/backfill.
- [ ] Run GREEN with the same suite.
- [ ] Regression: `tenantMemberApi`, `tenantMembershipRole`, `tenantMembershipService`, and founder concurrency/idempotency tests.

**GO:** only the newly provisioned membership changes and transaction rollback/idempotency remain green. **NO-GO:** any User role or historical membership write is observed.

### Task 4: Complete the tenant authority matrix on the canonical `/api/members` surface

**Objective:** Establish reusable proof before migrating other tenant families.

**Files:**
- Extend: `__tests__/tenantMembershipRole.mongo.integration.test.js`
- Extend: `__tests__/tenantMemberApi.mongo.integration.test.js`
- Runtime files only on demonstrated defect: `middleware/tenantMembershipRole.js`, `services/tenantMembershipService.js`, `routes/tenantMemberRoutes.js`

- [ ] TENANT-01 no membership → 403.
- [ ] TENANT-02 tenant-A membership with tenant-B header → 403.
- [ ] TENANT-03 allowed businessRole → success.
- [ ] TENANT-04 wrong businessRole → 403.
- [ ] TENANT-05 global Admin without membership → 403.
- [ ] TENANT-06 PlatformOperator without membership → 403.
- [ ] TENANT-07 Proprietaire + membership Admin → `/api/members` allowed.
- [ ] TENANT-08 same User Admin in A and Collaborateur in B → allow Admin endpoint only in A and collaborator endpoint only in B.
- [ ] TENANT-09 body `businessRole:'Admin'` cannot elevate caller.
- [ ] TENANT-10 forged/inaccessible tenant header fails closed.
- [ ] Confirm fallback remains tested only on explicit opt-in route and disabled on `/api/members`.
- [ ] Run: `npx jest --runInBand __tests__/tenantMembershipRole.mongo.integration.test.js __tests__/tenantMemberApi.mongo.integration.test.js __tests__/tenantMembershipService.mongo.integration.test.js`.

**GO:** matrix passes without runtime change or with a minimal proven fix. **NO-GO:** any operator/global Admin bypass remains.

### Task 5: Preflight and migrate the first complete tenant route family

**Objective:** Migrate one coherent family, not all legacy staff routes. Recommended first family: CRM + CRM automation, because both already require tenant scope at router level and their services are tenant-oriented.

**Files:**
- Create: `__tests__/crmTenantMembershipAuthority2B.mongo.integration.test.js`
- Modify: `routes/crmRoutes.js`, `routes/crmAutomationRoutes.js`
- Inspect/modify only direct authority reads: `controllers/crmController.js`, `controllers/crmAutomationController.js`, `services/crmService.js`, related automation service

**Role mapping to preserve:** existing `STAFF` endpoints accept all six tenant business roles; existing `MANAGERS` endpoints accept exactly the current route set. Derive these sets from existing constants and encode them as `businessRole` arguments; do not invent semantics.

- [ ] Audit every handler query for a tenant key/scope derived from `req.platformTenant`, never body/header directly.
- [ ] If any handler is global or unscoped, mark the family `DEFERRED_DEPENDENCY` and stop Task 5 without runtime changes.
- [ ] Write RED tests for TENANT-01, 02, 03, 04, 05, 06, 07, 08, 09 and 10 against representative read and mutation routes.
- [ ] Run RED and verify failure comes from legacy User.role authority.
- [ ] Replace route `restrictTo(...STAFF/MANAGERS)` with `attachTenantContext`/existing required scope ordering plus `requireTenantMembershipRole({roles, allowLegacyRoleFallback:false})`.
- [ ] Remove controller/service User.role authority only where the route test covers the same operation; retain ownership logic if present.
- [ ] Run GREEN.
- [ ] Regression: `crm.mongo.integration.test.js`, `crmAutomation.mongo.integration.test.js`, `crmIndexGate1.mongo.integration.test.js`, `marketingAutomation.mongo.integration.test.js` if shared services are used.

**GO:** full family queries are tenant-scoped and all matrix cases pass. **NO-GO:** partial scope, ownership branch loss, or reliance on legacy fallback; defer the entire family.

### Task 6: Optional second tenant wave—marketing/dashboard/ERP one family at a time

**Objective:** Repeat Task 5 only for a route family proven entirely tenant-scoped. This task is optional within 2B; ambiguity does not block certification of earlier tasks.

**Files:** `routes/marketingRoutes.js`, `routes/dashboardRoutes.js`, or `routes/erpRoutes.js` and exact controllers/services/tests for the selected family.

- [ ] Select one family only after documenting every endpoint and database query scope.
- [ ] Write a dedicated RED matrix file named `<family>TenantMembershipAuthority2B.mongo.integration.test.js`.
- [ ] Prove global Admin without membership and PlatformOperator without membership are denied.
- [ ] Prove allowed membership roles and cross-tenant denial.
- [ ] Apply the minimal membership guard and remove only corresponding direct User.role authority.
- [ ] Run dedicated GREEN and all existing family suites.
- [ ] Repeat only after a separate GO decision.

**GO:** one whole family is migrated atomically. **NO-GO:** mixed platform-wide mode, missing tenant field, or ambiguous business ownership; record `NEEDS_ARCHITECTURE_DECISION`.

### Task 7: Make web tenant discovery membership-based

**Objective:** Allow a Proprietaire tenant Admin to discover/select its tenant while keeping PlatformOperator capabilities and global routing separate.

**Files:**
- Modify: `client/lib/context/PlatformTenantRuntimeContext.jsx`
- Modify: `client/lib/services/platformTenantService.js`
- Modify backend route/service only if no member-safe list endpoint exists: `routes/platformTenantRoutes.js`, `controllers/platformTenantController.js`, `services/platformTenant/tenantContextService.js`
- Test: `client/lib/__tests__/PlatformTenantRuntimeContext.test.jsx`, backend tenant-context suite, `postAuthDestination.test.js`

**Current behavior:** provider exits for non-Admin, calls operator status first, and calls global `GET /platform-tenants`, which itself requires Admin + `platform.tenants.read`. Therefore simply removing the role guard would still deny a Proprietaire.

**Required API design:** expose a read-only authenticated endpoint such as `GET /api/platform-tenants/accessible` backed only by `resolveAvailableTenantsForUser(req.user.id)`. It returns active/trial tenants reachable through active memberships and does not use PlatformOperator to list every tenant. A separate operator call may continue populating `operator` for Admin UI.

- [ ] Backend RED: Client/Proprietaire without membership gets `[]`; Proprietaire with membership gets only its tenant; cross-tenant inaccessible tenant is absent; global Admin without membership gets `[]`; operator global list remains separately capability-gated.
- [ ] Frontend SWITCH-01: Proprietaire membership receives and can select tenant.
- [ ] SWITCH-02: Client with empty accessible response has no selected tenant/header.
- [ ] SWITCH-03: selecting tenant never changes the AuthContext User.role.
- [ ] SWITCH-04: switching A/B exposes the selected membership role if the API response includes a canonical `businessRole`; otherwise defer role-driven UI and assert only tenant ID isolation.
- [ ] SWITCH-05: persisted tenant not in fresh accessible list is cleared and never sent in `X-Platform-Tenant-Id`.
- [ ] Run frontend RED: `cd ../client && npm test -- --run lib/__tests__/PlatformTenantRuntimeContext.test.jsx lib/__tests__/postAuthDestination.test.js`.
- [ ] Implement minimal accessible endpoint and provider initialization for any authenticated user; keep `can('platform.*')` operator-only.
- [ ] Generalize storage/event names only if compatibility aliases are retained; do not break existing listeners in the same task.
- [ ] Run GREEN and backend tenant-context/global suites.

**GO:** membership-derived list controls selection; no role mutation or fabricated tenant. **NO-GO:** endpoint leaks all tenants to an operator/member or frontend must infer businessRole from User.role.

### Task 8: Apply the same switching contract to mobile

**Objective:** Match web semantics using SecureStore.

**Files:**
- Modify: `altimmo-app/src/context/PlatformTenantRuntimeContext.jsx`
- Modify: `altimmo-app/src/services/platformTenantService.js`
- Extend: `altimmo-app/src/context/__tests__/PlatformTenantRuntimeContext.test.jsx`

- [ ] Write SWITCH-01..05 mobile tests, including stale SecureStore selection clearing.
- [ ] Run RED: `cd ../altimmo-app && npm test -- --runTestsByPath src/context/__tests__/PlatformTenantRuntimeContext.test.jsx`.
- [ ] Replace Admin/operator-only initialization with accessible-tenants initialization; independently fetch operator status only where global capability UI needs it.
- [ ] Keep validated-header injection constrained to a server-returned tenant ID.
- [ ] Run GREEN and `npm run check:syntax`.

**GO:** web/mobile parity for membership selection. **NO-GO:** nonmember tenant ID reaches API headers.

### Task 9: Frontend navigation and guards—minimal follow-through

**Objective:** Preserve post-auth global destinations and expose tenant entry without treating User.role as tenant authority.

**Files:**
- Test/modify only as required: `client/lib/pages/dashboard/AdminDashboard.jsx`, `client/lib/components/dashboard/PlatformOperatorContextSwitcher.jsx`, `client/lib/context/AuthContext.jsx`, `client/lib/navigation/postAuthDestination.js`, `client/lib/components/RoleProtectedRoute.jsx`

- [ ] RED: Admin still routes to global dashboard; Proprietaire still routes to owner surface; Client still routes to client surface.
- [ ] RED: Proprietaire with accessible tenant can see/select tenant entry without receiving Admin-global links.
- [ ] RED: global Admin without membership does not see tenant-internal member controls merely because of role.
- [ ] Keep `AuthContext.isAdmin` explicitly global; do not reuse it for tenant buttons.
- [ ] Add/use selected membership businessRole only when returned canonically by backend; never derive from global role.
- [ ] Migrate page-specific tenant UI only for backend route families completed in Tasks 5/6. Leave other legacy UI guards intact and list them as deferred.
- [ ] Run `AdminDashboardDomains`, `DashboardResponsiveNavigation`, `MembersPanel`, `postAuthDestination`, and runtime-context suites.

**GO:** navigation identity and tenant affordances are distinct. **NO-GO:** frontend grants access not enforced by backend or hides the owner surface.

### Task 10: Ownership regression certification

**Objective:** Prove incremental membership work did not remove legitimate external access.

**Files:** tests only unless a regression is demonstrated.

- [ ] OWNERSHIP-01 Proprietaire can manage own Property without OrgMembership where current policy allows.
- [ ] OWNERSHIP-02 Proprietaire cannot manage another owner’s Property.
- [ ] OWNERSHIP-03 Client can read/cancel its own reservation according to current state rules.
- [ ] OWNERSHIP-04 Client cannot access another guest’s reservation.
- [ ] OWNERSHIP-05 conversation participant remains allowed; nonparticipant denied.
- [ ] OWNERSHIP-06 tenant membership alone does not bypass resource tenant/ownership scope.
- [ ] Run property ownership, accommodation reservation tenant scope, messaging read/send authority, and visit owner suites.

**GO:** behavior matches pre-2B contracts. **NO-GO:** stop and rollback the responsible task’s hunks.

### Task 11: Certification and final inventory

**Objective:** Produce evidence for the 2B final report without beginning 2C.

- [ ] Re-run the route scan and update the matrix statuses to `MIGRATED_2B`, `ALREADY_COMPLIANT`, `OWNERSHIP_PRESERVED`, `DEFERRED_DEPENDENCY`, or `NEEDS_ARCHITECTURE_DECISION`.
- [ ] Run targeted backend suites:

```bash
npx jest --runInBand \
  __tests__/globalAdminAuthority2B.mongo.integration.test.js \
  __tests__/platformAdmin1.adversarial.mongo.integration.test.js \
  __tests__/platformAdminCert1.vulnerabilities.mongo.integration.test.js \
  __tests__/tenantApplicationPhase1.mongo.integration.test.js \
  __tests__/tenantMembershipRole.mongo.integration.test.js \
  __tests__/tenantMembershipService.mongo.integration.test.js \
  __tests__/tenantMemberApi.mongo.integration.test.js
```

- [ ] Run each migrated tenant-family suite and ownership regression suites separately so failures remain attributable.
- [ ] Run `npm run architecture:check`.
- [ ] Run `npm run lint`; report pre-existing failures separately and do not edit unrelated files.
- [ ] Run client targeted tests, then `npm run lint` in `client/`.
- [ ] Run mobile runtime test, `npm run check:syntax`, and targeted lint/typecheck if affected.
- [ ] Run `git diff --check`.
- [ ] Compare final `git status --short` to the initial snapshot and enumerate only 2B files/hunks.
- [ ] Confirm no `MONGO_URI`, production endpoint, Render, Atlas, backfill, commit, push, or deploy command was used.

**GO:** all required matrices and affected regressions pass with attributable evidence. **NO-GO:** any authority escalation, cross-tenant leak, global role mutation, or unexplained regression.

## 6. Global baseline versus sensitive policy

### Baseline Admin authority without PlatformOperator

Keep only these categories as baseline during 2B:

- authentication/self-service shared with all users;
- entry to the global Admin shell and non-sensitive UI metadata;
- `GET /api/platform-operators/me` to learn whether the Admin has an active operator record (it reveals only the caller’s own operator state);
- legacy/ambiguous routes explicitly unchanged pending decision. Their unchanged state is compatibility debt, not endorsement as final baseline.

No mutation of global User identity, PlatformOperator, PlatformTenant, tenant application, or cross-tenant resource is baseline.

### Sensitive capability-gated authority

- `platform.operators.manage`: operator list and mutations.
- `platform.tenants.read/manage`: global tenant list/read and creation/mutations.
- `platform.tenant_applications.read/review/request_changes/approve/reject`: application review actions.
- `platform.users.read/manage`: global user reads/mutations.
- Existing `platform.properties.*`, `platform.hotels.*`, `platform.accommodations.*`, `platform.finance.*`, `platform.reporting.read`, `platform.audit.read`, etc. remain required only on routes explicitly designed for global/cross-tenant mode.

## 7. Risks and mitigations

- **Dirty overlap:** several target files are already modified. Mitigation: per-file pre-edit diff and minimal patches.
- **Provider/API mismatch:** current `listTenants` is global capability-gated. Mitigation: dedicated accessible endpoint; never weaken global list.
- **Legacy Admin wildcard:** `iamArchitecture` grants `*`. Mitigation: never accept it as a platform capability and replace it only within fully migrated tenant families.
- **Nested-unit memberships:** accessible tenant resolution climbs ancestors, while `resolveTenantMembership` currently requires root membership. Mitigation: do not claim a nested-unit member is tenant Admin; decide/root-normalize membership semantics before migrating such users.
- **Operator-selected tenant versus membership tenant:** both use the same header. Mitigation: preserve distinct `tenantContextSource` and require explicit platform capability on operator routes.
- **Founder historical nulls:** new fix does not repair old tenants. Mitigation: document 2C prerequisite and keep fallback untouched.
- **Mixed ownership:** adding router-wide membership can lock out clients/owners. Mitigation: split route branches or defer whole family.
- **Frontend false security:** UI guards are not authority. Mitigation: backend matrix required before UI migration.
- **Test database safety:** use repository MongoMemoryReplSet harness only; never export/use production URI.

## 8. Conceptual rollback

Rollback is task-local and code-only; no data rollback should be needed because 2B has no historical migration.

1. Stop at the first failing GO criterion.
2. Identify only hunks introduced by the current task from its pre-edit diff snapshot.
3. Revert those hunks with `apply_patch`; do not use destructive git commands.
4. Re-run the preceding task’s GREEN suite.
5. For founder provisioning, tenants created in disposable tests are discarded with the test database. If a non-production development tenant was manually created, do not mutate it automatically; record it for explicit handling.
6. Never roll back by restoring entire dirty files.

## 9. Explicit out of scope

- 2C historical `businessRole` backfill and zero-null enforcement.
- 2D removal of `membership_legacy_user_role`/`allowLegacyRoleFallback`.
- 2E reduction of the User enum.
- 2F cleanup of `User` and `Prestataire` values.
- Production/Atlas/Render reads or writes.
- New platform capabilities without a separate demonstrated architecture decision.
- Automatic resolution of any `NEEDS_ARCHITECTURE_DECISION` row.
- Rewriting all frontend role gates before corresponding backend authority migration.
- Converting HotelStaffAssignment, UserBusinessProfile, Property.owner, guest, participant, or author relations into OrgMembership.
- Commit, push, PR, deployment, or starting 2C.
