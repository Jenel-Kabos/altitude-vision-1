# C2.10C Individual Rental Functional Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking. The user explicitly requires no commits.

**Goal:** Close individual rental management by adding safe batch payments, scoped penalties, and a reusable end-to-end operational Web experience.

**Architecture:** `Property.tenant` remains the only provenance discriminator. Backend batch mutations resolve every submitted resource through its canonical Property before any write. Frontend organization and individual screens reuse the same components and service functions through an explicit request context that adds `scope=individual` and clears tenant headers only in individual mode.

**Tech Stack:** Express 4, Mongoose/Mongo replica-set, Jest/Supertest, Next.js 15, React 18, Axios, Vitest.

**Spec:** `/Users/apple/.codex/attachments/3de91bd0-a34f-430d-a017-0d0332cdbc8b/Pasted text.txt`

## Global Constraints

- `Property.tenant=null` is INDIVIDUAL; `Property.tenant=T` is ORGANIZATION(T).
- No owner, manager, createdBy, role, membership, unique-tenant or header fallback.
- Individual access requires exact Property owner, `tenant:null`, eligible IndividualSubscription and `location` entitlement.
- Batch mutations are all-or-nothing and validate every resource before writes.
- Preserve organization behavior and the single-state invariant.
- No data migration, remote mutation, FULL_MONGO, commit, push, deploy or EAS.

## Review Focus

- A mixed batch containing one foreign payment must perform zero writes.
- Penalty calculation must receive a non-global contract ID set for both HTTP scopes.
- Individual requests must clear stale tenant headers; organization requests must retain selected tenant context.
- Existing pages must not hide individual lifecycle actions merely because `User.role` is `Proprietaire`.
- Subscription states must explain access without deleting or rewriting domain data.

---

### Task 1: C1 inventory and context contract

**Files:**
- Create: `scratchpad/c210c/audit.md`
- Create: `client/lib/services/rentalRequestContext.js`
- Test: `client/lib/__tests__/RentalRequestContextC210C.test.js`

**Interfaces:**
- Produce `INDIVIDUAL_RENTAL_CONTEXT`, `ORGANIZATION_RENTAL_CONTEXT`, `rentalRequestConfig(context, params?, config?)`, and `rentalBasePath(context)`.

- [ ] Write tests proving individual scope injection/header clearing and organization context preservation.
- [ ] Run them RED.
- [ ] Implement the minimal pure request-context helper.
- [ ] Run them GREEN.

### Task 2: C2 atomic individual batch payments

**Files:**
- Modify: `server/routes/paiementLocationRoutes.js`
- Modify: `server/controllers/paiementController.js`
- Modify: `server/services/rentalIndividualResourceAccessService.js`
- Test: `server/__tests__/individualRentalBatchPaymentsC210C.mongo.integration.test.js`

**Interfaces:**
- Produce `assertIndividualRentalResourceSetAccess({ resourceType, resources, userId, session? })`.
- Expose `POST /api/paiements/location/encaisser-multiple?scope=individual` through the existing controller.

- [ ] Write RED cases: A/A allow, B deny whole batch, organization deny, mixed deny, expired deny, active allow, organization→individual deny.
- [ ] Verify RED without any payment/receipt mutation.
- [ ] Implement set validation before idempotency lookup, upload or financial transaction.
- [ ] Run C2 GREEN and adjacent multi-allocation tests.

### Task 3: C3 scoped penalty calculation

**Files:**
- Modify: `server/routes/paiementLocationRoutes.js`
- Test: `server/__tests__/individualRentalPenaltiesC210C.mongo.integration.test.js`

**Interfaces:**
- Individual route derives contract IDs from `individualRentalDomainIds(userId)` and calls `verifierPaiementsEnRetard({ contratIds })`.
- Organization path remains unchanged except retaining its canonical tenant contract IDs.

- [ ] Write RED cases for Individual A, Individual B, Tenant X, expired and active subscriptions.
- [ ] Verify RED.
- [ ] Add the individual route adapter before tenant routes.
- [ ] Run C3 GREEN and penalty-adjacent regression tests.

### Task 4: Scope-aware shared frontend services

**Files:**
- Modify: `client/lib/services/gestionLocativeService.js`
- Modify: `client/lib/services/rentalLeaseLifecycleService.js`
- Modify: `client/lib/services/rentalMaintenanceService.js`
- Test: `client/lib/__tests__/IndividualRentalServicesC210C.test.js`

**Interfaces:**
- Every relevant service accepts an optional final `rentalContext` argument and delegates request construction to `rentalRequestConfig`.
- Produce `encaisserPaiementsMultiples(payload, rentalContext)` and `getIndividualSubscription()`.

- [ ] Write RED tests for all domain URL/config combinations and stale-header clearing.
- [ ] Implement minimal optional context parameters with organization-compatible defaults.
- [ ] Run GREEN plus existing service tests.

### Task 5: C4/C5 reusable operational UX

**Files:**
- Modify: `client/lib/pages/dashboard/IndividualRentalManagementPage.jsx`
- Modify: `client/lib/pages/dashboard/RentalLeasesPage.jsx`
- Modify: `client/lib/pages/dashboard/RentalTenantsPage.jsx`
- Modify: `client/lib/pages/dashboard/RentalPaymentsPage.jsx`
- Modify: `client/lib/pages/dashboard/RentalNoticesPage.jsx`
- Modify: `client/lib/pages/dashboard/RentalMaintenancePage.jsx`
- Modify: `client/lib/pages/dashboard/RentalDocumentsPage.jsx`
- Modify: lifecycle components only where scope propagation is required.
- Create: `client/app/mes-biens/gestion-locative/{baux,locataires,paiements,preavis,maintenance,documents}/page.jsx`
- Test: `client/lib/__tests__/IndividualRentalFunctionalCompletionC210C.test.jsx`

**Interfaces:**
- Shared pages receive `rentalContext` with organization default.
- Individual shell exposes operational navigation, activation, dossiers and five-state subscription feedback.
- Child links use `rentalBasePath(context)`.

- [ ] Write RED component tests for navigation, individual service context, lifecycle visibility, batch/penalty actions, and five subscription states.
- [ ] Generalize shared pages/components without duplicating business rules.
- [ ] Add individual route wrappers.
- [ ] Run GREEN plus existing page tests.

### Task 6: C6/C7 end-to-end and final gates

**Files:**
- Create: `server/__tests__/individualRentalFunctionalCompletionC210C.mongo.integration.test.js`
- Update: `scratchpad/c210c/progress.md`
- Logs: `scratchpad/c210c/logs/`

- [ ] Write the replica-set E2E scenario for Owner A/B and Tenant X/Y using real application routes.
- [ ] Run RED for any uncovered integration gap, then minimal GREEN fixes.
- [ ] Run C2.10C, C2.10B, C2.10A, adjacent GL and client gates on a stable hash snapshot.
- [ ] Run `certify:tenant`, `health`, `verify`, architecture, touched lint and `git diff --check`.
- [ ] Stop before FULL_MONGO and report exact PASS/FAIL evidence.
