// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1H.3D.1 — APPLY-CONN-01..07.

const { spawnSync } = require('child_process');
const path = require('path');
const {
  parseArgs,
  validateArgs,
  resolveApplyConnection,
  computeDryRunHash,
} = require('../scripts/backfillTenantMembershipsApply');

const READONLY_URI = 'mongodb://readonly:readonly-secret@readonly.example.test/altitudevision';
const LIVE_URI = 'mongodb://writer:writer-secret@writer.example.test/application';

describe('APPLY connection separation', () => {
  test('APPLY-CONN-01: no flags selects MONGO_URI_READONLY even when MONGO_URI is set', () => {
    const connection = resolveApplyConnection(parseArgs([]), {
      MONGO_URI_READONLY: READONLY_URI,
      MONGO_URI: LIVE_URI,
    });

    expect(connection.uri).toBe(READONLY_URI);
    expect(connection.variable).toBe('MONGO_URI_READONLY');
    expect(connection.writeEnabled).toBe(false);
  });

  test('APPLY-CONN-02: no-write mode refuses MONGO_URI as a fallback', () => {
    expect(() => resolveApplyConnection(parseArgs([]), { MONGO_URI: LIVE_URI }))
      .toThrow('READONLY_URI_REQUIRED');

    const scriptPath = path.resolve(__dirname, '../scripts/backfillTenantMembershipsApply.js');
    const res = spawnSync(process.execPath, [scriptPath], {
      env: { ...process.env, MONGO_URI: LIVE_URI, MONGO_URI_READONLY: '' },
    });
    const output = `${String(res.stdout)}${String(res.stderr)}`;
    expect(res.status).not.toBe(0);
    expect(output).toMatch(/READONLY_URI_REQUIRED/);
    expect(output).not.toContain('writer-secret');
    expect(output).not.toContain('writer.example.test');
  });

  test('APPLY-CONN-03: --live without --commit still requires MONGO_URI_READONLY', () => {
    expect(() => resolveApplyConnection(parseArgs(['--live']), { MONGO_URI: LIVE_URI }))
      .toThrow('READONLY_URI_REQUIRED');

    expect(resolveApplyConnection(parseArgs(['--live']), { MONGO_URI_READONLY: READONLY_URI, MONGO_URI: LIVE_URI }))
      .toMatchObject({ uri: READONLY_URI, variable: 'MONGO_URI_READONLY', writeEnabled: false });
  });

  test('APPLY-CONN-04: --commit without --live preserves MODE_REFUSED', () => {
    expect(() => validateArgs(parseArgs(['--commit']))).toThrow('MODE_REFUSED');
  });

  test('APPLY-CONN-05: --live plus --commit selects only MONGO_URI', () => {
    const connection = resolveApplyConnection(parseArgs(['--live', '--commit']), {
      MONGO_URI_READONLY: READONLY_URI,
      MONGO_URI: LIVE_URI,
    });

    expect(connection.uri).toBe(LIVE_URI);
    expect(connection.variable).toBe('MONGO_URI');
    expect(connection.writeEnabled).toBe(true);
  });

  test('APPLY-CONN-06: readonly URI targeting another database is refused', () => {
    expect(() => resolveApplyConnection(parseArgs([]), {
      MONGO_URI_READONLY: 'mongodb://readonly:secret@readonly.example.test/other',
    })).toThrow('READONLY_DATABASE_REQUIRED');
  });

  test('APPLY-CONN-07: readonly connection failures never print URI or credentials', () => {
    const scriptPath = path.resolve(__dirname, '../scripts/backfillTenantMembershipsApply.js');
    const res = spawnSync(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        MONGO_URI: LIVE_URI,
        MONGO_URI_READONLY: 'mongodb://readonly:do-not-print@readonly.example.test/wrong-database',
      },
    });
    const output = `${String(res.stdout)}${String(res.stderr)}`;

    expect(res.status).not.toBe(0);
    expect(output).toMatch(/READONLY_DATABASE_REQUIRED/);
    expect(output).not.toContain('do-not-print');
    expect(output).not.toContain('readonly.example.test');
    expect(output).not.toContain(READONLY_URI);
    expect(output).not.toContain(LIVE_URI);
  });

  test('APPLY-CONN-08: connection separation leaves the certified dryRunHash manifest unchanged', () => {
    const report = { candidates: [
      {
        membershipId: '000000000000000000000002', userId: '000000000000000000000012',
        tenantId: '6a7de24e48d42c4c87f893dc', currentBusinessRole: null,
        proposedBusinessRole: 'Collaborateur', userRole: 'Collaborateur',
        source: 'legacy_user_role_single_tenant', confidence: 'HIGH',
        classification: 'UPDATE_CANDIDATE', action: 'UPDATE',
      },
      {
        membershipId: '000000000000000000000001', userId: '000000000000000000000011',
        tenantId: '6a7de24e48d42c4c87f893dc', currentBusinessRole: 'Admin',
        proposedBusinessRole: null, userRole: 'Admin', source: null, confidence: null,
        classification: 'ALREADY_CANONICAL', action: 'SKIP',
      },
    ] };

    expect(computeDryRunHash(report))
      .toBe('8cc46d7984f8e8084160eaf55c42301b730eb3af17e6908eec89d0f99b783c5f');
  });
});
