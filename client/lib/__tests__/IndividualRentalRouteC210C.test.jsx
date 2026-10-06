import { render, screen } from '@testing-library/react';
import IndividualRentalRoute from '../components/dashboard/IndividualRentalRoute';
import { getIndividualSubscription } from '../services/gestionLocativeService';

vi.mock('../services/gestionLocativeService', () => ({ getIndividualSubscription: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

test.each(['active', 'trialing'])('rend l’écran opérationnel pour un abonnement %s', async (status) => {
  getIndividualSubscription.mockResolvedValue({ status, modulesIncluded: ['location'] });
  render(<IndividualRentalRoute><p>Écran paiements</p></IndividualRentalRoute>);
  expect(await screen.findByText('Écran paiements')).toBeInTheDocument();
});

test.each([
  [null, 'Aucun abonnement individuel'],
  [{ status: 'past_due' }, 'Paiement de l’abonnement en attente'],
  [{ status: 'cancelled' }, 'Abonnement individuel résilié'],
])('bloque explicitement sans détruire les données', async (subscription, label) => {
  getIndividualSubscription.mockResolvedValue(subscription);
  render(<IndividualRentalRoute><p>Écran paiements</p></IndividualRentalRoute>);
  expect(await screen.findByText(label)).toBeInTheDocument();
  expect(screen.queryByText('Écran paiements')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('données locatives sont conservés');
});

test('distingue le refus d’autorité d’une erreur technique', async () => {
  getIndividualSubscription.mockRejectedValue({ response: { status: 403 } });
  render(<IndividualRentalRoute><p>Écran paiements</p></IndividualRentalRoute>);
  expect(await screen.findByText(/Accès interdit/i)).toBeInTheDocument();
});
