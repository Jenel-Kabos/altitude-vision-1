# RESET-TEST-HOTELS-AND-RECREATE-1

## 1. Executive Summary

Verdict: **F — PRODUCTION INVENTORY UNAVAILABLE — DELETE SAFETY UNPROVEN**.

The local architecture audit proves that a Hotel is surrounded by substantially more than its Property and Accommodation. The existing delete endpoint is intentionally limited to never-published drafts/rejections, performs a non-transactional partial cascade, and cannot safely delete HOTEL MILA as characterized historically. No production read-only credential was available, so no Hotel was inventoried or classified as disposable. Production writes/deletes: zero.

## 2. Git Baseline

- Branch: `main`.
- HEAD: `9a6f77592f3eba267967cfe1b9e3ef1201d3d253`.
- Worktree was already dirty with unrelated client, tenant/rental, financial-portal reports/services/tests, and the local release-report update. All were preserved.
- Initial `git diff --check`: GREEN.
- This report is the only artifact created by this sprint. No commit, push, deploy, reset, clean, restore, or stash.

## 3. Current Hotel Architecture

The domain uses a Hotel business document, a linked public Property anchor (`Hotel.property`), and an Accommodation adapter (`Accommodation.hotel` plus `Accommodation.property`). RoomCategory and Room are separate collections. Reservations target Hotel and RoomCategory; physical-room assignment is a separate historical collection.

## 4. Hotel Dependency Graph

```text
Hotel
├── Property anchor (Hotel.property; potentially referenced by shared real-estate domains)
├── Accommodation adapter(s) (hotel + property)
│   ├── RatePlan (accommodation)
│   ├── AccommodationReservation
│   ├── AvailabilityBlock / NightLock / CalendarMutex
├── RoomCategory
│   ├── RatePlan (roomCategory)
│   ├── RoomInventory / InventoryOperationLock
│   └── HotelReservation
├── Room
│   ├── RoomAssignment
│   ├── HousekeepingTask
│   ├── RoomInspection
│   └── MaintenanceTicket
├── HotelReservation
│   ├── RoomAssignment / notification
│   ├── financial documents, lines, artifacts, deliveries
│   ├── payments, allocations, receipts, refunds
│   └── append-only FinancialLedgerEntry
├── HotelStaffAssignment
└── audit/notification/document references that should normally be retained
```

Property can additionally be referenced by Document, Transaction, Conversation, Like/Review, Visite, Signalement, RealEstateApplication/Reservation, SaleManagement, Contrat, Estimation comparables, and rental-domain models. These are shared references, not automatically Hotel-owned.

## 5. Property Projection

`Hotel.property` points to `Property._id`; Accommodation must point to the same Property. Property also has tenant and owner authority plus public-state fields. Because many non-Hotel models can reference a Property, exclusivity must be proven per target before deletion. User/owner records are never cleanup targets.

## 6. Accommodation Projection

Accommodation references both Hotel and Property and is normally the Hotel booking adapter. It owns/reaches Accommodation-specific RatePlans, reservations, calendar locks, blocks and mutex state. The current Hotel delete removes Accommodation documents but does not enumerate these dependent collections, so exclusivity and orphan prevention are not certified.

## 7. Rooms

Rooms and RoomCategories are separate collections keyed by Hotel. RoomInventory and InventoryOperationLock reference Hotel/RoomCategory. RoomAssignment references Room and HotelReservation and retains released assignment history. Counts are unavailable without production inventory.

## 8. Reservations

`HotelReservation.hotel` and `.roomCategory` are direct critical references and include guest PII and frozen pricing. AccommodationReservation is another reservation domain linked through Accommodation. Any real or ambiguous reservation makes hard deletion ineligible. Production counts/classification are unavailable.

## 9. Financial Dependencies

FinancialDocument, FinancialPayment, PaymentAllocation, FinancialRefund, FinancialSequence and FinancialLedgerEntry use `domain=hotel`, `establishmentType=Hotel`, and `establishmentId=Hotel._id`; artifacts/deliveries can reference HotelReservation. Payment receipts and document lines are transitive. Ledger entries are append-only and explicitly reject delete/update middleware operations. Any financial history is a hard preservation gate.

## 10. Housekeeping

HousekeepingTask directly references Hotel, Room and optionally HotelReservation. RoomInspection references Room and HousekeepingTask. These are operational/historical children and are not deleted by the current Hotel service. Counts/classification are unavailable.

## 11. Maintenance

MaintenanceTicket directly references Hotel, Room and optionally RoomInspection. It is distinct from RentalMaintenanceTicket; rental maintenance is excluded and must never be swept by Hotel cleanup.

## 12. Documents

