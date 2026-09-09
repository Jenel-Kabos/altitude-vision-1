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

describe('PropertyCard — PHASE-HW1 §18 (routage Hotel-backed)', () => {
  test('un bien adossé à un Hotel publié route vers /immobilier/hotels/:hotelId (jamais Property._id)', () => {
    render(<PropertyCard property={{ ...baseProperty, status: 'hebergement', accommodationType: 'hotel', hotel: 'HOTEL-ID-1' }} />);
    const link = screen.getByText('TEST DATA HOUSE').closest('a');
    expect(link).toHaveAttribute('href', '/immobilier/hotels/HOTEL-ID-1');
  });

  test('un bien adossé à un Hotel affiche le badge "Hôtel"', () => {
    render(<PropertyCard property={{ ...baseProperty, status: 'hebergement', accommodationType: 'hotel', hotel: 'HOTEL-ID-1' }} />);
    expect(screen.getByText('Hôtel')).toBeInTheDocument();
  });

  test('un Hotel affiche au plus trois points forts canoniques et le compteur restant', () => {
    render(<PropertyCard property={{ ...baseProperty, status: 'hebergement', accommodationType: 'hotel', hotel: 'HOTEL-ID-1', hotelServices: { restaurant: true, bar: true, piscine: true, spa: true, wifi: true } }} />);
    expect(screen.getByText('Restaurant')).toBeInTheDocument();
    expect(screen.getByText('Bar')).toBeInTheDocument();
    expect(screen.getByText('Piscine')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.queryByText('Spa')).not.toBeInTheDocument();
  });

  test('un Hotel sans point fort ne rend aucune zone vide', () => {
    render(<PropertyCard property={{ ...baseProperty, status: 'hebergement', accommodationType: 'hotel', hotel: 'HOTEL-ID-1', hotelServices: {} }} />);
    expect(screen.queryByLabelText('Points forts de l’hôtel')).not.toBeInTheDocument();
  });

  test('une Vente ne transforme jamais ses commodités en points forts Hotel', () => {
    render(<PropertyCard property={{ ...baseProperty, status: 'vente', amenities: ['Piscine'], hotelServices: { restaurant: true } }} />);
    expect(screen.getByText('Piscine')).toBeInTheDocument();
    expect(screen.queryByText('Restaurant')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Points forts de l’hôtel')).not.toBeInTheDocument();
  });

  test('un hébergement non-hôtel (meublé indépendant) route toujours vers /immobilier/property/:id (non-régression)', () => {
    render(<PropertyCard property={{ ...baseProperty, status: 'hebergement', accommodationType: 'appartement_meuble', hotel: null, accommodation: { rates: [] } }} />);
    const link = screen.getByText('TEST DATA HOUSE').closest('a');
    expect(link).toHaveAttribute('href', '/immobilier/property/TEST-DATA-PROPERTY');
    expect(screen.getByText('Hébergement')).toBeInTheDocument();
  });

  test('accommodationType "hotel" sans hotel réel (donnée incohérente) ne bascule jamais le routage (jamais un lien vers /immobilier/hotels/undefined)', () => {
    render(<PropertyCard property={{ ...baseProperty, status: 'hebergement', accommodationType: 'hotel', hotel: null }} />);
    const link = screen.getByText('TEST DATA HOUSE').closest('a');
    expect(link).toHaveAttribute('href', '/immobilier/property/TEST-DATA-PROPERTY');
  });
});
