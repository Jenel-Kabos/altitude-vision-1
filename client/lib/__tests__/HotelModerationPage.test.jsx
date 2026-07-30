import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HotelModerationPage from '../pages/dashboard/HotelModerationPage';
import { getPendingHotels, reviewHotel } from '../services/hotelService';

vi.mock('../utils/toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/hotelService', () => ({ getPendingHotels: vi.fn(), reviewHotel: vi.fn() }));

describe('HotelModerationPage — versions sensibles proposées', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPendingHotels.mockResolvedValue([{
      _id: 'HOTEL-1', name: 'Nom publié', starRating: 4,
      property: { title: 'Nom publié', address: { city: 'Brazzaville' }, images: [] },
      categories: [], hotelServices: {},
      proposedVersion: { status: 'pending', hotelChanges: { name: 'Nom proposé' }, propertyChanges: { address: { city: 'Pointe-Noire' } } },
    }]);
    reviewHotel.mockResolvedValue({});
  });

  test('compare la proposition en rappelant que la version publiée reste active', async () => {
    render(<HotelModerationPage />);
    expect(await screen.findByText('Modification sensible proposée')).toBeInTheDocument();
    expect(screen.getByText(/version actuellement publiée reste exploitée/i)).toBeInTheDocument();
    expect(screen.getByText(/Nom proposé/)).toBeInTheDocument();
    expect(screen.getByText(/Pointe-Noire/)).toBeInTheDocument();
  });

  test('valide la proposition uniquement depuis Modération Hôtellerie', async () => {
    render(<HotelModerationPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Valider' }));
    await waitFor(() => expect(reviewHotel).toHaveBeenCalledWith('HOTEL-1', 'validate'));
  });
});
