import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RentalLeasesPage from '../pages/dashboard/RentalLeasesPage';
import { RentalOperationProvider } from '../context/RentalOperationContext';
import { INDIVIDUAL_RENTAL_CONTEXT } from '../services/rentalRequestContext';
import { createContrat, getRentalContracts } from '../services/gestionLocativeService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'Proprietaire' } }) }));
vi.mock('../services/gestionLocativeService', () => ({
  createContrat: vi.fn(), getRentalContracts: vi.fn(), getContrats: vi.fn(),
}));
vi.mock('../services/rentalLeaseLifecycleService', () => ({
  getLeaseLifecycleDashboard: vi.fn().mockResolvedValue({
    bauxAEcheance: [], renouvellementsAPreparer: [], preavisEnAttente: [], inspectionsAProgrammer: [], cautionsARestituer: [], dossiersBloques: [],
  }),
  getAvailableTransitions: vi.fn(), transitionLease: vi.fn(), previewRenewal: vi.fn(), renewLease: vi.fn(), addLeaseAvenant: vi.fn(),
  encaisserCaution: vi.fn(), bloquerCaution: vi.fn(), appliquerRetenueCaution: vi.fn(), restituerCaution: vi.fn(),
}));

test('crée le bail par la surface location dans le contexte individuel explicite', async () => {
  getRentalContracts.mockResolvedValue([]);
  createContrat.mockResolvedValue({ _id: 'C1' });
  render(<RentalOperationProvider value={INDIVIDUAL_RENTAL_CONTEXT}><RentalLeasesPage /></RentalOperationProvider>);
  await screen.findByText('Aucun bail');
  fireEvent.change(screen.getByLabelText('Identifiant du bien'), { target: { value: 'P1' } });
  fireEvent.change(screen.getByLabelText('Identifiant du locataire'), { target: { value: 'L1' } });
  fireEvent.change(screen.getByLabelText('Date d’entrée'), { target: { value: '2027-01-01' } });
  fireEvent.change(screen.getByLabelText('Date de fin du bail'), { target: { value: '2027-12-31' } });
  fireEvent.change(screen.getByLabelText('Loyer mensuel'), { target: { value: '200000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Créer le bail' }));
  await waitFor(() => expect(createContrat).toHaveBeenCalledWith(expect.objectContaining({
    type: 'location', bien: 'P1', locataire: 'L1', montantLoyer: 200000,
  }), INDIVIDUAL_RENTAL_CONTEXT));
});
