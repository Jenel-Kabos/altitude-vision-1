# C2.10B Individual Rental Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` and `superpowers:test-driven-development`. The user requires inline execution, no commits, and targeted FAST-TRACK verification.

**Goal:** Add subscription-backed individual rental self-management while preserving C2.10A organization provenance and prepare a strictly read-only classification of legacy rental parties.

**Architecture:** `Property.tenant` remains the sole scope discriminator. A user-owned `IndividualSubscription` supplies entitlement only; centralized rental access composes scope, exact-owner authority, and entitlement while the existing tenant IAM/module chain remains authoritative for organizations. Existing GL services/controllers are reused through explicit request scope adapters, and legacy discovery is isolated in a native-driver read-only engine.

**Tech Stack:** Node.js, Express, Mongoose, MongoDB native driver, Jest/MongoMemoryReplSet, Next.js/React, Vitest.

**Spec:** `/Users/apple/.codex/attachments/040bc3fa-0e5f-4187-885b-7a4a963c05ad/Pasted text.txt` plus validated constraints in `/Users/apple/.codex/attachments/2f1ad239-30fd-40ae-8db6-e7a00f1fdef0/Pasted text.txt`.

## Global Constraints

- `Property.tenant=null` means INDIVIDUAL; `Property.tenant=T` means ORGANIZATION(T), with no fallback inference.
- `IndividualSubscription.user=User._id`; subscriptions grant entitlement, never Property authority.
- Never create an individual subscription, tenant, membership, or Property migration automatically.
- Canonical organization owners may not create or extend a parallel active individual portfolio; detect and block without migrating.
- Preserve all data when an entitlement is absent, past due, or cancelled.
- Legacy party work is discovery-only; no apply path exists in C2.10B.
- Use targeted RED/GREEN tests, one Mongo campaign at a time, and `scratchpad/c210b/logs/` for long runs.
- No commit, push, deploy, EAS, production mutation, remote mutation, legacy migration, or full Mongo.

## Review Focus

- A stale tenant header on an individual request must not alter scope or authority; B2 tests it.
- An organization owner with active `tenant:null` assets must be detected and blocked from extending the inconsistent state; B2 tests it.
- Subscription expiry must block paid behavior without deleting or rewriting GL data; B1/B3 test it.
- ID-based access must resolve scope from the resource's Property rather than the requested mode; B2/B3 test it.
- The legacy CLI must reject mutation-like flags before opening any connection and expose no write-capable dependency; B6 tests it.

---

### B1: IndividualSubscription and shared entitlement facade

**Invariant:** Identity, scope, authority, and entitlement remain separate; subscription belongs to User and is never auto-created.

**Files:**
- Create `server/models/IndividualSubscription.js`.
- Create `server/services/subscription/moduleEntitlementService.js`.
- Create `server/__tests__/individualSubscriptionEntitlementC210B.mongo.integration.test.js`.
- Modify only shared constants if an exact reusable status/plan export is required.

**Interfaces:**
- Produce `canUseModule({ scope, userId, tenantId, module, session? })` returning a decision object with `allowed`, `reason`, `status`, and `subjectId`.
- Produce `assertCanUseModule(...)`, fail-closed with stable entitlement error codes.

**RED:** Test NO_SUBSCRIPTION, TRIALING, ACTIVE, PAST_DUE, CANCELLED; user isolation; organization delegation; Property-independent ownership; no automatic record creation.

**GREEN:** Minimal model plus facade. Tenant behavior delegates to the current feature/subscription semantics; individual behavior reads only eligible user subscriptions.

**Adjacent regression:** `tenantModuleGate` unit tests and tenant subscription tests.

### B2: Individual rental scope and authority

**Invariant:** An individual resource requires `tenant:null`, exact owner, eligible entitlement, and a non-hybrid canonical owner state.

**Files:**
- Modify `server/services/platformTenant/rentalScopeService.js`.
- Create `server/services/rentalIndividualAccessService.js`.
- Create `server/middleware/rentalScopeAccess.js`.
- Modify `server/routes/rentalManagementRoutes.js` and minimally its controller.
- Create `server/__tests__/individualRentalScopeC210B.mongo.integration.test.js`.

**Interfaces:**
- Produce `assertIndividualRentalPropertyAccess({ property, userId, action, session? })`.
- Produce list filter `{ tenant: null, owner: userId }` only after entitlement and single-state validation.
- Resource-by-ID scope is always resolved from Property, never query/header/body.

**RED:** I01–I10, organization-owner hybrid, stale tenant header, and all four cross-scope directions for RentalManagement reads/writes.

**GREEN:** Add explicit individual adapters to existing handlers; preserve the default organization route chain.

