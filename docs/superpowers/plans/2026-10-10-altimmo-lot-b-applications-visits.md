# Lot B Applications, Prospects, and Visits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. No commits are permitted.

**Goal:** Expose only the minimum candidate data needed for owner decisions while independently protecting contact details and sensitive evidence.

**Architecture:** Centralize application projections and disclosure policy. Contact disclosure consumes Lot C scopes; sensitive-document access has separate need-to-know authority. Owner decisions remain intact and visits never imply direct-contact authority.

**Tech Stack:** Express, Mongoose, secure storage, Jest/Supertest, Next.js, React Native.

**Spec:** `docs/superpowers/specs/2026-10-10-altimmo-commercial-intermediation-hardening-design.md`

## Global Constraints

- Lot C interfaces must be green first.
- Preserve final owner accept/reject authority and all tenant boundaries.
- Direct-message permission never grants sensitive-document access.
- No real notifications or delivery operations.

## Review Focus

- Lists, details, notifications, exports, and sockets must share safe projections.
- Contact disclosure must require the exact active Lot C scope.
- Evidence download must require a distinct need-to-know path.
- Visit confirmation must not create authorization or reveal phone/email.
- Owner decision endpoints must remain functional and audited.

---

### Task 1: Application data classification and safe serializers

**Files:**
- Create: `server/services/realEstateApplicationPrivacyService.js`
- Modify: `server/controllers/realEstateApplicationController.js`
- Modify: `server/models/RealEstateApplication.js` only for audit metadata required by the workflow
- Create: `server/__tests__/realEstateApplicationPrivacy.mongo.integration.test.js`
- Modify: `server/__tests__/realEstateApplicationSecurity.test.js`

- [ ] Write failing tests for decision-only owner list/detail projections, hidden email/phone/address/raw income/document metadata, self-view, platform mediator view, and cross-tenant denial.
- [ ] Run the focused tests and confirm RED on current payload leakage.
- [ ] Implement `serializeDecisionView`, `serializeApplicantView`, and safe platform views in one service; replace raw/populated document responses.
- [ ] Re-run the focused suites.

**Acceptance:** owner responses contain decision facts but no direct coordinates or raw evidence by default.

### Task 2: Explicit disclosures and independent evidence authorization

**Files:**
- Create: `server/models/ApplicationDisclosureEvent.js`
- Extend: `server/services/realEstateApplicationPrivacyService.js`
- Modify: `server/routes/realEstateApplicationRoutes.js`
- Modify: `server/controllers/realEstateApplicationController.js`
- Create: `server/__tests__/realEstateApplicationDisclosure.mongo.integration.test.js`

- [ ] Write failing tests for contact disclosure with/without exact active Lot C scope, revoked scope, sensitive attachment denial despite messaging authorization, capable mediator access, tenant isolation, and disclosure audit events.
- [ ] Confirm RED.
- [ ] Add guarded contact-disclosure and evidence-download paths, field-category audit events, and revocation-time rechecks.
- [ ] Re-run disclosure, attachment, and replica workflow suites.

**Acceptance:** every protected disclosure is necessary, authorized, and traceable; messaging scope alone cannot download documents.

### Task 3: Decisions, visits, and secondary leak paths

**Files:**
- Modify: `server/controllers/visiteController.js`
- Modify: `server/services/visiteWorkflowService.js`
- Modify: `server/services/visiteAutomationService.js`
- Modify: `server/controllers/realEstateApplicationController.js`
- Modify relevant notification/export serializers discovered by call-site search
- Modify: `server/__tests__/securityClosureP1WaveRealEstateApplicationTenantAuthority.mongo.integration.test.js`
- Modify: `server/__tests__/securityClosureP1WaveVisiteTenantAuthority.mongo.integration.test.js`
- Modify: `server/__tests__/visiteWorkflowService.test.js`

- [ ] Add failing tests proving owner accept/reject remains available, decisions are audited, visit confirmation does not create `ContactAuthorization`, phone-transfer consent is not a submission prerequisite, and notifications/exports/sockets omit protected fields.
- [ ] Confirm RED, then implement minimal policy-aligned changes.
- [ ] Re-run application, visit, notification/export, and tenant-isolation suites.

### Task 4: Web and mobile projections

**Files:**
- Modify: `client/lib/services/realEstateApplicationService.js`
- Modify: `client/lib/pages/dashboard/RealEstateApplicationsPage.jsx`
- Modify: `client/lib/pages/dashboard/VisitesPage.jsx`
- Modify: `client/lib/pages/dashboard/OwnerVisitesPage.jsx`
- Modify corresponding mobile application/visit screens located during execution
- Add focused client tests.

- [ ] Write failing UI tests for masked data, authorized disclosure, protected evidence, owner decision controls, and visit/contact separation.
- [ ] Implement rendering from server projection flags only.
- [ ] Run focused web/mobile tests.

**Lot exit condition:** privacy, disclosure, decisions, visits, exports/notifications, and tenant regression suites pass with recorded counts before Lot A.

