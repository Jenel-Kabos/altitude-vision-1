import { render, screen, waitFor } from '@testing-library/react';
import IndividualRentalManagementPage from '../pages/dashboard/IndividualRentalManagementPage';
import { getIndividualRentalManagement, getIndividualRentalManagementStats, getIndividualSubscription } from '../services/gestionLocativeService';

vi.mock('../services/gestionLocativeService', () => ({
  getIndividualRentalManagement: vi.fn(),
  getIndividualRentalManagementStats: vi.fn(),
  getIndividualSubscription: vi.fn(),
  enableRentalManagement: vi.fn(),
}));

describe('C2.10B B4 — Gestion locative individuelle', () => {
  beforeEach(() => getIndividualSubscription.mockResolvedValue({ status: 'active', plan: 'premium' }));
  test('affiche uniquement la projection individuelle et ses états métier', async () => {
    getIndividualRentalManagement.mockResolvedValue({ rentals: [{ _id: 'R1', property: { title: 'Studio indépendant', address: { city: 'Brazzaville' } }, occupancyStatus: 'vacant' }], total: 1 });
    getIndividualRentalManagementStats.mockResolvedValue({ total: 1, vacant: 1, occupied: 0, overduePayments: 0 });
    render(<IndividualRentalManagementPage />);

    expect(screen.getByRole('heading', { name: 'Gestion locative individuelle' })).toBeInTheDocument();
    expect(await screen.findByText('Studio indépendant')).toBeInTheDocument();
    expect(screen.getByText(/Property\.tenant = null/i)).toBeInTheDocument();
    expect(getIndividualRentalManagement).toHaveBeenCalledWith({ page: 1, limit: 25 });
  });

  test('un abonnement indisponible verrouille les actions sans masquer les explications', async () => {
    const error = Object.assign(new Error('Abonnement requis'), { response: { status: 403, data: { code: 'INDIVIDUAL_ENTITLEMENT_REQUIRED' } } });
    getIndividualRentalManagement.mockRejectedValue(error);
    getIndividualRentalManagementStats.mockRejectedValue(error);
    render(<IndividualRentalManagementPage />);
    expect(await screen.findByText('Abonnement individuel requis')).toBeInTheDocument();
    expect(screen.getByText(/aucune donnée n’est supprimée/i)).toBeInTheDocument();
  });

  test('affiche un état vide explicite', async () => {
    getIndividualRentalManagement.mockResolvedValue({ rentals: [], total: 0 });
    getIndividualRentalManagementStats.mockResolvedValue({ total: 0 });
    render(<IndividualRentalManagementPage />);
    await waitFor(() => expect(screen.getByText('Aucun bien en autogestion')).toBeInTheDocument());
  });
});
