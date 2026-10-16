# Altimmo Commercial Intermediation Hardening — Design

## 1. Purpose

Harden Altimmo so that Altitude Vision exclusively controls platform property commercialization, publication approval, prospect qualification, and direct introductions, while owners and customer organizations retain ownership of their resources, authorized operational management, and the final decision on buyers or tenants.

This design preserves the uncommitted `MARKETING-CONSENT-1` work present at HEAD `5a54a135b61b30de9b8d298f2cdc2ae282eec330`. It does not authorize commits, pushes, deployments, production migrations, real outbound communications, EAS builds, AAB builds, or Google Play submissions.

## 2. Existing foundations and constraints

The implementation must reuse the existing multi-tenant and platform-authority architecture:

- `PLATFORM` is an explicit platform context and is never inferred from a missing tenant.
- `TENANT` is a resolved customer-organization scope.
- `UNRESOLVED` fails closed for protected operations.
- `PlatformOperator` is the canonical platform actor identity.
- Platform rights come from explicit capabilities, never from `User.role`, an email address, a mutable name, tenant membership, or `tenant: null`.
- `platform.commercial.manage` is the authority for commercial moderation, mediation, and introductions.
- `platform.marketing.manage` is the authority for commercial campaigns and marketing automation.
- `Property.tenant` and equivalent hotel/accommodation ownership fields preserve the actual resource owner. Central moderation never transfers ownership to Altitude Vision.
- Existing financial authorization and hotel accounting invariants remain unchanged.
- Existing marketing consent and deletion changes must be preserved and integrated, not replaced.

## 3. Architectural approach

### 3.1 Canonical platform authority

Altitude Vision's technical commercial identity is represented by an active `PlatformOperator` holding the exact required capability. No production tenant is automatically created or designated. No code may recognize Altitude Vision from a tenant name, slug, email domain, role, or null tenant.

The capability split is:

- `platform.commercial.manage`: approve or reject commercial publications, grant or revoke contact authorization, coordinate commercial applications and visits, and perform other non-financial platform mediation.
- `platform.marketing.manage`: create, approve, schedule, launch, or automate marketing campaigns using Altitude Vision consent.
- Existing read capabilities remain necessary for platform-wide lists where already required. A write capability must not silently imply unrelated financial or operator-management powers.

Customer-tenant staff retain tenant-scoped operational management. Their `Admin` or `CommunityManager` role alone never grants either platform capability.

### 3.2 Shared policy services

Authorization rules must be implemented in focused services and middleware, then reused by REST controllers, legacy routes, attachment access, serializers, notifications, and Socket.IO entry points. Controllers must not each invent variants of the policy.

Policies fail closed when the actor, context, resource attribution, parties, property/dossier scope, or authorization state cannot be resolved unambiguously.

## 4. Lot C — Contact authorization and messaging

### 4.1 ContactAuthorization model

Introduce one canonical `ContactAuthorization` entity rather than embedding mutable booleans independently in conversations, applications, and visits.

Required fields:

- `client`: the prospective buyer or tenant.
- `representative`: the owner or explicitly identified organization representative.
- `property`: the property when the authorization concerns a listing.
- `dossierType` and `dossier`: an optional typed reference to the application, reservation, or other supported commercial dossier.
- `tenant`: the customer organization owning the relevant resource, or `null` only for a genuinely unaffiliated resource.
- `grantedBy`: the authorized `PlatformOperator` user.
- `grantedAt`, `grantReason`.
- `status`: `active` or `revoked`.
- `revokedBy`, `revokedAt`, `revokeReason`.
- `scopes`: a closed enum describing exactly what is allowed, initially direct transactional messaging and, independently, direct contact-detail disclosure.
- `events`: immutable grant/revoke history with actor, timestamp, reason, and resulting scopes.

The entity uses compound indexes supporting exact party/resource lookups. Authorization matching is exact: swapping parties, changing the property, dossier, tenant, or requested scope invalidates the match. No wildcard authorization is inferred from incomplete legacy data.

Grant and revocation require an active platform operator with `platform.commercial.manage`. Reads are limited to the concerned parties within the safe response projection and appropriately capable platform staff. Cross-tenant discovery must return the repository's standard not-found/forbidden behavior without revealing existence.

### 4.2 Messaging decision matrix

- Client ↔ Altitude Vision staff inbox: allowed under the existing support workflow.
- Owner/organization ↔ Altitude Vision staff: allowed where current tenant/platform policies allow it.
- Client ↔ owner or customer-organization representative for a property transaction: requires an active matching authorization with the direct-messaging scope.
- Hotel guest ↔ hotel operational staff: allowed only through the established reservation/stay operational channel and only for the relevant reservation; it does not create a general commercial contact authorization.
- Any arbitrary `receiverId` without one of the allowed relationships: rejected.

`POST /api/messages`, `POST /api/conversations`, `/start`, and retained legacy creation paths all invoke the same policy. A receiver identifier alone can never establish a commercial relationship.

### 4.3 Legacy conversations

