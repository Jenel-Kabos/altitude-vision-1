# Altitude Vision — Testing Strategy & Domain Certification

Three levels. Match the level to the work — do not run a release-gate for a
single-file bug fix.

---

## LEVEL 1 — Feature tests (development)

Fast feedback while writing code. Run only what covers the file(s) being
changed.

```bash
# Server: one file
cd server && npx jest <fileNameFragment>

# Client: one file
cd client && npx vitest <fileNameFragment>
```

**When**: during implementation, TDD, quick debugging.
**Duration**: seconds to a minute.

---

## LEVEL 2 — Domain certification

Run when a feature is complete. Covers feature tests + adjacent-domain
regression + architecture. Curated per business domain.

```bash
npm run certify:tenant         # OrgMembership, tenant authority, promotion
npm run certify:contracts      # Contrat polymorphic + typed + lifecycles
npm run certify:rental         # Rental lease/payments/tenant module gate
npm run certify:sales          # Sale contract lifecycle + Transaction seam
npm run certify:financial      # Finalization, ledger, documents, payments
npm run certify:architecture   # Structural boundaries + boundary test
npm run certify:frontend       # Client Vitest suite
```

Each command runs a Jest pattern set defined in `scripts/certify.js`. The
runner is `--runInBand` (deterministic against the shared Mongo harness).

**When**: before opening a PR; after implementing a vertical feature; after
touching an invariant domain.
**Duration**: a few minutes to ~15 minutes per bundle. Run one bundle,
not all of them; certify the domain you actually changed, plus
`certify:architecture` if you touched service/controller/route wiring.

**Pass criteria**: all suites GREEN. Classify any failure using
[`FAILURE_CLASSIFICATION.md`](./FAILURE_CLASSIFICATION.md) before deciding to
block; do not paper over a suite that broke because your change made it
break.

---

## LEVEL 3 — Release gate

Expensive repository-wide certification. Composes existing
`local-ci.js` (`npm run release-check`) which runs server unit + server
Mongo (~1–2 h) + client build/tests + mobile checks.

```bash
npm run certify:release        # alias for release-check
```

**When**: before deploying; after a major architecture change; when a
domain certification revealed a systemic risk that could hide beyond the
curated pattern set. Never on every feature.

**Known non-blocking harness debt**: see
[`certification-baseline.json`](./certification-baseline.json). Failure of
this exact suite/test with this exact signature does not block release, but
must still be reported visibly and re-run in isolation.

---

## Isolation and reproducibility

- Server Mongo tests share a `mongodb-memory-server` replica set managed by
  `scripts/run-mongo-tests.js`. Run one suite alone with
  `cd server && npx jest <fragment> --runInBand --forceExit`.
- A test that only fails inside the shared harness and passes twice in
  isolation is an ORDER_DEPENDENT_HARNESS_TIMEOUT (see classification).

## Do not

- Do not run `npm run test:mongo` (server full) automatically after every
  feature. Use domain certification.
- Do not delete or muzzle a failing test to make certification green.
- Do not classify a failure as "harness debt" without evidence
  (isolated repro + comparison to the recorded baseline).
