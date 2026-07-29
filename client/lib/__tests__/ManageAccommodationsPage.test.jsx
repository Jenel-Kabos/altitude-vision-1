import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import ManageAccommodationsPage from '../pages/dashboard/ManageAccommodationsPage';
import { getAccommodationsAdmin, reviewAccommodation } from '../services/accommodationService';

// Sprint B1 — dashboard admin "Tous les hébergements" : filtres par statut,
// actions rapides (valider/rejeter/suspendre/réactiver).

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/link', () => ({ default: ({ children, href }) => <a href={href}>{children}</a> }));
vi.mock('../services/accommodationService', () => ({
  getAccommodationsAdmin: vi.fn(),
  reviewAccommodation: vi.fn(),
  createFullAccommodation: vi.fn(),
  updateFullAccommodation: vi.fn(),
}));
vi.mock('../components/dashboard/AccommodationPropertyForm', () => ({ default: () => <div>FORMULAIRE HÉBERGEMENT TEST DATA</div> }));

const acc = (overrides = {}) => ({
  _id: 'ACC-1',
  accommodationType: 'villa_meublee',
  publicationStatus: 'soumis',
  property: { title: 'Villa Test', address: { city: 'Brazzaville' } },
  completion: { score: 100, complete: true },
  ...overrides,
});

describe('ManageAccommodationsPage — Sprint B1 (dashboard admin) — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAccommodationsAdmin.mockResolvedValue({ accommodations: [acc()], total: 1, page: 1, limit: 20 });
  });

  test('affiche les hébergements retournés par le service admin avec leur statut', async () => {
    render(<ManageAccommodationsPage />);
    expect(await screen.findByText('Villa Test')).toBeInTheDocument();
    expect(screen.getAllByText('En attente').length).toBeGreaterThan(0);
  });

  test('Ajouter un hébergement ouvre exclusivement le formulaire hébergement', async () => {
    render(<ManageAccommodationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un hébergement' }));
    expect(screen.getByText('FORMULAIRE HÉBERGEMENT TEST DATA')).toBeInTheDocument();
  });

  test('cliquer sur un onglet de statut relance la requête avec le bon filtre', async () => {
    render(<ManageAccommodationsPage />);
    await screen.findByText('Villa Test');
    fireEvent.click(screen.getByRole('button', { name: 'Publié' }));
    await waitFor(() => expect(getAccommodationsAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'publie' }),
    ));
  });

  test('valider un hébergement soumis appelle reviewAccommodation("validate")', async () => {
    reviewAccommodation.mockResolvedValue({});
    render(<ManageAccommodationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Valider' }));
    await waitFor(() => expect(reviewAccommodation).toHaveBeenCalledWith('ACC-1', 'validate', {}));
  });

  test('rejeter sans motif affiche une erreur et n\'appelle pas le service', async () => {
    render(<ManageAccommodationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Rejeter' }));
    expect(toast.error).toHaveBeenCalled();
    expect(reviewAccommodation).not.toHaveBeenCalled();
  });

  test('suspendre un hébergement publié exige un motif', async () => {
    getAccommodationsAdmin.mockResolvedValue({
      accommodations: [acc({ publicationStatus: 'publie' })], total: 1, page: 1, limit: 20,
    });
    reviewAccommodation.mockResolvedValue({});
    render(<ManageAccommodationsPage />);
    const input = await screen.findByPlaceholderText('Motif de suspension');
    fireEvent.change(input, { target: { value: 'Signalement' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suspendre' }));
    await waitFor(() => expect(reviewAccommodation).toHaveBeenCalledWith('ACC-1', 'suspend', { reason: 'Signalement' }));
  });

  test('un hébergement suspendu propose "Réactiver"', async () => {
    getAccommodationsAdmin.mockResolvedValue({
      accommodations: [acc({ publicationStatus: 'suspendu', suspensionReason: 'Litige' })], total: 1, page: 1, limit: 20,
    });
    reviewAccommodation.mockResolvedValue({});
    render(<ManageAccommodationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Réactiver' }));
    await waitFor(() => expect(reviewAccommodation).toHaveBeenCalledWith('ACC-1', 'unsuspend', {}));
    expect(screen.getByText(/Litige/)).toBeInTheDocument();
  });
});
