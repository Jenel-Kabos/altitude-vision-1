#!/usr/bin/env node
// scripts/local-ci.js — orchestrateur de CI locale (voir docs/LOCAL_CI.md).
//
// Exécute les mêmes validations que la CI GitHub Actions distante, dans
// l'ordre server → client → mobile, et affiche un rapport agrégé.
//
// Usage : node scripts/local-ci.js <mode>
//   mode = ci | verify | release
//
// Ne masque jamais un échec : chaque check s'exécute jusqu'au bout (pour que
// le rapport soit complet), mais le process se termine avec un code de
// sortie non nul si au moins un check a échoué.

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WORKSPACES = {
  server: path.join(ROOT, 'server'),
  client: path.join(ROOT, 'client'),
  mobile: path.join(ROOT, 'altimmo-app'),
};

const mode = process.argv[2] || 'ci';
if (!['ci', 'verify', 'release'].includes(mode)) {
  console.error(`Mode inconnu : "${mode}". Attendu : ci | verify | release`);
  process.exit(2);
}

function runNpm(cwd, args) {
  const res = spawnSync('npm', args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return res.status === 0;
}

const results = []; // { section, label, ok }

function check(section, label, cwd, npmArgs) {
  console.log(`\n\x1b[36m▶ ${section} — ${label}\x1b[0m (${npmArgs.join(' ')})`);
  const ok = runNpm(cwd, npmArgs);
  results.push({ section, label, ok });
  if (!ok) console.log(`\x1b[31m✖ ${section} — ${label} a échoué\x1b[0m`);
  return ok;
}

const runTests = mode !== 'verify';
const runBuildAndExport = mode !== 'verify';

// ── SERVER ─────────────────────────────────────────────────────────────
check('SERVER', 'Lint', WORKSPACES.server, ['run', 'lint']);
if (runTests) check('SERVER', 'Tests', WORKSPACES.server, ['test']);

// ── CLIENT ─────────────────────────────────────────────────────────────
check('CLIENT', 'Lint', WORKSPACES.client, ['run', 'lint']);
if (runTests) check('CLIENT', 'Tests', WORKSPACES.client, ['test']);
if (runBuildAndExport) check('CLIENT', 'Build', WORKSPACES.client, ['run', 'build']);

// ── MOBILE ─────────────────────────────────────────────────────────────
if (runTests) check('MOBILE', 'Syntax', WORKSPACES.mobile, ['run', 'check:syntax']);
check('MOBILE', 'Lint', WORKSPACES.mobile, ['run', 'lint']);
check('MOBILE', 'Types', WORKSPACES.mobile, ['run', 'typecheck']);
if (runTests) check('MOBILE', 'Tests', WORKSPACES.mobile, ['run', 'test:coverage']);
if (runBuildAndExport) {
  check('MOBILE', 'Doctor', WORKSPACES.mobile, ['run', 'doctor']);
  check('MOBILE', 'Export', WORKSPACES.mobile, ['run', 'export']);
}

// ── RAPPORT ────────────────────────────────────────────────────────────
const LABEL_WIDTH = 16;
const pad = (s) => s + '.'.repeat(Math.max(1, LABEL_WIDTH - s.length));
const icon = (ok) => (ok ? '✅' : '❌');

console.log('\n==============================');
let currentSection = null;
for (const r of results) {
  if (r.section !== currentSection) {
    if (currentSection !== null) console.log('==============================');
    console.log(r.section);
    currentSection = r.section;
  }
  console.log(`${pad(r.label)} ${icon(r.ok)}`);
}
console.log('==============================');

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;

console.log('TOTAL');
console.log(`✔ ${passed} validations`);
console.log(`✖ ${failed} erreurs`);
console.log('==============================');

if (mode === 'release') {
  console.log(
    failed === 0
      ? '\n🚀 Résumé : le projet est prêt pour une release (toutes les validations passent).'
      : `\n🛑 Résumé : ${failed} validation(s) en échec — ne pas déployer avant correction.`,
  );
}

process.exit(failed === 0 ? 0 : 1);
