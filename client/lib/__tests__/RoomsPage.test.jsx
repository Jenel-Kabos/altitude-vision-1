import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import RoomsPage from '../pages/dashboard/RoomsPage';
import { getRooms, createRoom, updateRoom, deleteRoom, getRoomCategories } from '../services/hotelService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useParams: () => ({ hotelId: 'HOTEL-1' }) }));
vi.mock('../services/hotelService', () => ({
  getRooms: vi.fn(),
  createRoom: vi.fn(),
  updateRoom: vi.fn(),
  deleteRoom: vi.fn(),
  getRoomCategories: vi.fn(),
}));

const room = (overrides = {}) => ({
  _id: 'ROOM-1', roomNumber: '101', floor: 1, status: 'available',
  roomCategory: { name: 'Standard' }, reservation: null,
  ...overrides,
});

describe('RoomsPage — Sprint D (tableau des chambres + plan d\'étage) — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRoomCategories.mockResolvedValue([{ _id: 'CAT-1', name: 'Standard' }]);
    getRooms.mockResolvedValue([room()]);
  });

  test('affiche le tableau des chambres avec statut et catégorie', async () => {
    render(<RoomsPage />);
    expect(await screen.findByText('101')).toBeInTheDocument();
    expect(screen.getAllByText('Standard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Disponible').length).toBeGreaterThan(0);
  });

  test('affiche la réservation et le client si la chambre est occupée', async () => {
    getRooms.mockResolvedValue([room({ status: 'occupied', reservation: { reference: 'RES-1', guest: { firstName: 'Jean', lastName: 'Dupont' } } })]);
    render(<RoomsPage />);
    expect(await screen.findByText('RES-1')).toBeInTheDocument();
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
  });

  test('bascule vers le plan d\'étage groupé par étage', async () => {
    render(<RoomsPage />);
    await screen.findByText('101');
    fireEvent.click(screen.getByRole('button', { name: "Plan d'étage" }));
    await waitFor(() => expect(screen.getAllByText(/Étage 1/).length).toBeGreaterThan(0));
  });

  test('création : numéro et catégorie requis', async () => {
    render(<RoomsPage />);
    await screen.findByText('101');
    fireEvent.click(screen.getByRole('button', { name: '+ Nouvelle chambre' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(toast.error).toHaveBeenCalled();
    expect(createRoom).not.toHaveBeenCalled();
  });

  test('création réussie appelle createRoom puis recharge', async () => {
    createRoom.mockResolvedValue({ _id: 'ROOM-2' });
    render(<RoomsPage />);
    await screen.findByText('101');
    fireEvent.click(screen.getByRole('button', { name: '+ Nouvelle chambre' }));
    fireEvent.change(screen.getByLabelText('Numéro de chambre'), { target: { value: '102' } });
    fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: 'CAT-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(createRoom).toHaveBeenCalledWith('HOTEL-1', expect.objectContaining({ roomNumber: '102', roomCategoryId: 'CAT-1' })));
  });

  test('suppression appelle deleteRoom', async () => {
    deleteRoom.mockResolvedValue();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<RoomsPage />);
    await screen.findByText('101');
    fireEvent.click(screen.getByRole('button', { name: 'Suppr.' }));
    await waitFor(() => expect(deleteRoom).toHaveBeenCalledWith('ROOM-1'));
  });

  test('filtre par statut relance le chargement avec le bon paramètre', async () => {
    render(<RoomsPage />);
    await screen.findByText('101');
    fireEvent.change(screen.getByLabelText('Filtrer par statut'), { target: { value: 'occupied' } });
    await waitFor(() => expect(getRooms).toHaveBeenCalledWith('HOTEL-1', expect.objectContaining({ status: 'occupied' })));
  });

  test("le tableau de bord ne filtre pas par 'active' — les chambres désactivées restent visibles pour réactivation", async () => {
    render(<RoomsPage />);
    await screen.findByText('101');
    expect(getRooms).toHaveBeenCalledWith('HOTEL-1', expect.not.objectContaining({ active: expect.anything() }));
  });
});
