const { parseArgs } = require('../scripts/migrateLegacyHotelManagersToAssignments');

describe('migrateLegacyHotelManagersToAssignments — parseArgs', () => {
  test('aucune option → dry-run par défaut', () => {
    expect(parseArgs([])).toEqual({ apply: false });
  });
  test('--dry-run explicite reste dry-run', () => {
    expect(parseArgs(['--dry-run'])).toEqual({ apply: false });
  });
  test('--apply active le mode apply', () => {
    expect(parseArgs(['--apply'])).toEqual({ apply: true });
  });
  test('rejette une option inconnue', () => {
    expect(() => parseArgs(['--force'])).toThrow(/Option\(s\) inconnue\(s\)/);
  });
  test('rejette une option inconnue même combinée à une option valide', () => {
    expect(() => parseArgs(['--apply', '--yolo'])).toThrow(/--yolo/);
  });
});
