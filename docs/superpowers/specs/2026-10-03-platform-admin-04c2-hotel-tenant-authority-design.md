# PA-04C2 Hotel Tenant Authority & Patrimony Invariant — Design (rev. 3)

> Status: **PROPOSED — awaiting human validation.** Revision 3 adds §9 PlatformOperator lifecycle & authority separation (sub-audit `PA_04C2_PLATFORM_OPERATOR_LIFECYCLE_AUDIT`). Revision 2 superseded revision 1 (same date): it integrates the business invariant `INDEPENDENT XOR TENANT`, `HOTEL ⇒ TENANT`, `TENANT ⇒ canonical professional patrimony in the tenant`. No production code, data or authority has been changed by this design phase. Decisions `D*` must be validated before implementation.

## 1. Intent

1. Secure Hotel/Tenant authority definitively (F1–F7 of revision 1 remain valid).
2. Make a durable half-independent / half-organisation patrimony impossible.

```text
PLATFORM   = active PlatformOperator + exact capability
TENANT     = resolved tenant + active OrgMembership + allowed businessRole
             OR active PlatformOperator selection + exact capability
SELF-SERVICE = Hotel.manager / effective HotelStaffAssignment, own hotel only
UNRESOLVED = no administration

INDEPENDENT ⇒ patrimony tenant:null, no hotel
ORGANISATION (PlatformTenant) ⇒ the holder's professional patrimony in the tenant, hotels allowed
```

`PlatformTenant` is the organisation. `OrgMembership` is the only membership model. No pseudo-tenant per independent, no new role, no new membership system.

## 2. Observed architecture (evidence)

### 2.1 Attribution
- `Property.tenant` (default `null`) is the **authoritative** attribution since Lot G; `Property.owner` (required) is the ownership/self-service relation. `fromProperty` falls back to `owner` membership only when `tenant` is null (historical inference).
- `Accommodation.property` is required and **unique** (1 Property ↔ ≤1 Accommodation); `Accommodation.hotel` is required for `HOTEL_ACCOMMODATION_TYPES = ['hotel','residence_hoteliere','chambre_hotes','autre']`; `Accommodation.tenant` is its own field.
- `Hotel` has **no `owner`**: `manager` (operator/exploitant), `createdBy`, optional anchor `property` (whose `owner` is the property owner), `tenant`.
- "Établissement" = Hotel (+ its anchor Property/Accommodation adapter created by `createFullHotel`). Rooms, categories, housekeeping, maintenance, staff assignments derive their scope from `hotel`.

### 2.2 Where the hybrid state is produced today
| Path | Tenant written | Effect |
|---|---|---|
| `POST /api/properties` (`/mes-biens`, `restrictTo('Proprietaire')`) | always `null` (no tenant context attached, Decision 2E.1.X-G) | founder/member properties are always personal |
| `POST /api/properties/mobile` | always `null` | idem |
| `POST /api/properties/portfolio` (staff) | `req.platformTenant` | `owner` = **creating staff user** |
| `POST /api/hotels/mine` (self-service, `attachTenantScopeIfResolvable`) | `req.platformTenant` **if one resolves, else `null`** | a member gets `Hotel.tenant = T` while `/mes-biens` stays `null` → **reported symptom**; an independent gets `Hotel.tenant = null` |
| `POST /api/hotels/admin`, `/api/accommodations/admin` | `requireTenantScope` | tenant required |
| `POST /api/accommodations/mobile/full` (hotel types) | `HOTEL_SCOPE_REQUIRED` if no tenant | **already enforces HOTEL ⇒ TENANT** |
| `POST /api/hotels/:id/duplicate` | `hotel.tenant` | a `tenant:null` hotel clones to `tenant:null` |
| `POST /api/accommodations` (owner) | `req.platformTenant` of the **requester**, not `property.tenant` | Accommodation/Property tenant divergence possible; `User.role === 'Admin'` bypass |
| `TenantApplication.approveApplication` | creates tenant + root + `owner/Admin` membership | **transfers no existing asset** → every approval yields a hybrid |
| Staff import / rental onboarding | `owner` = third-party Proprietaire, `tenant` = agency tenant | **legitimate mandate** (GL-ARCH-1.1: "never transform the owner's other personal listings into managed properties") |

