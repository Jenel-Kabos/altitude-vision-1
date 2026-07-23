import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import RoomAssignmentPanel from '../components/RoomAssignmentPanel';
import { getRooms, assignRoom, changeRoom } from '../services/hotelService';
import {
  checkInHotelReservation, checkOutHotelReservation, getCheckoutFinancialReadiness, getReservationRoomAssignment,
} from '../services/hotelReservationService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/hotelService', () => ({
  getRooms: vi.fn(),
  assignRoom: vi.fn(),
  changeRoom: vi.fn(),
}));
vi.mock('../services/hotelReservationService', () => ({
  checkInHotelReservation: vi.fn(),
  checkOutHotelReservation: vi.fn(),
  getReservationRoomAssignment: vi.fn(),
  getCheckoutFinancialReadiness: vi.fn(),
}));

const reservation = (overrides = {}) => ({
  _id: 'RES-1', status: 'confirmed', roomsCount: 1, hotel: { _id: 'HOTEL-1' }, roomCategory: { _id: 'CAT-1' },
  ...overrides,
});

describe('RoomAssignmentPanel — correctif (affectation persistante + garde-fou multi-chambres) — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRooms.mockResolvedValue([{ _id: 'ROOM-1', roomNumber: '101', roomCategory: { name: 'Standard' } }]);
    getReservationRoomAssignment.mockResolvedValue(null);
    getCheckoutFinancialReadiness.mockResolvedValue({ allowed: true, status: 'ready', blockers: [], warnings: [], financialSnapshot: { documentTotalMinor: 100000, allocatedMinor: 100000, balanceMinor: 0, currency: 'XAF' } });
  });

  test('affiche un état de chargement puis interroge le backend au montage', async () => {
    let resolvePromise;
    getReservationRoomAssignment.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));
    render(<RoomAssignmentPanel reservation={reservation()} onChanged={vi.fn()} />);
    expect(screen.getByText(/Chargement de l'affectation/)).toBeInTheDocument();
    resolvePromise(null);
    await waitFor(() => expect(screen.queryByText(/Chargement de l'affectation/)).not.toBeInTheDocument());
    expect(getReservationRoomAssignment).toHaveBeenCalledWith('RES-1');
  });

  test('une affectation déjà existante est affichée après le montage (persistance après rechargement)', async () => {
    getReservationRoomAssignment.mockResolvedValue({ id: 'ASSIGN-1', room: { id: 'ROOM-1', roomNumber: '205', floor: 2, status: 'reserved' }, assignedAt: '2026-08-01T00:00:00Z' });
    render(<RoomAssignmentPanel reservation={reservation()} onChanged={vi.fn()} />);
    expect(await screen.findByText(/Chambre affectée : 205/)).toBeInTheDocument();
  });

  test('remonter le composant (simulation de rechargement) retrouve la même affectation', async () => {
    getReservationRoomAssignment.mockResolvedValue({ id: 'ASSIGN-1', room: { id: 'ROOM-1', roomNumber: '205', floor: 2, status: 'reserved' } });
    const { unmount } = render(<RoomAssignmentPanel reservation={reservation()} onChanged={vi.fn()} />);
    await screen.findByText(/Chambre affectée : 205/);
    unmount();
    render(<RoomAssignmentPanel reservation={reservation()} onChanged={vi.fn()} />);
    expect(await screen.findByText(/Chambre affectée : 205/)).toBeInTheDocument();
    expect(getReservationRoomAssignment).toHaveBeenCalledTimes(2);
  });

  test('le sélecteur de chambres exclut les chambres désactivées (active=true transmis au backend)', async () => {
    render(<RoomAssignmentPanel reservation={reservation()} onChanged={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Affecter chambre' }));
    await waitFor(() => expect(getRooms).toHaveBeenCalledWith('HOTEL-1', { roomCategoryId: 'CAT-1', status: 'available', active: true }));
  });

  test('affecter une chambre puis rafraîchit l\'affectation depuis le backend (pas seulement un état local)', async () => {
    assignRoom.mockResolvedValue({ _id: 'ASSIGN-1' });
    getReservationRoomAssignment
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'ASSIGN-1', room: { id: 'ROOM-1', roomNumber: '101' } });
    const onChanged = vi.fn();
    render(<RoomAssignmentPanel reservation={reservation()} onChanged={onChanged} />);
    await waitFor(() => expect(getReservationRoomAssignment).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole('button', { name: 'Affecter chambre' }));
    fireEvent.change(await screen.findByLabelText('Choisir une chambre disponible'), { target: { value: 'ROOM-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    await waitFor(() => expect(getReservationRoomAssignment).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Chambre affectée : 101/)).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  test('check-in rafraîchit l\'affectation après succès', async () => {
    checkInHotelReservation.mockResolvedValue({ reservation: { status: 'checked_in' }, room: { roomNumber: '101' } });
    getReservationRoomAssignment
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'ASSIGN-1', room: { id: 'ROOM-1', roomNumber: '101' } });
    render(<RoomAssignmentPanel reservation={reservation()} onChanged={vi.fn()} />);
    await waitFor(() => expect(getReservationRoomAssignment).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Check-in' }));
    await waitFor(() => expect(getReservationRoomAssignment).toHaveBeenCalledTimes(2));
  });

  test('check-out rafraîchit l\'affectation après succès', async () => {
    checkOutHotelReservation.mockResolvedValue({ reservation: { status: 'checked_out' }, room: { status: 'cleaning' } });
    getReservationRoomAssignment
      .mockResolvedValueOnce({ id: 'ASSIGN-1', room: { id: 'ROOM-1', roomNumber: '101' } })
      .mockResolvedValueOnce(null);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<RoomAssignmentPanel reservation={reservation({ status: 'checked_in' })} onChanged={vi.fn()} />);
    await screen.findByText(/Chambre affectée : 101/);
    fireEvent.click(screen.getByRole('button', { name: 'Check-out' }));
    await waitFor(() => expect(getReservationRoomAssignment).toHaveBeenCalledTimes(2));
  });

  test('désactive le check-out bloqué pour un non-Admin et affiche les bloqueurs', async () => {
    getCheckoutFinancialReadiness.mockResolvedValue({ allowed: false, status: 'blocked', blockers: [{ code: 'FINANCIAL_BALANCE_REMAINING' }], warnings: [], financialSnapshot: { documentTotalMinor: 100000, allocatedMinor: 40000, balanceMinor: 60000, currency: 'XAF' } });
    render(<RoomAssignmentPanel reservation={reservation({ status: 'checked_in' })} />);
    expect(await screen.findByText('Check-out bloqué')).toBeInTheDocument(); expect(screen.getByText('FINANCIAL_BALANCE_REMAINING')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Check-out' })).toBeDisabled();
  });

  test('Admin peut demander une dérogation justifiée', async () => {
    getCheckoutFinancialReadiness.mockResolvedValue({ allowed: false, status: 'blocked', blockers: [{ code: 'FINANCIAL_BALANCE_REMAINING' }], warnings: [], financialSnapshot: { balanceMinor: 60000, currency: 'XAF' } });
    checkOutHotelReservation.mockResolvedValue({ financialCheckout: { status: 'overridden', overrideApplied: true } }); vi.spyOn(window, 'confirm').mockReturnValue(true); vi.spyOn(window, 'prompt').mockReturnValue('Départ exceptionnel validé par la direction');
    render(<RoomAssignmentPanel reservation={reservation({ status: 'checked_in' })} isAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dérogation et check-out' }));
    await waitFor(() => expect(checkOutHotelReservation).toHaveBeenCalledWith('RES-1', { financialOverride: { requested: true, reason: 'Départ exceptionnel validé par la direction' } }));
  });

  test('rafraîchit un état devenu bloqué sans mutation optimiste', async () => {
    getCheckoutFinancialReadiness.mockResolvedValueOnce({ allowed: true, status: 'ready', blockers: [], warnings: [], financialSnapshot: { balanceMinor: 0, currency: 'XAF' } }).mockResolvedValue({ allowed: false, status: 'blocked', blockers: [{ code: 'FINANCIAL_BALANCE_REMAINING' }], warnings: [], financialSnapshot: { balanceMinor: 1, currency: 'XAF' } }); vi.spyOn(window, 'confirm').mockReturnValue(true);
    checkOutHotelReservation.mockRejectedValue({ response: { data: { code: 'CHECKOUT_BLOCKED_FINANCIAL', message: 'Bloqué', financialReadiness: { allowed: false, status: 'blocked', blockers: [{ code: 'FINANCIAL_BALANCE_REMAINING' }], warnings: [], financialSnapshot: { balanceMinor: 1 } } } } });
    const onChanged = vi.fn(); render(<RoomAssignmentPanel reservation={reservation({ status: 'checked_in' })} onChanged={onChanged} />); fireEvent.click(await screen.findByRole('button', { name: 'Check-out' })); await waitFor(() => expect(screen.getByText('FINANCIAL_BALANCE_REMAINING')).toBeInTheDocument()); expect(onChanged).not.toHaveBeenCalled();
  });

  test('changement de chambre rafraîchit l\'affectation après succès', async () => {
    getReservationRoomAssignment
      .mockResolvedValueOnce({ id: 'ASSIGN-1', room: { id: 'ROOM-OLD', roomNumber: '100' } })
      .mockResolvedValueOnce({ id: 'ASSIGN-2', room: { id: 'ROOM-1', roomNumber: '101' } });
    changeRoom.mockResolvedValue({ _id: 'ASSIGN-2' });
    render(<RoomAssignmentPanel reservation={reservation()} onChanged={vi.fn()} />);
    await screen.findByText(/Chambre affectée : 100/);
    fireEvent.click(screen.getByRole('button', { name: 'Changer chambre' }));
    fireEvent.change(await screen.findByLabelText('Choisir une chambre disponible'), { target: { value: 'ROOM-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    await waitFor(() => expect(getReservationRoomAssignment).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Chambre affectée : 101/)).toBeInTheDocument();
  });

  test('réservation multi-chambres : affiche une erreur et bloque affecter/check-in', async () => {
    render(<RoomAssignmentPanel reservation={reservation({ roomsCount: 3 })} onChanged={vi.fn()} />);
    expect(await screen.findByText((content, el) => el.tagName === 'P' && el.textContent.includes('affectation individuelle non prise en charge'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Affecter chambre' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check-in' })).not.toBeInTheDocument();
  });

  test('réservation checked_in : propose uniquement Check-out', async () => {
    getReservationRoomAssignment.mockResolvedValue({ id: 'ASSIGN-1', room: { id: 'ROOM-1', roomNumber: '101' } });
    render(<RoomAssignmentPanel reservation={reservation({ status: 'checked_in' })} onChanged={vi.fn()} />);
    await screen.findByText(/Chambre affectée : 101/);
    expect(screen.getByRole('button', { name: 'Check-out' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check-in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Affecter chambre' })).not.toBeInTheDocument();
  });

  test("erreur d'affectation (409, double affectation) affiche un toast", async () => {
    const err = new Error('conflit'); err.response = { data: { message: 'Cette chambre vient déjà d\'être affectée à une autre réservation.' } };
    assignRoom.mockRejectedValue(err);
    render(<RoomAssignmentPanel reservation={reservation()} onChanged={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Affecter chambre' }));
    fireEvent.change(await screen.findByLabelText('Choisir une chambre disponible'), { target: { value: 'ROOM-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Cette chambre vient déjà d'être affectée à une autre réservation."));
  });
});
