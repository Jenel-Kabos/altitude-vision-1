import { render, screen } from '@testing-library/react';
import HotelEstablishmentPage from '../pages/dashboard/HotelEstablishmentPage';
import { getHotelDetail } from '../services/hotelService';

vi.mock('next/navigation', () => ({ useParams: () => ({ hotelId: 'hotel-1' }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/hotelService', () => ({ getHotelDetail: vi.fn() }));
vi.mock('../components/dashboard/HotelPropertyForm', () => ({
  default: (props) => <div data-testid="hotel-property-form" data-hotel-id={props.hotelId} data-scope={props.scope} />,
}));

describe('HotelEstablishmentPage — PHASE-HX1 §7 (réutilise HotelPropertyForm en édition)', () => {
  test('charge l’hôtel et transmet son identifiant au formulaire existant (mode édition, jamais création)', async () => {
    getHotelDetail.mockResolvedValue({ hotel: { _id: 'hotel-1', name: 'Altitude Palace', property: {} } });
    render(<HotelEstablishmentPage />);
    const form = await screen.findByTestId('hotel-property-form');
    expect(form).toHaveAttribute('data-hotel-id', 'hotel-1');
    expect(form).toHaveAttribute('data-scope', 'owner');
  });

  test('hôtel introuvable : état explicite, jamais un formulaire vide silencieux', async () => {
    getHotelDetail.mockResolvedValue({ hotel: null });
    render(<HotelEstablishmentPage />);
    expect(await screen.findByText('Établissement introuvable')).toBeInTheDocument();
  });
});
