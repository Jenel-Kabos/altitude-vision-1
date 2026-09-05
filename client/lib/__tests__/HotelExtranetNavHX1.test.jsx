import { render, screen } from '@testing-library/react';
import HotelExtranetNav from '../components/dashboard/HotelExtranetNav';

let currentPath = '/mes-hotels/hotel-1';
vi.mock('next/navigation', () => ({ usePathname: () => currentPath }));
vi.mock('next/link', () => ({ default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a> }));

describe('HotelExtranetNav — PHASE-HX1 §4-5', () => {
  test('affiche le contexte hôtel (nom, statut, ville, étoiles)', () => {
    render(<HotelExtranetNav hotelId="hotel-1" hotel={{ name: 'Altitude Palace', publicationStatus: 'publie', starRating: 4, property: { address: { city: 'Brazzaville' } } }} />);
    expect(screen.getByText('Altitude Palace')).toBeInTheDocument();
    expect(screen.getByText('Publié')).toBeInTheDocument();
    expect(screen.getByText('4 étoile(s)')).toBeInTheDocument();
    expect(screen.getByText('Brazzaville')).toBeInTheDocument();
  });

  test('expose tous les onglets de la structure cible', () => {
    render(<HotelExtranetNav hotelId="hotel-1" hotel={null} />);
    ["Vue d'ensemble", "Établissement", "Chambres", "Tarifs", "Disponibilités", "Réservations", "Avis clients", "FAQ"].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  test('marque l’onglet actif selon le chemin courant', () => {
    currentPath = '/mes-hotels/hotel-1/rates';
    render(<HotelExtranetNav hotelId="hotel-1" hotel={null} />);
    expect(screen.getByText('Tarifs').closest('a')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Chambres').closest('a')).not.toHaveAttribute('aria-current');
  });

  test('les liens pointent vers les routes existantes de l’établissement', () => {
    currentPath = '/mes-hotels/hotel-1';
    render(<HotelExtranetNav hotelId="hotel-1" hotel={null} />);
    expect(screen.getByText('Chambres').closest('a')).toHaveAttribute('href', '/mes-hotels/hotel-1/room-categories');
    expect(screen.getByText('Disponibilités').closest('a')).toHaveAttribute('href', '/mes-hotels/hotel-1/inventory');
    expect(screen.getByText('Réservations').closest('a')).toHaveAttribute('href', '/mes-hotels/reservations?hotelId=hotel-1');
  });
});
