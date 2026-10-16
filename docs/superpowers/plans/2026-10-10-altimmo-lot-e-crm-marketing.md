# Lot E CRM and Marketing Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. No commits are permitted.

**Goal:** Reserve platform commercial marketing to `platform.marketing.manage` while preserving tenant-scoped operational CRM and all `MARKETING-CONSENT-1` protections.

**Architecture:** Add a server-side CRM action classifier and enforce platform marketing authority at routes, services, automations, schedulers, and indirect notification actions. Operational CRM remains under existing tenant capabilities.

**Tech Stack:** Express, Mongoose, Jest/Supertest, Next.js.

**Spec:** `docs/superpowers/specs/2026-10-10-altimmo-commercial-intermediation-hardening-design.md`

## Global Constraints

- Preserve every existing modified/untracked consent file and its semantics.
- Marketing consent belongs to Altitude Vision and is never reusable by tenants.
- Missing, withdrawn, deleted, or deactivated recipients stay excluded.
- Unknown automation actions that communicate externally fail closed as marketing.

## Review Focus

- Direct API calls by tenant Admin/CommunityManager must fail.
- `crm.notification.create` and scheduled jobs must not bypass marketing authority.
- Operator status/capability is checked at execution, not just campaign creation.
- Operational notes, opportunities, and dossier follow-up remain available to tenants.
- Existing consent withdrawal and deletion exclusions remain green.

---

### Task 1: Marketing route and service authority

**Files:**
- Modify: `server/routes/marketingRoutes.js`
- Modify: `server/controllers/marketingController.js`
- Modify: `server/services/marketingCampaignService.js`
- Modify: `server/services/marketingTemplateService.js`
- Create: `server/__tests__/marketingPlatformAuthority.mongo.integration.test.js`

- [ ] Write failing tests for capable active operator, incapable/inactive operator, tenant Admin, tenant CommunityManager, `TENANT`, `PLATFORM`, `UNRESOLVED`, and capability revocation before send.
- [ ] Confirm RED against membership-role guards.
- [ ] Replace tenant-role marketing mutations with platform capability enforcement at both route and service boundaries.
- [ ] Run authority, campaign, and consent suites.

### Task 2: CRM operational/marketing classification and automation

**Files:**
- Create: `server/services/crmActionPolicy.js`
- Modify: `server/routes/crmAutomationRoutes.js`
- Modify: `server/services/crmAutomationActions.js`
- Modify: `server/services/crmAutomationEngine.js`
- Modify: `server/controllers/crmAutomationController.js`
- Modify: `server/__tests__/crmAutomation.mongo.integration.test.js`

- [ ] Write failing tests for operational CRM actions retained in tenant scope, marketing sends denied, `crm.notification.create` classified by purpose, unknown outbound actions denied, simulation safety, scheduled execution, and execution-time capability revocation.
- [ ] Implement a closed action classification and service-level authority checks; simulations perform no delivery.
- [ ] Run CRM automation, CRM boundary, and tenant-isolation suites.

### Task 3: Consent integration and indirect recipients

**Files:**
- Preserve/modify only as required: `server/services/marketingConsentService.js`, `server/services/crmService.js`, `server/services/marketingSegmentService.js`, `server/services/accountSelfDeletionService.js`
- Extend: `server/__tests__/marketingConsent.mongo.integration.test.js`
- Extend campaign/automation suites.

- [ ] Add failing cases for absent/withdrawn consent, deleted/deactivated account, tenant attempting to consume platform consent, manual versus automated campaign parity, and no retroactive consent.
- [ ] Implement minimal integration while preserving existing local work.
- [ ] Run all consent/deletion/marketing suites and inspect the diff for accidental overwrite.

### Task 4: Web marketing controls and tenant CRM preservation

**Files:**
- Modify: `client/lib/pages/dashboard/MarketingDashboardPage.jsx`
- Modify: `client/lib/services/marketingService.js`
- Modify: `client/lib/services/crmAutomationService.js`
- Modify CRM dashboard components only where authority messaging is needed.
- Extend existing web tests.

- [ ] Add failing UI tests for platform-capable controls, tenant denial, operational CRM availability, and consent exclusions.
- [ ] Implement capability-aware presentation backed by server denial.
- [ ] Run focused tests and `certify:frontend` later in Lot F.

**Lot exit condition:** all campaign/automation mutations are platform-only, tenant CRM management remains green, and the full consent suite passes.

