import { render, screen } from '@testing-library/react';
import ClientLayout from '../../app/ClientLayout';

// UX-OWNER-1 — non-régression du correctif de chevauchement header/contenu :
// le shell `OwnerDashboard.jsx` (réutilisé par /mes-biens, /mes-hotels,
// /mes-hebergements) et le sas `/mon-espace-proprietaire` ne réservent aucun
// offset pour le header global fixe (`position: fixed`, 58-76px, z-index 50,
// Header.jsx) — celui-ci masquait donc le haut de leur contenu. Corrigé en
// les ajoutant à la liste d'exclusion déjà utilisée par /dashboard et /admin
// (shells autonomes avec leur propre chrome). Ce test verrouille cette
// liste d'exclusion pour empêcher toute régression silencieuse.

const usePathnameMock = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock('../../lib/components/layout/Header', () => ({
  default: () => <div data-testid="global-header">Header</div>,
}));
vi.mock('../../lib/components/layout/Footer', () => ({
  default: () => <div data-testid="global-footer">Footer</div>,
}));
vi.mock('../../lib/components/CookieBanner', () => ({
  default: () => null,
}));

describe('ClientLayout — exclusion du header/footer global', () => {
  test.each([
    ['/mes-biens'],
    ['/mes-biens/visites'],
    ['/mes-hotels'],
    ['/mes-hotels/reservations'],
    ['/mes-hebergements'],
    ['/mon-espace-proprietaire'],
    ['/dashboard'],
    ['/admin'],
  ])('n\'affiche PAS le header/footer global sur %s', (pathname) => {
    usePathnameMock.mockReturnValue(pathname);
    render(<ClientLayout><div>contenu</div></ClientLayout>);
    expect(screen.queryByTestId('global-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('global-footer')).not.toBeInTheDocument();
  });

  test.each([
    ['/'],
    ['/properties'],
    ['/mon-espace'],
    ['/login'],
  ])('affiche le header/footer global sur %s (routes publiques)', (pathname) => {
    usePathnameMock.mockReturnValue(pathname);
    render(<ClientLayout><div>contenu</div></ClientLayout>);
    expect(screen.getByTestId('global-header')).toBeInTheDocument();
    expect(screen.getByTestId('global-footer')).toBeInTheDocument();
  });
});
