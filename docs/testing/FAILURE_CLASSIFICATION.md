# Altitude Vision — Test Failure Classification

Every failing test must be classified before deciding whether to block.
Classify honestly — the point is not to reach green; the point is to know
what broke.

---

## BLOCKING — must fix before proceeding

- **BUSINESS_REGRESSION** — a certified business rule now behaves
  differently.
- **TENANT_SECURITY_REGRESSION** — cross-tenant access, membership bypass,
  authority escalation.
- **AUTHORITY_REGRESSION** — platform-vs-tenant boundary weakened; role gate
  misapplied.
- **FINANCIAL_REGRESSION** — commission, ledger, invoice, payment
  idempotence, finalization semantics.
- **DATA_INTEGRITY_REGRESSION** — index/unique/CAS invariant broken;
  duplicate side effects; lost writes.
- **ARCHITECTURE_REGRESSION** — service→controller, controller→controller,
  route→model boundary violation (see `server/architecture/checker.js`).
- **REAL_BUILD_FAILURE** — code no longer parses, lints (error level), or
  builds.

## NON-AUTOMATICALLY-BLOCKING — record, do not paper over

- **STALE_TEST_EXPECTATION** — the test asserts an old behavior that this
  change legitimately supersedes per an authorized invariant update. Align
  the test and cite the invariant.
- **KNOWN_TEST_HARNESS_FLAKE** — a test that fails only under specific
  harness conditions unrelated to the code change. Requires isolated
  reproduction and comparison to
  [`certification-baseline.json`](./certification-baseline.json).
- **ORDER_DEPENDENT_HARNESS_TIMEOUT** — passes in isolation, times out only
  in the shared 190-suite Mongo run. Same evidence requirement.
- **PRE_EXISTING_UNRELATED_FAILURE** — same failure exists on the last
  certified baseline before your change; touch nothing.
- **LINT_WARNING_DEBT** — style/warning-level output that predates the
  change and is unrelated.

## Classification requires evidence

Before labeling anything non-blocking:

1. Compare to the last certified baseline (`certification-baseline.json`).
2. Reproduce the failure in isolation
   (`npx jest <file> --runInBand --forceExit`) at least twice.
3. Confirm the affected domain is not in your change surface.
4. Record the classification in the PR description or feature report.

If any of the four fails, treat as BLOCKING.

## What never justifies non-blocking

- "This test is flaky" without a repro protocol.
- "This test was probably already broken" without checking the baseline.
- "The mongo harness is slow" — that is a symptom, not a classification.
- Deleting or `.skip()`-ing a failing assertion to move on.
