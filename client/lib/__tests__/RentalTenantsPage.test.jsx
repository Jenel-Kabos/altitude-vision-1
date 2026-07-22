import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import RentalTenantsPage from '../pages/dashboard/RentalTenantsPage';
import { getLocataireDossiers } from '../services/gestionLocativeService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/gestionLocativeService', () => ({
  getLocataireDossiers: vi.fn(),
}));

const tenant = (overrides = {}) => ({
  _id: 'T1', nom: 'Dupont', prenom: 'Jean', telephone: '0600000000', email: 'jean@example.com',
  lease: { bien: { title: 'Appartement Centre' }, statut: 'actif', dateEntree: '2026-01-01', dateFinBail: '2026-12-31', montantLoyer: 150000 },
  paymentSummary: { expected: 300000, paid: 150000, remaining: 150000, nextDueAt: '2026-08-01' },
  activeNotice: null,
  ...overrides,
});

describe('RentalTenantsPage — Sprint GL-B2 — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLocataireDossiers.mockResolvedValue({ locataires: [tenant()], total: 1, page: 1, totalPages: 1 });
  });

  test('affiche identité, bien loué, bail, loyer et solde', async () => {
    render(<RentalTenantsPage />);
    expect(await screen.findByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('Appartement Centre')).toBeInTheDocument();
    expect(screen.getAllByText(/150\s?000/).length).toBeGreaterThan(0);
  });

  test('affiche un badge préavis actif quand applicable', async () => {
    getLocataireDossiers.mockResolvedValue({ locataires: [tenant({ activeNotice: { plannedExitAt: '2026-09-01' } })], total: 1 });
    render(<RentalTenantsPage />);
    expect(await screen.findByText(/Sortie le/)).toBeInTheDocument();
  });

  test('la recherche relance le chargement avec le bon paramètre', async () => {
    render(<RentalTenantsPage />);
    await screen.findByText('Jean Dupont');
    fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: 'Dupont' } });
    await waitFor(() => expect(getLocataireDossiers).toHaveBeenCalledWith(expect.objectContaining({ search: 'Dupont' })));
  });

  test('clic sur une ligne ouvre la fiche détaillée', async () => {
    render(<RentalTenantsPage />);
    fireEvent.click(await screen.findByText('Jean Dupont'));
    expect(await screen.findByText(/Voir dans la Gestion Locative/)).toBeInTheDocument();
  });

  test('message vide quand aucun locataire', async () => {
    getLocataireDossiers.mockResolvedValue({ locataires: [], total: 0 });
    render(<RentalTenantsPage />);
    expect(await screen.findByText(/Aucun locataire/)).toBeInTheDocument();
  });

  test('erreur de chargement affiche un toast', async () => {
    getLocataireDossiers.mockRejectedValue(new Error('network'));
    render(<RentalTenantsPage />);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
