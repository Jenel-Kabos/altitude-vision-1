# C2.8M Atomic Legacy Asset Regularization Design

## Intent

Build and certify a narrowly scoped, transaction-safe mechanism that can later move exactly two legacy `Property.tenant:null` records owned by huinlogistics Boss into Mila Events. The future mutation may only change `Property.tenant`; `Property.owner` and every other business field remain unchanged. This mission develops preview and apply machinery but does not authorize a production apply.

## Non-negotiable scope

- `Property.tenant` remains the only organizational provenance.
- `/mes-biens` remains owner-scoped and unchanged.
- Discovery remains read-only and cannot call the apply engine.
- The Altitude Vision orphan Hotels are excluded from all validation and mutation paths.
- No scan-driven mutation, owner-wide update, backfill, repair, commit, push, deploy, full Mongo run, or remote mutation.
- The production CLI is purpose-specific to the two approved Property IDs; the service remains explicit and reusable.

## Considered architectures

### Selected: focused transactional service plus purpose-specific CLI

A new service accepts `targetTenantId`, `expectedOwnerId`, the complete explicit `propertyIds` batch, actor, reason, operation ID, and mode. It performs preview and apply through the same validation pipeline inside one Mongo transaction. A separate CLI pins the Mila Events batch and enforces production confirmations before connecting.

This keeps business validation testable independently from CLI guards and makes an accidental third Property impossible.

### Rejected: extend `tenantDataRegularizationService`

The existing service applies one manifest entry per transaction. C2.8M requires both Properties to commit or roll back together, so adapting that flow would preserve the wrong atomicity boundary.

### Rejected: add apply to discovery

This would violate the required security boundary. `discoverAssetProjectionConsistency.js` and its service remain strictly read-only.

## Components

### Apply service

`regularizeAssetProjectionBatch(input)` owns a single transaction for the full batch. Preview calls the same transaction-scoped validation path but performs no `Property` or `ActionLog` writes.

Input:

- `mode`: `preview` or `apply`;
- `targetTenantId`;
- `expectedOwnerId`;
- `propertyIds`: exact, unique, non-empty allowlist;
- `actorId`;
- `reason`;
- `operationId`;
- optional failure injection used only by tests.

The actor must be an active `PlatformOperator` with `platform.properties.manage` and an active, non-technical User account.

### CLI

`applyAssetProjectionConsistency.js` contains the immutable C2.8M manifest:

- owner `6a84080352c6ffabafb26af7`;
- tenant `6a9ba40f6e102ba5f9b1a4c6`;
- Properties `6a8be8be306fabec9cad0506` and `6a89f9bcbbb632e80e727ec4`;
- reason `C2_8M_LEGACY_ORGANIZATION_ASSET_REGULARIZATION`.

Preview requires explicit database, target tenant, owner, actor, operation ID, and both exact Property confirmations. Apply additionally requires `--apply`, `--confirm-production`, and an explicit apply environment guard. Any missing, duplicate, or additional Property ID is rejected before connection. The target host/database description is emitted without credentials before connection. Mongoose connects with `autoIndex:false` and `autoCreate:false`.

## Transactional validation

Inside the transaction, immediately before any mutation:

1. Re-read the active PlatformOperator and exact capability.
2. Re-read the target `PlatformTenant` and prove exactly one active root owner membership for the expected owner with `roleInUnit:owner` and `businessRole:Admin`; reject inactive history, ambiguity, wrong root, or inactive tenant.
3. Re-read every allowlisted Property under the session.
4. Require exact cardinality, expected owner, and either `tenant:null` or the target tenant.
5. Re-run `classifyOrganizationAsset` for current historical and eligibility state.
6. Detect active Transactions, RealEstateReservations, RealEstateApplications, Accommodation/Hotel reservations, RentalManagement, and live Contracts linked to each Property.
7. Reject the whole batch on any conflict, ambiguity, history state, or workflow blocker.

## Mutation, CAS, and idempotence

For apply, each candidate is updated with a CAS containing `_id`, expected owner, `tenant:null`, and the eligibility fields observed and classified within the transaction. `modifiedCount` must be exactly one for each candidate. Any mismatch aborts the transaction.

Properties already in the target are reported `ALREADY_IN_TARGET` and are never written. If the complete batch is already in target, the second execution is a no-op with no new audit events. Concurrent transactions rely on Mongo write-conflict retry plus revalidation; at most one logical mutation and one canonical audit event per Property result.

Failure injection points are before the first mutation, after the first Property, before the second Property, and before transaction commit. Each failure aborts the entire batch.

## Audit

Successful apply writes one `ActionLog` per migrated Property in the same transaction. It uses the existing `metadata.regularization` envelope and unique batch/resource/operation index. The log records actor, operation ID, Property, owner, previous tenant, target tenant, reason, and batch identity. Preview and all rejected/no-op paths write no audit event.

## Expected post-condition after a separately authorized future apply

- Mila Events Properties: 3.
- Sales: 1.
- Rentals: 1.
- Independent Accommodations: 0.
- Hotels: 1.
- huinlogistics Boss `/mes-biens`: 3.

## End-to-end post-condition gate

The apply engine is not certified from `Property.tenant` mutations alone. A local Mongo replica-set fixture must reproduce the complete future business state and execute the real query contracts used by each projection rather than reimplementing their filters in the test.

After atomically regularizing Bureau and Parcelle, the gate must prove:

- the owner-scoped `/mes-biens` contract still returns exactly Mila Hotel, Bureau, and Parcelle;
- the Mila Events tenant registry returns exactly those three Properties;
- the Mila Events sales and rentals projections return exactly one Property each;
- the independent Accommodation projection returns zero;
- the Hotel/Établissements projection returns exactly one Hotel, Mila Hotel;
- neither `tenant:null` nor another tenant's sentinel Property leaks into a Mila Events projection;
- regularizing Bureau and Parcelle creates no Accommodation or Hotel;
- Mila Hotel is not duplicated;
- all three `Property.owner` values remain the original owner;
- the two Altitude Vision Hotels with missing Property anchors remain outside the fixture projections and outside every C2.8M input/result.

This gate runs only on the local Mongo harness. A real read-only preview is forbidden until it is GREEN.

## Certification boundary

Certification uses only the local replica-set Mongo test harness. After targeted tests and static gates pass, the preview may run against the configured Atlas database only after its no-write behavior, `autoIndex:false`, and `autoCreate:false` guards are proven. The absolute stop point is the real preview result; production apply remains forbidden.

The final report verdict is exactly `READY_FOR_PRODUCTION_APPLY_AUTHORIZATION` or `NOT_READY_FOR_PRODUCTION_APPLY`, and must explicitly retain `PRODUCTION_MUTATION=NO`, `REMOTE_DATA_MUTATION=NO`, `LEGACY_MIGRATION_EXECUTION=NO`, `COMMIT=NO`, `PUSH=NO`, `DEPLOY=NO`, and `FULL_MONGO=NO`.
