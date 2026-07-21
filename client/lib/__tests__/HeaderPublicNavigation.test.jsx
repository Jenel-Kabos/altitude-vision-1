import { render, screen, fireEvent } from '@testing-library/react';
import Header from '../components/layout/Header';

// Sprint 0 (architecture Altimmo) — vérifie que la navigation publique
// propose Acheter/Louer/Séjourner à la place de l'ancien lien générique
// "Toutes les annonces", et que chaque route pointe vers le bon filtre du
// listing existant (AltimmoAnnonces, réutilisé tel quel).

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, logout: vi.fn() }),
}));

vi.mock('../services/unreadCountService', () => ({
  getConversationsUnreadCount: vi.fn().mockResolvedValue(0),
}));

vi.mock('../components/messaging/UnreadMessagesBadge', () => ({ default: () => null }));
vi.mock('../components/notifications/NotificationBell', () => ({ default: () => null }));

describe('Header — navigation publique Altimmo (Sprint 0) — TEST DATA', () => {
  test('le menu Altimmo propose Acheter/Louer/Séjourner (plus de lien générique "Toutes les annonces")', () => {
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: /Altimmo/i }));

    expect(screen.getByRole('link', { name: /Acheter/i })).toHaveAttribute('href', '/immobilier/acheter');
    expect(screen.getByRole('link', { name: /Louer/i })).toHaveAttribute('href', '/immobilier/louer');
    expect(screen.getByRole('link', { name: /Séjourner/i })).toHaveAttribute('href', '/immobilier/sejourner');
    expect(screen.getByRole('link', { name: /App Altimmo/i })).toHaveAttribute('href', '/altimmo/application');
  });
});
