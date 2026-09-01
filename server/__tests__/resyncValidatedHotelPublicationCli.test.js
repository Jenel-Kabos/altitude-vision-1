const mongoose = require('mongoose');
const { parseArgs, validateExecution, URI_ENV, APPLY_ENV } = require('../scripts/resyncValidatedHotelPublication');

const HOTEL_ID = new mongoose.Types.ObjectId().toString();

describe('resyncValidatedHotelPublication CLI', () => {
  test('ID explicite requis; aucune cible vide ne devient un batch', () => {
    expect(() => parseArgs([])).toThrow('VALID_HOTEL_ID_REQUIRED');
    expect(() => parseArgs(['--hotel-id=invalid'])).toThrow('VALID_HOTEL_ID_REQUIRED');
  });

  test('dry-run est le défaut et --apply est explicite', () => {
    expect(parseArgs([`--hotel-id=${HOTEL_ID}`])).toEqual(expect.objectContaining({ hotelId: HOTEL_ID, apply: false }));
    expect(parseArgs([`--hotel-id=${HOTEL_ID}`, '--apply'])).toEqual(expect.objectContaining({ hotelId: HOTEL_ID, apply: true }));
  });

  test('modes contradictoires et arguments inconnus sont refusés', () => {
    expect(() => parseArgs([`--hotel-id=${HOTEL_ID}`, '--dry-run', '--apply'])).toThrow('MODE_CONFLICT');
    expect(() => parseArgs([`--hotel-id=${HOTEL_ID}`, '--all'])).toThrow('INVALID_ARGUMENT');
  });

  test('noms des gardes dédiées sont stables et sans fallback applicatif', () => {
    expect(URI_ENV).toBe('HOTEL_PUBLICATION_RESYNC_MONGODB_URI');
    expect(APPLY_ENV).toBe('HOTEL_PUBLICATION_RESYNC_ALLOW_APPLY');
  });

  test('une URI dédiée est obligatoire avant toute connexion', () => {
    const args = parseArgs([`--hotel-id=${HOTEL_ID}`]);
    expect(() => validateExecution(args, {})).toThrow(`${URI_ENV}_REQUIRED`);
  });

  test('apply exige le drapeau opérateur et la double confirmation', () => {
    const base = parseArgs([`--hotel-id=${HOTEL_ID}`, '--apply']);
    expect(() => validateExecution(base, { [URI_ENV]: 'dedicated-test-uri' })).toThrow(`${APPLY_ENV}_REQUIRED`);
    expect(() => validateExecution(base, { [URI_ENV]: 'dedicated-test-uri', [APPLY_ENV]: 'YES' }))
      .toThrow('HOTEL_ID_CONFIRMATION_MISMATCH');
    expect(() => validateExecution({ ...base, confirmHotelId: HOTEL_ID }, {
      [URI_ENV]: 'dedicated-test-uri', [APPLY_ENV]: 'YES',
    })).toThrow('DATABASE_CONFIRMATION_REQUIRED');
  });

  test('la configuration apply complète retourne seulement l URI dédiée', () => {
    const args = parseArgs([
      `--hotel-id=${HOTEL_ID}`, '--apply', `--confirm-hotel-id=${HOTEL_ID}`, '--confirm-database=altitude',
    ]);
    expect(validateExecution(args, {
      [URI_ENV]: 'dedicated-test-uri', [APPLY_ENV]: 'YES', MONGODB_URI: 'forbidden-fallback',
    })).toBe('dedicated-test-uri');
  });
});
