#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const appDir = path.join(root, 'app');
const sourceRoots = ['app', 'lib'].map((directory) => path.join(root, directory));
const extensions = new Set(['.js', '.jsx', '.ts', '.tsx']);

const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolute = path.join(directory, entry.name);
  if (entry.isDirectory()) return walk(absolute);
  return extensions.has(path.extname(entry.name)) ? [absolute] : [];
});

const routeFiles = walk(appDir).filter((file) => /(?:^|\/)page\.(?:js|jsx|ts|tsx)$/.test(file));
const routes = routeFiles.map((file) => {
  const relative = path.relative(appDir, path.dirname(file));
  const route = `/${relative === '' ? '' : relative}`.replace(/\/\([^/]+\)/g, '');
  return route === '/' ? route : route.replace(/\/$/, '');
}).sort();

// Catch-all pages in this project render a 404. They must not make every typo
// appear valid during the audit.
const routePatterns = routes.filter((route) => !route.includes('[...')).map((route) => {
  const expression = route
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\[\\\.\\\.\\\.[^\]]+\\\]/g, '.*')
    .replace(/\\\[[^\]]+\\\]/g, '[^/]+');
  return new RegExp(`^${expression || '/'}$`);
});

const findings = [];
const staticDestination = /(?:^|[\s<])(?:href|to)\s*=\s*["']([^"']*)["']|\brouter\.(?:push|replace)\(\s*["']([^"']*)["']/g;

for (const file of sourceRoots.flatMap(walk)) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (const [index, line] of lines.entries()) {
    for (const match of line.matchAll(staticDestination)) {
      const destination = match[1] ?? match[2];
      const location = `${path.relative(root, file)}:${index + 1}`;

      if (destination === '' || destination === '#') {
        findings.push({ severity: 'error', location, destination: destination || '(vide)', reason: 'destination vide ou factice' });
        continue;
      }
      if (!destination.startsWith('/') || destination.startsWith('//')) continue;

      const pathname = destination.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/';
      if (!routePatterns.some((pattern) => pattern.test(pathname))) {
        findings.push({ severity: 'error', location, destination, reason: 'route App Router statique introuvable' });
      }
    }
  }
}

console.log(`Routes App Router inventoriées : ${routes.length}`);
for (const route of routes) console.log(`  ${route}`);
console.log(`\nDestinations suspectes : ${findings.length}`);
for (const finding of findings) {
  console.log(`  [${finding.severity.toUpperCase()}] ${finding.location} → ${finding.destination} (${finding.reason})`);
}

if (findings.some(({ severity }) => severity === 'error')) process.exitCode = 1;
