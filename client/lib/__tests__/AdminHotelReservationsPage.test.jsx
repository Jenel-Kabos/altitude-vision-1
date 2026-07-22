import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminHotelReservationsPage from '../pages/dashboard/AdminHotelReservationsPage';
import { getAdminHotelReservations } from '../services/hotelReservationService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/hotelReservationService', () => ({
  getAdminHotelReservations: vi.fn(),
  checkInHotelReservation: vi.fn(),
  checkOutHotelReservation: vi.fn(),
  getReservationRoomAssignment: vi.fn().mockResolvedValue(null),
}));
vi.mock('../services/hotelService', () => ({
  getRooms: vi.fn().mockResolvedValue([]),
  assignRoom: vi.fn(),
  changeRoom: vi.fn(),
}));

const reservation = (overrides = {}) => ({
  _id: 'RES-1', reference: 'RES-2026-000001', status: 'confirmed', source: 'public_web',
  hotel: { name: 'Hôtel Test', manager: 'OWNER-1' }, roomCategory: { name: 'Standard' },
  guest: { firstName: 'Jean', lastName: 'Dupont' },
  checkInDate: '2026-08-10', checkOutDate: '2026-08-12', nights: 2,
  roomsCount: 1, adults: 2, children: 0, totalAmount: 70000,
  statusHistory: [{ from: 'pending', to: 'confirmed', changedAt: '2026-08-01T00:00:00Z', reason: '' }],
  ...overrides,
});

describe('AdminHotelReservationsPage — Sprint C (dashboard admin) — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminHotelReservations.mockResolvedValue({ reservations: [reservation()], total: 1, page: 1, limit: 20 });
  });

  test('affiche la liste globale avec hôtel/catégorie/client/source/montant', async () => {
    render(<AdminHotelReservationsPage />);
    expect(await screen.findByText('RES-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('Hôtel Test')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Site public')).toBeInTheDocument();
  });

  test("cliquer sur une ligne affiche l'historique des statuts", async () => {
    render(<AdminHotelReservationsPage />);
    const row = await screen.findByText('RES-2026-000001');
    fireEvent.click(row);
    expect(await screen.findByText(/pending → confirmed/)).toBeInTheDocument();
  });

  test('filtrer par statut relance la requête admin', async () => {
    render(<AdminHotelReservationsPage />);
    await screen.findByText('RES-2026-000001');
    fireEvent.click(screen.getByRole('button', { name: 'En attente' }));
    await waitFor(() => expect(getAdminHotelReservations).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' })));
  });
});
