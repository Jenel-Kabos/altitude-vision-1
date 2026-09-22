# Altitude Vision — Permanent Invariants

Canonical, human-readable statement of the architectural invariants that MUST
be preserved. If a task appears to require breaking any of these, STOP and
request an architecture decision.

This file supersedes older sprint-report narratives when it disagrees with
them; sprint reports are historical, this file is current.

---

## 1. Multi-tenant identity and authority

- `User` is the **global identity**.
- `OrgMembership` is the **canonical tenant membership authority**.
  - `OrgMembership.businessRole` is tenant-scoped.
  - A user may belong to multiple tenants with different business roles.
- Canonical tenant `businessRole` values:
  `Admin`, `Collaborateur`, `Secretaire`, `GestionnaireImmobilier`,
  `CommunityManager`, `Communicant`.
- External identities that are NOT implicit tenant staff:
  `Client`, `Proprietaire`, `Prestataire`, generic `User`.
- `User.role` is **not** canonical tenant authority.
  - Global `User.role='Admin'` **does not** imply tenant `Admin`.
- `PlatformOperator` is **not** tenant membership.
  - `platform.commercial.manage`, `platform.finance.manage`,
    `platform.finance.read` are platform capabilities.
  - A PlatformOperator without an active `OrgMembership` cannot use tenant-
    scoped mutation surfaces.
- Suspended or revoked membership does **not** authorize tenant access.
- Cross-tenant resource access **must fail closed**.
- Request-body tenant IDs are **never** authoritative — resolve tenant via
  `resolveTenantForUser` and `assertResourceTenantOrUnattributed`.

## 2. Last-admin invariant

- Every tenant must retain **at least one active Admin** `OrgMembership`.
- Enforcement is **distributed** via Mongo CAS / transactional writes —
  never a process-local mutex, JS `Map` lock, or frontend-only check.

## 3. Property tenant boundary

- `Property.tenant` is the canonical direct tenant boundary
  (PROPERTY-DIRECT-TENANT).
- Legacy `owner`-based attribution may still be honored where explicitly
  supported (`tenantResourceAttributionService`).
- New code prefers direct `Property.tenant` isolation.
- Cross-tenant IDs on `Property`, `Transaction`, `Contrat` fail closed.

### Tenant portfolio KPI and display sets

- `/api/property-asset/portfolio/dashboard` requires the same canonical tenant,
  immobilier module and membership-role guards as `/api/properties/portfolio`.
  `Property.tenant` must equal the resolved tenant; global roles, ownership alone
  and PlatformOperator identity do not replace tenant membership on this surface.
  Null-tenant legacy properties are excluded, without data reassignment.
- Patrimonial KPI retain tenant assets across publication and occupancy states
  (including occupied/unpublished, draft and archived assets), with optional
  `status=vente|location` filtering. Physical type and publication are not authority.
  The list remains the existing eligible-publication projection, with specialized
  accommodation/hotel projection and deduplication. Occupancy KPI must not inherit
  the list's `availability=Disponible` restriction. No new soft-delete semantics.
- The existing executive platform report explicitly opts into platform-wide
  aggregation; tenant HTTP callers cannot select that mode.
- Without a selected frontend tenant, portfolio requests remain gated. Scope
  changes hide old values immediately and invalidate outstanding responses.

## 4. Contrat domain

- `Contrat` remains **polymorphic** (`type ∈ {location, vente}`), one Mongo
  collection. Storage is shared.
- HTTP mutation surfaces are typed:
  - Rental: `/api/contrats/location/*`
  - Sale: `/api/contrats/vente/*`
- Legacy polymorphic READS remain supported:
  - `GET /api/contrats`
  - `GET /api/contrats/:id`
  Do not retire without a caller-migration phase.
- Legacy polymorphic MUTATIONS remain retired:
  - `PUT /api/contrats/:id` → `410 CONTRACT_LEGACY_MUTATION_RETIRED`
  - `DELETE /api/contrats/:id` → `410 CONTRACT_LEGACY_MUTATION_RETIRED`
