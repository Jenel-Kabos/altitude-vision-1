import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import RentalMaintenancePage from '../pages/dashboard/RentalMaintenancePage';
import {
  getRentalMaintenanceTickets, createRentalMaintenanceTicket, assignRentalMaintenanceTicket,
  scheduleRentalMaintenanceTicket, startRentalMaintenanceWork, resolveRentalMaintenanceTicket, closeRentalMaintenanceTicket,
} from '../services/rentalMaintenanceService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/rentalMaintenanceService', () => ({
  getRentalMaintenanceTickets: vi.fn(),
  createRentalMaintenanceTicket: vi.fn(),
  assignRentalMaintenanceTicket: vi.fn(),
  scheduleRentalMaintenanceTicket: vi.fn(),
  startRentalMaintenanceWork: vi.fn(),
  resolveRentalMaintenanceTicket: vi.fn(),
  closeRentalMaintenanceTicket: vi.fn(),
}));

const ticket = (overrides = {}) => ({
  _id: 'TICKET-1', property: { title: 'Villa Test' }, category: 'plomberie', description: 'Fuite au lavabo',
  status: 'ouvert', tenant: null, assignedTo: null, estimatedCost: 20000, actualCost: null, scheduledFor: null,
  ...overrides,
});

describe('RentalMaintenancePage — Sprint GL-B2 — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRentalMaintenanceTickets.mockResolvedValue([ticket()]);
  });

  test('affiche le ticket avec bien/catégorie/description/statut', async () => {
    render(<RentalMaintenancePage />);
    expect(await screen.findByText('Villa Test')).toBeInTheDocument();
    expect(screen.getByText(/Fuite au lavabo/)).toBeInTheDocument();
    expect(screen.getAllByText('Ouvert').length).toBeGreaterThan(0);
  });

  test('filtrer par statut relance le chargement', async () => {
    render(<RentalMaintenancePage />);
    await screen.findByText('Villa Test');
    fireEvent.click(screen.getByRole('button', { name: 'Résolu' }));
    await waitFor(() => expect(getRentalMaintenanceTickets).toHaveBeenCalledWith(expect.objectContaining({ status: 'resolu' })));
  });

  test('créer un ticket exige un bien et une description', async () => {
    render(<RentalMaintenancePage />);
    await screen.findByText('Villa Test');
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau ticket' }));
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }));
    expect(toast.error).toHaveBeenCalled();
    expect(createRentalMaintenanceTicket).not.toHaveBeenCalled();
  });

  test('assigner un technicien', async () => {
    assignRentalMaintenanceTicket.mockResolvedValue({});
    render(<RentalMaintenancePage />);
    fireEvent.change(await screen.findByPlaceholderText('ID technicien'), { target: { value: 'TECH-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assigner' }));
    await waitFor(() => expect(assignRentalMaintenanceTicket).toHaveBeenCalledWith('TICKET-1', 'TECH-1'));
  });

  test('résoudre un ticket en cours avec un coût réel', async () => {
    getRentalMaintenanceTickets.mockResolvedValue([ticket({ status: 'en_cours' })]);
    resolveRentalMaintenanceTicket.mockResolvedValue({});
    render(<RentalMaintenancePage />);
    fireEvent.change(await screen.findByPlaceholderText('Coût réel'), { target: { value: '25000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Résoudre' }));
    await waitFor(() => expect(resolveRentalMaintenanceTicket).toHaveBeenCalledWith('TICKET-1', 25000));
  });

  test('clôturer un ticket résolu', async () => {
    getRentalMaintenanceTickets.mockResolvedValue([ticket({ status: 'resolu', actualCost: 25000 })]);
    closeRentalMaintenanceTicket.mockResolvedValue({});
    render(<RentalMaintenancePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Clôturer' }));
    await waitFor(() => expect(closeRentalMaintenanceTicket).toHaveBeenCalledWith('TICKET-1'));
  });
});
