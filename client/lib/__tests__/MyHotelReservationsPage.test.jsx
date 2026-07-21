import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import MyHotelReservationsPage from '../pages/dashboard/MyHotelReservationsPage';
import {
  getOwnerHotelReservations, confirmHotelReservation, rejectHotelReservation, cancelHotelReservation,
} from '../services/hotelReservationService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/hotelReservationService', () => ({
  getOwnerHotelReservations: vi.fn(),
  createOwnerHotelReservation: vi.fn(),
  confirmHotelReservation: vi.fn(),
  rejectHotelReservation: vi.fn(),
  cancelHotelReservation: vi.fn(),
}));

const reservation = (overrides = {}) => ({
  _id: 'RES-1', reference: 'RES-2026-000001', status: 'pending',
  hotel: { name: 'Hôtel Test' }, roomCategory: { name: 'Standard' },
  checkInDate: '2026-08-10', checkOutDate: '2026-08-12', nights: 2,
  guest: { firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com' },
  adults: 2, children: 0, totalAmount: 70000,
  ...overrides,
});

describe('MyHotelReservationsPage — Sprint C (dashboard propriétaire) — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerHotelReservations.mockResolvedValue({ reservations: [reservation()], total: 1, page: 1, limit: 20 });
  });

  test('affiche les réservations avec statut et montant', async () => {
    render(<MyHotelReservationsPage />);
    expect(await screen.findByText(/RES-2026-000001/)).toBeInTheDocument();
    expect(screen.getAllByText('En attente').length).toBeGreaterThan(0);
  });

  test('confirmer une réservation en attente', async () => {
    confirmHotelReservation.mockResolvedValue({});
    render(<MyHotelReservationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer' }));
    await waitFor(() => expect(confirmHotelReservation).toHaveBeenCalledWith('RES-1'));
    expect(toast.success).toHaveBeenCalled();
  });

  test('rejeter exige un motif', async () => {
    render(<MyHotelReservationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Rejeter' }));
    expect(toast.error).toHaveBeenCalled();
    expect(rejectHotelReservation).not.toHaveBeenCalled();
  });

  test('rejeter avec motif appelle le service', async () => {
    rejectHotelReservation.mockResolvedValue({});
    render(<MyHotelReservationsPage />);
    fireEvent.change(await screen.findByPlaceholderText('Motif de rejet'), { target: { value: 'Complet' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rejeter' }));
    await waitFor(() => expect(rejectHotelReservation).toHaveBeenCalledWith('RES-1', 'Complet'));
  });

  test('annuler une réservation confirmée', async () => {
    getOwnerHotelReservations.mockResolvedValue({ reservations: [reservation({ status: 'confirmed' })], total: 1, page: 1, limit: 20 });
    cancelHotelReservation.mockResolvedValue({});
    render(<MyHotelReservationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(cancelHotelReservation).toHaveBeenCalled());
  });

  test("filtrer par statut relance la requête", async () => {
    render(<MyHotelReservationsPage />);
    await screen.findByText(/RES-2026-000001/);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmée' }));
    await waitFor(() => expect(getOwnerHotelReservations).toHaveBeenCalledWith(expect.objectContaining({ status: 'confirmed' })));
  });
});
