import { render, screen } from '@testing-library/react';
import MesPaiementsPage from '../pages/MesPaiementsPage';
import { getMyPayments, initierPaiementVisite } from '../services/visiteService';

// ALTIMMO-PAY-SAFETY-04A — l'action « Payer maintenant » n'est proposée que si
// le serveur annonce explicitement l'initiation disponible.
vi.mock('next/image', () => ({ default: (props) => <img alt={props.alt} /> }));
vi.mock('../services/visiteService', () => ({ getMyPayments: vi.fn(), initierPaiementVisite: vi.fn(), verifierPaiementVisite: vi.fn() }));

const pendingVisit = { _id: 'V1', paiementStatus: 'en_attente', property: { title: 'Appartement Moungali', price: 250000, status: 'location', address: { city: 'Brazzaville' } } };

afterEach(() => vi.clearAllMocks());

test('paiement suspendu : aucun bouton de paiement, message explicite, visite toujours listée', async () => {
  getMyPayments.mockResolvedValue({ visites: [pendingVisit], paymentInitiationAvailable: false });
  render(<MesPaiementsPage />);
  expect(await screen.findByText('Appartement Moungali')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Payer maintenant/ })).not.toBeInTheDocument();
  expect(screen.getByText(/paiement en ligne des visites est temporairement indisponible/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Contacter un agent/ })).toBeInTheDocument();
  expect(initierPaiementVisite).not.toHaveBeenCalled();
});

test('paiement explicitement réactivé : le bouton de paiement reste disponible', async () => {
  getMyPayments.mockResolvedValue({ visites: [pendingVisit], paymentInitiationAvailable: true });
  render(<MesPaiementsPage />);
  expect(await screen.findByRole('button', { name: /Payer maintenant/ })).toBeInTheDocument();
});
