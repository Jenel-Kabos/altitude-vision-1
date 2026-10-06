const {
  parseArgs,
  describeMongoTarget,
} = require('../scripts/purgeLegacyRentalTestData');

const uri = 'mongodb+srv://user:secret@example.mongodb.net/altitude_test';

test('preview est read-only, exige confirmation de base et un fichier de sortie', () => {
  expect(parseArgs(['--preview', '--confirm-database=altitude_test', '--manifest-out=/tmp/c211d.json'], { MONGO_URI: uri }))
    .toMatchObject({ mode: 'preview', database: 'altitude_test', manifestOut: '/tmp/c211d.json' });
  expect(() => parseArgs(['--preview', '--confirm-database=wrong', '--manifest-out=/tmp/c211d.json'], { MONGO_URI: uri }))
    .toThrow(expect.objectContaining({ code: 'DATABASE_CONFIRMATION_MISMATCH' }));
});

test('apply exige manifest, hash, confirmation destructive et garde environnementale', () => {
  const args = ['--apply', '--confirm-database=altitude_test', '--manifest=/tmp/c211d.json', '--confirm-manifest-hash=abc', '--confirm-delete-legacy-test-data'];
  expect(() => parseArgs(args, { MONGO_URI: uri })).toThrow(expect.objectContaining({ code: 'APPLY_ENV_GUARD_REQUIRED' }));
  expect(parseArgs(args, { MONGO_URI: uri, ALLOW_C2_11D_LEGACY_TEST_DATA_DELETE: 'true' }))
    .toMatchObject({ mode: 'apply', manifestPath: '/tmp/c211d.json', manifestHash: 'abc' });
});

test('la cible affichée ne révèle jamais les credentials', () => {
  expect(describeMongoTarget(uri)).toEqual({ host: 'example.mongodb.net', database: 'altitude_test' });
});
