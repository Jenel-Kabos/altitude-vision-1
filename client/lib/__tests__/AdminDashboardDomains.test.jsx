import { render, screen } from '@testing-library/react';
import AdminDashboard from '../pages/dashboard/AdminDashboard';

// Sprint 0 (architecture Altimmo) — vérifie la réorganisation de la
// navigation admin en domaines métier (Immobilier / Gestion locative /
// Hôtellerie) et l'harmonisation des permissions de modération.

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard',
}));

vi.mock('../hooks/useDashboardBadges', () => ({ useDashboardBadges: () => ({ badges: {} }) }));

const renderAsRole = (role) => {
  vi.doMock('../context/AuthContext', () => ({
    useAuth: () => ({
      user: { _id: 'TEST-USER', role, name: 'TEST USER' },
      logout: vi.fn(), isCollaborateur: false, activeWrites: {}, timeLeft: () => 0,
    }),
  }));
};

describe('AdminDashboard — domaines métier Altimmo (Sprint 0) — TEST DATA', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('Admin voit les 3 domaines (Immobilier, Gestion locative, Hôtellerie) avec leurs sous-liens', async () => {
    renderAsRole('Admin');
    const { default: Dashboard } = await import('../pages/dashboard/AdminDashboard');
    render(<Dashboard><p>CONTENU</p></Dashboard>);

    expect(screen.getByText('Immobilier')).toBeInTheDocument();
    expect(screen.getByText('Gestion locative')).toBeInTheDocument();
    expect(screen.getByText('Hôtellerie')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Tous les biens/i })).toHaveAttribute('href', '/dashboard/properties');
    expect(screen.getByRole('link', { name: /^Ventes$/i })).toHaveAttribute('href', '/dashboard/sales');
    expect(screen.getByRole('link', { name: /^Locations$/i })).toHaveAttribute('href', '/dashboard/rentals');
    expect(screen.getByRole('link', { name: /^Hébergements$/i })).toHaveAttribute('href', '/dashboard/hebergements');
    expect(screen.getByRole('link', { name: /Propriétaires/i })).toHaveAttribute('href', '/dashboard/proprietaires');

    expect(screen.getByRole('link', { name: /^Baux$/i })).toHaveAttribute('href', '/dashboard/gestion-locative/baux');
    expect(screen.getByRole('link', { name: /Locataires/i })).toHaveAttribute('href', '/dashboard/gestion-locative/locataires');
    expect(screen.getByRole('link', { name: /Préavis/i })).toHaveAttribute('href', '/dashboard/gestion-locative/preavis');
    expect(screen.getByRole('link', { name: /Maintenance/i })).toHaveAttribute('href', '/dashboard/gestion-locative/maintenance');

    // Sprint B2 — Catégories/Tarifs sont gérés PAR établissement (depuis sa
    // fiche), plus de lien de nav global "à plat" pour ces deux entrées.
    expect(screen.getByRole('link', { name: /Établissements/i })).toHaveAttribute('href', '/dashboard/etablissements');
  });

  test("CommunityManager voit Immobilier/Hôtellerie mais pas Gestion locative (ROLES_GL exclu) ni Modération Hébergement (harmonisé sur ROLES_MODERATION)", async () => {
    renderAsRole('CommunityManager');
    const { default: Dashboard } = await import('../pages/dashboard/AdminDashboard');
    render(<Dashboard><p>CONTENU</p></Dashboard>);

    expect(screen.getByText('Immobilier')).toBeInTheDocument();
    expect(screen.getByText('Hôtellerie')).toBeInTheDocument();
    expect(screen.queryByText('Gestion locative')).not.toBeInTheDocument();
    // Harmonisation (audit de sécurité) : "Modération Hébergement" utilisait
    // ROLES_ALTIMMO (incluait CommunityManager) — désormais ROLES_MODERATION
    // comme ses deux liens voisins, pour un périmètre cohérent.
    expect(screen.queryByText('Modération Hébergement')).not.toBeInTheDocument();
    // Sprint B2 — "Modération Hôtellerie" suit la même règle ROLES_MODERATION.
    expect(screen.queryByText('Modération Hôtellerie')).not.toBeInTheDocument();
  });

  test("GestionnaireImmobilier voit Gestion locative mais pas la section Modération", async () => {
    renderAsRole('GestionnaireImmobilier');
    const { default: Dashboard } = await import('../pages/dashboard/AdminDashboard');
    render(<Dashboard><p>CONTENU</p></Dashboard>);

    expect(screen.getByText('Gestion locative')).toBeInTheDocument();
    expect(screen.queryByText('Modération')).not.toBeInTheDocument();
  });

  test("Collaborateur (legacy) voit toujours Modération Hébergement (rôle conservé dans ROLES_MODERATION)", async () => {
    renderAsRole('Collaborateur');
    const { default: Dashboard } = await import('../pages/dashboard/AdminDashboard');
    render(<Dashboard><p>CONTENU</p></Dashboard>);

    expect(screen.getByText('Modération Hébergement')).toBeInTheDocument();
    expect(screen.getByText('Modération Hôtellerie')).toBeInTheDocument();
  });
});
