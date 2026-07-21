import { render, screen, waitFor } from '@testing-library/react';
import OwnerDashboard from '../pages/dashboard/OwnerDashboard';
import { getOwnerVisitesUnreadCount } from '../services/visiteService';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/mes-biens',
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'TEST-OWNER', name: 'OWNER TEST', role: 'Proprietaire' }, logout: vi.fn() }),
}));

vi.mock('../services/visiteService', () => ({ getOwnerVisitesUnreadCount: vi.fn() }));

describe('Navigation propriétaire', () => {
  test('expose Rendez-vous, son badge, la messagerie et la route de sécurité réelle', async () => {
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

  test("Sprint 0 — expose le domaine Mes annonces (Vente/Location/Hébergement), Mes hôtels et Mes paiements en préparation de navigation", async () => {
    getOwnerVisitesUnreadCount.mockResolvedValue(0);
    render(<OwnerDashboard><p>CONTENU PROPRIETAIRE</p></OwnerDashboard>);

    expect(screen.getByText('Mes annonces')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vente' })).toHaveAttribute('href', '/mes-biens?status=vente');
    expect(screen.getByRole('link', { name: 'Location' })).toHaveAttribute('href', '/mes-biens?status=location');
    expect(screen.getByRole('link', { name: 'Hébergement' })).toHaveAttribute('href', '/mes-hebergements');
    expect(screen.getByRole('link', { name: 'Mes hôtels' })).toHaveAttribute('href', '/mes-hotels');
    expect(screen.getByRole('link', { name: 'Mes paiements' })).toHaveAttribute('href', '/mes-biens/paiements');
  });
});
