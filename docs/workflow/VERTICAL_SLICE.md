# Altitude Vision — Vertical Slice Principle

Prefer finishing one feature end-to-end over partially implementing many
layers.

A **vertical slice** for this codebase, when relevant, includes:

| Layer | What "done" looks like |
|---|---|
| Mongoose model | Schema updated additively; indexes justified. |
| Service | Owns the write. Callable and tested. |
| API route | Typed surface (`/api/<feature>/*`) with canonical auth chain. |
| Tenant authority | Chain: `protect → requireTenantScope → requireTenantMembershipRole → assertResourceTenantOrUnattributed → controller`. |
| Notifications | Idempotent; no duplicate firings. |
| ActionLog | Append-only entry with existing module taxonomy. |
| Frontend service | `client/lib/services/<domain>Service.js` — one function per endpoint. |
| Frontend page/component | Wired to the service, no direct `axios` in components. |
| Mobile screen | If the feature has a mobile surface. |
| Tests | Feature tests (LEVEL 1) + domain certification (LEVEL 2). |

## Rules

- Finish the vertical before starting the next feature.
- If a layer must be deferred, name it explicitly in the feature report as
  KNOWN DEBT with a concrete follow-up.
- Do not add abstractions "for the next feature" — three similar lines beat
  a premature helper.
- Do not add feature flags or backwards-compat shims when the code can just
  change.

## Anti-patterns

- "Wire the model now, we'll do the service later" — creates orphan data
  and unclear ownership.
- "Ship the API, the UI can come next sprint" — the API contract drifts.
- Half-migrated dual read paths (old + new both live) without a
  documented migration end date.
