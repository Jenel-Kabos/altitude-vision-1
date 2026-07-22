import { render, screen, waitFor } from '@testing-library/react';
import HotelDetailPage from '../pages/dashboard/HotelDetailPage';
import { getHotelDetail, getRooms } from '../services/hotelService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useParams: () => ({ hotelId: 'HOTEL-1' }) }));
vi.mock('../services/hotelService', () => ({
  getHotelDetail: vi.fn(),
  submitHotel: vi.fn(),
  deactivateHotel: vi.fn(),
  reactivateHotel: vi.fn(),
  duplicateHotel: vi.fn(),
  deleteHotel: vi.fn(),
  getRooms: vi.fn(),
}));

const hotel = (overrides = {}) => ({
  _id: 'HOTEL-1', name: 'Hôtel Test', publicationStatus: 'publie', active: true,
  property: { address: { city: 'Kinshasa' } },
  ...overrides,
});

describe('HotelDetailPage — Sprint E §12 (compteurs de statut des chambres) — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getHotelDetail.mockResolvedValue({ hotel: hotel(), completion: { score: 100, complete: true } });
  });

  test('affiche les compteurs disponibles/occupées/nettoyage/inspection/hors service', async () => {
    getRooms.mockResolvedValue([
      { _id: 'R1', status: 'available' }, { _id: 'R2', status: 'available' },
      { _id: 'R3', status: 'occupied' }, { _id: 'R4', status: 'cleaning' },
      { _id: 'R5', status: 'inspection' }, { _id: 'R6', status: 'out_of_service' },
    ]);
    render(<HotelDetailPage />);
    await screen.findByText('Hôtel Test');
    await waitFor(() => expect(getRooms).toHaveBeenCalledWith('HOTEL-1'));
    expect(await screen.findByText('2')).toBeInTheDocument(); // available
    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.getByText('Occupée')).toBeInTheDocument();
    expect(screen.getByText('Nettoyage')).toBeInTheDocument();
    expect(screen.getByText('Inspection')).toBeInTheDocument();
    expect(screen.getByText('Hors service')).toBeInTheDocument();
  });

  test('n\'affiche pas les compteurs si aucune chambre (silencieux, pas bloquant)', async () => {
    getRooms.mockResolvedValue([]);
    render(<HotelDetailPage />);
    await screen.findByText('Hôtel Test');
    await waitFor(() => expect(getRooms).toHaveBeenCalled());
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  test('erreur de chargement des chambres n\'empêche pas l\'affichage de la fiche hôtel', async () => {
    getRooms.mockRejectedValue(new Error('network'));
    render(<HotelDetailPage />);
    expect(await screen.findByText('Hôtel Test')).toBeInTheDocument();
  });
});
