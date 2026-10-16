// F-U2.15 — le build de production utilisé par les E2E (NEXT_E2E_BUILD=1) ne
// doit jamais pouvoir fuir vers la production : sans le drapeau, la CSP de
// production n'autorise aucun backend local et la sortie reste `.next` (seul
// dossier publié par Netlify) ; avec le drapeau, sortie isolée `.next-e2e`.
// La configuration est évaluée dans un processus Node séparé, comme par Next.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const CONFIG = path.resolve(__dirname, '../../next.config.mjs');
const SCRIPT = `
  const { default: config } = await import(${JSON.stringify(`file://${CONFIG}`)});
  const [{ headers }] = await config.headers();
  const csp = headers.find((header) => header.key === 'Content-Security-Policy').value;
  process.stdout.write(JSON.stringify({ distDir: config.distDir ?? null, csp }));
`;

function loadConfig(env) {
  const { NEXT_E2E_BUILD: _ignored, ...base } = process.env;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', SCRIPT], { env: { ...base, ...env }, encoding: 'utf8' });
  return JSON.parse(output);
}

describe('next.config — build E2E isolé', () => {
  test('production standard : aucun backend local dans la CSP, sortie .next', () => {
    const { distDir, csp } = loadConfig({ NODE_ENV: 'production' });
    expect(csp).not.toContain('localhost');
    expect(distDir).toBeNull();
  });

  test('build E2E : backend local autorisé, sortie isolée .next-e2e', () => {
    const { distDir, csp } = loadConfig({ NODE_ENV: 'production', NEXT_E2E_BUILD: '1' });
    expect(csp).toContain('http://localhost:5000');
    expect(distDir).toBe('.next-e2e');
  });

  test('toute autre valeur du drapeau ne déclenche rien', () => {
    const { distDir, csp } = loadConfig({ NODE_ENV: 'production', NEXT_E2E_BUILD: 'true' });
    expect(csp).not.toContain('localhost');
    expect(distDir).toBeNull();
  });
});
