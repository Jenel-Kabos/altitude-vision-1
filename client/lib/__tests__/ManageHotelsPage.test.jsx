import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import ManageHotelsPage from '../pages/dashboard/ManageHotelsPage';
import { deactivateHotel, getHotelPortfolio } from '../services/hotelService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/link', () => ({ default: ({ children, href }) => <a href={href}>{children}</a> }));
vi.mock('next/image', () => ({ default: ({ fill: _fill, ...props }) => <img {...props} /> }));
vi.mock('../services/hotelService', () => ({ getHotelPortfolio: vi.fn(), deactivateHotel: vi.fn() }));
vi.mock('../components/dashboard/HotelPropertyForm', () => ({ default: ({ onSuccess }) => <button onClick={() => onSuccess({ hotel: { publicationStatus: 'soumis' } })}>Soumettre le formulaire test</button> }));
vi.mock('../services/dashboardAnalyticsService', () => ({ getDashboardAnalytics: vi.fn().mockResolvedValue({ kpis: {} }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'Admin' } }) }));

const publishedHotel = {
  _id: 'HOTEL-1', name: 'Altitude Hôtel', publicationStatus: 'publie', status: 'actif', active: true,
  starRating: 4, totalRooms: 18, totalCapacity: 41, minNightlyRate: 35000,
  property: { title: 'Altitude Hôtel', images: [], address: { city: 'Brazzaville', arrondissement: 'Centre-ville' }, statusAdmin: 'Validée' },
  operationalStats: { totalRooms: 18, availableRooms: 12, occupiedRooms: 6, occupancyRate: 33.33 },
};

describe('ManageHotelsPage — portefeuille hôtelier validé', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getHotelPortfolio.mockResolvedValue({ hotels: [publishedHotel], total: 1, page: 1, limit: 12 });
    window.confirm = vi.fn(() => true);
  });

  test('affiche les cartes opérationnelles reçues du portefeuille serveur', async () => {
    render(<ManageHotelsPage />);
    expect(await screen.findByText('Altitude Hôtel')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir' })).toHaveAttribute('href', '/dashboard/etablissements/HOTEL-1');
  });

  test('ne propose aucune action de modération', async () => {
    render(<ManageHotelsPage />);
    await screen.findByText('Altitude Hôtel');
    ['Valider', 'Approuver', 'Rejeter', 'Suspendre'].forEach((name) => expect(screen.queryByRole('button', { name })).not.toBeInTheDocument());
  });

  test('recherche via le seul endpoint portefeuille sans statut de modération', async () => {
    render(<ManageHotelsPage />);
    fireEvent.change(await screen.findByLabelText('Rechercher un établissement'), { target: { value: 'Altitude' } });
    await waitFor(() => expect(getHotelPortfolio).toHaveBeenCalledWith(expect.objectContaining({ search: 'Altitude' })));
    expect(getHotelPortfolio.mock.calls.flatMap(([params]) => Object.keys(params))).not.toContain('status');
  });

  test('l’ajout annonce le passage obligatoire par Modération Hôtellerie', async () => {
    render(<ManageHotelsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un établissement' }));
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre le formulaire test' }));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Modération Hôtellerie'));
  });

  test('archive via le cycle de vie hôtelier et retire ensuite la carte', async () => {
    deactivateHotel.mockResolvedValue({});
    render(<ManageHotelsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Archiver' }));
    await waitFor(() => expect(deactivateHotel).toHaveBeenCalledWith('HOTEL-1'));
  });
});
