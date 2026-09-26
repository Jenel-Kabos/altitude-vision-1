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

## 12. Canonical authorization architecture patterns (ARCH-AUTH-03)

Three canonical patterns coexist in the codebase — each right for its domain,
none universal. Do **not** normalize a domain onto another domain's pattern
without an explicit architecture decision. Every pattern implements the same
underlying rule of §1 (tenant authority ≠ platform authority ≠ global role),
just at a different composition site.

### Pattern 1 — Route-level compositional (Option 3)

- Canonical middleware: `server/middleware/tenantMembershipRoleOrPlatformCapability.js`.
- One middleware factory `requireTenantMembershipRoleOrPlatformCapability({ tenantRoles, platformCapabilities })`
  accepts EITHER PATH A (active `OrgMembership` with matching `businessRole`) OR PATH B
  (active `PlatformOperator` with matching capability AND explicitly selected tenant via
  `X-Platform-Tenant-Id` / `X-Tenant-Id`).
- No global `User.role` bypass. No artificial `OrgMembership` synthesis. No cross-tenant
  platform-wide view — PATH B is always tenant-scoped to a selected tenant.
- Read/write capabilities separate: reads accept `<domain>.read` OR `<domain>.manage`;
  mutations require `<domain>.manage` only.
- Domains using Pattern 1:
  - **Members** — `server/routes/tenantMemberRoutes.js` (`platform.users.read/manage`).
  - **Properties** — `server/routes/propertyRoutes.js` + `propertyAssetRoutes.js`
    (`platform.properties.read/manage`); 4 helpers portfolioRead/portfolioManage/
    moderationRead/moderationManage.
  - **Rentals** — `server/routes/rentalManagementRoutes.js` (`platform.rentals.read/manage`);
    scope strictly limited to R1 (reads) + R2 (RentalManagement-only state). R4 lifecycle
    routes (publish, mark-*, notice, validate-exit, resolveRequest, onboarding create)
    mutate Property/Contrat/RealEstateReservation and REMAIN on strict
    `requireTenantMembershipRole` — enabling PlatformOperator on them requires a future
    slice composing multiple capabilities (`platform.rentals.manage` +
    `platform.properties.manage`, potentially `platform.contracts.manage`).
  - **CRM** — `server/routes/crmRoutes.js` + `crmAutomationRoutes.js`
    (`platform.crm.read/manage`); STAFF=6 roles (Admin, Collaborateur,
    GestionnaireImmobilier, Secretaire, CommunityManager, Communicant),
    MANAGERS=Admin+GestionnaireImmobilier only for `/consolidations` and automation
    rule mutations/simulate.

### Pattern 2 — Route-level platform-native

- Canonical middlewares: `requireTenantScopeForStaffAllowPlatformWide` +
  `requirePlatformOperatorCapabilityWhenPresent` (and, where operational granularity
  is needed, a domain-specific third layer such as `requireHotelCapability`).
- The two middlewares chain: the scope middleware admits either a tenant-scoped staff
  member OR a platform-wide operator context (with or without a selected tenant);
  the capability middleware enforces the platform capability WHEN a PlatformOperator
  context is present (transparent for pure PATH A tenant staff).
- Rationale: the domain is natively multi-tenant AND platform-observable — the
  PlatformOperator legitimately needs a platform-wide read across all tenants (moderation,
  cross-tenant reporting) without being forced to select a single tenant, while tenant
  staff remain strictly scoped.
- Domains using Pattern 2:
  - **Accommodations** — `platform.accommodations.read` already wired.
  - **Hotels** — `platform.hotels.read/manage` already wired; `requireHotelCapability`
    (F2.6 operational) sits as a 3rd layer for granular hotel-manager operations
    (check-in/check-out overrides, reservation lifecycle).

### Pattern 3 — Service-level unified

- Canonical service: `server/services/finance/financialAuthorizationService.js`,
  function `hasFinancialCapability(user, capability)`.
- Authority resolution is centralized IN THE SERVICE, not at the route layer. A single
  entrypoint composes PATH A (`resolveTenantMembership` → `tenantCapabilities(businessRole)`
  mapping via `DEFAULT_CAPABILITIES` / IAM) AND PATH B (`resolveActiveOperator` →
  `platform.finance.read` maps to `readOnlyFinanceCapabilities`,
  `platform.finance.manage` maps to `adminCapabilities`) in one decision.
- Fine-grained CAPABILITIES enum (22 named): DOCUMENT_VIEW, DOCUMENT_CREATE_DRAFT,
  DOCUMENT_EDIT_DRAFT, DOCUMENT_ISSUE, PAYMENT_VIEW, PAYMENT_CREATE, PAYMENT_CONFIRM,
  PAYMENT_ALLOCATE, ALLOCATION_REVERSE, LEDGER_VIEW, RECONCILIATION_VIEW,
  RECONCILIATION_RUN, HOTEL_CHECKOUT_VIEW, HOTEL_CHECKOUT_OVERRIDE,
  DOCUMENT_PDF_GENERATE, DOCUMENT_PDF_DOWNLOAD, DOCUMENT_EMAIL_SEND,
  DOCUMENT_DELIVERY_VIEW, DASHBOARD_VIEW, DASHBOARD_ALERTS_VIEW,
  DASHBOARD_OVERRIDE_AUDIT_VIEW.
