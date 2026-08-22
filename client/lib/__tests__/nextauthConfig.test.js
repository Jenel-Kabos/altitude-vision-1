import { describe, test, expect, beforeAll, afterAll } from 'vitest';

// HOTFIX-WEB-GOOGLE-AUTH-1 — verrou anti-régression sur la configuration
// NextAuth elle-même (pas les callbacks métier, déjà couverts par
// nextauthJwtCallback.test.js). Capture le `config` réellement passé à
// NextAuth(...) au chargement du module route.js, sans le modifier.
const { capturedConfigRef } = vi.hoisted(() => ({ capturedConfigRef: { current: null } }));

vi.mock('next-auth', () => ({
  default: (config) => {
    capturedConfigRef.current = config;
    return { handlers: { GET: () => {}, POST: () => {} } };
  },
}));

vi.mock('next-auth/providers/google', () => ({
  default: (opts) => ({ id: 'google', type: 'oauth', ...opts }),
}));

describe('Configuration NextAuth (route.js) — HOTFIX-WEB-GOOGLE-AUTH-1', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = '872164120879-fake-web-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'GOCSPX-fake-secret-for-tests';
    process.env.NEXTAUTH_URL = 'https://altitudevision.agency';
    process.env.NEXTAUTH_SECRET = 'fake-nextauth-secret-for-tests';
    // Déclenche NextAuth(config) et peuple capturedConfigRef.current.
    await import('../../app/api/auth/[...nextauth]/route.js');
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test('trustHost est explicitement activé — Auth.js v5 lève UntrustedHost sinon sur Netlify (NODE_ENV=production sans AUTH_URL/AUTH_TRUST_HOST)', () => {
    expect(capturedConfigRef.current.trustHost).toBe(true);
  });

  test('le provider Google est configuré avec le client ID Web (jamais codé en dur, toujours lu depuis process.env)', () => {
    const google = capturedConfigRef.current.providers.find((p) => p.id === 'google');
    expect(google.clientId).toBe(process.env.GOOGLE_CLIENT_ID);
    expect(google.clientSecret).toBe(process.env.GOOGLE_CLIENT_SECRET);
  });

  test('le client ID appartient au projet Google Cloud attendu (préfixe projet)', () => {
    const google = capturedConfigRef.current.providers.find((p) => p.id === 'google');
    expect(google.clientId).toMatch(/^872164120879-/);
  });

  test('aucun secret n\'est codé en dur dans le fichier source (toujours dérivé de process.env)', () => {
    const google = capturedConfigRef.current.providers.find((p) => p.id === 'google');
    expect(google.clientSecret).toBe(process.env.GOOGLE_CLIENT_SECRET);
    expect(capturedConfigRef.current.secret).toBe(process.env.NEXTAUTH_SECRET);
  });

  test('les pages signIn/error pointent vers /login (contrat existant, jamais une page NextAuth par défaut exposant des détails techniques)', () => {
    expect(capturedConfigRef.current.pages).toEqual({ signIn: '/login', error: '/login' });
  });
});