### 2.3 Consequence for the invariant (correction)
`Property.owner` is **not** the organisation's patrimony holder:
- agency/mandate properties belong to third-party owners but are held by the tenant (GL-ARCH-1.1, validated rule);
- `/portfolio` properties are owned by the creating staff user.

Therefore the invariant is expressed on the **patrimony holder** of an organisation, not on every `Property.owner`:

```text
PATRIMONY HOLDER of tenant T = user with an ACTIVE OrgMembership roleInUnit:'owner' on T's rootOrgUnit
(the canonical founder shape created by approveApplication: roleInUnit 'owner' + businessRole 'Admin')
```

- A holder of exactly one tenant T: every Property/Hotel/Accommodation they own **in their own name** must be `tenant = T` (no personal `tenant:null` remains).
- A plain member (roleInUnit `member`, any businessRole) keeps personal properties `tenant:null` (staff with a personal house) — PROPERTY-PERSONAL-03 / PROPERTY-OWN-05 remain valid for them.
- A third-party mandated owner (no membership) may have personal `tenant:null` properties **and** properties held by an agency tenant — not a violation (GL-ARCH-1.1). **Decision D7.**
- A holder of two tenants: ambiguous — personal creation refused until explicit selection (fail-closed).

## 3. State matrix (corrected to the real model)

| State | Holder's own Property tenant:null | Holder's own Property tenant:T | Hotel tenant:null (manager = user) | Hotel tenant:T | Valid |
|---|---|---|---|---|---|
| Independent (no `owner` membership) | yes | no¹ | no | no | **YES** |
| Organisation holder (one `owner` membership on T) | **no** | yes | no | yes / none | **YES** |
| Hybrid holder | yes | yes | any | any | **NO** |
| Independent hotel | any | no | **yes** | no | **NO** |
| Holder with hotel outside T | any | any | — | tenant:T2≠T | **NO** (ambiguous) |
| Plain member of T (`member`) | yes (personal) | via staff creation only | no | via T only | **YES** (personal ≠ org patrimony) |
| Third-party mandated owner | yes | yes (agency T, owner = them) | no | no | **YES** — GL-ARCH-1.1, D7 |

¹ `tenant:T` with `owner = independent` exists only as mandate (row 7).

Corrections vs the brief: rows 6–7 added (they exist and are legitimate in the code); "organisation" is defined by `roleInUnit:'owner'`, not by any membership; "independent hotel" covers manager-owned `tenant:null` hotels (Hotel has no owner field).

## 4. Target architecture

### 4.1 Patrimony tenant resolver (single source of truth)
`resolvePatrimonyTenant(userId) → { mode: 'independent' } | { mode: 'organisation', tenantId } | { mode: 'ambiguous' }` in a new service `server/services/platformTenant/patrimonyService.js`, using only `OrgMembership` (`roleInUnit:'owner'`, `status:'active'`, root of an active/trial tenant). No `createdBy`, no `User.role`, no `legacy_fallback`.

### 4.2 Creation guards (prevent future hybrids)
- Owner property creation (`POST /api/properties`, `/mobile`, owner `POST /api/accommodations`): `independent` → `tenant:null`; `organisation` → `tenant: T`; `ambiguous` → 409 `PATRIMONY_TENANT_AMBIGUOUS`. Body/header never read.
- `Accommodation.tenant` always copied from `property.tenant` (never from the requester).
- Hotel creation (`/mine`, `/admin`, mobile, duplicate, accommodation hotel input): requires `organisation` (or staff TENANT scope); `independent` → 403 `HOTEL_ORGANIZATION_REQUIRED` (same semantics as the existing mobile `HOTEL_SCOPE_REQUIRED`); duplicate of a `tenant:null` hotel refused.
- `Hotel` schema: `tenant` required **on create only** (`isNew`), so legacy `tenant:null` documents remain saveable until migrated.

