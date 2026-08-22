import React from 'react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { sessionRef } = vi.hoisted(() => ({ sessionRef: { current: null } }));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: sessionRef.current }),
  signOut:    vi.fn(),
}));

vi.mock('../services/userBusinessProfileService', () => ({
  getEffectiveProfiles: vi.fn().mockResolvedValue([]),
}));

const getMeMock = vi.fn().mockResolvedValue(null);
vi.mock('../services/userService', () => ({
  getMe: (...args) => getMeMock(...args),
}));

const { AuthProvider, useAuth } = await import('../context/AuthContext');

// RBAC-3 — prouve que `can()` lit les capacités du user réel (localStorage
// ou session Google projetée) et ne recrée jamais un mapping rôle→capacités
// côté client (voir server/docs/RBAC3_SECURITY_MATRIX.md).
const Probe = ({ capability }) => {
  const { can, user } = useAuth();
  return (
    <div>
      <span data-testid="result">{String(can(capability))}</span>
      <span data-testid="role">{user?.role || 'none'}</span>
    </div>
  );
};

describe('AuthContext.can()', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionRef.current = null;
    getMeMock.mockReset().mockResolvedValue(null);
  });

  test('utilisateur email/password — capacité présente dans user.capabilities → true', async () => {
    localStorage.setItem('token', 'jwt');
    localStorage.setItem('user', JSON.stringify({
      _id: 'u1', role: 'GestionnaireImmobilier', capabilities: ['properties.update', 'rental.manage'],
    }));

    render(<AuthProvider><Probe capability="properties.update" /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('GestionnaireImmobilier'));
    expect(screen.getByTestId('result').textContent).toBe('true');
  });

  test('capacité absente de user.capabilities → false (fail closed)', async () => {
    localStorage.setItem('token', 'jwt');
    localStorage.setItem('user', JSON.stringify({
      _id: 'u2', role: 'GestionnaireImmobilier', capabilities: ['properties.update'],
    }));

    render(<AuthProvider><Probe capability="payments.reverse" /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('GestionnaireImmobilier'));
    expect(screen.getByTestId('result').textContent).toBe('false');
  });

  test('user.capabilities absent (ancienne session) → false, jamais un fallback rôle→capacité', async () => {
    localStorage.setItem('token', 'jwt');
    localStorage.setItem('user', JSON.stringify({ _id: 'u3', role: 'Admin' }));

    render(<AuthProvider><Probe capability="properties.update" /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('Admin'));
    expect(screen.getByTestId('result').textContent).toBe('false');
  });

  test('aucun utilisateur connecté → false', async () => {
    render(<AuthProvider><Probe capability="properties.update" /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('none'));
    expect(screen.getByTestId('result').textContent).toBe('false');
  });

  test('session Google (sans user local) — capacités projetées depuis session.user.capabilities', async () => {
    // Le backend (getEffectiveCapabilities, RBAC-2) renvoie déjà la liste
    // complète pour Admin — jamais le wildcard littéral '*' au frontend.
    sessionRef.current = {
      accessToken: 'jwt-google',
      user: {
        id: 'u4', name: 'Google User', email: 'g@test.com', role: 'Admin',
        capabilities: ['properties.update', 'payments.reverse'],
      },
    };

    render(<AuthProvider><Probe capability="properties.update" /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('Admin'));
    expect(screen.getByTestId('result').textContent).toBe('true');
  });

  test('auto-guérison : session pré-RBAC-3 (capabilities absent) se rafraîchit via /me sans fallback rôle→capacité', async () => {
    localStorage.setItem('token', 'jwt');
    localStorage.setItem('user', JSON.stringify({ _id: 'u5', role: 'GestionnaireImmobilier' }));
    getMeMock.mockResolvedValue({ _id: 'u5', role: 'GestionnaireImmobilier', capabilities: ['properties.update'] });

    render(<AuthProvider><Probe capability="properties.update" /></AuthProvider>);

    // Avant le refresh /me : fail closed, jamais un mapping rôle→capacités local.
    expect(screen.getByTestId('result').textContent).toBe('false');

    await waitFor(() => expect(getMeMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('result').textContent).toBe('true'));
    expect(JSON.parse(localStorage.getItem('user')).capabilities).toEqual(['properties.update']);
  });

  test('auto-guérison : échec réseau — reste fail closed, ne boucle pas indéfiniment', async () => {
    localStorage.setItem('token', 'jwt');
    localStorage.setItem('user', JSON.stringify({ _id: 'u6', role: 'Admin' }));
    getMeMock.mockRejectedValue(new Error('network down'));

    render(<AuthProvider><Probe capability="properties.update" /></AuthProvider>);

    await waitFor(() => expect(getMeMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('result').textContent).toBe('false');
  });
});
