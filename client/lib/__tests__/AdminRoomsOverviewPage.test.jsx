import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminRoomsOverviewPage from '../pages/dashboard/AdminRoomsOverviewPage';
import { getHotelsAdmin, getRooms } from '../services/hotelService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/hotelService', () => ({
  getHotelsAdmin: vi.fn(),
  getRooms: vi.fn(),
}));

describe('AdminRoomsOverviewPage — Sprint D (mission §18, vue globale) — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getHotelsAdmin.mockResolvedValue({ hotels: [{ _id: 'HOTEL-1', name: 'Hôtel A' }, { _id: 'HOTEL-2', name: 'Hôtel B' }] });
    getRooms.mockImplementation((hotelId) => {
      if (hotelId === 'HOTEL-1') return Promise.resolve([{ _id: 'R1', roomNumber: '101', floor: 1, status: 'available', roomCategory: { name: 'Standard' } }]);
      return Promise.resolve([{ _id: 'R2', roomNumber: '201', floor: 2, status: 'occupied', roomCategory: { name: 'Suite' } }]);
    });
  });

  test('agrège les chambres de tous les hôtels avec des compteurs par statut', async () => {
    render(<AdminRoomsOverviewPage />);
    expect(await screen.findByText('101')).toBeInTheDocument();
    expect(screen.getByText('201')).toBeInTheDocument();
    expect(screen.getByText('Hôtel A')).toBeInTheDocument();
    expect(screen.getByText('Hôtel B')).toBeInTheDocument();
  });

  test('cliquer sur un compteur de statut filtre la liste', async () => {
    render(<AdminRoomsOverviewPage />);
    await screen.findByText('101');
    const occupiedCount = screen.getAllByText('Occupée')[0].closest('button');
    fireEvent.click(occupiedCount);
    await waitFor(() => expect(screen.queryByText('101')).not.toBeInTheDocument());
    expect(screen.getByText('201')).toBeInTheDocument();
  });
});
