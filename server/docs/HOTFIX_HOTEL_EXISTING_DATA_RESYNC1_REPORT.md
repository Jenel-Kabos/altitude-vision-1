# HOTFIX-HOTEL-EXISTING-DATA-RESYNC-1 — Certification report

## 1. Executive Summary

SPRINT: HOTFIX-HOTEL-EXISTING-DATA-RESYNC-1
VERDICT: A — TARGETED HOTEL RE-SYNC TOOL CERTIFIED — READY FOR POST-DEPLOY CONTROLLED APPLY
BRANCH: `main`
HEAD: `49f12d787b1011d16f9682cedefb81b377823e4d`
PREVIOUS HOTFIX: CERTIFIED
ROOT CAUSE: `Property.isPublished` historical sync gap
EXISTING DATA REPAIR: REQUIRED for a stale historical record, subject to production dry-run qualification
REPAIR SCOPE: TARGETED
TARGET SELECTION: EXPLICIT HOTEL ID
NAME-BASED MUTATION: NO
ELIGIBILITY: CERTIFIED
TENANT SAFETY: PASS
DRY-RUN: YES
DEFAULT: DRY-RUN
APPLY EXPLICIT: YES
IDEMPOTENT: YES
CAS: YES
CONCURRENT SAFE: YES
MODEL CHANGE: NO
PUBLIC QUERY CHANGE: NO
FRONTEND CHANGE: NO
MOBILE CHANGE: NO
NEW DEPENDENCY: NO
RED: PASS
TARGETED TESTS: 23/23
HOTEL CLUSTER: 176/176
MONGO: 38/38 relevant tests
FULL BACKEND: 1600/1600
ARCHITECTURE: PASS
LINT: PASS — 0 errors; 102 pre-existing warnings; new files clean
DIFF CHECK: GREEN
SECRET SCAN: PASS
PRODUCTION READ: NO
PRODUCTION WRITE: NO
PRODUCTION APPLY: NO
POST-DEPLOY RESYNC READY: YES
MANUAL PROD CHECK REQUIRED: YES
COMMIT: NO
PUSH: NO
DEPLOY: NO

## 2. Git Baseline

The initial baseline was branch `main`, HEAD `49f12d787b1011d16f9682cedefb81b377823e4d`. The worktree was already dirty and was preserved. Pre-existing tracked changes concerned dashboard/payment UI, Hotel publication tests/controller, tenant portal tests/service, and rental-management controller/routes. Pre-existing untracked files included earlier audit/hotfix reports and rental financial portal work. No reset, clean, restore, stash, add, commit, push, or deployment was performed.

## 3. Previous Hotfix Baseline

`server/docs/HOTFIX_HOTEL_PUBLICATION_VISIBILITY1_REPORT.md` was read in full. Its certified root cause remains unchanged: Hotel validation previously synchronized Hotel, Accommodation, and `Property.statusAdmin`, but omitted `Property.isPublished`. The previous fix covers future validation/rejection transitions; it does not mutate historical records.

## 4. Existing Data Problem

A Hotel validated before the previous fix can remain linked to a Property whose `isPublished` is false or absent. It will therefore be excluded by the correct public Property query. HOTEL MILA motivates the operation, but its name is neither encoded nor queried. No production data was read, so actual current eligibility must be established by the future dry-run using its stable Hotel ID.

## 5. Hotel/Property/Accommodation Relations

- Models: `server/models/Hotel.js`, `server/models/Property.js`, `server/models/Accommodation.js`.
- Hotel points to its Property through `Hotel.property`.
- Accommodation points back through `Accommodation.hotel` and `Accommodation.property`; the repair requires exactly one coherent Hotel accommodation.
- Tenant authority is carried by all three records. Non-null Hotel, Property, and Accommodation tenants must be identical.
- Property ownership remains `Property.owner`. The repair neither infers nor rewrites ownership: an Admin-created Hotel may legitimately have a separately assigned owner, so tenant and canonical links—not speculative owner equality—govern this repair.

## 6. Canonical Publication Contract

A publishable Hotel is present, `publicationStatus=publie`, `status=actif`, and not explicitly inactive. Its Property is present, `type=hebergement`, `pole=Altimmo`, `statusAdmin=Validée`, `availability=Disponible`, and not `internalManagedOnly=true`. Exactly one linked Accommodation must reference the same Hotel and Property, have `type=hotel`, `publicationStatus=publie`, not be explicitly inactive, and share the tenant.

