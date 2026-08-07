import { render, screen, waitFor } from '@testing-library/react';
import OwnerDashboard from '../pages/dashboard/OwnerDashboard';
import { getOwnerVisitesUnreadCount } from '../services/visiteService';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/mes-biens',
}));

// USER-ARCH-UX-1 (Phase 2) — remplace le mock implicite (role: 'Proprietaire'
// seul) par un mock explicite des profils métiers effectifs, seule source de
// vérité désormais utilisée par OwnerDashboard pour filtrer sa navigation.
let mockAuth = {};
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../services/visiteService', () => ({ getOwnerVisitesUnreadCount: vi.fn() }));

const baseUser = { _id: 'TEST-OWNER', name: 'OWNER TEST', role: 'Proprietaire' };

describe('Navigation propriétaire', () => {
  beforeEach(() => {
    mockAuth = {
      user: baseUser,
      logout: vi.fn(),
      businessProfiles: ['proprietaire_immobilier', 'exploitant_etablissement'],
      isProprietaireImmobilier: true,
      isExploitantEtablissement: true,
    };
  });

  test('expose Rendez-vous, son badge, la messagerie et la route de sécurité réelle (liens communs, tout profil)', async () => {
    getOwnerVisitesUnreadCount.mockResolvedValue(3);
    render(<OwnerDashboard><p>CONTENU PROPRIETAIRE</p></OwnerDashboard>);

    const visits = screen.getByRole('link', { name: /Mes rendez-vous/i });
    expect(visits).toHaveAttribute('href', '/mes-biens/visites');
    expect(visits).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Toutes mes annonces' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('Nouveaux rendez-vous :')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mes messages' })).toHaveAttribute('href', '/messages');
    expect(screen.getByRole('link', { name: 'Sécurité' })).toHaveAttribute('href', '/mes-biens/securite');
    await waitFor(() => expect(getOwnerVisitesUnreadCount).toHaveBeenCalled());
  });

  test('un utilisateur portant les deux profils voit ses annonces immobilières ET ses établissements', async () => {
    getOwnerVisitesUnreadCount.mockResolvedValue(0);
    render(<OwnerDashboard><p>CONTENU PROPRIETAIRE</p></OwnerDashboard>);

    expect(screen.getByText('Mes annonces')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vente' })).toHaveAttribute('href', '/mes-biens?status=vente');
    expect(screen.getByRole('link', { name: 'Location' })).toHaveAttribute('href', '/mes-biens?status=location');
    expect(screen.getByRole('link', { name: 'Hébergement' })).toHaveAttribute('href', '/mes-hebergements');
    expect(screen.getByRole('link', { name: 'Mes hôtels' })).toHaveAttribute('href', '/mes-hotels');
    expect(screen.getByRole('link', { name: 'Mes paiements' })).toHaveAttribute('href', '/mes-biens/paiements');
  });

  test('un utilisateur avec uniquement le profil immobilier ne voit pas les liens établissement', async () => {
    mockAuth = { ...mockAuth, businessProfiles: ['proprietaire_immobilier'], isProprietaireImmobilier: true, isExploitantEtablissement: false };
    getOwnerVisitesUnreadCount.mockResolvedValue(0);
    render(<OwnerDashboard><p>CONTENU PROPRIETAIRE</p></OwnerDashboard>);

    expect(screen.getByRole('link', { name: 'Vente' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Location' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Hébergement' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mes hôtels' })).not.toBeInTheDocument();
    // Les liens communs restent visibles quel que soit le profil.
    expect(screen.getByRole('link', { name: 'Mes messages' })).toBeInTheDocument();
  });

  test('un utilisateur avec uniquement le profil établissement ne voit pas les liens immobiliers', async () => {
    mockAuth = { ...mockAuth, businessProfiles: ['exploitant_etablissement'], isProprietaireImmobilier: false, isExploitantEtablissement: true };
    getOwnerVisitesUnreadCount.mockResolvedValue(0);
    render(<OwnerDashboard><p>CONTENU PROPRIETAIRE</p></OwnerDashboard>);

    expect(screen.getByRole('link', { name: 'Mes hôtels' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hébergement' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Vente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Location' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Toutes mes annonces' })).not.toBeInTheDocument();
  });

  test('un utilisateur sans aucun profil métier ne voit que les liens communs', async () => {
    mockAuth = { ...mockAuth, businessProfiles: [], isProprietaireImmobilier: false, isExploitantEtablissement: false };
    getOwnerVisitesUnreadCount.mockResolvedValue(0);
    render(<OwnerDashboard><p>CONTENU PROPRIETAIRE</p></OwnerDashboard>);

    expect(screen.queryByRole('link', { name: 'Toutes mes annonces' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mes hôtels' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mes messages' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mon profil' })).toBeInTheDocument();
  });

  test('tant que businessProfiles est null (chargement), tous les liens restent visibles (pas de flash de menu amputé)', async () => {
    mockAuth = { ...mockAuth, businessProfiles: null, isProprietaireImmobilier: false, isExploitantEtablissement: false };
    getOwnerVisitesUnreadCount.mockResolvedValue(0);
    render(<OwnerDashboard><p>CONTENU PROPRIETAIRE</p></OwnerDashboard>);

    expect(screen.getByRole('link', { name: 'Toutes mes annonces' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mes hôtels' })).toBeInTheDocument();
  });
});
