import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import HousekeepingDashboardPage from '../pages/dashboard/HousekeepingDashboardPage';
import {
  getHousekeepingTasks, assignHousekeepingTask, startHousekeepingTask,
  completeHousekeepingTask, cancelHousekeepingTask,
} from '../services/housekeepingService';
import { createInspection, approveInspection, rejectInspection } from '../services/inspectionService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/housekeepingService', () => ({
  getHousekeepingTasks: vi.fn(),
  assignHousekeepingTask: vi.fn(),
  startHousekeepingTask: vi.fn(),
  completeHousekeepingTask: vi.fn(),
  cancelHousekeepingTask: vi.fn(),
}));
vi.mock('../services/inspectionService', () => ({
  createInspection: vi.fn(),
  approveInspection: vi.fn(),
  rejectInspection: vi.fn(),
}));

const task = (overrides = {}) => ({
  _id: 'TASK-1', type: 'checkout_cleaning', priority: 'normal', status: 'pending',
  room: { _id: 'ROOM-1', roomNumber: '101' }, hotel: { name: 'Hôtel Test' }, assignedTo: null,
  createdAt: '2026-08-01T10:00:00Z',
  ...overrides,
});

describe('HousekeepingDashboardPage — Sprint E — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getHousekeepingTasks.mockResolvedValue([task()]);
  });

  test('affiche la tâche avec chambre/hôtel/priorité/statut', async () => {
    render(<HousekeepingDashboardPage />);
    expect(await screen.findByText('101')).toBeInTheDocument();
    expect(screen.getByText('Hôtel Test')).toBeInTheDocument();
    expect(screen.getAllByText('Normale').length).toBeGreaterThan(0);
    expect(screen.getAllByText('En attente').length).toBeGreaterThan(0);
  });

  test('filtrer par statut relance le chargement avec le bon paramètre', async () => {
    render(<HousekeepingDashboardPage />);
    await screen.findByText('101');
    fireEvent.change(screen.getByLabelText('Filtrer par statut'), { target: { value: 'in_progress' } });
    await waitFor(() => expect(getHousekeepingTasks).toHaveBeenCalledWith(expect.objectContaining({ status: 'in_progress' })));
  });

  test('assigner une tâche exige un identifiant employé', async () => {
    render(<HousekeepingDashboardPage />);
    await screen.findByText('101');
    fireEvent.click(screen.getByRole('button', { name: 'Assigner' }));
    expect(toast.error).toHaveBeenCalled();
    expect(assignHousekeepingTask).not.toHaveBeenCalled();
  });

  test('assigner une tâche avec un employé renseigné appelle le service', async () => {
    assignHousekeepingTask.mockResolvedValue({});
    render(<HousekeepingDashboardPage />);
    await screen.findByText('101');
    fireEvent.change(screen.getByPlaceholderText('ID employé'), { target: { value: 'EMP-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assigner' }));
    await waitFor(() => expect(assignHousekeepingTask).toHaveBeenCalledWith('TASK-1', 'EMP-1'));
  });

  test('démarrer puis terminer une tâche', async () => {
    startHousekeepingTask.mockResolvedValue({});
    render(<HousekeepingDashboardPage />);
    await screen.findByText('101');
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer' }));
    await waitFor(() => expect(startHousekeepingTask).toHaveBeenCalledWith('TASK-1'));
  });

  test('terminer une tâche en cours', async () => {
    getHousekeepingTasks.mockResolvedValue([task({ status: 'in_progress' })]);
    completeHousekeepingTask.mockResolvedValue({});
    render(<HousekeepingDashboardPage />);
    await screen.findByText('101');
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));
    await waitFor(() => expect(completeHousekeepingTask).toHaveBeenCalledWith('TASK-1'));
  });

  test('annuler une tâche demande confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    cancelHousekeepingTask.mockResolvedValue({});
    render(<HousekeepingDashboardPage />);
    await screen.findByText('101');
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(cancelHousekeepingTask).toHaveBeenCalled());
    confirmSpy.mockRestore();
  });

  test('tâche terminée : "Inspecter" crée une inspection puis propose Approuver/Rejeter', async () => {
    getHousekeepingTasks.mockResolvedValue([task({ status: 'completed' })]);
    createInspection.mockResolvedValue({ _id: 'INSPECT-1' });
    render(<HousekeepingDashboardPage />);
    await screen.findByText('101');
    fireEvent.click(screen.getByRole('button', { name: 'Inspecter' }));
    await waitFor(() => expect(createInspection).toHaveBeenCalledWith({ roomId: 'ROOM-1', housekeepingTaskId: 'TASK-1' }));
    expect(await screen.findByRole('button', { name: 'Approuver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rejeter' })).toBeInTheDocument();
  });

  test('approuver l\'inspection appelle approveInspection', async () => {
    getHousekeepingTasks.mockResolvedValue([task({ status: 'completed' })]);
    createInspection.mockResolvedValue({ _id: 'INSPECT-1' });
    approveInspection.mockResolvedValue({});
    render(<HousekeepingDashboardPage />);
    await screen.findByText('101');
    fireEvent.click(screen.getByRole('button', { name: 'Inspecter' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Approuver' }));
    await waitFor(() => expect(approveInspection).toHaveBeenCalledWith('INSPECT-1'));
  });
});
