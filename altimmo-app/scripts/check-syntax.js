#!/usr/bin/env node
// Parses every JS/JSX file under src/ with the project's own Babel config
// to catch syntax errors (unterminated strings, bad tokens...) before they
// reach an EAS build. Not a full lint — just "does this file parse".

const fs = require('fs');
const path = require('path');
const { transformFileSync } = require('@babel/core');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const EXTENSIONS = new Set(['.js', '.jsx']);

function collectFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, files);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = collectFiles(SRC_DIR);
let hasError = false;

for (const file of files) {
  try {
    transformFileSync(file, { presets: ['babel-preset-expo'], filename: file, babelrc: false, configFile: false });
  } catch (err) {
    hasError = true;
    console.error(`\n✖ ${path.relative(ROOT, file)}`);
    console.error(err.message);
  }
}

if (hasError) {
  console.error(`\nSyntax check failed.`);
  process.exit(1);
}

console.log(`✓ ${files.length} fichiers vérifiés, aucune erreur de syntaxe.`);
