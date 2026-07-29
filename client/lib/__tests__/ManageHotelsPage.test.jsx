import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import ManageHotelsPage from '../pages/dashboard/ManageHotelsPage';
import { getHotelsAdmin, reviewHotel } from '../services/hotelService';

// Sprint B2 — dashboard admin "Établissements" : filtres par statut, actions
// rapides (valider/rejeter/suspendre/réactiver) avec score de complétude.

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/link', () => ({ default: ({ children, href }) => <a href={href}>{children}</a> }));
vi.mock('../services/hotelService', () => ({
  getHotelsAdmin: vi.fn(),
  reviewHotel: vi.fn(),
}));
vi.mock('../components/dashboard/HotelPropertyForm', () => ({ default: () => <div>FORMULAIRE HÔTEL TEST DATA</div> }));

const hotel = (overrides = {}) => ({
  _id: 'HOTEL-1',
  name: 'Hôtel Le Panorama',
  publicationStatus: 'soumis',
  property: { address: { city: 'Brazzaville' } },
  completion: { score: 100, complete: true },
  ...overrides,
});

describe('ManageHotelsPage — Sprint B2 (dashboard admin) — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getHotelsAdmin.mockResolvedValue({ hotels: [hotel()], total: 1, page: 1, limit: 20 });
  });

  test('affiche les hôtels retournés avec leur statut', async () => {
    render(<ManageHotelsPage />);
    expect(await screen.findByText('Hôtel Le Panorama')).toBeInTheDocument();
    expect(screen.getAllByText('En attente').length).toBeGreaterThan(0);
  });

  test('Ajouter un hôtel ouvre exclusivement HotelPropertyForm', async () => {
    render(<ManageHotelsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un hôtel' }));
    expect(screen.getByText('FORMULAIRE HÔTEL TEST DATA')).toBeInTheDocument();
  });

  test('cliquer sur un onglet de statut relance la requête avec le bon filtre', async () => {
    render(<ManageHotelsPage />);
    await screen.findByText('Hôtel Le Panorama');
    fireEvent.click(screen.getByRole('button', { name: 'Publié' }));
    await waitFor(() => expect(getHotelsAdmin).toHaveBeenCalledWith(expect.objectContaining({ status: 'publie' })));
  });

  test('valider un hôtel soumis appelle reviewHotel("validate")', async () => {
    reviewHotel.mockResolvedValue({});
    render(<ManageHotelsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Valider' }));
    await waitFor(() => expect(reviewHotel).toHaveBeenCalledWith('HOTEL-1', 'validate', {}));
  });

  test("un hôtel incomplet ne peut pas être validé — l'API renvoie le score", async () => {
    reviewHotel.mockRejectedValue({ response: { data: { completion: { score: 60 } } } });
    render(<ManageHotelsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Valider' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('60%')));
  });

  test('suspendre un hôtel publié exige un motif', async () => {
    getHotelsAdmin.mockResolvedValue({ hotels: [hotel({ publicationStatus: 'publie' })], total: 1, page: 1, limit: 20 });
    reviewHotel.mockResolvedValue({});
    render(<ManageHotelsPage />);
    const input = await screen.findByPlaceholderText('Motif de suspension');
    fireEvent.change(input, { target: { value: 'Signalement' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suspendre' }));
    await waitFor(() => expect(reviewHotel).toHaveBeenCalledWith('HOTEL-1', 'suspend', { reason: 'Signalement' }));
  });

  test('un hôtel suspendu propose "Réactiver"', async () => {
    getHotelsAdmin.mockResolvedValue({ hotels: [hotel({ publicationStatus: 'suspendu', suspensionReason: 'Litige' })], total: 1, page: 1, limit: 20 });
    reviewHotel.mockResolvedValue({});
    render(<ManageHotelsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Réactiver' }));
    await waitFor(() => expect(reviewHotel).toHaveBeenCalledWith('HOTEL-1', 'unsuspend', {}));
    expect(screen.getByText(/Litige/)).toBeInTheDocument();
  });
});