**Adjacent regression:** C2.10A rental scope, C2.9 owner-state invariant, tenant RentalManagement authority.

### B3: Individual GL domains

**Invariant:** Every linked GL resource inherits the scope of its canonical Property and applies the same subject/authority/entitlement composition.

**Files:**
- Modify relevant rental contract, lifecycle, tenant-party, payment, notice, maintenance, document, and dashboard routes/controllers/services.
- Create focused `server/__tests__/individualRentalDomainsC210B.mongo.integration.test.js` plus narrow route tests where needed.

**Interfaces:**
- Extend the B2 resource guard for `Contrat`, `Locataire`, `Paiement`, `RentalMaintenanceTicket`, rental documents, and overview queries.
- List queries derive Property IDs from the authorized individual population.

**RED:** Owner A/P1 allow; Owner B/P1 deny; tenant staff/P1 deny; Owner A/P3 not individual, for read and write across every required domain.

**GREEN:** Reuse current business services; replace tenant-only filtering at route boundaries with explicit dual-scope access, without duplicating domain logic.

**Adjacent regression:** existing organization GL suites, quotas, receipts, lifecycle, maintenance, documents, reporting.

### B4: Owner UX

**Invariant:** `/mes-biens` remains the owner portfolio; individual GL and organization-managed assets are visibly separate.

**Files:**
- Add `/mes-biens/gestion-locative` page.
- Modify owner navigation and rental frontend services/components only as required.
- Add Vitest suites for context, labels, request scope, entitlement states, loading/error/forbidden.

**Interfaces:**
- Shared UI context `{ mode: 'individual' }` sends explicit scope and removes tenant headers through the existing request infrastructure.
- `/owner/my` retains the organization-managed projection; self-managed records use the individual GL projection.

**RED:** No mixing between projections; no organization Property in individual UI; expired subscription preserves visible data and displays locked actions.

**GREEN:** Reuse existing GL components with scope props; no cloned feature tree.

**Adjacent regression:** owner dashboard/navigation, `/mes-biens`, organization dashboard GL.

### B5: Tenant portal, notifications, and documents boundary

**Invariant:** Tenant users rely on lease relationships, individual operations never broadcast to arbitrary tenant staff, and document IDs cannot bypass scope.

**Files:**
- Modify tenant portal/service only if tests prove a tenant-only assumption.
- Modify notification producers only where individual paths reach `notifyStaff`.
- Modify generic document boundary only on demonstrated bypass.
- Add focused backend tests.

**RED:** Dual-scope tenant portal; individual action emits no tenant-wide notification; organization request retains scoped staff notification; document IDOR across owners/scopes denied.

**GREEN:** Route individual direct actions without `notifyStaff`; preserve organization workflow. Close only proven document bypasses.

**Adjacent regression:** tenant portal routes, rental notification producers, document download tests.

### B6: Read-only legacy party discovery

**Invariant:** Classification is evidence-based, deterministic, and incapable of mutation.

**Files:**
- Create `server/services/platformTenant/legacyRentalPartyDiscoveryService.js` as pure classification logic.
- Create `server/scripts/discoverLegacyRentalParties.js` using Mongo native driver read-only operations only.
- Create unit and local Mongo tests.
- Produce `scratchpad/c210b/legacy-manifest.json` from the authorized read-only discovery when local certification passes.

**Interfaces:**
- Classifications: `ALTITUDE_VISION_PROVEN`, `ALTITUDE_VISION_LIKELY_BUT_NOT_PROVEN`, `OTHER_TENANT_PROVEN`, `AMBIGUOUS`, `ORPHAN_NO_EVIDENCE`.
- Manifest includes only proven records with `type`, `id`, `evidence`, `currentTenant`, `proposedTenant`.

**RED:** Reject every mutation-like flag before connector invocation; classify each evidence combination; uncertain evidence never becomes proven; scan performs zero writes.

**GREEN:** Pure classifier plus late native-driver import/connection, secondary-preferred/read concern where supported, and commands limited to `find`/aggregation without `$out` or `$merge`.

**Adjacent regression:** existing tenant legacy audit/discovery CLI safety tests.

### B7: Consolidated targeted certification

**Invariant:** Certification results describe a stable tree and no running test is reported PASS.

**Steps:**
- Record hashes of certified files before launch.
- Run one consolidated targeted Mongo gate in the background with command/PID/timestamps/log/exit-code metadata.
- Do not modify certified files while it runs; compare final hashes.
- Run focused client tests, C2.10A/C2.9 regressions, `certify:tenant`, `health`, `verify`, architecture check, touched-file lint, and `git diff --check` where available.
- Record suite/test counts and named failures in `scratchpad/c210b/test-ledger.md`.
- STOP with `FULL_MONGO=AWAITING_AUTHORIZATION`.
