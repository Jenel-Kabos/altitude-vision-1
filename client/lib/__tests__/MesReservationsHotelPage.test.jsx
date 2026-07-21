import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import MesReservationsHotelPage from '../pages/MesReservationsHotelPage';
import { getMyHotelReservations, cancelHotelReservation } from '../services/hotelReservationService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/hotelReservationService', () => ({
  getMyHotelReservations: vi.fn(),
  cancelHotelReservation: vi.fn(),
}));

const reservation = (overrides = {}) => ({
  _id: 'RES-1', reference: 'RES-2026-000001', status: 'confirmed',
  hotel: { name: 'Hôtel Test' }, roomCategory: { name: 'Standard' },
  checkInDate: '2026-08-10', checkOutDate: '2026-08-12', nights: 2,
  totalAmount: 70000,
  ...overrides,
});

describe('MesReservationsHotelPage — Sprint C (espace client) — TEST DATA', () => {
  beforeEach(() => vi.clearAllMocks());

  test('affiche un message quand aucune réservation', async () => {
    getMyHotelReservations.mockResolvedValue([]);
    render(<MesReservationsHotelPage />);
    expect(await screen.findByText(/aucune réservation/i)).toBeInTheDocument();
  });

  test('affiche hôtel, catégorie, dates, statut et montant', async () => {
    getMyHotelReservations.mockResolvedValue([reservation()]);
    render(<MesReservationsHotelPage />);
    expect(await screen.findByText('Hôtel Test')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Confirmée')).toBeInTheDocument();
    expect(screen.getByText(/70\s?000/)).toBeInTheDocument();
  });

  test('une réservation confirmée ou pending propose "Annuler"', async () => {
    getMyHotelReservations.mockResolvedValue([reservation({ status: 'pending' })]);
    render(<MesReservationsHotelPage />);
    expect(await screen.findByRole('button', { name: 'Annuler' })).toBeInTheDocument();
  });

  test('une réservation annulée/rejetée/expirée ne propose pas "Annuler"', async () => {
    getMyHotelReservations.mockResolvedValue([reservation({ status: 'cancelled' })]);
    render(<MesReservationsHotelPage />);
    await screen.findByText('Hôtel Test');
    expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument();
  });

  test('annuler demande confirmation puis appelle le service', async () => {
    getMyHotelReservations.mockResolvedValue([reservation({ status: 'pending' })]);
    cancelHotelReservation.mockResolvedValue({});
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MesReservationsHotelPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(cancelHotelReservation).toHaveBeenCalledWith('RES-1', expect.any(String)));
    confirmSpy.mockRestore();
  });
});