The general Document model supports Property and polymorphic `entityType/entityId` relationships. Financial artifacts/deliveries are immutable/audited evidence tied transitively to reservations/documents. Shared, regulatory, issued or ambiguous documents must be retained and block deletion.

## 13. Cloudinary

Property, Hotel/RoomCategory galleries and related records may hold media references. No Cloudinary call occurred. Mongo cannot transact with Cloudinary; any future media cleanup needs a post-commit queue/compensation plan and proof of exclusive asset ownership. Default preference is retain assets until DB cleanup is certified.

## 14. Notifications / Audit Logs

HotelReservationNotification references reservations. General Notification/ActionLog may contain target metadata rather than strict foreign keys. Audit evidence should be retained or tombstoned, not erased merely for cosmetic cleanup. No audit/log deletion is proposed.

## 15. Tenant Safety

Future eligibility requires a known, identical tenant across Hotel, Property, Accommodation, RoomCategory/Room and every owned child. Any null ambiguity or mismatch fails closed. Existing `assertHotelAccess(...HOTEL_MANAGE)` protects the endpoint, but it does not make a cross-tenant dependency safe to cascade.

## 16. Owner/User Safety

User, Proprietaire, Client, staff and tenant records are shared authorities and are never deletion targets. HotelStaffAssignment records are Hotel references; their presence currently blocks the canonical delete.

## 17. Existing Delete Workflow

`DELETE /api/hotels/:id` loads Hotel/Property, checks `HOTEL_MANAGE`, and permits only `brouillon|rejete` with no `publishedAt`. It blocks when RoomCategory, Room, HotelReservation, FinancialPayment/Document/Refund, HousekeepingTask, MaintenanceTicket or HotelStaffAssignment counts are non-zero.

If allowed, `hotelService.deleteHotel` sequentially deletes RoomCategory RatePlans, RoomCategories, Accommodation, Hotel, Property, then Property images. It has no Mongo transaction and does not enumerate Accommodation RatePlans/reservations/calendar data, RoomInventory/locks, assignments/inspections, notifications, financial transitive records, documents or shared Property references. It also invokes external image cleanup after DB deletions. Therefore it is safe only for the very narrow empty never-published case already guarded; it is **not certified for legacy published-test cleanup** and must not be reused for HOTEL MILA.

## 18. Production Inventory

Unavailable. `HOTEL_PUBLICATION_RESYNC_MONGODB_URI` was UNSET; the application `server/.env:MONGO_URI` was not used. Production Hotel count and every dependency count remain unknown. Production reads: zero.

## 19. Hotel-by-Hotel Classification

No production Hotel could be enumerated. Each Hotel remains `UNPROVEN / NOT DELETE ELIGIBLE`. There is no basis for “delete all”.

## 20. HOTEL MILA Classification

- Exists/IDs/tenant/dependencies: unverified in this sprint.
- Test data: UNPROVEN.
- Real business history: UNPROVEN.
- Safe to delete: NO/UNPROVEN.
- The historical fact that it was published means the current canonical endpoint would reject deletion even before dependency checks.

## 21. Safe Delete Predicate

`SAFE_TO_DELETE_TEST_HOTEL` requires: explicit stable Hotel ID; independently proven test provenance; known coherent tenant and linked IDs; exclusive Hotel ownership of every deletion target; zero real/ambiguous Hotel and Accommodation reservations; zero issued/immutable financial, ledger, payment, refund, receipt or regulatory history; zero ambiguous/shared Property references; complete classified operational children; no cross-tenant anomaly; and a tested atomic cleanup implementation. Unknown equals false.

## 22. Delete Plan

No executable plan is authorized yet. After read-only inventory, choose per Hotel:

1. Preserve/archive or use publication resync when any business/financial/ambiguous history exists.
2. For a proven empty disposable target, first build and certify a dedicated explicit-ID cleanup service; do not broaden the current endpoint silently.
3. Requalify immediately before mutation and lock/CAS the target state.
4. Inside one Mongo transaction, delete only proven-owned operational leaf records, inventory/locks, room data, Accommodation children and adapter, then the exclusive Property anchor and Hotel in a dependency-safe order. Retain immutable financial/audit history; if such history exists, abort instead.
5. Verify zero dangling references before commit. Handle media after DB commit through an auditable compensation queue only when ownership is proven.
6. Require a separate production-delete authorization naming exact Hotel/Property/Accommodation IDs.

## 23. Transaction Strategy

A replica-set transaction is recommended because multiple collections must remain coherent. Read qualification and all Mongo deletes should occur in one session with conditional target predicates. Cloudinary remains outside the transaction. The existing sequential cascade is insufficient for this broader operation.

## 24. Cloudinary Strategy

Inventory public IDs without deleting. After successful DB transaction and orphan verification, enqueue individually proven-owned assets for controlled cleanup with retry/audit. On uncertainty, retain the asset. Never delete shared Property media or act before separate authorization.

