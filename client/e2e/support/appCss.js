// F-U2.14 — CSS applicatif pour les tests visuels, compilé à la demande avec
// la configuration RÉELLE du projet (tailwind.config.js + plugins PostCSS de
// postcss.config.js) à partir des mêmes sources que le layout
// (`app/globals.css`, `app/dashboard/dashboard.css`). Mêmes règles que le
// build de production (sans minification) — indépendant du dossier `.next`,
// que le serveur E2E (`next dev`) réécrit pendant la campagne.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const SOURCES = ['app/globals.css', 'app/dashboard/dashboard.css'];

export async function buildAppCss(clientRoot) {
  const config = (await import(pathToFileURL(path.join(clientRoot, 'tailwind.config.js')).href)).default;
  const content = config.content.map((glob) => path.join(clientRoot, glob));
  const chunks = [];
  for (const relative of SOURCES) {
    const file = path.join(clientRoot, relative);
    const result = await postcss([tailwindcss({ ...config, content }), autoprefixer]).process(fs.readFileSync(file, 'utf8'), { from: file });
    chunks.push(result.css);
  }
  const css = chunks.join('\n');
  if (!css.includes('.dark') && !css.includes('dark')) throw new Error('CSS applicatif incomplet : variantes sombres absentes.');
  return css;
}
