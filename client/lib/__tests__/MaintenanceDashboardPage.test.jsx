import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import MaintenanceDashboardPage from '../pages/dashboard/MaintenanceDashboardPage';
import {
  getMaintenanceTickets, assignMaintenanceTicket, startMaintenanceWork,
  resolveMaintenanceTicket, closeMaintenanceTicket,
} from '../services/maintenanceService';
import { createInspection, approveInspection, rejectInspection } from '../services/inspectionService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/maintenanceService', () => ({
  getMaintenanceTickets: vi.fn(),
  assignMaintenanceTicket: vi.fn(),
  startMaintenanceWork: vi.fn(),
  resolveMaintenanceTicket: vi.fn(),
  closeMaintenanceTicket: vi.fn(),
}));
vi.mock('../services/inspectionService', () => ({
  createInspection: vi.fn(),
  approveInspection: vi.fn(),
  rejectInspection: vi.fn(),
}));

const ticket = (overrides = {}) => ({
  _id: 'TICKET-1', category: 'plumbing', priority: 'normal', status: 'open',
  room: { _id: 'ROOM-1', roomNumber: '101' }, assignedTo: null,
  inspection: { _id: 'INSPECT-0', housekeepingTask: { _id: 'TASK-0' } },
  ...overrides,
});

describe('MaintenanceDashboardPage — Sprint E — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMaintenanceTickets.mockResolvedValue([ticket()]);
  });

  test('affiche le ticket avec chambre/catégorie/priorité/statut', async () => {
    render(<MaintenanceDashboardPage />);
    expect(await screen.findByText('101')).toBeInTheDocument();
    expect(screen.getAllByText('Plomberie').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ouvert').length).toBeGreaterThan(0);
  });

  test('filtrer par catégorie relance le chargement', async () => {
    render(<MaintenanceDashboardPage />);
    await screen.findByText('101');
    fireEvent.change(screen.getByLabelText('Filtrer par catégorie'), { target: { value: 'electricity' } });
    await waitFor(() => expect(getMaintenanceTickets).toHaveBeenCalledWith(expect.objectContaining({ category: 'electricity' })));
  });

  test('assigner un ticket exige un identifiant technicien', async () => {
    render(<MaintenanceDashboardPage />);
    await screen.findByText('101');
    fireEvent.click(screen.getByRole('button', { name: 'Assigner' }));
    expect(toast.error).toHaveBeenCalled();
    expect(assignMaintenanceTicket).not.toHaveBeenCalled();
  });

  test('assigner puis démarrer un ticket', async () => {
    assignMaintenanceTicket.mockResolvedValue({});
    startMaintenanceWork.mockResolvedValue({});
    render(<MaintenanceDashboardPage />);
    await screen.findByText('101');
    fireEvent.change(screen.getByPlaceholderText('ID technicien'), { target: { value: 'TECH-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assigner' }));
    await waitFor(() => expect(assignMaintenanceTicket).toHaveBeenCalledWith('TICKET-1', 'TECH-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer' }));
    await waitFor(() => expect(startMaintenanceWork).toHaveBeenCalledWith('TICKET-1'));
  });

  test('résoudre un ticket en cours', async () => {
    getMaintenanceTickets.mockResolvedValue([ticket({ status: 'in_progress' })]);
    resolveMaintenanceTicket.mockResolvedValue({});
    render(<MaintenanceDashboardPage />);
    await screen.findByText('101');
    fireEvent.click(screen.getByRole('button', { name: 'Résoudre' }));
    await waitFor(() => expect(resolveMaintenanceTicket).toHaveBeenCalledWith('TICKET-1'));
  });

  test('ticket résolu : "Ré-inspecter" crée une inspection puis propose Approuver/Rejeter', async () => {
    getMaintenanceTickets.mockResolvedValue([ticket({ status: 'resolved' })]);
    createInspection.mockResolvedValue({ _id: 'INSPECT-1' });
    render(<MaintenanceDashboardPage />);
    await screen.findByText('101');
    fireEvent.click(screen.getByRole('button', { name: 'Ré-inspecter' }));
    await waitFor(() => expect(createInspection).toHaveBeenCalledWith({ roomId: 'ROOM-1', housekeepingTaskId: 'TASK-0' }));
    expect(await screen.findByRole('button', { name: 'Approuver' })).toBeInTheDocument();
  });

  test('approuver la ré-inspection appelle approveInspection puis recharge', async () => {
    getMaintenanceTickets.mockResolvedValue([ticket({ status: 'resolved' })]);
    createInspection.mockResolvedValue({ _id: 'INSPECT-1' });
    approveInspection.mockResolvedValue({});
    render(<MaintenanceDashboardPage />);
    await screen.findByText('101');
    fireEvent.click(screen.getByRole('button', { name: 'Ré-inspecter' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Approuver' }));
    await waitFor(() => expect(approveInspection).toHaveBeenCalledWith('INSPECT-1'));
  });

  test('clôturer un ticket résolu', async () => {
    getMaintenanceTickets.mockResolvedValue([ticket({ status: 'resolved' })]);
    closeMaintenanceTicket.mockResolvedValue({});
    render(<MaintenanceDashboardPage />);
    await screen.findByText('101');
    fireEvent.click(screen.getByRole('button', { name: 'Clôturer' }));
    await waitFor(() => expect(closeMaintenanceTicket).toHaveBeenCalledWith('TICKET-1'));
  });
});
