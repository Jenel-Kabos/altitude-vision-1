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

    const visits = screen.getByRole('link', { name: /Rendez-vous/i });
    expect(visits).toHaveAttribute('href', '/mes-biens/visites');
    expect(visits).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Mes Biens' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('Nouveaux rendez-vous :')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Messagerie' })).toHaveAttribute('href', '/messages');
    expect(screen.getByRole('link', { name: 'Sécurité' })).toHaveAttribute('href', '/mes-biens/securite');
    await waitFor(() => expect(getOwnerVisitesUnreadCount).toHaveBeenCalled());
  });
});
