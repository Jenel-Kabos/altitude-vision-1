# Altitude Vision — Feature Development Workflow

Fast path from idea to closed feature. Replaces the previous per-feature
"phase 1..N" certification cascades.

---

## 9-step workflow

1. **Audit relevant domain.** Read
   [`docs/architecture/DOMAIN_OWNERSHIP.md`](../architecture/DOMAIN_OWNERSHIP.md)
   and [`docs/architecture/INVARIANTS.md`](../architecture/INVARIANTS.md).
   Confirm which module owns each write your change needs.
2. **State the invariants your change must preserve.** Write them down.
   If your change would break any invariant, STOP and request an
   architecture decision (see [Stop conditions](#stop-conditions)).
3. **Implement the complete vertical.** Model → service → API → tenant
   authority → notifications → frontend → mobile → tests. Finish it end-to-end
   before moving on (see [`VERTICAL_SLICE.md`](./VERTICAL_SLICE.md)).
4. **Run feature tests (LEVEL 1).** Jest/Vitest on the changed files only.
5. **Run domain certification (LEVEL 2).** `npm run certify:<domain>` for the
   domain you changed, plus `certify:architecture` if you touched wiring.
6. **Classify failures** using
   [`docs/testing/FAILURE_CLASSIFICATION.md`](../testing/FAILURE_CLASSIFICATION.md).
   No paint-over.
7. **Close the feature.** Write a short report (see
   [Reporting standard](#reporting-standard)).
8. **Continue to the next feature.**
9. **Run the release gate (LEVEL 3) only at a release boundary.**
   `npm run certify:release` — expensive; do not run per feature.

---

## Stop conditions

Halt and ask for an architecture/business decision when:

- a destructive migration is required;
- tenant authority must change;
- financial authority must change;
- cross-tenant behavior is ambiguous;
- existing canonical domains conflict;
- a new infrastructure dependency is required;
- data migration/backfill is unavoidable;
- public API compatibility must be broken;
- production mutation is required.

Otherwise: audit → implement → test → certify without asking for approval
after every internal step.

---

## Reporting standard

Keep feature reports short. Suggested template:

```
FEATURE
STATUS

FILES CHANGED

BEHAVIOR IMPLEMENTED
- Bullet each observable change.

INVARIANTS PRESERVED
- List which invariants (by section number of INVARIANTS.md) apply.

TESTS
focused    : <n>/<n>
domain     : certify:<name>  <n>/<n>
architecture: <n>/<n>

KNOWN DEBT
- Any pre-existing issue you touched but did not fix.

SAFETY
commit: NO   push: NO   deploy: NO

VERDICT
```

Do not restate the entire project history in every report.

---

## What replaces the old "SCL-1/2/3 phase" pattern

Previously each feature ran multiple certification passes (audit, design,
implementation, certification, hardening) each generating a full report.
That was correct while the architecture was still being discovered; it is
now overhead.

New default: one feature → one report → one domain certification. Split
into phases **only** when a stop condition triggers or the vertical is too
large to finish in a single sitting.
