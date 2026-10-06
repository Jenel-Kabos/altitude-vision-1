# C2.8 Asset Projection Consistency — Design

## Objective

Keep `Property.tenant` as the sole organizational provenance of a real-estate asset while making owner, tenant, sales, rentals, accommodation, hotel, and counter projections internally consistent.

## Confirmed facts

- `/mes-biens` correctly reads direct ownership through `Property.owner`.
- The tenant property registry correctly reads organizational provenance through `Property.tenant`.
- Mila Hotel is already attributed to Mila Events.
- Bureau à louer and Parcelle à vendre are legacy `tenant:null` assets classified `ELIGIBLE_ACTIVE_ASSET`; no active workflow blocker was found.
- An independent accommodation is not a Hotel.
- Two Altitude Vision Hotel records reference missing Property anchors and must not gain a tenant or Property through inference.

## Technical design

1. Preserve `/mes-biens` owner semantics and the PA-03 Property registry query.
2. Add an acceptance fixture proving P1/P2/P3/P4 projection behavior across owner, tenant, sales, rentals, accommodation, and hotel domains.
3. Close the legacy property-portfolio Hotel scope by forwarding the canonical `tenantId` to the Hotel query. Never use owner, manager, or creator as a tenant substitute.
4. Make counters name and reuse their list population contract. The administrative Property registry count remains exhaustive; published portfolio and operational domain counters stay explicitly distinct.
5. Add read-only legacy discovery/dry-run output for eligible Mila Events assets and dangling Hotel anchors. It must refuse every write/apply/backfill flag.

## Data policy

No data mutation is part of C2.8 implementation. The two Mila Events candidates are reported only. Dangling Altitude Vision Hotels are reported as blockers requiring separate human resolution.

## Security invariants

- PLATFORM is authority, never ownership.
- TENANT scope comes from direct resource tenant fields.
- UNRESOLVED remains denied.
- `tenant:null` remains valid for independent assets and never enters a tenant projection.
- `createdBy`, `manager`, `User.role`, membership user lists, and client headers never replace direct resource tenant attribution.

## Verification

Use RED → GREEN → REFACTOR for every production change. Run focused unit/Mongo/Web tests during tasks, then one consolidated C2.8 gate. Do not run full Mongo until all C2.8 lots and local functional validation are ready.
