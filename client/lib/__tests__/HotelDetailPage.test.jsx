import { render, screen, waitFor } from '@testing-library/react';
import HotelDetailPage from '../pages/dashboard/HotelDetailPage';
import { getHotelDetail } from '../services/hotelService';
import { getDashboardAnalytics } from '../services/dashboardAnalyticsService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useParams: () => ({ hotelId: 'HOTEL-1' }), usePathname: () => '/dashboard/hotels/HOTEL-1', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../services/hotelService', () => ({
  getHotelDetail: vi.fn(),
  getHotelPortfolioDetail: vi.fn(),
  submitHotel: vi.fn(),
  deactivateHotel: vi.fn(),
  reactivateHotel: vi.fn(),
  duplicateHotel: vi.fn(),
  deleteHotel: vi.fn(),
}));
vi.mock('../services/dashboardAnalyticsService', () => ({ getDashboardAnalytics: vi.fn() }));

const hotel = (overrides = {}) => ({
  _id: 'HOTEL-1', name: 'Hôtel Test', publicationStatus: 'publie', active: true,
  property: { address: { city: 'Kinshasa' } },
  ...overrides,
});

describe('HotelDetailPage — DASH-3 today board — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getHotelDetail.mockResolvedValue({ hotel: hotel(), completion: { score: 100, complete: true } });
    getDashboardAnalytics.mockResolvedValue({ kpis: { totalRooms: 6, occupiedRooms: 1, cleaningRooms: 1, inspectionRooms: 1, outOfServiceRooms: 1, checkInsToday: 2, pendingCheckIns: 1, checkOutsToday: 1, pendingCheckOuts: 1, housekeeping: 2, maintenance: 1, remainingAmount: 5000 } });
  });

  test('affiche un cockpit quotidien issu d’une seule agrégation sélectionnée', async () => {
    render(<HotelDetailPage />);
    await screen.findByText('Hôtel Test');
    await waitFor(() => expect(getDashboardAnalytics).toHaveBeenCalledWith('hotels', { hotelId: 'HOTEL-1' }));
    expect(screen.getByText('Aujourd’hui')).toBeInTheDocument();
    expect(screen.getByText('Occupation')).toBeInTheDocument();
    expect(screen.getByText('Arrivées aujourd’hui')).toBeInTheDocument();
    expect(screen.getByText('À nettoyer')).toBeInTheDocument();
    expect(screen.getByText('Alertes financières')).toBeInTheDocument();
  });

  test('affiche des zéros fiables quand l’établissement est vide', async () => {
    getDashboardAnalytics.mockResolvedValue({ kpis: {} });
    render(<HotelDetailPage />);
    await screen.findByText('Hôtel Test');
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  test('une panne analytics n’empêche pas l’affichage de la fiche hôtel', async () => {
    getDashboardAnalytics.mockRejectedValue(new Error('network'));
    render(<HotelDetailPage />);
    expect(await screen.findByText('Hôtel Test')).toBeInTheDocument();
    expect(await screen.findByText('Indicateurs opérationnels indisponibles')).toBeInTheDocument();
  });
});
