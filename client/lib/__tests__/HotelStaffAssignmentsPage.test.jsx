import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import HotelStaffAssignmentsPage from '../pages/dashboard/HotelStaffAssignmentsPage';
import * as staffService from '../services/hotelAccessService';

vi.mock('next/navigation', () => ({ useParams: () => ({ hotelId: 'HOTEL-1' }) }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/hotelAccessService', () => ({
  listHotelStaffAssignments: vi.fn(),
  getHotelStaffAssignment: vi.fn(),
  createHotelStaffAssignment: vi.fn(),
  updateHotelStaffAssignment: vi.fn(),
  suspendHotelStaffAssignment: vi.fn(),
  reactivateHotelStaffAssignment: vi.fn(),
  revokeHotelStaffAssignment: vi.fn(),
}));

const assignment = (overrides = {}) => ({
  id: 'ASSIGN-1', user: { id: 'USER-1', name: 'Ada Lovelace', email: 'ada@example.test' },
  hotel: { id: 'HOTEL-1', name: 'Hôtel Un' }, assignmentRole: 'reception', capabilities: [],
  status: 'active', effectiveStatus: 'active', validFrom: '2026-01-01T00:00:00Z', validUntil: null,
  assignedAt: '2026-01-01T00:00:00Z', ...overrides,
});

describe('HotelStaffAssignmentsPage F2.6', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    staffService.listHotelStaffAssignments.mockResolvedValue({ assignments: [assignment()], total: 1, page: 1, limit: 20 });
  });

  test('affiche la liste du personnel rattaché', async () => {
    render(<HotelStaffAssignmentsPage />);
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getAllByText('Réception').length).toBeGreaterThan(0);
  });

  test("affiche un état vide explicite quand aucun rattachement n'existe", async () => {
    staffService.listHotelStaffAssignments.mockResolvedValue({ assignments: [], total: 0, page: 1, limit: 20 });
    render(<HotelStaffAssignmentsPage />);
    expect(await screen.findByText('Aucun membre du personnel rattaché.')).toBeInTheDocument();
  });

  test('affiche un message d’accès refusé sur une erreur 403', async () => {
    staffService.listHotelStaffAssignments.mockRejectedValue({ response: { status: 403 } });
    render(<HotelStaffAssignmentsPage />);
    expect(await screen.findByText('Accès refusé à la gestion du personnel de cet hôtel.')).toBeInTheDocument();
  });

  test('crée un rattachement via le formulaire', async () => {
    staffService.createHotelStaffAssignment.mockResolvedValue(assignment());
    render(<HotelStaffAssignmentsPage />);
    await screen.findByText('Ada Lovelace');
    fireEvent.change(screen.getByLabelText('Utilisateur (identifiant)'), { target: { value: 'USER-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rattacher' }));
    await waitFor(() => expect(staffService.createHotelStaffAssignment).toHaveBeenCalledWith('HOTEL-1', expect.objectContaining({ userId: 'USER-2', assignmentRole: 'reception' })));
    expect(toast.success).toHaveBeenCalled();
  });

  test('exige une raison d’au moins 10 caractères avant suspension', async () => {
    window.prompt = vi.fn(() => 'court');
    render(<HotelStaffAssignmentsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suspendre' }));
    expect(toast.error).toHaveBeenCalledWith('Une raison d’au moins 10 caractères est obligatoire.');
    expect(staffService.suspendHotelStaffAssignment).not.toHaveBeenCalled();
  });

  test('suspend un rattachement avec une raison valide', async () => {
    window.prompt = vi.fn(() => 'Départ temporaire de l’équipe');
    staffService.suspendHotelStaffAssignment.mockResolvedValue(assignment({ status: 'suspended', effectiveStatus: 'suspended' }));
    render(<HotelStaffAssignmentsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suspendre' }));
    await waitFor(() => expect(staffService.suspendHotelStaffAssignment).toHaveBeenCalledWith('HOTEL-1', 'ASSIGN-1', 'Départ temporaire de l’équipe'));
  });

  test('révoque un rattachement après confirmation avec raison', async () => {
    window.prompt = vi.fn(() => 'Fin de contrat définitive constatée');
    staffService.revokeHotelStaffAssignment.mockResolvedValue(assignment({ status: 'revoked', effectiveStatus: 'revoked' }));
    render(<HotelStaffAssignmentsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Révoquer' }));
    await waitFor(() => expect(staffService.revokeHotelStaffAssignment).toHaveBeenCalledWith('HOTEL-1', 'ASSIGN-1', 'Fin de contrat définitive constatée'));
  });

  test('filtre par statut sans requêtes en boucle', async () => {
    render(<HotelStaffAssignmentsPage />);
    await screen.findByText('Ada Lovelace');
    const callsBefore = staffService.listHotelStaffAssignments.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'suspended' } });
    await waitFor(() => expect(staffService.listHotelStaffAssignments.mock.calls.length).toBe(callsBefore + 1));
    expect(staffService.listHotelStaffAssignments).toHaveBeenLastCalledWith('HOTEL-1', expect.objectContaining({ status: 'suspended' }));
  });
});
