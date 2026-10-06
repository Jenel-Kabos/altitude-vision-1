# PA_04C2_GLOBAL_DOMAIN_MAP

## A. Failure table

| ID | Severity | Domain | Root cause | Primary files | Batch |
|---|---|---|---|---|---|
| F1 | P1 | Hotel authority | TENANT branch accepts a selected PlatformOperator without the exact Hotel capability | `hotelController.js`, `hotelRoutes.js` | A |
| F3 | P1 | Hotel authority | `User.role` classifies Hotel administrators instead of active `OrgMembership.businessRole` | `hotelController.js`, `hotelAccessScopeService.js`, reservation surfaces | A |
| F6 | P2 | Resource concealment | direct cross-tenant Hotel assertion returns 403 after revealing existence | `administrationScopeService.js`, `hotelController.js` | A |
| F7 | P3 | Platform authority debt | unused `requireGlobalAdmin` still encodes `User.role=Admin` as global authority | `platformAuthority.js`, stale route comment | A |
| F4 | P1 | Hotel attribution | `fromHotel` and operational access infer organisation from manager/property/createdBy for `tenant:null` | attribution/access/reservation/finance services | B |
| C2-01 | P1 | Accommodation attribution | owner creation copies request tenant instead of `Property.tenant` | `accommodationController.js` | C |
| C2-02 | P1 | Mobile accommodation | non-Hotel mobile flow can persist divergent Property/Accommodation tenants | `mobileAccommodationPublicationService.js` | C |
| C2-03 | P1 | Hotel linking | existing Hotel can be linked without direct tenant equality | `accommodationService.js` | C |
| C2-04 | P2 | Online invariant | no service boundary rejects divergent linked-resource provenance | domain services | C |
| C2-05 | P1 | Organisation transition | approval creates tenant/membership without patrimony preflight | `tenantApplicationService.js` | D — gated |
| C2-06 | P2 | Client authority UX | Web tenant actions derive from `User.role`; CommunityManager is over-shown | dashboard Hotel/Accommodation pages | E |
| C2-07 | P2 | Mobile debt | mobile operator lookup is still gated by `User.role=Admin` | mobile runtime | deferred; no platform UI |

## B. Dependency graph

```text
Batch A — canonical Hotel authority (F1/F3/F6/F7)
  ↓
Batch B — direct Hotel.tenant attribution (F4)
  ↓
Batch C — prevent linked-resource divergence + read-only discovery
  ↓
Batch D — professional asset selection + transactional transition
  ↑ HUMAN DECISION REQUIRED before writes

Batch E — Web/Mobile compatibility follows A-C and does not grant authority.
```

## C. Data ownership matrix

| Resource | Authoritative tenant | Owner/self-service | Derived links | Migration relevance | Historical rule |
|---|---|---|---|---|---|
| Property | `Property.tenant` | `Property.owner` | Accommodation/Hotel anchor | transition root | sold/archived not rewritten |
| Accommodation | `Accommodation.tenant`, required to equal Property | `createdBy` provenance only | Property, optional Hotel | follows Property | completed reservations immutable |
| Hotel | `Hotel.tenant` | manager/assignment, Hotel-only | Property/Accommodation | must be explicit/non-null when operational | null legacy is discovery/manual resolution |
| OrgMembership | tenant through root OrgUnit | `roleInUnit=owner`, `businessRole=Admin` for founder | User ↔ organisation | authority, not asset provenance | never synthesized for operators |
| Reservations | persisted tenant snapshot | guest/creator | Hotel/Accommodation | active ambiguity blocks transition | completed/cancelled immutable |
| Financial records | persisted tenant snapshot | none | reservation/resource | never bulk-migrated | immutable issued history |

## D. Client impact

- Backend remains the only authority.
- Web must consume `tenantBusinessRole`, not `User.role`, for tenant Hotel actions.
- `platformScoped:true` and stale-response protection are already correct.
- `/mes-hotels` needs an actionable organisation-required error after backend prevention.
- Mobile self-service/onboarding remains tenant-scoped; no PLATFORM UI is introduced.

## E. Execution plan

1. Batch A: RED role/capability/404/dead-guard tests; canonical Hotel authority; certify.
2. Batch B: RED strict `Hotel.tenant` tests; remove administrative inference while preserving exact manager/assignment self-service; certify reservations/finance.
3. Batch C: RED linked-provenance tests; prevent new divergence; add bounded read-only discovery; certify.
4. Batch E: align Web authority UX and organisation-required handling; mobile compatibility tests; certify.
5. Batch D is not executable until the product defines how a founder marks `tenant:null` assets as personal versus professional. No production migration or write discovery is authorised.

## Failure cache

- Baseline: `hotfixUsersCount1` expects legacy Admin authority and conflicts with PA-01/PA-02.
- Environment: loopback listeners may require sandbox escalation; ordinary full unit can OOM without 8192 MB.
- Full Mongo is sharded/multi-hour; use exact, batch, then milestone gates.
