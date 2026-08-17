/* eslint-env node */
const fs = require('fs');
const path = require('path');
const { colors } = require('../colors');
const { colorsDark } = require('../colorsDark');

const SRC_DIR = path.join(__dirname, '..', '..');
const VALID_KEYS = new Set(Object.keys(colors));

// Repère `c.xxx` / `themeColors.xxx` dans le code applicatif — jamais dans les
// fichiers de test — et vérifie que `xxx` est une clé réelle du thème.
const TOKEN_USAGE_RE = /\b(?:c|themeColors)\.([a-zA-Z0-9]+)/g;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) files.push(full);
  }
  return files;
}

describe('Design tokens — intégrité (mandat UI-MOB-3 §39-40)', () => {
  // Le bug HotelOperationsScreen (`c.danger` inexistant, fallback hardcodé
  // toujours actif) a montré qu'une référence à un token inexistant ne
  // provoque ni erreur ni avertissement à l'exécution — seulement un
  // `undefined` silencieux. Ce test scanne tout le code source applicatif
  // pour détecter toute nouvelle régression de ce type.
  test('colors.js et colorsDark.js exposent exactement le même jeu de clés', () => {
    expect(Object.keys(colorsDark).sort()).toEqual(Object.keys(colors).sort());
  });

  test('aucune référence c.xxx / themeColors.xxx dans le code ne pointe vers une clé de thème inexistante', () => {
    const invalid = [];
    for (const file of walk(SRC_DIR)) {
      const content = fs.readFileSync(file, 'utf8');
      let match;
      while ((match = TOKEN_USAGE_RE.exec(content))) {
        const key = match[1];
        if (!VALID_KEYS.has(key)) {
          const line = content.slice(0, match.index).split('\n').length;
          invalid.push(`${path.relative(SRC_DIR, file)}:${line} -> .${key}`);
        }
      }
    }
    expect(invalid).toEqual([]);
  });
});
