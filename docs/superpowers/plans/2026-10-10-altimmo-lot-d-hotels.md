# Lot D Hotels and Accommodations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. No commits are permitted.

**Goal:** Confirm platform-only publication while preserving direct booking, valid operational communication, staff operations, and certified finance workflows.

**Architecture:** Consume Lot A moderation and Lot C communication policy. Hotel operational messaging is a closed reservation/stay channel with participant checks; it never creates general commercial authority.

**Tech Stack:** Express, Mongoose, Socket.IO, Jest/Supertest, Next.js, React Native.

**Spec:** `docs/superpowers/specs/2026-10-10-altimmo-commercial-intermediation-hardening-design.md`

## Global Constraints

- Lots C and A must be green first.
- Do not require Altitude Vision approval per reservation or daily operation.
- Do not weaken financial, payment, refund, invoice, check-in, or checkout controls.
- Operational communication requires a valid reservation/stay and verified participant/staff assignment.

## Review Focus

- Establishments cannot self-publish or publish substantive revisions.
- Public reservations remain available immediately under existing rules.
- Reservation cancellation/revocation terminates operational messaging where appropriate.
- Hotel staff cannot use an operational room as a general prospecting channel.
- Financial and concurrency suites remain unchanged and green.

---

### Task 1: Publication/operations boundary tests

**Files:**
- Extend hotel/accommodation moderation tests from Lot A.
- Create: `server/__tests__/hotelCommercialOperationalBoundary.mongo.integration.test.js`

- [ ] Write failing/contract tests covering initial approval, substantive revision, room/rate/availability operations after approval, direct reservation, cancellation, check-in/out, and unaffiliated/tenant establishment ownership.
- [ ] Run the focused suite; distinguish missing hardening from already-correct operational behavior.
- [ ] Make only the minimal controller/service changes needed to align publication paths, never finance paths.
- [ ] Re-run the boundary suite.

### Task 2: Reservation-scoped operational messaging

**Files:**
- Extend: `server/services/messagingAuthorizationService.js`
- Modify reservation/message adapters or controllers identified by exact call graph during execution.
- Create: `server/__tests__/hotelOperationalMessaging.mongo.integration.test.js`
- Extend: `server/__tests__/socketAuthorization.test.js`

- [ ] Write failing cases for guest and assigned hotel staff on a valid reservation, unrelated guest/staff, other tenant, cancelled/expired reservation, concluded-stay policy, and attempted general marketing conversation.
- [ ] Implement exact reservation/stay and participant verification with a fresh state read before send.
- [ ] Re-run messaging, hotel access, and reservation scope suites.

### Task 3: Operational and financial non-regression

**Files:**
- No production finance changes unless a new test proves this work caused a regression.
- Existing hotel/accommodation reservation, finance, invoice, refund, inventory, and concurrency suites.

- [ ] Run targeted reservation, payment guarantee, billing, refund, check-in/out, overbooking, and staff-assignment suites.
- [ ] If a regression appears, reproduce it with a focused failing test before changing code.
- [ ] Record exact pass/fail counts and any environment-limited suites.

### Task 4: Web/mobile hotel communication state

**Files:**
- Modify relevant reservation detail/chat pages discovered during execution.
- Modify `client/lib/pages/MesReservationsHotelPage.jsx` and mobile equivalents only where the operational channel is surfaced.
- Add focused UI tests.

- [ ] Test that only eligible reservation participants see an operational composer and that cancellation/read-only state is rendered from the server.
- [ ] Implement without exposing general contact coordinates.
- [ ] Run focused web/mobile tests.

**Lot exit condition:** publication is platform-controlled; direct booking and daily operations pass; operational messaging is reservation-scoped; financial suites show no introduced regression.