- Grouped bundles: `readOnlyFinanceCapabilities` (all *_VIEW-style caps),
  `operationalPaymentCapabilities` (Secretaire's PAYMENT_CREATE/CONFIRM/ALLOCATE),
  `managerCapabilities` (Admin/manager-level bundle without irreversibles),
  `adminCapabilities` = managerCapabilities + RECONCILIATION_RUN +
  HOTEL_CHECKOUT_OVERRIDE + DASHBOARD_OVERRIDE_AUDIT_VIEW.
- Rationale: 20+ granular financial operations, several irreversible
  (allocation reverse, reconciliation run, hotel checkout override, dashboard audit
  override). Routes would need 20+ different `platformCapabilities: [...]` argument
  triplets and repeatedly retype the same PATH A businessRole → capability mapping.
  The service centralization is what makes fine-grained financial capabilities
  auditable and testable in one place.
- Domain using Pattern 3: **Finance** (Payments, Documents, Ledger, Reconciliation,
  Dashboard, Hotel checkout financial paths).

### Pattern selection decision tree

1. Does the domain have MORE than ~5 distinct operations that need independent
   authority? → **Pattern 3** (service-level unified). Rationale: route-level
   composition scales badly past a handful of capabilities.
2. Does the domain natively need a platform-wide (all-tenants) view or moderation
   surface for PlatformOperator? → **Pattern 2** (route-level platform-native).
3. Otherwise (tenant-native domain with a small handful of operations exposed to
   PlatformOperator for administrative visibility, always tenant-scoped) →
   **Pattern 1** (route-level compositional Option 3).

Not-yet-classified domains: **Documents**, **Reporting**, **Commercial** (marketplace
formation, see §10 — currently platform-only via `platform.commercial.manage`),
**Organization** (Org/Tenant lifecycle). Classification requires a dedicated audit
slice before any authority change.

### Anti-patterns (forbidden across ALL three patterns)

- **Double authority stacking.** Never chain a Pattern-1 middleware with a
  Pattern-2 middleware on the same route — the two admit disjoint identity shapes.
  Never chain a route-level authority middleware with a service-level authority
  check (Pattern 3) that duplicates the same PATH A/B resolution — service calls
  belong INSIDE Pattern-3 handlers, not on top of Pattern-1/2 middlewares.
- **`User.role='Admin'` bypass.** Global `User.role` is identity, not tenant nor
  platform authority. Any code path that grants tenant or platform authority based
  on global role is a §1 violation.
- **Artificial `OrgMembership` synthesis.** A PlatformOperator MUST NOT gain tenant
  authority by having the runtime forge an in-memory OrgMembership on their behalf.
  PATH B (platform capability + selected tenant) is the sole legitimate mechanism.
- **Cross-tenant fail-open on tenant:null legacy resources.** A PlatformOperator
  who has selected a tenant via `X-Platform-Tenant-Id` MUST NOT access a resource
  whose `tenant == null` (legacy unattributed); such resources are the domain of
  their legitimate `owner` (self-service pathway), not of any operator context.
  See `rentalManagementRoutes.js` `router.param('id')` for the canonical
  fail-closed enforcement.

### Cross-cutting invariants (all patterns)

- **Fail-closed on missing/null/cross-tenant.** Missing tenant context, `tenant == null`
  on a resource in an operator context, and cross-tenant resource IDs all resolve to
  404 or 403 — never to permissive access.
- **Capability read/manage separation.** Reads must be authorized by `<domain>.read`
  OR `<domain>.manage`; mutations by `<domain>.manage` only. `read` never grants
  write.
- **Finance capability immutability.** The `CAPABILITIES` enum and the four capability
  groups (readOnly / operational / manager / admin) in `financialAuthorizationService`
  are the audit surface for financial authority. Changes require an architecture
  decision, not a domain slice.
- **Never touch core middleware.** `server/middleware/tenantMembershipRole.js` and
  `server/services/finance/financialAuthorizationService.js` are canonical anchors
  of Patterns 1 and 3 respectively; direct edits require an architecture decision.

### Domain classification summary

| Domain | Pattern | Anchor |
|---|---|---|
| Members | 1 | `tenantMemberRoutes.js` |
| Properties | 1 | `propertyRoutes.js` + `propertyAssetRoutes.js` |
| Rentals (R1/R2) | 1 | `rentalManagementRoutes.js` |
| Rentals (R4 lifecycle) | 1-strict-PATH-A | same file — no PATH B until composed slice |
| CRM | 1 | `crmRoutes.js` + `crmAutomationRoutes.js` |
| Accommodations | 2 | `accommodation*Routes.js` |
| Hotels | 2 (+ operational F2.6) | `hotel*Routes.js` + `requireHotelCapability` |
| Finance | 3 | `financialAuthorizationService.js` |
| Documents | not classified | audit slice required |
| Reporting | not classified | audit slice required |
| Commercial (marketplace) | platform-only §10 | `POST /api/contrats` |
| Organization | not classified | audit slice required |
