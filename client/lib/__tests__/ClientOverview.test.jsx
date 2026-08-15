import { render, screen } from '@testing-library/react';
import ClientOverview from '../pages/dashboard/ClientOverview';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { _id: 'CLIENT-1', role: 'Client', name: 'Alice Client' },
    loading: false,
    businessProfiles: ['locataire'],
    isLocataireProfile: true,
  }),
}));

describe('ClientOverview', () => {
  test('réunit les parcours Client et expose le portail locataire conditionnel', () => {
    render(<ClientOverview />);
    expect(screen.getByRole('heading', { name: /Bonjour Alice/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Favoris/i })).toHaveAttribute('href', '/favoris');
    expect(screen.getByRole('link', { name: /Mes visites/i })).toHaveAttribute('href', '/mes-visites');
    expect(screen.getByRole('link', { name: /Mes séjours/i })).toHaveAttribute('href', '/mes-reservations-hotel');
    expect(screen.getByRole('link', { name: /Ouvrir l’espace locataire/i })).toHaveAttribute('href', '/espace-locataire');
  });
});