## 25. Recreation Plan

Recreate manually through the normal dashboard only after authorized cleanup: actor → full Hotel wizard → submit → moderation → validate. Never insert directly into Mongo and never recreate automatically in this audit.

## 26. Publication Verification Plan

After recreation validate: Hotel `publicationStatus=publie`; Accommodation `publicationStatus=publie`; Property `statusAdmin=Validée` and `isPublished=true`; same tenant/links; public `/api/properties`; `/immobilier/annonces` card/image/type/price/CTA; public detail. The corrected workflow should require no special resync.

## 27. Risks

Primary risks are deleting real reservations/PII, violating append-only financial history, leaving Property/Accommodation/Room orphans, cross-tenant deletion, shared Property/media destruction, partial sequential failure, and duplicated Hotel name caused by an orphan. All remain fail-closed until production inventory and dedicated cleanup tests exist.

## 28. Mandatory Answers

1. Branch? `main`.
2. HEAD? `9a6f77592f3eba267967cfe1b9e3ef1201d3d253`.
3. Worktree initial? Dirty, preserved.
4. Hotel model? `server/models/Hotel.js`.
5. Property model? `server/models/Property.js`.
6. Accommodation model? `server/models/Accommodation.js`.
7. HotelReservation model? `server/models/HotelReservation.js`.
8. Exact Hotel→Property relation? `Hotel.property → Property._id`.
9. Exact Hotel→Accommodation relation? `Accommodation.hotel → Hotel._id`, plus same Property link.
10. Rooms embedded/separate? Separate Room and RoomCategory collections.
11. Other Hotel dependencies? Yes; graph in section 4.
12. Existing delete endpoint/service? `DELETE /api/hotels/:id` → `hotelController.remove` → `hotelService.deleteHotel`.
13. Existing delete safe? Only for guarded empty never-published drafts/rejections; not for legacy published cleanup.
14. Existing delete cascades? Partial sequential cascade only.
15. Production Hotel count? Unknown.
16. HOTEL MILA exists? Unverified here.
17. HOTEL MILA Hotel ID? Unknown.
18. HOTEL MILA Property ID? Unknown.
19. HOTEL MILA Accommodation ID? Unknown.
20. Tenant consistent? Unknown.
21. Rooms count? Unknown.
22. Reservations count? Unknown.
23. Real reservations? Unknown.
24. Financial documents count? Unknown.
25. Payments count? Unknown.
26. Financial history? Unknown.
27. Housekeeping records? Unknown.
28. Inspections? Unknown.
29. Maintenance records? Unknown.
30. Documents? Unknown.
31. Cloudinary assets? Unknown.
32. Audit logs? Unknown; preserve by default.
33. Any shared resource? Property and audit/user/media references may be shared; target-specific proof required.
34. Any ambiguous dependency? Yes, until inventory.
35. HOTEL MILA proven test data? No.
36. HOTEL MILA safe to delete? No/UNPROVEN.
37. Other Hotels found? Inventory unavailable.
38. Each Hotel individually classified? No.
39. Broad delete needed? NO.
40. Delete by explicit IDs? Required for any future operation.
41. Transaction recommended? Yes for multi-collection cleanup.
42. Cloudinary cleanup required? Unknown; inventory and exclusive ownership required.
43. Users deleted? NO.
44. Proprietaires deleted? NO.
45. Rental data touched? NO.
46. Financial immutable history deleted? NO.
47. Production reads? NO.
48. Production writes? 0.
49. Production deletes? 0.
50. Code changed? No.
51. Tests required? No code changed; future cleanup implementation requires RED/Mongo/regression gates.
52. Tests results? Not run; structural audit only.
53. Architecture? Not rerun; no code changed.
54. Lint? Not rerun; no code changed.
55. Diff-check? GREEN.
56. Commit? NO.
57. Push? NO.
58. Deploy? NO.
59. Safe cleanup plan ready? Conceptual fail-closed plan ready; executable plan blocked on inventory and implementation proof.
60. Explicit delete authorization required? YES, after prerequisites.
61. Recreation through normal UI? Yes.
62. New validation should set `isPublished=true`? Yes, deployed hotfix contract.
63. Special resync required after recreation? Expected NO.
64. Final verdict? F — production inventory unavailable; delete safety unproven.

## 29. Final Verdict

**F — PRODUCTION INVENTORY UNAVAILABLE — DELETE SAFETY UNPROVEN.**

Do not delete HOTEL MILA or any Hotel. Next obtain a legitimate dedicated read-only production credential, inventory every target and dependency, and classify each Hotel individually. If a disposable target is proven, a separate tested cleanup hotfix and explicit production-delete authorization are still required.