### 4.3 Independent → Organisation transition (canonical point: `approveApplication`)
Extend the existing transaction in `tenantApplicationService.approveApplication` (operator-approved, transactional, idempotent, audited, last-admin compatible):
1. `assertApplicantEligibleForProvisioning` (unchanged).
2. `createFirstOwnerTenant` + `grantMembership(roleInUnit:'owner', businessRole:'Admin')` (unchanged).
3. **New:** `transferPatrimony({ applicant, tenant, session })`, computed inside the transaction by the classification of §5; any `AMBIGUOUS` item aborts the approval with 409 `PATRIMONY_TRANSFER_REVIEW_REQUIRED` and the list (no silent attribution). Optional operator-provided exclusions (D9).
4. ActionLog per transferred resource (`metadata.transition = 'PA-04C2'`, previous tenant `null`).
5. Idempotent re-run: already-transferred items are `tenant = T` → no-op; stragglers created concurrently are transferred.

No implicit transition from hotel creation. Web gets an applicant entry point equivalent to mobile `FirstOrganizationOnboardingScreen` (D10).

### 4.4 Hotel authority (from rev. 1, unchanged)
- `assertHotelAdministrationAuthority(req, hotel, { action })`: PLATFORM → exact capability; TENANT → `hotel.tenant === scope.tenantId` AND (`businessRole ∈ HOTEL_TENANT_ROLES[action]` OR operator exact capability); UNRESOLVED → 403. Replaces `isHotelAdministrationActor` (F1, F3).
- Operational access: administration branch reuses it; inferred attribution and `actor.role === 'Admin'` removed (F4). Self-service (manager/assignment) unchanged and never grants tenant administration.
- `READ != MANAGE`; `platform.support.read` grants nothing on Hotel.

### 4.5 F2 containment
`resolveLegacyTenantForUser` returns `null` for any user with a `PlatformOperator` record (any status). `createdBy` stays technical provenance only.

### 4.6 Legacy founder
Kept fallback for non-hotel domains (D3); proven founders migrated to `owner/Admin` membership with the 1H framework extended by a founder step (rev. 1 §Founder migration), then patrimony transfer via the same `transferPatrimony` service (dry-run first).

## 5. Patrimony transfer classification (used by transition, discovery and migration)

For holder U entering tenant T, candidates are documents **owned in U's own name with `tenant:null`**:

| Resource | Owner source | Tenant field | Transfer | Kind | Rule / risk |
|---|---|---|---|---|---|
| Property | `owner` | `tenant` (authoritative) | **AUTO** if `tenant:null`, not sold/archived (`availability ∉ {Vendu, Retiré}`, `assetCycle ∉ {vendu, archive}`), no `RentalManagement.tenant` ≠ null/T, no in-progress sale `Transaction` (`status ∈ {En cours, Paiement en attente, Litigée}`); else **REVIEW** | authoritative | sold/archived stay personal history; in-progress sale → review |
| Accommodation | via `property` | `tenant` | **FOLLOW** its Property (same transaction) | derived-consistent | must equal `property.tenant` |
| Hotel | `manager` (+ `createdBy`, anchor `property.owner`) | `tenant` | **AUTO** if `manager = createdBy = U` and (no anchor or anchor owner = U); else **REVIEW** | authoritative | `createdBy` never sufficient alone |
| Room, RoomCategory, RatePlan, Housekeeping, Maintenance, HotelStaffAssignment, Inspection | via `hotel` / `accommodation` | none | follow implicitly | derived | no write |
| RentalManagement | `owner` / `property` | `tenant` | **FOLLOW** Property if `tenant:null` | derived-authoritative | lease management authority moves to T |
| Contrat, Paiement, Transaction | via `bien` / `property` | none | follow implicitly (reporting re-attribution of past sales — D11) | derived | no write |
| AccommodationReservation, HotelReservation | snapshot | `tenant` | **completed/cancelled: immutable**; active/future: **REVIEW** (D8) | snapshot | new invoices use `reservation.tenant` |
| FinancialDocument, FinancialPayment, PaymentAllocation, FinancialRefund, FinancialDeduction, ledger | snapshot | `tenant` | **NEVER** | immutable history | idempotency keys include `tenant` |
| Visite, Document, CrmCustomer, ActionLog, Conversation | snapshot | `tenant` | **NEVER** automatically | history | — |
| RentalMaintenanceTicket | — | `tenant` → **`Locataire`** (renter) | **NEVER** | name collision | must never be touched by tenant migration |

Never `updateMany({ owner })`: each document is classified and transferred by `_id` with a CAS precondition `tenant: null`.

## 6. Data migration

