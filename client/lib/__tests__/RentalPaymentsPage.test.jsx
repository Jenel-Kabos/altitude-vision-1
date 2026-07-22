import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import RentalPaymentsPage from '../pages/dashboard/RentalPaymentsPage';
import {
  getPaiementsPage, getPaiementsStats, marquerPaiementPaye, calculerPenalites,
} from '../services/gestionLocativeService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/gestionLocativeService', () => ({
  getPaiementsPage: vi.fn(),
  getPaiementsStats: vi.fn(),
  marquerPaiementPaye: vi.fn(),
  calculerPenalites: vi.fn(),
}));

const paiement = (overrides = {}) => ({
  _id: 'P1', mois: 8, annee: 2026, montant: 150000, montantTotal: 150000, statut: 'impayé',
  contrat: { locataire: { nom: 'Dupont', prenom: 'Jean' } },
  ...overrides,
});

describe('RentalPaymentsPage — Sprint GL-B2 — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPaiementsPage.mockResolvedValue({ paiements: [paiement()], total: 1, page: 1, totalPages: 1 });
    getPaiementsStats.mockResolvedValue({ totalAttendu: 300000, totalEncaisse: 150000, totalImpaye: 150000, tauxEncaissement: 50, nbImpayes: 1 });
  });

  test('affiche les statistiques d\'encaissement calculées côté serveur', async () => {
    render(<RentalPaymentsPage />);
    expect(await screen.findByText(/50%/)).toBeInTheDocument();
  });

  test('affiche la ligne de paiement avec locataire/montant/statut', async () => {
    render(<RentalPaymentsPage />);
    expect(await screen.findByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.getAllByText('Impayé').length).toBeGreaterThan(0);
  });

  test('filtrer par statut relance le chargement', async () => {
    render(<RentalPaymentsPage />);
    await screen.findByText('Jean Dupont');
    fireEvent.click(screen.getByRole('button', { name: 'Payé' }));
    await waitFor(() => expect(getPaiementsPage).toHaveBeenCalledWith(expect.objectContaining({ statut: 'payé' })));
  });

  test('marquer un paiement payé appelle le service avec le montant reçu', async () => {
    marquerPaiementPaye.mockResolvedValue({});
    render(<RentalPaymentsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Marquer payé' }));
    fireEvent.change(screen.getByPlaceholderText('Montant reçu'), { target: { value: '150000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    await waitFor(() => expect(marquerPaiementPaye).toHaveBeenCalledWith('P1', expect.objectContaining({ montantRecu: 150000 })));
  });

  test('recalculer les pénalités appelle le service', async () => {
    calculerPenalites.mockResolvedValue({});
    render(<RentalPaymentsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Recalculer les pénalités' }));
    await waitFor(() => expect(calculerPenalites).toHaveBeenCalled());
  });
});