The public Property condition remains `isPublished=true`; `/api/properties` was not changed. Rejected, submitted/pending, draft, inactive, internally managed, unavailable, or otherwise incoherent records remain unpublished.

## 7. Eligibility Predicate

`ELIGIBLE_TO_REPUBLISH` is the conjunction of the complete contract above, an explicit valid Hotel ObjectId, coherent bidirectional IDs, a unique required Accommodation, strict non-null tenant equality, and `Property.isPublished != true`. Missing or ambiguous critical facts fail closed. An already coherent record returns `ALREADY_SYNCED`, not eligible-for-write.

## 8. Tenant Safety

Tenant mismatch returns `TENANT_MISMATCH` and performs zero writes. Null/ambiguous tenant authority also fails closed. The CAS includes the exact previously qualified Property tenant; no mismatch is auto-corrected and no tenant/owner metadata is emitted.

## 9. Repair Strategy Comparison

- One-off script: narrow, but risks duplicating domain qualification inside operational code.
- Internal service plus CLI: testable qualification/CAS with a short-lived, explicitly administered entry point.
- Admin endpoint: unnecessary permanent attack surface.
- Startup migration: implicit, broad, and unsuitable for one stale boolean.
- Manual Mongo update: bypasses tested qualification and CAS.

## 10. Selected Strategy

Option B was selected: `server/services/validatedHotelPublicationResyncService.js` plus `server/scripts/resyncValidatedHotelPublication.js`. It uses canonical Mongoose models, has no endpoint, no discovery/batch mode, no migration framework, and no transaction because one field on one Property is the sole write.

## 11. Dry-Run Contract

Dry-run is the default. It reads, qualifies, and returns sanitized JSON containing mode/database, Hotel ID, Property ID when known, Hotel publication state, current/expected Property publication boolean, eligibility, `wouldUpdate`, result, reason, and write count. It performs no mutation and is compatible with a dedicated read-only credential.

Results distinguish `ELIGIBLE`, `ALREADY_SYNCED`, `NOT_ELIGIBLE`, `NOT_FOUND`, `TENANT_MISMATCH`, `AMBIGUOUS_LINK`, `STATE_CHANGED`, and `ERROR`. Exit code 0 means eligible dry-run, updated, or already synchronized; 2 means a safely classified non-success state; 1 means invalid arguments, connection/configuration failure, or another error.

## 12. Apply Contract

Apply requires all of: `--apply`, a valid explicit `--hotel-id`, `HOTEL_PUBLICATION_RESYNC_ALLOW_APPLY=YES`, matching `--confirm-hotel-id`, and exact `--confirm-database`. The only URI source is `HOTEL_PUBLICATION_RESYNC_MONGODB_URI`; no dotenv, application URI, database URL, or random fallback is accepted. The actual connected database name is verified before qualification. Empty/invalid targets stop; `--all`, unknown options, and contradictory modes stop.

## 13. Idempotence

The first eligible apply changes only `Property.isPublished` from not-true to true and returns `UPDATED`. Subsequent runs return `ALREADY_SYNCED` with zero writes. Mongoose timestamps are disabled for this one-field update so no secondary field is rewritten.

## 14. CAS / State Change Safety

Apply requalifies immediately before mutation. The atomic `updateOne` filter includes explicit Property ID, `isPublished != true`, the qualified tenant, the qualified `updatedAt`, and all canonical public-state predicates. A Hotel/Accommodation/Property change before the write becomes `STATE_CHANGED`; a concurrent winner becomes `ALREADY_SYNCED`. There is no blind overwrite.

## 15. Output Sanitization

The output excludes names, owner, tenant IDs/metadata, address, email, phone, descriptions, images, documents, credentials, and URI. It contains only operational IDs and publication/decision state. The structured result should be retained by the authorized operator with command timestamp and authorization reference; no `ActionLog` is forced because the CLI has no canonical authenticated User actor and an extra database write would violate the minimal-write contract.

## 16. RED

The initial Mongo test modeled a published/active Hotel and Accommodation with a validated Property whose `isPublished=false`. Before implementation, Jest failed because the repair service module did not exist (0 tests executed). This captured the missing mechanism before GREEN implementation.

## 17. GREEN

The new service/CLI suites pass 23/23: 16 Mongo service cases and 7 CLI contract cases. They cover dry-run, apply, idempotence, explicit target validation, dedicated URI, apply confirmations, stale absent boolean, already synchronized state, pending/rejected/draft Hotel, incompatible Property state, missing/ambiguous links, tenant mismatch, state changes, and concurrency.

## 18. Mongo Integration

