# Altitude Vision — Domain Ownership Map

Which module writes what, and which side effects are forbidden across
domain boundaries. Human-readable; complements
[`INVARIANTS.md`](./INVARIANTS.md).

Legend: **W** = authoritative writer; **R** = reader-only.

---

## User

- **Owner**: `authController`, `userService`.
- **Tenant boundary**: none (global identity).
- **Authority**: `User.role` is not tenant authority — see `OrgMembership`.
- **Side effects**: `tokenVersion` increment invalidates all outstanding JWTs.

## OrgMembership

- **Owner**: `organizationService`, `tenantMemberController`.
- **Tenant boundary**: `OrgMembership.orgUnit → PlatformTenant.rootOrgUnit`.
- **Authority**: `businessRole` is the canonical tenant authority.
- **Forbidden**: mutating `businessRole` outside `organizationService` or the
  tenant-member surface. Last-admin invariant enforced by CAS.

## PlatformTenant

- **Owner**: `platformTenantService`.
- **Tenant boundary**: self.
- **Forbidden**: request-body tenant IDs granting authority.

## PlatformOperator

- **Owner**: `platformOperatorService`.
- **Authority**: capabilities (`platform.commercial.manage`,
  `platform.finance.manage`, `platform.finance.read`).
- **Forbidden**: assuming tenant membership from operator status.

## Property

- **Owner (create/edit)**: `salePropertyController`, `rentalPropertyController`,
  `propertyController`, `propertyMobileController`.
- **Owner (availability lifecycle)**: `rentalListingSyncService`,
  `realEstateApplicationService`, `realEstateTransactionFinalizationService`.
- **Owner (assetCycle)**: `propertyAssetLifecycleService`.
- **Tenant boundary**: `Property.tenant` (canonical) with legacy `owner`
  fallback via `tenantResourceAttributionService`.
- **Forbidden**: writing `Property.availability='Vendu'` outside
  `realEstateTransactionFinalizationService`.

## Transaction

- **Owner (create/read/cancel/notes)**: `transactionController`.
- **Owner (finalize)**: `realEstateTransactionFinalizationService`.
- **Tenant boundary**: via `property.owner` (indirect) or explicit resource
  resolution.
- **Authority**: `platform.finance.manage` for sensitive writes.
- **Forbidden**: writing `Transaction.status`, `commission`, or
  `finalization.*` from tenant-scoped code paths. No back-writes from
  `Contrat`.

## Contrat (location)

- **Owner**: `contratController` (typed rental surface),
  `rentalLeaseLifecycleService` for `cycleVie`.
- **Tenant boundary**: via `Contrat.bien → Property.tenant`/`owner`.
- **Forbidden**: writing `cycleVie` outside the lifecycle service; direct
  `statut` write for rental (must go through lifecycle).

## Contrat (vente)

- **Owner**: `contratController` (typed sale surface),
  `saleContractLifecycleService` for `saleCycle` + `statut`.
- **Tenant boundary**: via `Contrat.bien`.
- **Forbidden**: writing `saleCycle`/`saleCycleHistory` from anywhere else;
  direct `statut='actif'` bypass; duplicating Transaction/Property/financial
  side effects; back-writing `Transaction.finalAmount` from Contrat.

## RentalManagement

- **Owner**: `rentalManagementLeaseSyncService`, `rentalManagementController`.
- **Tenant boundary**: via `RentalManagement.property → Property.tenant`.
- **Coupling**: contract creation for rental requires an active
  `RentalManagement` (`ensureRentalManagementActive`).

## FinancialDocument / FinancialLedgerEntry / FinancialPayment / …

- **Owner**: `financialController`, `financialLedgerService`,
  `financialTransactionService`, `realEstateTransactionFinalizationService`,
  `paymentAllocationService`.
- **Authority**: centralized `financialAuthorizationService` for hotel financial
  operations: active tenant membership mapped to named capabilities OR explicit
  active PlatformOperator finance capability. User.role and Hotel.manager alone
  grant no financial authority. Hotel scope must match the resolved tenant.
  Marketplace/finalization platform-financial authority remains unchanged.
- **Collections**: FinancialPayment owns received money; PaymentAllocation owns
  assignment to invoices; FinancialLedgerEntry records each operation. Separate
  create/confirm/allocate operations preserve atomicity individually.
- **Forbidden**: creating invoices or ledger entries from tenant contract
  routes.

## Paiement (rental)

- **Owner**: `paiementController` (typed rental surface),
  `rentalPaymentScheduleService`.
- **Authority**: rental tenant staff scoped by `requireTenantModule('location')`.
- **Forbidden**: writing sale-related payment state through this surface.

## PaiementTransaction (sale/rental commercial)

- **Owner**: `paiementTransactionController`.
- **Authority**: `platform.finance.manage` for cash/virement validation;
  client self-service for buyer-initiated flows.

## RealEstateReservation

- **Owner**: `realEstateApplicationService`,
  `realEstateTransactionFinalizationService` (conversion),
  `releaseReservation` (cancellation).
- **Coupling**: at most one active reservation per property (schema unique).

## Hotel / Accommodation / HotelReservation

- **Owner**: `hotelController`, `hotelReservationController`,
  `accommodationController`, `accommodationReservationController`.
- **Tenant boundary**: `Hotel.tenant`, `Accommodation.tenant`.
- **Financial coupling**: `hotelFinancialDashboardController`,
  `financialController` for hotel invoices and checkout blockers.
- Verify current runtime state before treating any historical hotel
  roadmap doc as certified fact.

## Notification (`notify`, `notifyStaff`, `notifyContractTenant`)

- **Owner**: `notificationService`, `rentalTenantNotificationService`.
- **Rule**: idempotent lifecycle transitions must not fire duplicate
  notifications.

## ActionLog

- **Owner**: `actionLogService`.
- **Rule**: append-only; existing `module` taxonomy (`GestionLocative`,
  `Altimmo`, …) is preserved — do not opportunistically refactor it.
