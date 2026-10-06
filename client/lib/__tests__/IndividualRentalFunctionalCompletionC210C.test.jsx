import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import IndividualRentalManagementPage from '../pages/dashboard/IndividualRentalManagementPage';
import {
  enableRentalManagement,
  getIndividualRentalManagement,
  getIndividualRentalManagementStats,
  getIndividualSubscription,
} from '../services/gestionLocativeService';

vi.mock('../services/gestionLocativeService', () => ({
  enableRentalManagement: vi.fn(),
  getIndividualRentalManagement: vi.fn(),
  getIndividualRentalManagementStats: vi.fn(),
  getIndividualSubscription: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getIndividualRentalManagement.mockResolvedValue({ rentals: [], total: 0 });
  getIndividualRentalManagementStats.mockResolvedValue({ total: 0, vacant: 0, occupied: 0 });
  getIndividualSubscription.mockResolvedValue({ status: 'active', plan: 'premium', modulesIncluded: ['location'] });
  enableRentalManagement.mockResolvedValue({ _id: 'R1' });
});

test('l’espace individuel expose toutes les surfaces opérationnelles partagées', async () => {
  render(<IndividualRentalManagementPage />);
  expect(await screen.findByText('Aucun bien en autogestion')).toBeInTheDocument();
  for (const label of ['Dossiers', 'Baux', 'Locataires', 'Paiements', 'Préavis', 'Maintenance', 'Documents']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
  }
  expect(screen.getByText(/Abonnement Premium · actif/i)).toBeInTheDocument();
});

test.each([
  [null, 'Aucun abonnement individuel'],
  [{ status: 'past_due' }, 'Paiement de l’abonnement en attente'],
  [{ status: 'cancelled' }, 'Abonnement individuel résilié'],
  [{ status: 'trialing', plan: 'essentiel' }, 'Abonnement Essentiel · période d’essai'],
])('affiche l’état d’abonnement sans créer ni migrer de données', async (subscription, expected) => {
  getIndividualSubscription.mockResolvedValue(subscription);
  render(<IndividualRentalManagementPage />);
  expect(await screen.findByText(expected)).toBeInTheDocument();
});

test('active une Property individuelle par le contrat existant', async () => {
  render(<IndividualRentalManagementPage />);
  await screen.findByText('Aucun bien en autogestion');
  fireEvent.change(screen.getByLabelText('Identifiant du bien à activer'), { target: { value: '507f1f77bcf86cd799439011' } });
  fireEvent.click(screen.getByRole('button', { name: 'Activer en gestion locative' }));
  await waitFor(() => expect(enableRentalManagement).toHaveBeenCalledWith(
    { property: '507f1f77bcf86cd799439011' },
    expect.objectContaining({ mode: 'individual' }),
  ));
});
