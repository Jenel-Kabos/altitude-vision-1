import React from 'react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { getPostAuthDestination } from '../navigation/postAuthDestination';

// HOTFIX-AUTH-POSTLOGIN-ROUTING-1 — caractérise puis prouve la convergence de
// /auth/google-redirect (seul point d'entrée post-login Google, hors
// redirection explicite ?redirect=) vers le résolveur canonique unique
// getPostAuthDestination, déjà consommé par LoginPage/RegisterPage/
// VerifyEmailPage. Avant correction, cette page réimplémentait sa propre
// logique locale (getTargetPath) et divergeait pour Proprietaire (/mes-biens
// au lieu de /mon-espace-proprietaire, court-circuitant resolveOwnerDestination)
// et pour Client/legacy (/altimmo/annonces au lieu de /mon-espace ou /).

const { sessionRef, replaceMock } = vi.hoisted(() => ({
  sessionRef: { current: null },
  replaceMock: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => sessionRef.current,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const { default: GoogleRedirectPage } = await import('../../app/auth/google-redirect/page.jsx');

describe('/auth/google-redirect — parité avec le résolveur canonique', () => {
  beforeEach(() => {
    replaceMock.mockClear();
  });

  test.each(['Admin', 'Collaborateur', 'Secretaire', 'GestionnaireImmobilier', 'CommunityManager', 'Communicant'])(
    '%s rejoint le shell staff, identique au flow email',
    async (role) => {
      sessionRef.current = { status: 'authenticated', data: { user: { role, isNewUser: false } } };
      render(<GoogleRedirectPage />);
      await waitFor(() => expect(replaceMock).toHaveBeenCalled());
      expect(replaceMock).toHaveBeenCalledWith(getPostAuthDestination({ role }));
      expect(replaceMock).toHaveBeenCalledWith('/dashboard');
    }
  );

  test('Proprietaire est envoyé vers le résolveur canonique /mon-espace-proprietaire, jamais directement vers /mes-biens', async () => {
    sessionRef.current = { status: 'authenticated', data: { user: { role: 'Proprietaire', isNewUser: false } } };
    render(<GoogleRedirectPage />);
    await waitFor(() => expect(replaceMock).toHaveBeenCalled());
    expect(replaceMock).toHaveBeenCalledWith(getPostAuthDestination({ role: 'Proprietaire' }));
    expect(replaceMock).toHaveBeenCalledWith('/mon-espace-proprietaire');
  });

  test('Client rejoint son espace personnel, identique au flow email', async () => {
    sessionRef.current = { status: 'authenticated', data: { user: { role: 'Client', isNewUser: false } } };
    render(<GoogleRedirectPage />);
    await waitFor(() => expect(replaceMock).toHaveBeenCalled());
    expect(replaceMock).toHaveBeenCalledWith(getPostAuthDestination({ role: 'Client' }));
    expect(replaceMock).toHaveBeenCalledWith('/mon-espace');
  });

  test.each(['User', 'Prestataire', undefined])('%s rejoint le site public, identique au flow email', async (role) => {
    sessionRef.current = { status: 'authenticated', data: { user: { role, isNewUser: false } } };
    render(<GoogleRedirectPage />);
    await waitFor(() => expect(replaceMock).toHaveBeenCalled());
    expect(replaceMock).toHaveBeenCalledWith(getPostAuthDestination({ role }));
    expect(replaceMock).toHaveBeenCalledWith('/');
  });

  test('nouveau compte (isNewUser) est envoyé vers la complétion de profil, avant toute résolution de destination', async () => {
    sessionRef.current = { status: 'authenticated', data: { user: { role: 'Client', isNewUser: true } } };
    render(<GoogleRedirectPage />);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/completer-profil'));
    expect(replaceMock).not.toHaveBeenCalledWith('/mon-espace');
  });

  test('session non authentifiée renvoie vers /login, aucune destination privée', async () => {
    sessionRef.current = { status: 'unauthenticated', data: null };
    render(<GoogleRedirectPage />);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
  });

  test('session en cours de chargement ne déclenche aucune navigation', async () => {
    sessionRef.current = { status: 'loading', data: null };
    render(<GoogleRedirectPage />);
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