Code migration (§4) and historical data migration are separate. A read-only discovery/dry-run (`server/scripts/patrimonyInvariantDiscovery.js`, reusing the 1H read-only URI guard) classifies: `INDEPENDENT_CLEAN`, `TENANT_CLEAN`, `HYBRID_HOLDER`, `LEGACY_FOUNDER`, `EX_OPERATOR_DANGEROUS_FALLBACK`, `HOTEL_TENANT_NULL`, `ACCOMMODATION_TENANT_DIVERGENT`, `MEMBER_WITH_ORG_HOTEL_AND_PERSONAL_ASSETS` (reported-symptom class, review), `MANDATE_OWNER` (informational), `AMBIGUOUS`. Output: counts + SHA-256-truncated identifiers, no names/emails. Writes are a separate authorised step.

## 7. Invariants preserved
PA-01 … PA-04C1 contracts; cross-tenant isolation; `tenant:null` never administrable in TENANT; provenance never from body/header; last-admin via `tenantMemberService` + PlatformTenant sentinel lock; no OrgMembership for PlatformOperators; self-service paths unchanged; GL-ARCH-1.1 unchanged unless D7 says otherwise.

## 8. PLATFORMOPERATOR LIFECYCLE & AUTHORITY SEPARATION

### 8.1 Separation (permanent constraint)

```text
User identity ≠ PLATFORM authority ≠ TENANT membership ≠ organisation ownership ≠ createdBy provenance
PLATFORM authority          = PlatformOperator.status 'active' + exact capability
TENANT business authority   = resolved tenant + active OrgMembership + allowed businessRole
Operator acting in TENANT   = active PlatformOperator + exact capability + resolved selected tenant (no artificial membership)
createdBy                   = technical provenance only (never authority, ownership, membership)
```

### 8.2 Real model (`server/models/PlatformOperator.js`)
- One document per user (`user` unique), never physically deleted (`assertNoPlatformOperatorForHardDelete` blocks user hard-delete while a record exists).
- `status ∈ { active, suspended, revoked }` (`PLATFORM_OPERATOR_STATUSES`); no other status is introduced.
- `capabilities` ⊂ `PLATFORM_OPERATOR_CAPABILITIES` (35 entries incl. `platform.hotels.read|manage`, `platform.support.read`, `platform.operators.manage`); `PLATFORM_VIEW_REQUIRED_CAPABILITIES` = registry minus `platform.support.impersonation`.
- Audit fields: `grantedBy/At/Reason`, `suspendedBy/At/Reason`, `revokedBy/At/Reason`; every transition emits an ActionLog (`platform_operator.*`, `scopeMode: 'platform'`).
- Only `status: 'active'` counts (`resolveActiveOperator`, `hasCapability`, `isPlatformViewEligible`).

### 8.3 Lifecycle (as implemented)

```text
            grantOperator (other eligible operator with operators.manage)
  (none) ───────────────────────────────────────────────▶ active
  active ── suspendOperator ──▶ suspended ── reactivateOperator ──▶ active   (capabilities preserved and restored)
  active|suspended ── revokeOperator ──▶ revoked ── grantOperator (new decision, new reason) ──▶ active
  user ban / suspend (account) ──▶ operator suspended (cascade, transitionOperatorForUserLifecycle)
  user self-deletion ──▶ operator revoked (cascade)
  user re-activation (account) ──▶ operator stays suspended (no automatic recovery)
```

| Route | Auth | Required authority | Self-mutation | Last-viable guard | Audit |
|---|---|---|---|---|---|
| `GET /api/platform-operators/me` | protect | none | own read | — | — |
| `GET /api/platform-operators` | protect | eligible + `platform.operators.manage` | — | — | — |
| `POST /api/platform-operators` (grant / capability change / re-grant after revoke) | protect | idem | **refused** (`SELF_ACTION_FORBIDDEN`; bootstrap CLI only when no operator exists) | yes when removing `operators.manage` | ActionLog |
| `PATCH /:userId/suspend` | protect | idem | refused | yes | ActionLog |
| `PATCH /:userId/reactivate` | protect | idem | **no explicit check** (unreachable while suspended: route requires active) | n/a | ActionLog |
| `PATCH /:userId/revoke` | protect | idem | refused | yes | ActionLog |
| `PATCH /api/admin/owners/:id/{suspend,ban}` (account → operator cascade) | protect | eligible + `platform.users.manage` | **allowed** (no self-check) | yes | user ActionLog only |
| `PATCH /api/users/:id/suspend` (account → operator cascade) | protect | `platform.users.manage` **with tenant selection allowed** | refused | yes | — |
| `DELETE /api/users/me` (self-deletion → revoke) | protect | self | n/a | yes | — |
| Bootstrap CLI `bootstrapPlatformOperator.js` | DB access | distinct Admin user as `grantedBy` | `--allow-self-grant` only if no operator exists | — | ActionLog |

