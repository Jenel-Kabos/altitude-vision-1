// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1H.2 · RUNBOOK-01..RUNBOOK-18.
// Statique : lit docs/1H.2-pilot-runbook.md et vérifie que la
// documentation opératoire porte toutes les protections que 1H.2 exige.

const fs = require('fs');
const path = require('path');

const RUNBOOK_PATH = path.resolve(__dirname, '../../docs/1H.2-pilot-runbook.md');

describe('RUNBOOK · Membership Backfill First Pilot (1H.2)', () => {
  let text;
  beforeAll(() => { text = fs.readFileSync(RUNBOOK_PATH, 'utf8'); });

  test('RUNBOOK-01: document exists', () => {
    expect(fs.existsSync(RUNBOOK_PATH)).toBe(true);
    expect(text.length).toBeGreaterThan(1000);
  });

  test('RUNBOOK-02: mentions --tenant', () => {
    expect(text).toMatch(/--tenant\s+<T0>/);
    expect(text).toMatch(/--tenant\b/);
  });

  test('RUNBOOK-03: mentions --limit 1 and FIRST_PILOT_MAX_WRITES = 1', () => {
    expect(text).toMatch(/--limit\s+1\b/);
    expect(text).toMatch(/FIRST_PILOT_MAX_WRITES\s*=\s*1/);
  });

  test('RUNBOOK-04: mentions --live', () => {
    expect(text).toMatch(/\B--live\b/);
  });

  test('RUNBOOK-05: mentions --commit', () => {
    expect(text).toMatch(/\B--commit\b/);
  });

  test('RUNBOOK-06: requires dry-run before apply', () => {
    expect(text).toMatch(/Read-only pre-flight/i);
    expect(text).toMatch(/backfillTenantMembershipsDryRun/);
  });

  test('RUNBOOK-07: requires human review', () => {
    expect(text).toMatch(/Explicit human sign-off/i);
    // The checklist must include every mandatory tick.
    const mandatory = [
      'tenantId correct', 'membershipId correct', 'userId correct',
      'currentBusinessRole == null', 'proposedBusinessRole correct',
      'confidence == HIGH', 'multi-tenant risk checked',
      'manifest hash captured', '--limit == 1',
      'operator explicitly approves execution',
    ];
    mandatory.forEach((m) => expect(text).toContain(m));
  });

  test('RUNBOOK-08: requires manifest hash capture', () => {
    expect(text).toMatch(/dryRunManifestHash/);
    expect(text).toMatch(/manifest hash captured/);
    expect(text).toMatch(/manifestHash/);
  });

  test('RUNBOOK-09: requires ActionLog verification after apply', () => {
    expect(text).toMatch(/ActionLog verification/i);
    expect(text).toMatch(/tenant_membership_backfill_1h1/);
    expect(text).toMatch(/manifestHash/);
    expect(text).toMatch(/operation === 'apply'/);
  });

  test('RUNBOOK-10: requires second dry-run', () => {
    expect(text).toMatch(/Second dry-run/i);
    expect(text).toMatch(/ALREADY_CANONICAL/);
  });

  test('RUNBOOK-11: requires rollback procedure', () => {
    expect(text).toMatch(/Rollback procedure/i);
    expect(text).toMatch(/CAS-inverse/i);
  });

  test('RUNBOOK-12: rollback is CAS-protected', () => {
    expect(text).toMatch(/businessRole:\s*<newBusinessRole>/);
    expect(text).toMatch(/status:\s*'active'/);
    expect(text).toMatch(/updateOne/);
  });

  test('RUNBOOK-13: rollback must not overwrite a subsequent canonical role change', () => {
    expect(text).toMatch(/rollback MUST NOT overwrite that canonical change/i);
    expect(text).toMatch(/ROLLBACK_CONFLICT/);
    expect(text).toMatch(/matchedCount === 0/);
  });

  test('RUNBOOK-14: requires User immutability verification', () => {
    expect(text).toMatch(/User\.role`?\s+unchanged/);
    expect(text).toMatch(/User\.isActive`?\s+unchanged/);
    expect(text).toMatch(/historiqueRoles`?\s+unchanged/);
  });

  test('RUNBOOK-15: requires membership count verification', () => {
    expect(text).toMatch(/countDocuments\(\{\}\)`?\s+unchanged/);
  });

  test('RUNBOOK-16: requires tenant isolation verification', () => {
    expect(text).toMatch(/tenant isolation/i);
    expect(text).toMatch(/No unrelated tenant/i);
  });

  test('RUNBOOK-17: explicitly forbids automatic 1I progression', () => {
    expect(text).toMatch(/Automatic 1I progression is explicitly forbidden/);
  });

  test('RUNBOOK-18: explicitly forbids production write during 1H.2', () => {
    expect(text).toMatch(/1H\.2 explicitly forbids production write during the phase itself/);
    expect(text).toMatch(/Production writes:\s*0/);
  });

  test('RUNBOOK-19: pre-flight exige MONGO_URI_READONLY sans fallback applicatif', () => {
    expect(text).toMatch(/MONGO_URI_READONLY.*REQUIRED FOR PREFLIGHT/i);
    expect(text).toMatch(/MONGO_URI.*FORBIDDEN FOR PREFLIGHT/i);
    expect(text).toMatch(/READONLY_URI_REQUIRED/);
    expect(text).toMatch(/READONLY_DATABASE_REQUIRED/);
    expect(text).toMatch(/no implicit fallback/i);
  });

  test('RUNBOOK-20: apply conserve un credential write explicitement séparé', () => {
    expect(text).toMatch(/live-apply credential is separate from pre-flight/i);
    expect(text).toMatch(/restricted-write `MONGO_URI`/i);
  });

  test('RUNBOOK-SANITY: no hardcoded ObjectId, tenant placeholder present', () => {
    expect(text).toMatch(/PILOT_TENANT_ID=TO_BE_SELECTED_DURING_AUTHORIZED_PREFLIGHT/);
    // A real ObjectId is 24 hex chars. The document should not contain any
    // 24-char hex string that could be a real production id.
    // (Git SHAs are longer/40 chars, so they're not caught here.)
    const matches = text.match(/\b[0-9a-f]{24}\b/g) || [];
    expect(matches).toEqual([]);
  });

  test('RUNBOOK-SANITY: no emails, no bearer tokens, no connection strings', () => {
    expect(text).not.toMatch(/mongodb(?:\+srv)?:\/\//i);
    expect(text).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+/);
    // No emails except the standard `role:'system'` marker context.
    expect(text).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  });
});
