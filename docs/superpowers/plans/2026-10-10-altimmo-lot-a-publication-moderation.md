# Lot A Centralized Publication Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. No commits are permitted.

**Goal:** Make publication decisions platform-commercial-only and preserve the last approved public version during substantive revision review.

**Architecture:** Introduce a shared moderation/revision service used by property, hotel, and accommodation flows. Public queries consume approved snapshots; ownership and tenant attribution never change.

**Tech Stack:** Express, Mongoose, Jest/Supertest, Next.js, React Native.

**Spec:** `docs/superpowers/specs/2026-10-10-altimmo-commercial-intermediation-hardening-design.md`

## Global Constraints

- Approval requires a freshly verified active `PlatformOperator` with `platform.commercial.manage`.
- Tenant roles may edit legitimate drafts but never approve/publicize.
- `tenant: null` listings are moderated without reassignment.
- Public images, price, description, characteristics, and commercial availability come only from approved data.

## Review Focus

- Tenant Admin self-approval and direct controller calls must fail.
- Pending unaffiliated properties must be visible to capable platform moderators.
- Rejected/stale revisions must not alter the public snapshot.
- Concurrent moderation decisions must have one winner.
- Every public/search/recommendation/detail path must use approved values.

---

### Task 1: Shared publication revision contract

**Files:**
- Create: `server/models/CommercialPublicationRevision.js`
- Create: `server/services/commercialPublicationService.js`
- Create: `server/__tests__/commercialPublicationService.mongo.integration.test.js`

- [ ] Write failing tests for the closed substantive-field set, pending revision creation, approved snapshot preservation, rejection, atomic promotion, stale version conflict, and unchanged resource tenant/owner.
- [ ] Confirm RED.
- [ ] Implement revision schema, resource-type adapter boundary, optimistic version/compare-and-set decisions, and ActionLog-compatible history.
- [ ] Re-run the suite.

### Task 2: Property creation, editing, moderation, and public reads

**Files:**
- Modify: `server/models/Property.js`
- Modify: `server/controllers/propertyController.js`
- Modify: `server/controllers/propertyMobileController.js`
- Modify: `server/routes/propertyRoutes.js`
- Modify: `server/routes/adminPropertyRoutes.js`
- Modify: `server/services/propertyPublicationInputService.js`
- Modify: `server/services/propertyFilterService.js`
- Modify: `server/services/publicApi/publicPropertyService.js`
- Update property moderation/public visibility tests, including `P-PROPERTY-14` and `P-PROPERTY-15` owners.

- [ ] Add failing integration tests for unaffiliated owner, customer tenant, tenant Admin/Collaborateur, capable/uncapable operator, rejection, approved publication, substantive edit, concurrent decision, and public snapshot across list/detail/recommended/public API.
- [ ] Confirm the old self-approval and live-edit behavior fails the new assertions.
- [ ] Route all moderation through the shared service and make public serializers snapshot-aware.
- [ ] Run property authority, provenance, publication, search, registry, mobile, and public API suites.

### Task 3: Hotel and accommodation publication adapters

**Files:**
- Modify: `server/models/Hotel.js`
- Modify: `server/models/Accommodation.js`
- Modify: `server/controllers/hotelController.js`
- Modify: `server/controllers/accommodationController.js`
- Modify: `server/routes/hotelRoutes.js`
- Modify: `server/routes/accommodationRoutes.js`
- Modify: `server/services/hotelRepublishModerationService.js`
- Modify public hotel/accommodation services and publication payload serializers.

- [ ] Write failing tests for tenant self-approval denial, capable platform decision, pending substantive revision, approved snapshot public reads, stale decisions, and unchanged hotel/accommodation ownership.
- [ ] Implement adapters to the shared moderation service without touching reservation or finance state.
- [ ] Run hotel/accommodation moderation and public visibility suites.

### Task 4: Moderation interfaces

**Files:**
- Modify: `client/lib/pages/dashboard/PropertyModerationPage.jsx`
- Modify: `client/lib/pages/dashboard/HotelModerationPage.jsx`
- Modify: `client/lib/pages/dashboard/AccommodationModerationPage.jsx`
- Modify associated services and mobile owner-edit screens.
- Add focused UI tests.

- [ ] Write failing tests for platform-capability visibility, revision comparison, stale conflict handling, and tenant users seeing pending state without moderation controls.
- [ ] Implement UI from server authority/status responses.
- [ ] Run focused frontend/mobile tests.

**Lot exit condition:** all public surfaces show approved values only; cross-tenant and concurrency tests pass; no resource attribution changed.

