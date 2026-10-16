# Lot C Contact Authorization and Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repository policy forbids commits for this engagement.

**Goal:** Prevent all unmediated client-to-owner commercial messaging while preserving staff inboxes, authorized direct contact, hotel operational communication, and read access to legacy conversations.

**Architecture:** Add a canonical `ContactAuthorization` aggregate and a single messaging policy service evaluated immediately before every write. Conversation serializers expose server-derived write state; legacy direct conversations without proof remain readable but read-only.

**Tech Stack:** Express, Mongoose, Socket.IO, Jest, Supertest, MongoDB integration harness, Next.js, React Native.

**Spec:** `docs/superpowers/specs/2026-10-10-altimmo-commercial-intermediation-hardening-design.md`

## Global Constraints

- Preserve all pre-existing `MARKETING-CONSENT-1` changes.
- Use active `PlatformOperator` plus `platform.commercial.manage`; never infer platform authority from role, tenant name, email, or missing tenant.
- `PLATFORM`, `TENANT`, and `UNRESOLVED` retain their existing meanings; ambiguous authority fails closed.
- No production migration, real notification delivery, commit, push, deployment, EAS build, or AAB.
- All new behavior follows RED → GREEN → regression verification.

## Review Focus

- Authorization revoked between initial request parsing and persistence must block the message.
- Exact party/property/dossier/tenant matching must reject near matches and reversed roles.
- `receiverId` and every legacy conversation-creation route must use the same policy.
- Historical conversations must stay readable without acquiring an invented authorization.
- Staff inbox and valid hotel-reservation communication must not be broken.

---

### Task 1: Canonical contact authorization aggregate

**Files:**
- Create: `server/models/ContactAuthorization.js`
- Create: `server/services/contactAuthorizationService.js`
- Create: `server/__tests__/contactAuthorization.mongo.integration.test.js`

**Interfaces:**
- Produces: `grantAuthorization(input)`, `revokeAuthorization(input)`, `findActiveAuthorization(input)`, `assertActiveScope(input)`, and a safe serializer.
- Consumes: `PlatformOperator`, platform authority helpers, tenant attribution, `ActionLog` conventions.

- [ ] Write failing MongoDB tests for exact client/representative/property/dossier/tenant/scope matching, active operator capability, immutable event history, revocation, repeated grant behavior, cross-tenant denial, and a revoked-at-send-time recheck.
- [ ] Run `cd server && npx jest --runInBand __tests__/contactAuthorization.mongo.integration.test.js`; confirm failures are missing model/service behavior.
- [ ] Implement the schema, closed scope/status enums, indexes, safe serializer, atomic grant/revoke transitions, and fresh-query scope assertion.
- [ ] Re-run the targeted suite and confirm all cases pass.

**Acceptance:** no active authorization can match a different party, resource, tenant, or scope; revoked documents cannot authorize writes.

### Task 2: Platform-only authorization API

**Files:**
- Create: `server/controllers/contactAuthorizationController.js`
- Create: `server/routes/contactAuthorizationRoutes.js`
- Modify: `server/server.js`
- Create: `server/__tests__/contactAuthorizationRoutes.mongo.integration.test.js`

**Interfaces:**
- Endpoints: grant, safe inspect/list, and revoke under `/api/contact-authorizations`.
- Guards: authenticated active operator with `platform.commercial.manage` for mutations; safe participant/platform reads only.

- [ ] Write failing Supertest cases for capable operator, inactive/revoked operator, platform operator without capability, tenant Admin/CommunityManager, `UNRESOLVED`, unrelated participant, and cross-tenant enumeration.
- [ ] Run the route suite and confirm expected 403/404 failures.
- [ ] Wire controllers and routes to the service without duplicating authority logic.
- [ ] Re-run route and service suites.

**Acceptance:** roles and tenant membership alone never grant commercial authorization powers.

### Task 3: Central messaging policy and server-derived write state

**Files:**
- Modify: `server/services/messagingAuthorizationService.js`
- Create: `server/services/conversationSerializer.js`
- Modify: `server/services/messageSerializer.js`
- Modify: `server/models/Conversation.js`
- Create: `server/__tests__/commercialMessagingPolicy.mongo.integration.test.js`
- Modify: `server/__tests__/messageSerializer.test.js`

**Interfaces:**
- Produces: `evaluateConversationWriteState({ actor, conversation, receiverId, propertyId, dossier, req })` and `assertConversationWritable(...)`.
- Write-state result: `{ writable, code, authorizationId, channelType }` with no private identifiers.

- [ ] Write failing tests for client/owner without authorization, active and revoked authorization, wrong property/client/tenant, staff inbox, authorized hotel reservation channel, arbitrary direct recipient, and legacy read-only metadata.
- [ ] Run focused suites and verify policy failures.
- [ ] Implement closed channel classification and fresh authorization lookup immediately before persistence.
- [ ] Add safe conversation/message projections that remove email, phone, private evidence, and storage internals.
- [ ] Re-run policy and serializer suites.

**Acceptance:** every direct commercial write has a current server-verifiable basis, while reads retain participant and tenant checks.

### Task 4: Enforce policy on REST and legacy routes

**Files:**
- Modify: `server/controllers/messageController.js`
- Modify: `server/controllers/conversationController.js`
- Modify: `server/routes/messageRoutes.js`
- Modify: `server/routes/conversationRoutes.js`
- Modify: `server/__tests__/securityClosureP0WaveMessagingSendAuthority.mongo.integration.test.js`
- Modify: `server/__tests__/conversationRoutes.test.js`
- Modify: `server/__tests__/messageReadAuthority.mongo.integration.test.js`

**Interfaces:**
- Consumes: Task 3 policy; no controller-local alternative rule.

- [ ] Add failing cases covering `POST /api/messages` with `receiverId`, send by `conversationId`, `POST /api/conversations`, `/start`, the deprecated mobile path, attachment upload, revocation race, and audit case 12.
- [ ] Confirm RED with the existing permissive behavior.
- [ ] Invoke the common policy before conversation creation/upload and immediately before message persistence; avoid orphaned private uploads on denial.
- [ ] Return stable read-only/error codes and safe payloads.
- [ ] Run all listed messaging suites.

**Acceptance:** a recipient ID alone can never create or write a commercial relationship.

### Task 5: Socket.IO, notifications, web, and mobile read-only behavior

**Files:**
- Modify: `server/socket.js`
- Modify: `server/services/notificationService.js` only if payload shaping requires it
- Modify: `server/__tests__/socketAuthorization.test.js`
- Modify: `client/lib/services/conversationService.js`
- Modify: `client/lib/services/messageService.js`
- Modify: `client/lib/pages/MessagesPage.jsx`
- Modify: `client/lib/components/messaging/MessageInput.jsx`
- Modify: `altimmo-app/src/services/conversationService.js` and actual chat screen files located during execution
- Add focused web/mobile component tests beside existing messaging tests.

**Interfaces:**
- Consumes: API `writeState`; clients never decide authority locally.

- [ ] Add failing tests for unauthorized room/typing access, safe socket payloads, disabled composer with reason, and staff/hotel operational exceptions.
- [ ] Run server, web, and mobile focused tests to confirm RED.
- [ ] Enforce participant/tenant checks for realtime events and render the server write state without exposing role-based bypasses.
- [ ] Re-run all focused tests plus `conversationStaffInboxTenant` and message attachment tests.

**Lot exit condition:** Tasks 1–5 pass; legacy bypass tests are green; no private email/phone appears in representative message/conversation responses; staff inbox regression suite passes. Record exact counts before starting Lot B.