Existing direct conversations are not retroactively authorized. If no active matching authorization or other legitimate staff/operational relationship can be proven, participants may read existing messages and safe attachment metadata but cannot send new messages or upload new attachments. The API exposes an explicit read-only reason/code so web and mobile interfaces can disable composers consistently.

Revocation immediately makes the relevant direct conversation read-only. Historical messages remain readable by already authorized participants, subject to existing tenant and participant checks.

### 4.4 Privacy and realtime behavior

Message, conversation, notification, and Socket.IO payloads use safe serializers. They do not include email addresses, phone numbers, identity documents, income evidence, or raw private storage descriptors unless a separate endpoint has explicitly authorized that disclosure.

Socket.IO remains a delivery mechanism, not an alternate write authority. Message persistence occurs through the guarded server workflow. Room joins, typing events, and emitted message payloads remain participant/tenant scoped.

## 5. Lot B — Applications, prospects, and visits

### 5.1 Data classification

Application data is split into three projections:

1. Decision data: application status, eligibility summary, sanitized financial bands or conclusions, visit state, and other minimum facts required for an owner decision.
2. Direct contact data: phone, email, address, and equivalent identifiers. Hidden by default and released only with an active authorization containing the contact-disclosure scope.
3. Sensitive evidence: identity documents, payslips, bank evidence, contracts, and raw income documents. Protected independently from messaging and contact authorization, and available only through an explicit need-to-know permission/workflow.

An authorization to message never grants access to sensitive evidence.

### 5.2 Decision and disclosure workflow

Altitude Vision qualifies the application and coordinates exchanges. The owner retains the final accept/reject decision through the existing business workflow. Every decision and every protected disclosure creates a traceable event containing actor, dossier, fields/category disclosed, recipient, reason, and timestamp.

Lists, detail responses, notifications, exports, logs, and Socket.IO payloads must use the same classification rules. No secondary representation may leak hidden fields.

### 5.3 Visits

Altitude Vision remains the visit coordinator. Visit scheduling or confirmation does not grant direct messaging or release contact details. Any direct introduction requires a separate explicit `ContactAuthorization`. Existing phone-transfer consent is no longer treated as a mandatory prerequisite for submitting or confirming a visit; it is collected or applied only when a legitimate disclosure is actually requested.

## 6. Lot A — Centralized publication approval

### 6.1 Moderation authority

All commercial property, hotel, and accommodation publication decisions require an active platform operator with `platform.commercial.manage`. This applies equally to unaffiliated owners, customer organizations, tenant admins, tenant collaborators, and hotel managers.

Tenant staff and owners may create and manage drafts within their legitimate scope but cannot approve or publish them. Platform operators without the required capability cannot decide moderation.

The platform moderation queue must include both tenant-owned and `tenant: null` resources without mutating their ownership or tenant attribution.

### 6.2 Publication states and revisions

New listings enter pending review and remain absent from public search/detail responses until approved.

For an already published listing:

- Non-substantive operational edits may apply directly only when explicitly classified as safe.
- Substantive commercial edits create a pending revision containing the proposed public fields.
- The last approved snapshot remains publicly visible while the revision is reviewed.
- Approval atomically promotes the revision to the public version.
- Rejection preserves the last approved public version and records the reason.
- Concurrent decisions use versioning or an equivalent compare-and-set guard so stale reviews cannot overwrite newer revisions.

Substantive fields include price, transaction type, property type, location displayed publicly, description, core characteristics, public media, commercial availability, and other fields that materially alter the offer. The implementation must define the closed field set in one service and test it.

Public searches, recommendations, and detail endpoints read only approved public data. Owner and staff management endpoints may additionally expose pending revision metadata according to their scope.

## 7. Lot E — CRM, marketing, and Altitude Vision identity

### 7.1 Marketing boundary

Creating, approving, scheduling, launching, or automating a commercial marketing campaign requires `platform.marketing.manage` in a valid platform context. Direct API calls by tenant `Admin`, `CommunityManager`, or any other tenant member are rejected.

The rule applies to manual campaign routes, campaign services, CRM automation, scheduled execution, administrative APIs, and actions such as `crm.notification.create` when used for marketing.

### 7.2 Management CRM preserved

Customer organizations retain tenant-scoped CRM functions needed to view and manage their authorized dossiers, record operational follow-up, and perform permitted transactional communication. These functions must be separated from campaign audiences, bulk sends, marketing automation, and platform-property commercialization.

The implementation should classify CRM actions centrally as `operational` or `marketing`. Unknown or ambiguous automated send actions fail closed as marketing-restricted.

### 7.3 Consent ownership

Marketing consent belongs to Altitude Vision's platform marketing purpose. It is not transferable to a customer tenant. Audience resolution must continue excluding absent/withdrawn consent, deleted or deactivated accounts, and other exclusions introduced by `MARKETING-CONSENT-1`.

Existing local consent work must be merged carefully at overlapping files and covered by regression tests before marketing authority changes are considered complete.

## 8. Lot D — Hotels and accommodations

Initial public approval and any substantive public commercial revision require `platform.commercial.manage`, using the same platform moderation principles as properties.