Real MongoDB semantics were exercised using `mongodb-memory-server`, not model mocks. The relevant cluster passed 38/38 across `validatedHotelPublicationResync.mongo.integration.test.js` and `propertySearchFilters.mongo.integration.test.js`, covering `matchedCount`, `modifiedCount`, conditional update, unchanged timestamps, idempotence, state-change safety, and the canonical public filter. The repository-wide Mongo suite was not run; the complete affected-domain Mongo cluster was run.

## 19. Concurrency

Two simultaneous apply attempts yield exactly one `UPDATED`; the other safely yields `ALREADY_SYNCED` or `STATE_CHANGED`. The final boolean is true and aggregate writes equal one. No duplicate side effect or corruption occurs.

## 20. Regression Matrix

| Gate | Result |
|---|---:|
| New repair + CLI | 23/23 |
| Hotel/Property/Accommodation unit cluster | 176/176 |
| Relevant Mongo cluster | 38/38 |
| Full backend unit suite | 146 suites, 1600/1600 |
| Architecture | PASS, 483 files, 1603 edges, 0 new violations |
| Backend lint | PASS, 0 errors, 102 pre-existing warnings |
| Targeted lint | PASS, 0 errors/warnings |
| `git diff --check` | GREEN |

## 21. Production Runbook

This is a future procedure only. It was not executed in this sprint.

1. Deploy the previously certified publication hotfix and this repair tool through the normal release process.
2. Verify application/database health and identify HOTEL MILA by its trusted stable Hotel `_id`; do not select by name.
3. With a dedicated read-only credential, execute:

   `HOTEL_PUBLICATION_RESYNC_MONGODB_URI=<DEDICATED_READ_ONLY_URI> node server/scripts/resyncValidatedHotelPublication.js --hotel-id=<HOTEL_ID> --dry-run`

4. Have a human verify the target IDs, exact database, `ELIGIBLE`, current false/not-true, expected true, and `wouldUpdate=true`. Stop on every other result.
5. Obtain explicit production-change authorization and a legitimate, temporary write authority. Record the dry-run output, timestamp, operator, and authorization outside the database without PII.
6. Execute exactly once from the repository root:

   `HOTEL_PUBLICATION_RESYNC_MONGODB_URI=<AUTHORIZED_WRITE_URI> HOTEL_PUBLICATION_RESYNC_ALLOW_APPLY=YES node server/scripts/resyncValidatedHotelPublication.js --hotel-id=<HOTEL_ID> --confirm-hotel-id=<HOTEL_ID> --confirm-database=<EXACT_DATABASE_FROM_DRY_RUN> --apply`

7. Re-run dry-run with the read-only credential; require `ALREADY_SYNCED` and zero writes.
8. Verify the target through `/api/properties` without changing the query.
9. Verify `/immobilier/annonces`.
10. Verify the public Hotel detail.
11. Stop. Do not enumerate or repair additional Hotels without separate evidence and authorization.

## 22. Rollback Procedure

There is intentionally no automatic rollback mode. If an authorized apply is later proven erroneous, first re-characterize the same explicit Hotel, Property, and Accommodation against the canonical contract. After separate authorization, an operator may perform a targeted conditional transition of only that Property's `isPublished` from true to false, guarded by exact Property ID, tenant, and unchanged canonical state. Stop if state differs. Never use a name, broad filter, or automatic inverse operation.

## 23. Manual Production Checklist

- HOTEL MILA appears in `/api/properties` and `/immobilier/annonces`.
- Public count moves from 3 to 4 only if no other data changed; do not treat 4 as unconditional.
- Image, Hotel/type badge, price, “VOIR” link, and public detail are correct.
- The prior three public Properties remain visible.
- No draft, pending, rejected, inactive, unavailable, or internal-only record became public.
- The post-apply dry-run says `ALREADY_SYNCED`; retain sanitized before/after results and timestamps.

## 24. Security / Secrets

No credential, URI, token, password, production identifier, or HOTEL MILA name was embedded in executable logic. The dedicated URI is supplied only at runtime and is never printed. No production read, write, or apply occurred. No new endpoint or dependency was added.

## 25. Architecture

Canonical gate: PASS. It analyzed 483 files and 1603 internal static edges, with zero new violations, zero unresolved imports, and zero known cycles. The established service/script directories were reused.

## 26. Lint

Backend ESLint: PASS with 0 errors and 102 existing repository warnings. Targeted lint over the new service, CLI, and both test files: PASS with 0 errors and 0 warnings. Existing warnings were not broadened into this focused sprint.

