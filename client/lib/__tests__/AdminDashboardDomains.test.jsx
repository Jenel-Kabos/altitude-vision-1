import { render, screen } from '@testing-library/react';

// Sprint 0 (architecture Altimmo) — vérifie la réorganisation de la
// navigation admin en domaines métier (Immobilier / Gestion locative /
// Hôtellerie) et l'harmonisation des permissions de modération.

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard',
}));

vi.mock('../hooks/useDashboardBadges', () => ({ useDashboardBadges: () => ({ badges: {} }) }));

// RBAC-3 — mêmes capacités que server/utils/iamArchitecture.js
// (DEFAULT_CAPABILITIES), parité prouvée en RBAC-2/RBAC-3.
const CAPABILITIES_BY_ROLE = {
  Admin: ['*'],
  Collaborateur: ['legacy.full'],
  Secretaire: ['documents.read', 'documents.manage', 'payments.read', 'payments.manage', 'clients.read', 'owners.read', 'tenants.read', 'leases.read', 'properties.read'],
  GestionnaireImmobilier: ['properties.read', 'properties.create', 'properties.update', 'owners.read', 'tenants.read', 'tenants.manage', 'visits.read', 'visits.manage', 'rental.read', 'rental.manage', 'leases.read', 'leases.manage', 'maintenance.read', 'maintenance.manage', 'notice.read', 'notice.manage', 'occupancy.read', 'occupancy.manage', 'payment.status'],
  CommunityManager: ['altcom.read', 'altcom.manage', 'events.read', 'events.manage', 'media.read', 'media.manage'],
  Communicant: ['messages.read', 'messages.manage', 'visits.read'],
};

const renderAsRole = (role, explicitCapabilities) => {
  const capabilities = explicitCapabilities || CAPABILITIES_BY_ROLE[role] || [];
  const can = (capability) => capability === 'platform.tenant_applications.read'
    ? capabilities.includes(capability)
    : capabilities.includes('*') || capabilities.includes('legacy.full') || capabilities.includes(capability);
  vi.doMock('../context/AuthContext', () => ({
    useAuth: () => ({
      user: { _id: 'TEST-USER', role, name: 'TEST USER', capabilities },
      logout: vi.fn(), isCollaborateur: false, activeWrites: {}, timeLeft: () => 0, can,
    }),
  }));
  // PLATFORM-ADMIN-CAP-1 — le nav filtre désormais via le `can` composé de
  // PlatformTenantRuntimeContext (rôle + capacité PlatformOperator active),
  // jamais via useAuth().can seul, pour éviter deux systèmes de capacités.
  vi.doMock('../context/PlatformTenantRuntimeContext', () => ({
    usePlatformTenantRuntime: () => ({ tenantReady: true, tenantRequired: false, selectedTenantId: null, can }),
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

  test("IAM-3 — CommunityManager ne voit que ses domaines communication, sans Immobilier/Hôtellerie/GL", async () => {
    renderAsRole('CommunityManager');
    const { default: Dashboard } = await import('../pages/dashboard/AdminDashboard');
    render(<Dashboard><p>CONTENU</p></Dashboard>);

    expect(screen.queryByText('Immobilier')).not.toBeInTheDocument();
    expect(screen.queryByText('Hôtellerie')).not.toBeInTheDocument();
    expect(screen.queryByText('Gestion locative')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mila Events/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Altcom$/i })).toBeInTheDocument();
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

  test('DASH-01..06 — seule la capacité opérateur read affiche les activations professionnelles', async () => {
    renderAsRole('Admin', ['platform.tenant_applications.read']);
    const { default: Dashboard } = await import('../pages/dashboard/AdminDashboard');
    const { unmount } = render(<Dashboard><p>CONTENU</p></Dashboard>);
    expect(screen.getByRole('link', { name: 'Activations professionnelles' })).toHaveAttribute('href', '/dashboard/activations-professionnelles');
    unmount();

    for (const role of ['Admin', 'Collaborateur', 'CommunityManager', 'Proprietaire', 'Client']) {
      vi.resetModules();
      renderAsRole(role, []);
      const { default: RestrictedDashboard } = await import('../pages/dashboard/AdminDashboard');
      const view = render(<RestrictedDashboard><p>CONTENU</p></RestrictedDashboard>);
      expect(screen.queryByRole('link', { name: 'Activations professionnelles' })).not.toBeInTheDocument();
      view.unmount();
    }
  });
});
