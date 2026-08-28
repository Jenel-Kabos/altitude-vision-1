// HOTFIX-INBOX-SECURITY-2 — FINAL CERTIFICATION
// Preuve en moteur Chromium RÉEL (pas jsdom) — lève la réserve du hotfix
// précédent ("absence de validation réelle du comportement navigateur").
//
// Partie A (tests 1-2) : monte le VRAI composant de production
// `SafeAttachmentPreview.jsx` (bundlé via esbuild, voir mountAttachmentPreview.entry.jsx)
// avec des payloads HTML/SVG adversariaux inoffensifs, et vérifie dans un
// vrai DOM Chromium qu'aucune exécution n'atteint le contexte parent.
//
// Partie B (test 3) : contrôle négatif de défense en profondeur — sandbox
// SEUL (sans DOMPurify), pour prouver que même un contournement total de la
// sanitization resterait bloqué par l'attribut `sandbox` réel de Chromium.
//
// Partie C (tests 4-5) : reproduction du mécanisme historique de la faille
// (window.open sur un Blob HTML exécute son contenu) puis preuve que le
// correctif (`<a download>`) ne l'exécute jamais.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bundle le VRAI fichier de production en mémoire (jamais un artefact
// écrit sur disque) — évite toute dérive entre le code testé et le code
// réellement expédié, sans laisser de fichier généré dans le dépôt.
let BUNDLE;
test.beforeAll(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, 'mountAttachmentPreview.entry.jsx')],
    bundle: true,
    format: 'iife',
    loader: { '.jsx': 'jsx' },
    jsx: 'automatic',
    write: false,
    logLevel: 'silent',
  });
  BUNDLE = result.outputFiles[0].text;
});

const htmlPayload = '<p>Salut</p><script>window.parent.__INBOX_SECURITY_TEST__ = "pwned";</script><img src=x onerror="window.parent.__INBOX_SECURITY_TEST__ = \'pwned\'">';
const svgPayload = '<svg xmlns="http://www.w3.org/2000/svg" onload="window.parent.__INBOX_SECURITY_TEST__ = \'pwned\'"><script>window.parent.__INBOX_SECURITY_TEST__ = "pwned";</script><circle r="5"/></svg>';

// Sert la page hôte sur une VRAIE origine http:// (jamais about:blank/opaque)
// — nécessaire pour tester localStorage exactement comme sur le dashboard
// réel (https://altitudevision.agency), qui n'a jamais une origine opaque.
let server;
let baseURL;
test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}/`;
});
test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function mount(page, props) {
  await page.goto(baseURL);
  await page.evaluate(() => {
    window.__INBOX_SECURITY_TEST__ = 'untouched';
    window.localStorage.setItem('token', 'FAKE-JWT-FOR-TEST-ONLY');
  });
  await page.addScriptTag({ content: BUNDLE });
  await page.evaluate((p) => window.mountAttachmentPreview(p), props);
}

test.describe('SafeAttachmentPreview — preuve navigateur réel (Chromium)', () => {
  test('1. HTML hostile : aucune exécution dans le contexte parent, sandbox correcte, srcdoc nettoyé', async ({ page }) => {
    await mount(page, {
      filename: 'facture.html', kind: 'html', content: htmlPayload, loading: false, error: false,
    });

    const frame = page.getByTestId('attachment-safe-frame');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');

    const srcdoc = await frame.evaluate((el) => el.getAttribute('srcdoc') ?? el.srcdoc);
    expect(srcdoc).not.toContain('<script');
    expect(srcdoc).not.toContain('onerror');
    expect(srcdoc).toContain('Salut');

    // Laisser le temps à l'iframe de charger et à un éventuel script de s'exécuter.
    await page.waitForTimeout(500);
    const marker = await page.evaluate(() => window.__INBOX_SECURITY_TEST__);
    const token = await page.evaluate(() => window.localStorage.getItem('token'));
    expect(marker).toBe('untouched');
    expect(token).toBe('FAKE-JWT-FOR-TEST-ONLY');
  });

  test('2. SVG hostile : aucune exécution dans le contexte parent', async ({ page }) => {
    await mount(page, {
      filename: 'logo.svg', kind: 'svg', content: svgPayload, loading: false, error: false,
    });

    const frame = page.getByTestId('attachment-safe-frame');
    await expect(frame).toBeVisible();
    const srcdoc = await frame.evaluate((el) => el.getAttribute('srcdoc') ?? el.srcdoc);
    expect(srcdoc).not.toContain('<script');
    expect(srcdoc).not.toContain('onload');

    await page.waitForTimeout(500);
    const marker = await page.evaluate(() => window.__INBOX_SECURITY_TEST__);
    expect(marker).toBe('untouched');
  });

  test('3. Défense en profondeur — sandbox seul (DOMPurify contourné volontairement) bloque toujours tout', async ({ page, context }) => {
    // Contrôle négatif : reproduit le MÊME attribut sandbox que la production,
    // mais avec un srcDoc brut, non sanitizé, pour prouver que le sandbox
    // Chromium à lui seul empêche script, accès parent, popup et navigation
    // top — indépendamment de DOMPurify (double barrière prouvée séparément).
    await page.goto(baseURL);
    await page.evaluate(() => { window.__INBOX_SECURITY_TEST__ = 'untouched'; });

    const rawMaliciousSrcDoc = `<!DOCTYPE html><html><body>
      <script>
        try { window.parent.__INBOX_SECURITY_TEST__ = 'pwned'; } catch (e) {}
        try { window.top.location = 'https://evil.test/'; } catch (e) {}
        try { window.open('https://evil.test/popup'); } catch (e) {}
        try { window.localStorage.setItem('stolen', 'yes'); } catch (e) {}
      </script>
      <img src=x onerror="try { window.parent.__INBOX_SECURITY_TEST__ = 'pwned'; } catch(e) {}">
    </body></html>`;

    await page.evaluate((srcdoc) => {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
      iframe.setAttribute('data-testid', 'raw-sandboxed-frame');
      iframe.srcdoc = srcdoc;
      document.getElementById('root').appendChild(iframe);
    }, rawMaliciousSrcDoc);

    await page.waitForTimeout(800);

    const marker = await page.evaluate(() => window.__INBOX_SECURITY_TEST__);
    expect(marker).toBe('untouched');
    expect(page.url()).not.toContain('evil.test');
    expect(context.pages().length).toBe(1); // aucune popup ouverte
  });

  test('4. Reproduction historique : window.open sur un Blob HTML EXÉCUTE le script (mécanisme du bug avant correctif)', async ({ page, context }) => {
    await page.goto('about:blank');
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.evaluate(() => {
        const blob = new Blob(['<script>document.title = "PWNED-BY-BLOB";</script>'], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
      }),
    ]);
    await popup.waitForLoadState();
    await expect(popup).toHaveTitle('PWNED-BY-BLOB');
    await popup.close();
  });

  test("5. Correctif : téléchargement forcé (<a download>) sur le même Blob HTML n'exécute JAMAIS le contenu", async ({ page, context }) => {
    await page.goto('about:blank');
    const pagesBefore = context.pages().length;
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(() => {
        const blob = new Blob(['<script>document.title = "PWNED-BY-BLOB";</script>'], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'evil.html';
        document.body.appendChild(link);
        link.click();
        link.remove();
      }),
    ]);
    expect(download.suggestedFilename()).toBe('evil.html');
    // Aucune nouvelle page/onglet ouvert, aucune exécution du contenu — le
    // titre de la page courante ne change jamais.
    expect(context.pages().length).toBe(pagesBefore);
    await expect(page).toHaveTitle('');
  });
});