## 27. Diff Check

`git diff --check`: GREEN. The dirty worktree and unrelated user changes were preserved.

## 28. Mandatory Answers

1. Branch? `main`.
2. HEAD? `49f12d787b1011d16f9682cedefb81b377823e4d`.
3. Worktree initial? Dirty, preserved.
4. Preexisting changes? Yes; documented in Git Baseline and not overwritten.
5. Previous report read? Yes, fully.
6. Previous root cause unchanged? Yes.
7. Hotel model path? `server/models/Hotel.js`.
8. Property model path? `server/models/Property.js`.
9. Accommodation model path? `server/models/Accommodation.js`.
10. Exact Hotel→Property relation? `Hotel.property`; Accommodation must point to both same Hotel and Property.
11. Exact publishable Hotel state? `publicationStatus=publie`, `status=actif`, and `active !== false`, plus coherent linked entities.
12. Exact public Property condition? Canonical compatible Property state plus `isPublished=true` in the public query.
13. Current sync gap historical only? Yes; future validation/rejection flow is already fixed.
14. Existing records automatically fixed by code change? NO.
15. Existing data repair required? Yes for a proven stale historical target; production dry-run must confirm.
16. Broad migration required? NO.
17. Targeted repair suitable? Yes.
18. Search by hotel name used for mutation? NO.
19. Stable ID required? Yes, explicit Hotel ObjectId.
20. Eligibility predicate defined? Yes.
21. Tenant match required? Yes, strict and non-null across Hotel/Property/Accommodation.
22. Property linkage verified? Yes.
23. `statusAdmin` verified? Yes, `Validée`.
24. `publicationStatus` verified? Yes on Hotel and Accommodation.
25. Internal/private state verified? Yes, `internalManagedOnly=true` is rejected.
26. Dry-run supported? Yes.
27. Apply explicit? Yes.
28. Default mode dry-run? Yes.
29. Empty target causes global repair? NO; it errors.
30. Idempotent? Yes.
31. CAS/conditional write? Yes.
32. Already-synced result? `ALREADY_SYNCED`.
33. Not-eligible result? `NOT_ELIGIBLE`.
34. Tenant mismatch fail closed? Yes, `TENANT_MISMATCH`.
35. Missing Property fail closed? Yes, no creation.
36. Rejected Hotel remains unpublished? Yes.
37. Pending Hotel remains unpublished? Yes.
38. Concurrent repair safe? Yes, proven on Mongo.
39. Mongo real test? Yes, relevant domain integration tests.
40. Unit tests? Yes, 7 CLI contract tests plus full unit suite.
41. Targeted Hotel tests? Yes.
42. Cluster tests? Yes, 176/176 unit and 38/38 relevant Mongo.
43. Full backend tests? Yes, 1600/1600.
44. Mongo suite? Relevant complete domain cluster 38/38; repository-wide Mongo suite not run.
45. Model changed? NO.
46. Frontend changed? NO by this sprint.
47. Mobile changed? NO.
48. Public query changed? NO.
49. New dependency? NO.
50. Migration framework added? NO.
51. Production read executed? NO.
52. Production write executed? NO.
53. Production repair executed? NO.
54. Credential embedded? NO.
55. Runbook prepared? Yes.
56. Rollback documented? Yes, logical targeted rollback only.
57. Manual post-apply validation prepared? Yes.
58. Architecture? PASS, 0 new violations.
59. Lint? PASS, 0 errors; new files clean.
60. Diff-check? GREEN.
61. Secret scan? PASS.
62. P0? 0.
63. P1? 1 operational item: known historical visibility remains unresolved until authorized post-deploy qualification/apply.
64. P2? 0.
65. Ready for post-deploy resync? Yes, controlled explicit-ID operation only.
66. Next operational step? Deploy through normal authorization, verify health, then execute read-only dry-run for the trusted HOTEL MILA Hotel ID.
67. Commit? NO.
68. Push? NO.
69. Deploy? NO.
70. Final verdict? A — TARGETED HOTEL RE-SYNC TOOL CERTIFIED — READY FOR POST-DEPLOY CONTROLLED APPLY.

## 29. Final Verdict

**A — TARGETED HOTEL RE-SYNC TOOL CERTIFIED — READY FOR POST-DEPLOY CONTROLLED APPLY.**

Eligibility, tenant isolation, minimal CAS mutation, idempotence, concurrency behavior, output sanitation, and operational guards are proven. The sprint stops here: no production access, repair, commit, push, or deployment was performed.
