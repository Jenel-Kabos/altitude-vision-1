import { render, screen, fireEvent } from '@testing-library/react';
import Header from '../components/layout/Header';

// Sprint 0 (architecture Altimmo) — vérifie que la navigation publique
// propose Immobilier/Acheter/Louer/Séjourner/App Altimmo dans le menu déroulant "Altimmo",
// que chaque route pointe vers le bon filtre du listing existant (AltimmoAnnonces), et que
// le clic ferme le menu (correctif ajout lien "Immobilier", nomenclature canonique offerType).

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

describe('Header — menu déroulant Altimmo', () => {
  test('propose Immobilier en premier, puis Acheter/Louer/Séjourner/App Altimmo', () => {
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: /Altimmo/i }));

    const links = screen.getAllByRole('link', { name: /Immobilier|Acheter|Louer|Séjourner|App Altimmo/i });
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toEqual([
      '/immobilier',
      '/immobilier/annonces?offerType=vente',
      '/immobilier/annonces?offerType=location',
      '/immobilier/sejourner',
      '/altimmo/application',
    ]);
  });

  test('Immobilier pointe vers /immobilier', () => {
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: /Altimmo/i }));
    expect(screen.getByRole('link', { name: /Immobilier/i })).toHaveAttribute('href', '/immobilier');
  });

  test('les trois offres pointent vers le listing filtré avec la nomenclature canonique offerType', () => {
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: /Altimmo/i }));

    expect(screen.getByRole('link', { name: /Acheter/i })).toHaveAttribute('href', '/immobilier/annonces?offerType=vente');
    expect(screen.getByRole('link', { name: /Louer/i })).toHaveAttribute('href', '/immobilier/annonces?offerType=location');
    expect(screen.getByRole('link', { name: /Séjourner/i })).toHaveAttribute('href', '/immobilier/sejourner');
    expect(screen.getByRole('link', { name: /App Altimmo/i })).toHaveAttribute('href', '/altimmo/application');
  });

  test('un clic sur une entrée ferme le menu déroulant (desktop)', () => {
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: /Altimmo/i }));
    expect(screen.getByRole('link', { name: /Immobilier/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /Immobilier/i }));

    expect(screen.queryByRole('link', { name: /Immobilier/i })).not.toBeInTheDocument();
  });
});
