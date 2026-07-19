import { render, screen } from '@testing-library/react';
import PropertyCard from '../components/PropertyCard';

vi.mock('../components/likes/LikeButton', () => ({ default: () => <div>TEST DATA LIKE</div> }));

const baseProperty = {
  _id: 'TEST-DATA-PROPERTY', title: 'TEST DATA HOUSE', description: 'TEST DATA DESC',
  images: [], amenities: [], address: { city: 'TEST DATA CITY' }, price: 30000000,
  createdAt: '2030-01-01T00:00:00.000Z',
};

describe('PropertyCard — badge de transaction', () => {
  test('affiche le badge Hébergement et le tarif au format "/ nuit" quand un tarif nightly existe', () => {
    render(<PropertyCard property={{
      ...baseProperty,
      status: 'hebergement',
      accommodation: { rates: [{ mode: 'nightly', amount: 35000 }] },
    }} />);
    expect(screen.getByText('Hébergement')).toBeInTheDocument();
    expect(screen.getByText('/ nuit')).toBeInTheDocument();
  });

  test('un bien Vente affiche toujours le badge Vente et FCFA (non-régression)', () => {
    render(<PropertyCard property={{ ...baseProperty, status: 'vente' }} />);
    expect(screen.getByText('Vente')).toBeInTheDocument();
    expect(screen.getByText('FCFA')).toBeInTheDocument();
  });

  test('un bien Location affiche toujours le badge Location (non-régression)', () => {
    render(<PropertyCard property={{ ...baseProperty, status: 'location' }} />);
    expect(screen.getByText('Location')).toBeInTheDocument();
  });
});
