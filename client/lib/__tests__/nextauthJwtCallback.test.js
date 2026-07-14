import { describe, test, expect, beforeEach, vi } from 'vitest';

// NextAuth(config) est appelé au chargement du module route.js — on capture
// le `config` passé (callbacks compris) via un mock hoisté, sans modifier
// le fichier source ni l'exporter séparément.
const { capturedConfigRef } = vi.hoisted(() => ({ capturedConfigRef: { current: null } }));

vi.mock('next-auth', () => ({
  default: (config) => {
    capturedConfigRef.current = config;
    return { handlers: { GET: () => {}, POST: () => {} } };
  },
}));

vi.mock('next-auth/providers/google', () => ({
  default: () => ({}),
}));

// Déclenche NextAuth(config) et peuple capturedConfigRef.current
await import('../../app/api/auth/[...nextauth]/route.js');

const jwtCallback = capturedConfigRef.current.callbacks.jwt;

const FIVE_MINUTES = 5 * 60;

describe('NextAuth callback jwt', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  test('connexion initiale (backendToken déjà récupéré dans signIn) — pas de second appel réseau', async () => {
    const account = {
      provider:     'google',
      backendToken: 'jwt-du-backend',
      backendUser:  { _id: 'user-1', role: 'Admin' },
      isNewUser:    false,
    };
    const token = { email: 'admin@test.com' };

    const result = await jwtCallback({ token, account });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.accessToken).toBe('jwt-du-backend');
    expect(result.userId).toBe('user-1');
    expect(result.role).toBe('Admin');
    expect(result.roleCheckedAt).toEqual(expect.any(Number));
  });

  test('connexion initiale (pas de backendToken) — fallback fetch /auth/google-token', async () => {
    fetch.mockResolvedValue({
      json: async () => ({ token: 'jwt-fallback', userId: 'user-2', role: 'Client' }),
    });

    const account = { provider: 'google' };
    const token = { email: 'client@test.com' };

    const result = await jwtCallback({ token, account });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toMatch(/\/auth\/google-token$/);
    expect(result.accessToken).toBe('jwt-fallback');
    expect(result.userId).toBe('user-2');
    expect(result.role).toBe('Client');
    expect(result.roleCheckedAt).toEqual(expect.any(Number));
  });

  test('refresh (account absent) sans roleCheckedAt — recharge le rôle', async () => {
    fetch.mockResolvedValue({
      ok:   true,
      json: async () => ({ role: 'Collaborateur', userId: 'user-3' }),
    });

    const token = { email: 'staff@test.com', accessToken: 'ancien-token', role: 'Client' };

    const result = await jwtCallback({ token, account: null });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.role).toBe('Collaborateur');
    expect(result.userId).toBe('user-3');
    expect(result.roleCheckedAt).toEqual(expect.any(Number));
  });

  test('refresh dans la fenêtre de cache 5 min — ne recharge pas le rôle', async () => {
    const recentCheck = Math.floor(Date.now() / 1000) - 60; // il y a 1 min
    const token = {
      email:         'staff@test.com',
      accessToken:   'token-existant',
      role:          'Collaborateur',
      roleCheckedAt: recentCheck,
    };

    const result = await jwtCallback({ token, account: null });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.role).toBe('Collaborateur');
    expect(result.roleCheckedAt).toBe(recentCheck);
  });

  test('refresh hors fenêtre de cache (> 5 min) — recharge le rôle', async () => {
    const staleCheck = Math.floor(Date.now() / 1000) - (FIVE_MINUTES + 30);
    fetch.mockResolvedValue({
      ok:   true,
      json: async () => ({ role: 'Admin', userId: 'user-4' }),
    });

    const token = {
      email:         'admin2@test.com',
      accessToken:   'token-existant',
      role:          'Client',
      roleCheckedAt: staleCheck,
    };

    const result = await jwtCallback({ token, account: null });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.role).toBe('Admin');
    expect(result.roleCheckedAt).not.toBe(staleCheck);
  });

  test('pas de session active (account absent, pas de accessToken) — aucun appel réseau', async () => {
    const token = { email: 'anonyme@test.com' };

    const result = await jwtCallback({ token, account: null });

    expect(fetch).not.toHaveBeenCalled();
    expect(result).toBe(token);
  });

  test('refresh — échec réseau silencieux, le token existant est conservé', async () => {
    fetch.mockRejectedValue(new Error('network down'));

    const token = { email: 'staff@test.com', accessToken: 'token-existant', role: 'Collaborateur' };

    const result = await jwtCallback({ token, account: null });

    expect(result.role).toBe('Collaborateur');
    expect(result.roleCheckedAt).toBeUndefined();
  });
});