### 8.4 Findings
- **OK** — suspended/revoked operators lose PLATFORM immediately; no self-reactivation path; self-grant refused even for a full operator; tenant owner/Admin without active operator never reaches PLATFORM; operator tenant creation grants no membership (createdBy = operator only); last-viable-operator guard exists with a distributed sentinel lock (`PlatformAuthorityLock`) and concurrency test.
- **F2 (P1)** — `legacy_fallback` turns `createdBy` into tenant authority after operator loss (§4.5 containment).
- **F8 (P2, new)** — a *partial* operator holding only `platform.users.manage`, selecting tenant T, can suspend the account of a fully privileged operator who is a member of T; the cascade sets `PlatformOperator.status = 'suspended'`. Operator authority can thus be removed without `platform.operators.manage`.
- **F9 (P3)** — `/api/admin/owners/:id/{ban,suspend}` lacks the self-action check present in `/api/users/:id/suspend` (self-lockout possible, bounded by last-viable guard).
- **F10 (P3)** — `reactivateOperator` has no self-action check, no sentinel lock/transaction (defence in depth; not exploitable today).
- **F11 (open)** — reactivation restores the pre-suspension capability set automatically (D13).
- **F3 interaction** — a genuine membership survives operator suspension in canonical domains (users registry, dashboard: 200), but Hotel ignores `businessRole` (403) until C2.2.

### 8.5 Rules adopted for PA-04C2
1. `createdBy` is never used as authority, ownership or membership — including legacy founder discovery: createdBy-based candidates are **REVIEW (human attestation)**, never automatic.
2. PlatformOperator suspension/revocation never touches OrgMembership; OrgMembership never creates PLATFORM.
3. Removing an operator's PLATFORM authority (directly or by account cascade) requires the authority that governs operators (D14).
4. No new model, status, role or membership system.

## 9. Open decisions
- **D0** F2 containment (ex-operators excluded from `legacy_fallback`) — recommended now.
- **D1** Founder backfill role: `owner` + `Admin` (confirmed canonical by `approveApplication`).
- **D2** `HOTEL_TENANT_ROLES` (read/manage: Admin, Collaborateur, GestionnaireImmobilier per `ROLES_ALTIMMO`; moderate: Admin, Collaborateur per `ROLES_MODERATION`; operational admin: Admin; CommunityManager open).
- **D3** Keep `legacy_fallback` for non-hotel domains during PA-04C2.
- **D4** Run 1H.1 for `User.role` Admin members with `businessRole:null` before the hotel switch.
- **D5** Founder membership rollback semantics.
- **D6** 404 for out-of-scope hotel IDs in TENANT.
- **D7** Patrimony holder = `roleInUnit:'owner'` only; plain members and mandated third-party owners exempt (GL-ARCH-1.1 preserved).
- **D8** Active/future reservations on transferred assets: block transition vs migrate non-financialised ones.
- **D9** Operator-provided exclusions at approval (requires a `TenantApplication` field — model change) vs ambiguous ⇒ 409 only.
- **D10** Web applicant entry point (parity with mobile onboarding) vs mobile-only.
- **D11** Accept re-attribution of past sales in tenant reporting after Property transfer, or exclude sold properties (default in §5).
- **D12** Members (`member`) who manage an org hotel and own personal properties (reported-symptom class): leave personal, or promote to holder through an application.
- **D13** Reactivation restores previous capabilities automatically (current) vs requires explicit re-grant of capabilities.
- **D14** Account suspension/ban of a user holding an active PlatformOperator record: require eligible `platform.operators.manage` (recommended) vs keep `platform.users.manage`; forbid it under tenant selection in any case.
- **D15** Legacy founders without membership: human attestation required before canonical `owner/Admin` backfill (createdBy only nominates candidates).