After approval, authorized hotel staff retain tenant-scoped daily operations for rooms, categories, rates, availability, reservations, check-in/out, billing, cancellation, refunds, and operational notifications. Direct client reservations remain direct and do not require a new commercial approval step.

Operational guest communication is tied to a valid reservation/stay and limited to that context. It must not silently open a reusable direct commercial channel. Existing certified financial invariants are outside the modification boundary except where tests prove an authorization regression caused by this work.

## 9. API and interface behavior

New server surfaces will provide:

- Grant, inspect, list where authorized, and revoke contact authorizations.
- Explicit conversation write-state/read-only metadata.
- Platform moderation queue and decision endpoints capable of covering tenant and unaffiliated resources.
- Safe application projections and separately guarded disclosure endpoints.

Exact route names will follow existing route conventions after the implementation plan maps current controllers and avoids duplicate endpoints.

Web and mobile clients must:

- Stop creating arbitrary direct conversations from a receiver ID.
- Display mediation/authorization status and read-only conversations.
- Avoid rendering private contact fields unless the server supplied an authorized projection.
- Preserve owner accept/reject actions and direct hotel reservation flows.
- Expose moderation/authorization controls only to platform-capable interfaces; server enforcement remains authoritative.

## 10. Existing data compatibility

- Existing conversations receive no invented authorization. Their write state is evaluated dynamically and defaults to read-only when direct authority is unprovable.
- Existing approved listings remain public through their currently approved fields. The revision mechanism applies prospectively to substantive edits.
- Existing pending listings remain pending and become visible in the platform moderation queue without tenant reassignment.
- Existing tenant CRM data remains tenant-owned and operationally accessible under current legitimate scope.
- Existing consent events and fields remain authoritative; no consent is backfilled.
- Any database backfill must be optional, dry-run capable, environment guarded, and documented. No production migration is part of this task.

## 11. Testing strategy

Implementation follows test-driven development. Each behavior receives a failing test before production changes.

Targeted MongoDB integration tests cover:

- Contact authorization grant, exact matching, revocation, scope separation, audit history, and tenant isolation.
- REST and legacy-route bypass attempts.
- Existing direct conversations becoming read-only without retroactive grants.
- Staff inbox and hotel operational communication exceptions.
- Application safe projections, protected evidence, disclosures, owner decisions, visits, exports, notifications, and sockets.
- Platform-only property/hotel/accommodation moderation, unaffiliated properties, pending revisions, rejected revisions, concurrent decisions, and public visibility.
- Marketing routes and automations across `PLATFORM`, `TENANT`, and `UNRESOLVED`, including consent withdrawal and deleted accounts.
- Direct hotel booking and certified financial workflow non-regression.

Unit/contract tests cover serializers, policy matrices, substantive-field classification, route wiring, and client UI states.

After every lot, run its focused tests plus affected neighboring suites. Final certification attempts the repository's existing tenant, architecture, frontend, unit, and MongoDB suites as resources allow. The report must name every unexecuted or failing suite; it must not call certification complete when coverage is incomplete.

## 12. Execution decomposition

The work is divided into independently reviewable plans because the overall request spans several subsystems:

1. Lot C: canonical contact authorization and messaging enforcement.
2. Lot B: application privacy, disclosure, decisions, and visits.
3. Lot A: centralized moderation and approved revisions.
4. Lot E: platform marketing authority and CRM separation.
5. Lot D: hotel/accommodation publication versus operations.
6. Lot F: cross-system certification, client compatibility, Google Play analysis, and final report.

Dependencies justify this order: Lot B consumes Lot C's disclosure authorization; Lot A establishes publication authority used by Lot D; Lot E must integrate the existing consent work; Lot F validates all preceding contracts.

## 13. Google Play and release impact

No AAB is built. The future Android release must use `versionCode >= 5` because versionCode 4 predates `MARKETING-CONSENT-1`, the client email-registration correction, and the messaging/privacy changes in this design.

Before that future build, verify mobile API compatibility, disabled/read-only composer states, contact-field rendering, consent screens, privacy policy wording, and Data Safety declarations. Data Safety documentation should describe mediated contact, protected application documents, marketing consent and withdrawal, account deletion, and operational hotel messaging. The final report distinguishes code/document readiness from an actually built or submitted artifact.

## 14. Completion and reporting

The final artifact is named `ALTIMMO_COMMERCIAL_INTERMEDIATION_HARDENING_REPORT` and contains the required initial/final Git state, preserved-work inventory, before/after matrix, per-lot changes, files, models/endpoints, authority evolution, compatibility, exact test evidence, unexecuted tests, residual risks, pending decisions, web/mobile impact, Google Play impact, new-AAB requirement, and confirmation of no delivery operation.

The final verdict uses only evidence from executed tests:

- Business vision: `OUI`, `PARTIEL`, or `NON`.
- Intermediation security, tenant isolation, exclusive commercial CRM, and direct reservations: `PASS` or `FAIL`.
- Ready for controlled delivery: `OUI` only if the required implementation is complete and material certification gaps are absent; otherwise `NON`.

