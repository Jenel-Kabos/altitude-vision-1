const { parseArgs } = require('../scripts/reconcile-rental-management');

describe('GL-RECON-1 — CLI de réconciliation locative', () => {
  test('le dry-run est le mode par défaut', () => {
    expect(parseArgs([])).toEqual({ apply: false, actor: undefined });
    expect(parseArgs(['--dry-run'])).toEqual({ apply: false, actor: undefined });
  });

  test('apply exige une sélection explicite et conserve l’acteur', () => {
    expect(parseArgs(['--apply', '--actor=abc'])).toEqual({ apply: true, actor: 'abc' });
  });

  test('rejette les options inconnues et les modes contradictoires', () => {
    expect(() => parseArgs(['--force'])).toThrow('RECONCILIATION_UNKNOWN_OPTION');
    expect(() => parseArgs(['--dry-run', '--apply'])).toThrow('RECONCILIATION_MODE_CONFLICT');
  });
});
