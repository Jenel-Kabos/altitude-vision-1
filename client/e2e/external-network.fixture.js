import { test as base, expect } from '@playwright/test';

const isLocalUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    if (['data:', 'blob:', 'about:'].includes(url.protocol)) return true;
    const host = url.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.startsWith('127.');
  } catch { return false; }
};

const test = base.extend({
  externalNetworkIsolation: [async ({ context }, use) => {
    // F-U2.14 — visiteur ayant déjà exprimé son choix de cookies (refus des
    // cookies analytiques, clé réelle de useCookieConsent) : la bannière
    // compacte (refondue en 3ca61dc) ne recouvre plus les actions testées.
    // Même convention que les specs hôtelières, généralisée.
    await context.addInitScript(() => { try { localStorage.setItem('cookie_consent', 'refused'); } catch { /* stockage indisponible */ } });
    const blocked = [];
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      const parsed = new URL(url);
      if (parsed.pathname === '/_next/image') {
        const source = parsed.searchParams.get('url');
        if (source && /^https?:\/\//.test(source) && !isLocalUrl(source)) {
          return route.fulfill({
            status: 200,
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#d1d5db"/></svg>',
          });
        }
      }
      if (isLocalUrl(url)) return route.continue();
      if (route.request().resourceType() === 'image') {
        return route.fulfill({
          status: 200,
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#d1d5db"/></svg>',
        });
      }
      if (route.request().resourceType() === 'script') {
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* external script mocked by E2E isolation */' });
      }
      blocked.push(url);
      return route.abort('blockedbyclient');
    });
    await use();
    expect(blocked, `EXTERNAL_NETWORK_BLOCKED_IN_E2E: ${blocked.join(', ')}`).toEqual([]);
  }, { auto: true }],
});

export { test, expect };