- Legacy payment mutation retired:
  - `POST /api/contrats/:id/paiements` → `410 CONTRACT_PAYMENT_ENDPOINT_RETIRED`

## 5. Rental lifecycle

- `Contrat.cycleVie` is owned exclusively by `rentalLeaseLifecycleService`.
- Rental payment domain is separate (`/api/paiements/location/*`).
- `requireTenantModule('location')` is a rental-scoped gate — never a
  generic sale gate.

## 6. Sale contract lifecycle

- `Contrat(type='vente')` owns **legal** progression.
- Certified core states (SCL-2/SCL-3):
  `projet_vente → compromis_signe → acte_signe`.
- `saleCycle` is additive and nullable; legacy contracts derive their state
  from `dateSignatureActe` / `dateSignatureCompromis`.
- Direct `statut='actif'` on a sale contract cannot bypass the lifecycle
  (`CONTRACT_STATUT_LOCKED_BY_LIFECYCLE`).
- Client cannot mutate `saleCycle` or `saleCycleHistory` — allow-list rejects.
- `acte_signe` is terminal for the certified core.
- Deferred states — `annule`, `resilie`, `archive` — must not be implemented
  without an architecture decision (they cannot be represented without
  touching Property/Transaction/financial authority).

## 7. Commercial & financial authority

- `Transaction` owns commercial/financial state.
- `realEstateTransactionFinalizationService` is the sole authority for:
  payment-confirmed finalization, `Transaction.status='Réussie'`,
  commission finalization, `Property.availability='Vendu'`,
  `Property.isPublished=false`, invoice `Document` creation,
  `FinancialLedgerEntry` creation, reservation conversion, and
  `Property.assetCycle='vendu'` (best-effort).
- `Contrat(vente)` must **never** duplicate these side effects.

## 8. Sale snapshot (one-way)

- `Transaction.finalAmount` is commercial price authority.
- `Transaction.commission` is commission authority.
- At `acte_signe`, `Contrat.prixVente ← Transaction.finalAmount` and
  `Contrat.commissionAgence ← Transaction.commission.total` (legal snapshot).
- Direction is one-way: Transaction → Contrat. Never the reverse.
- Tenant staff cannot gain platform-financial authority via Contrat.

## 9. Platform vs tenant authority

- Tenant authority = `OrgMembership.businessRole`.
- Platform authority = PlatformOperator capabilities.
- The two do not imply each other.

## 10. Marketplace

- Marketplace / application / reservation flows use platform authority.
- `POST /api/contrats` (marketplace formation) requires
  `platform.commercial.manage` — no tenant membership.
- Do not convert platform formation endpoints into tenant CRUD without an
  architecture decision.

## 11. Hotel financial authority and collections

- `financialAuthorizationService` centralizes financial authorization. Neither
  global `User.role` nor `Hotel.manager` grants financial authority.
- Tenant plane: resolve an unambiguous active `OrgMembership` using
  `resolveTenantMembership`; suspended/archived tenants fail closed. Map its
  `businessRole` through named IAM capabilities, never `legacy.full`.
  Admin membership has financial management; Secretaire's existing
  `payments.manage` permits payment creation/confirmation/allocation, not
  reversal/override. GestionnaireImmobilier's `payment.status` permits
  financial reads, not money management. Other roles receive no implicit grant.
- Platform plane: an active persisted PlatformOperator with
  `platform.finance.manage` may manage financial operations independently of
  membership; `platform.finance.read` is read-only. No global-role fallback.
  Hotel operations still require a resolved tenant and matching hotel scope.
- Hotel.manager remains an operational relationship. Guest/owner personal
  document access remains distinct from staff financial-management authority.
- Reuse FinancialPayment → PaymentAllocation → FinancialDocument. Creation,
  confirmation and allocation are separate business operations; each operation
  must commit atomically with its ledger entries. No transaction spans user
  interactions. Hotel invoices are payable only when issued, in XAF; surplus
  confirmed funds may remain unallocated, but allocation cannot exceed balance.
