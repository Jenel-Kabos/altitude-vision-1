import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OwnerDashboard from '../pages/dashboard/OwnerDashboard';
import { getOwnerVisitesUnreadCount } from '../services/visiteService';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
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
    pushMock.mockReset();
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
    expect(screen.getByRole('link', { name: 'Vue du patrimoine' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('Nouveaux rendez-vous :')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mes messages' })).toHaveAttribute('href', '/messages');
    expect(screen.getByRole('link', { name: 'Sécurité' })).toHaveAttribute('href', '/mes-biens/securite');
    await waitFor(() => expect(getOwnerVisitesUnreadCount).toHaveBeenCalled());
  });

  test('un utilisateur portant les deux profils voit un seul contexte à la fois et peut basculer explicitement', async () => {
    getOwnerVisitesUnreadCount.mockResolvedValue(0);
    render(<OwnerDashboard><p>CONTENU PROPRIETAIRE</p></OwnerDashboard>);

    expect(screen.getByText('Mon patrimoine')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Biens en vente' })).toHaveAttribute('href', '/mes-biens?status=vente');
    expect(screen.getByRole('link', { name: 'Biens en location' })).toHaveAttribute('href', '/mes-biens?status=location');
    expect(screen.queryByRole('link', { name: 'Mes établissements' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mes paiements' })).toHaveAttribute('href', '/mes-biens/paiements');
    fireEvent.change(screen.getByRole('combobox', { name: 'Espace de travail' }), { target: { value: 'etablissement' } });
    expect(pushMock).toHaveBeenCalledWith('/mes-hotels');
  });

  test('un utilisateur avec uniquement le profil immobilier ne voit pas les liens établissement', async () => {
    mockAuth = { ...mockAuth, businessProfiles: ['proprietaire_immobilier'], isProprietaireImmobilier: true, isExploitantEtablissement: false };
    getOwnerVisitesUnreadCount.mockResolvedValue(0);
    render(<OwnerDashboard><p>CONTENU PROPRIETAIRE</p></OwnerDashboard>);

    expect(screen.getByRole('link', { name: 'Biens en vente' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Biens en location' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Hébergements' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mes établissements' })).not.toBeInTheDocument();
    // Les liens communs restent visibles quel que soit le profil.
    expect(screen.getByRole('link', { name: 'Mes messages' })).toBeInTheDocument();
  });

  test('un utilisateur avec uniquement le profil établissement ne voit pas les liens immobiliers', async () => {
    mockAuth = { ...mockAuth, businessProfiles: ['exploitant_etablissement'], isProprietaireImmobilier: false, isExploitantEtablissement: true };
    getOwnerVisitesUnreadCount.mockResolvedValue(0);
    render(<OwnerDashboard><p>CONTENU PROPRIETAIRE</p></OwnerDashboard>);

    expect(screen.getByRole('link', { name: 'Mes établissements' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hébergements' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Biens en vente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Biens en location' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Vue du patrimoine' })).not.toBeInTheDocument();
  });

  test('un utilisateur sans aucun profil métier ne voit que les liens communs', async () => {
    mockAuth = { ...mockAuth, businessProfiles: [], isProprietaireImmobilier: false, isExploitantEtablissement: false };
    getOwnerVisitesUnreadCount.mockResolvedValue(0);
    render(<OwnerDashboard><p>CONTENU PROPRIETAIRE</p></OwnerDashboard>);

    expect(screen.queryByRole('link', { name: 'Vue du patrimoine' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mes établissements' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mes messages' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mon profil' })).toBeInTheDocument();
  });

  test('tant que businessProfiles est null (chargement), tous les liens restent visibles (pas de flash de menu amputé)', async () => {
    mockAuth = { ...mockAuth, businessProfiles: null, isProprietaireImmobilier: false, isExploitantEtablissement: false };
    getOwnerVisitesUnreadCount.mockResolvedValue(0);
    render(<OwnerDashboard><p>CONTENU PROPRIETAIRE</p></OwnerDashboard>);

    expect(screen.getByRole('link', { name: 'Vue du patrimoine' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mes établissements' })).toBeInTheDocument();
  });
});
