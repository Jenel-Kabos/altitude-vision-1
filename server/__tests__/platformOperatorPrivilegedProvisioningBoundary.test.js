// PLATFORM-DELEGATION-POLICY-1 — garde statique : le provisionnement
// privilégié (attribution de capacités critiques, hors politique de
// délégation) n'est référencé QUE par son service et par les scripts CLI
// gardés d'administration initiale / de récupération. Aucune route, aucun
// contrôleur, aucun middleware ni aucun autre service ne peut l'appeler.
const fs = require('fs');
const path = require('path');

const SERVER_ROOT = path.join(__dirname, '..');
const SYMBOL = 'provisionPrivilegedOperator';
const ALLOWED = new Set([
  'services/platformOperator/platformOperatorService.js',
  'scripts/bootstrapPlatformOperator.js',
  'scripts/applyDataReset.js',
]);
const IGNORED_DIRS = new Set(['node_modules', '__tests__', 'coverage', '.git', 'uploads', 'logs']);

function listSourceFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listSourceFiles(full, acc);
    else if (/\.(c|m)?js$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

describe('Provisionnement privilégié des PlatformOperator — frontière', () => {
  const offenders = listSourceFiles(SERVER_ROOT)
    .map((file) => path.relative(SERVER_ROOT, file).split(path.sep).join('/'))
    .filter((rel) => !ALLOWED.has(rel))
    .filter((rel) => fs.readFileSync(path.join(SERVER_ROOT, rel), 'utf8').includes(SYMBOL));

  test('aucune route, aucun contrôleur, middleware ou service hors liste ne référence le provisionnement privilégié', () => {
    expect(offenders).toEqual([]);
  });

  test('la route HTTP d’octroi appelle l’octroi ordinaire soumis à la politique', () => {
    const controller = fs.readFileSync(path.join(SERVER_ROOT, 'controllers/platformOperatorController.js'), 'utf8');
    expect(controller).toMatch(/service\.grantOperator\(\{ userId, capabilities, reason, actor: req\.user, req \}\)/);
    expect(controller).not.toMatch(/allowSelfGrant/);
  });

  test('chaque appelant autorisé existe réellement (liste non périmée)', () => {
    for (const rel of ALLOWED) {
      expect(fs.readFileSync(path.join(SERVER_ROOT, rel), 'utf8')).toContain(SYMBOL);
    }
  });
});
