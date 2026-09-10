// DASHBOARD-SIDEBAR-STICKY-ACTIONS-1 — "Accueil du site" et "Déconnexion"
// doivent rester ancrés en bas de la sidebar : la zone centrale <nav> scrolle,
// le footer <div> ne fait PAS partie de cette zone scrollable.

import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard',
}));
vi.mock('../hooks/useDashboardBadges', () => ({ useDashboardBadges: () => ({ badges: {} }) }));

const can = () => true;
vi.doMock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { _id: 'U', role: 'Admin', name: 'Admin', capabilities: ['*'] },
    logout: vi.fn(), isCollaborateur: false, activeWrites: {}, timeLeft: () => 0, can,
  }),
}));
vi.doMock('../context/PlatformTenantRuntimeContext', () => ({
  usePlatformTenantRuntime: () => ({ tenantReady: true, tenantRequired: false, selectedTenantId: null, can }),
}));

describe('AdminDashboard sidebar — footer ancré, nav scrollable', () => {
  test('"Accueil du site" et "Déconnexion" sont dans un footer hors de la zone scrollable', async () => {
    const { default: Dashboard } = await import('../pages/dashboard/AdminDashboard');
    render(<Dashboard><p>CONTENU</p></Dashboard>);

    const accueil = screen.getByRole('button', { name: /Accueil du site/i });
    const deconnexion = screen.getByRole('button', { name: /Déconnexion/i });
    const nav = document.querySelector('aside > nav');

    // Le footer n'est pas contenu dans la zone scrollable <nav>.
    expect(nav.contains(accueil)).toBe(false);
    expect(nav.contains(deconnexion)).toBe(false);

    // Le footer est un enfant direct de <aside>, comme la zone scrollable — même parent.
    const aside = nav.closest('aside');
    expect(aside).not.toBeNull();
    expect(aside.contains(accueil)).toBe(true);
    expect(aside.contains(deconnexion)).toBe(true);
  });

  test('La zone centrale <nav> est le seul conteneur avec overflow-y-auto ; elle prend l\'espace restant (flex-1 min-h-0)', async () => {
    const { default: Dashboard } = await import('../pages/dashboard/AdminDashboard');
    render(<Dashboard><p>CONTENU</p></Dashboard>);

    const nav = document.querySelector('aside > nav');
    expect(nav.className).toMatch(/overflow-y-auto/);
    expect(nav.className).toMatch(/flex-1/);
    expect(nav.className).toMatch(/min-h-0/);

    // L'aside utilise une colonne flex : la sidebar occupe la hauteur disponible.
    const aside = nav.closest('aside');
    expect(aside.className).toMatch(/flex-col/);
    // Pas de justify-between (qui rendrait la zone centrale non expansible et
    // laisserait la nav pousser le footer hors du viewport quand elle overflow).
    expect(aside.className).not.toMatch(/justify-between/);

    // Le footer contenant les 2 actions ne scrolle pas (flex-shrink-0).
    const footer = screen.getByRole('button', { name: /Déconnexion/i }).parentElement;
    expect(footer.className).toMatch(/flex-shrink-0/);
  });

  test('Le handler de logout et la route Accueil du site sont conservés', async () => {
    const { default: Dashboard } = await import('../pages/dashboard/AdminDashboard');
    render(<Dashboard><p>CONTENU</p></Dashboard>);
    // Les deux actions sont bien des <button> (pas des <a>), pattern d'origine.
    expect(screen.getByRole('button', { name: /Accueil du site/i }).tagName).toBe('BUTTON');
    expect(screen.getByRole('button', { name: /Déconnexion/i }).tagName).toBe('BUTTON');
  });
});
