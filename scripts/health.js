#!/usr/bin/env node
// scripts/health.js — diagnostic rapide de l'environnement de développement
// (voir docs/LOCAL_CI.md). N'exécute aucun test, ne modifie rien.
//
// ⚠️ Le check "MongoDB" vérifie uniquement la PRÉSENCE de la configuration
// (variable MONGO_URI, driver installé) — il ne se connecte JAMAIS à une
// vraie base. Le MONGO_URI de ce projet pointe vers un cluster Atlas
// probablement partagé/production ; une connexion depuis un script de
// diagnostic exécuté à la légère serait risquée et hors du périmètre d'un
// simple health check.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const results = []; // { label, ok, detail, warnOnly }

function check(label, fn, { warnOnly = false } = {}) {
  try {
    const detail = fn();
    results.push({ label, ok: true, detail: detail || 'OK', warnOnly });
  } catch (err) {
    results.push({ label, ok: false, detail: err.message, warnOnly });
  }
}

function exists(p) {
  return fs.existsSync(path.join(ROOT, p));
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
}

function satisfiesMajorMin(version, range) {
  // Support minimal du format ">=X.Y.Z" utilisé dans ce repo (engines.node).
  const m = /^>=(\d+)\.(\d+)\.(\d+)/.exec(range);
  if (!m) return true;
  const [, maj, min, patch] = m.map(Number);
  const [vMaj, vMin, vPatch] = version.replace(/^v/, '').split('.').map(Number);
  if (vMaj !== maj) return vMaj > maj;
  if (vMin !== min) return vMin > min;
  return vPatch >= patch;
}

// ── Node.js / npm ──────────────────────────────────────────────────────
check('Node.js', () => {
  const v = process.version;
  return `${v} (${process.platform}/${process.arch})`;
});

check('npm', () => {
  return execSync('npm --version', { cwd: ROOT }).toString().trim();
});

// ── Compatibilité de versions (engines déclarés par workspace) ─────────
['server', 'client', 'altimmo-app'].forEach((ws) => {
  check(`Compatibilité Node — ${ws}`, () => {
    const pkg = readJSON(`${ws}/package.json`);
    const required = pkg.engines && pkg.engines.node;
    if (!required) return 'aucune contrainte engines.node déclarée';
    if (!satisfiesMajorMin(process.version, required)) {
      throw new Error(`Node ${process.version} ne satisfait pas engines.node="${required}"`);
    }
    return `engines.node="${required}" — satisfait par ${process.version}`;
  });
});

// ── package-lock.json ───────────────────────────────────────────────────
['.', 'server', 'client', 'altimmo-app'].forEach((ws) => {
  check(`package-lock.json — ${ws === '.' ? 'racine' : ws}`, () => {
    const lockPath = path.join(ws, 'package-lock.json');
    if (!exists(lockPath)) throw new Error('absent');
    return 'présent';
  });
});

// ── Fichiers critiques ───────────────────────────────────────────────────
const CRITICAL_FILES = [
  'server/server.js',
  'server/config/db.js',
  'server/eslint.config.js',
  'client/next.config.mjs',
  'client/.eslintrc.cjs',
  'altimmo-app/app.config.js',
  'altimmo-app/.eslintrc.js',
  '.github/workflows/lint.yml',
  '.github/workflows/mobile-validation.yml',
];
CRITICAL_FILES.forEach((f) => {
  check(`Fichier critique — ${f}`, () => {
    if (!exists(f)) throw new Error('absent');
    return 'présent';
  });
});

// ── Variables d'environnement ───────────────────────────────────────────
const ENV_FILES = [
  ['.env.example', true],
  ['server/.env', false],
  ['client/.env', false],
  ['altimmo-app/.env', false],
];
ENV_FILES.forEach(([f, required]) => {
  check(`Env — ${f}`, () => {
    if (exists(f)) return 'présent';
    if (required) throw new Error('absent (attendu, gabarit versionné)');
    return 'absent (local, non versionné — normal si jamais configuré sur cette machine)';
  }, { warnOnly: !required });
});

check('server/.env — MONGO_URI défini', () => {
  const envPath = path.join(ROOT, 'server/.env');
  if (!fs.existsSync(envPath)) throw new Error('server/.env absent — impossible de vérifier');
  const content = fs.readFileSync(envPath, 'utf8');
  if (!/^MONGO_URI\s*=\s*\S+/m.test(content)) throw new Error('MONGO_URI absent ou vide');
  return 'défini (contenu non affiché)';
}, { warnOnly: true });

check('server/.env — JWT_SECRET défini', () => {
  const envPath = path.join(ROOT, 'server/.env');
  if (!fs.existsSync(envPath)) throw new Error('server/.env absent — impossible de vérifier');
  const content = fs.readFileSync(envPath, 'utf8');
  if (!/^JWT_SECRET\s*=\s*\S+/m.test(content)) throw new Error('JWT_SECRET absent ou vide');
  return 'défini (contenu non affiché)';
}, { warnOnly: true });

// ── MongoDB (présence de configuration uniquement, jamais de connexion) ─
check('MongoDB — driver installé (server)', () => {
  if (!exists('server/node_modules/mongoose')) throw new Error('mongoose non installé — lancer npm install dans server/');
  return 'mongoose présent dans server/node_modules';
});

// ── node_modules installés ──────────────────────────────────────────────
['server', 'client', 'altimmo-app'].forEach((ws) => {
  check(`node_modules — ${ws}`, () => {
    if (!exists(`${ws}/node_modules`)) throw new Error(`absent — lancer npm install dans ${ws}/`);
    return 'présent';
  });
});

// ── Rapport ──────────────────────────────────────────────────────────────
console.log('\n==============================');
console.log('HEALTH CHECK — Altitude Vision');
console.log('==============================\n');

const LABEL_WIDTH = 46;
const pad = (s) => s + '.'.repeat(Math.max(1, LABEL_WIDTH - s.length));

let hardFailures = 0;
let warnings = 0;
for (const r of results) {
  const icon = r.ok ? '✅' : r.warnOnly ? '⚠️ ' : '❌';
  console.log(`${pad(r.label)} ${icon}  ${r.detail}`);
  if (!r.ok) {
    if (r.warnOnly) warnings += 1;
    else hardFailures += 1;
  }
}

console.log('\n==============================');
console.log(`✔ ${results.length - hardFailures - warnings} OK`);
console.log(`⚠ ${warnings} avertissement(s)`);
console.log(`✖ ${hardFailures} erreur(s) bloquante(s)`);
console.log('==============================');

process.exit(hardFailures === 0 ? 0 : 1);
