import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import RentalNoticesPage from '../pages/dashboard/RentalNoticesPage';
import {
  getRentalManagement, runRentalAction, acknowledgeNotice, cancelNotice, startNotice,
} from '../services/gestionLocativeService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/gestionLocativeService', () => ({
  getRentalManagement: vi.fn(),
  runRentalAction: vi.fn(),
  acknowledgeNotice: vi.fn(),
  cancelNotice: vi.fn(),
  startNotice: vi.fn(),
}));

const notice = (overrides = {}) => ({
  _id: 'R1', property: { title: 'Villa Test' }, currentTenant: { nom: 'Dupont', prenom: 'Jean' },
  activeLease: { _id: 'LEASE-1' }, plannedExitAt: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
  noticeAcknowledgedAt: null,
  ...overrides,
});

describe('RentalNoticesPage — Sprint GL-B2 — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRentalManagement.mockResolvedValue({ rentals: [notice()] });
  });

  test('affiche le bien, le locataire et les jours restants', async () => {
    render(<RentalNoticesPage />);
    expect(await screen.findByText('Villa Test')).toBeInTheDocument();
    expect(screen.getByText(/Jean Dupont/)).toBeInTheDocument();
    expect(screen.getByText(/jour\(s\) restant/)).toBeInTheDocument();
  });

  test('affiche un retard si la date prévue est dépassée', async () => {
    getRentalManagement.mockResolvedValue({ rentals: [notice({ plannedExitAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() })] });
    render(<RentalNoticesPage />);
    expect(await screen.findByText(/jour\(s\) de retard/)).toBeInTheDocument();
  });

  test('accuser réception appelle le service puis recharge', async () => {
    acknowledgeNotice.mockResolvedValue({});
    render(<RentalNoticesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Accuser réception' }));
    await waitFor(() => expect(acknowledgeNotice).toHaveBeenCalledWith('R1'));
  });

  test('réception déjà accusée : bouton masqué, mention affichée', async () => {
    getRentalManagement.mockResolvedValue({ rentals: [notice({ noticeAcknowledgedAt: '2026-08-01' })] });
    render(<RentalNoticesPage />);
    await screen.findByText('Villa Test');
    expect(screen.queryByRole('button', { name: 'Accuser réception' })).not.toBeInTheDocument();
    expect(screen.getByText('Réception accusée')).toBeInTheDocument();
  });

  test('annuler le préavis demande confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    cancelNotice.mockResolvedValue({});
    render(<RentalNoticesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler le préavis' }));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(cancelNotice).toHaveBeenCalled());
    confirmSpy.mockRestore();
  });

  test('valider la sortie appelle validate-exit', async () => {
    runRentalAction.mockResolvedValue({});
    render(<RentalNoticesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Valider la sortie' }));
    await waitFor(() => expect(runRentalAction).toHaveBeenCalledWith('R1', 'validate-exit', {}));
  });

  test('créer un préavis exige un dossier et une date', async () => {
    render(<RentalNoticesPage />);
    await screen.findByText('Villa Test');
    fireEvent.click(screen.getByRole('button', { name: '+ Démarrer un préavis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }));
    expect(toast.error).toHaveBeenCalled();
    expect(startNotice).not.toHaveBeenCalled();
  });
});
