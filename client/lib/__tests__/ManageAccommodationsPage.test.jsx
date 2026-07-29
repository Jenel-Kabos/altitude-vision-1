import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ManageAccommodationsPage from '../pages/dashboard/ManageAccommodationsPage';
import { deactivateAccommodation, getAccommodationsAdmin } from '../services/accommodationService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'Admin' }, canEdit: true }) }));
vi.mock('next/link', () => ({ default: ({ children, href }) => <a href={href}>{children}</a> }));
vi.mock('../services/accommodationService', () => ({ getAccommodationsAdmin: vi.fn(), deactivateAccommodation: vi.fn(), createFullAccommodation: vi.fn(), updateFullAccommodation: vi.fn() }));
vi.mock('../components/dashboard/AccommodationPropertyForm', () => ({ default: () => <div>FORMULAIRE HÉBERGEMENT TEST DATA</div> }));
vi.mock('../services/dashboardAnalyticsService', () => ({ getDashboardAnalytics: vi.fn().mockResolvedValue({ kpis: {} }) }));
vi.mock('../components/dashboard/AccommodationReservationsPanel', () => ({ default: ({ initialTab, initialAccommodationId }) => <div>OPÉRATIONS {initialTab} {initialAccommodationId}</div> }));

const validatedAccommodation = {
  _id: 'ACC-1', accommodationType: 'villa_meublee', publicationStatus: 'publie',
  property: { _id: 'PROPERTY-1', title: 'Villa Test', price: 35000, statusAdmin: 'Validée', address: { city: 'Brazzaville' } },
};

describe('ManageAccommodationsPage — gestion des hébergements validés', () => {
  beforeEach(() => { vi.clearAllMocks(); getAccommodationsAdmin.mockResolvedValue({ accommodations: [validatedAccommodation], total: 1 }); });

  test('la liste des biens est l’unique vue principale et demande uniquement les hébergements indépendants validés', async () => {
    render(<ManageAccommodationsPage />);
    expect(await screen.findByText('Villa Test')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Sections Hébergements' })).not.toBeInTheDocument();
    expect(getAccommodationsAdmin).toHaveBeenCalledWith(expect.objectContaining({ status: 'publie', independentOnly: true, validatedOnly: true, activeOnly: true }));
    expect(screen.queryByRole('button', { name: /Valider|Rejeter|Suspendre/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('accommodation-grid')).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4');
    expect(screen.getByText(/35.000 XAF \/ nuit/)).toBeInTheDocument();
    expect(screen.getByText('Publié')).toBeInTheDocument();
  });

  test('expose la recherche et les filtres métier sans filtre de modération', async () => {
    render(<ManageAccommodationsPage />); await screen.findByText('Villa Test');
    fireEvent.change(screen.getByPlaceholderText('Rechercher un hébergement…'), { target: { value: 'Villa' } });
    fireEvent.change(screen.getByLabelText('Ville'), { target: { value: 'Pointe-Noire' } });
    fireEvent.change(screen.getByLabelText('Disponibilité'), { target: { value: 'Maintenance' } });
    fireEvent.change(screen.getByLabelText('Trier par'), { target: { value: 'prix_desc' } });
    await waitFor(() => expect(getAccommodationsAdmin).toHaveBeenCalledWith(expect.objectContaining({ search: 'Villa', city: 'Pointe-Noire', availability: 'Maintenance', sort: 'prix_desc' })));
    expect(screen.queryByLabelText(/modération/i)).not.toBeInTheDocument();
  });

  test('affiche un skeleton structuré pendant le chargement', () => {
    getAccommodationsAdmin.mockReturnValue(new Promise(() => {}));
    render(<ManageAccommodationsPage />);
    expect(screen.getByRole('status', { name: 'Chargement des hébergements' }).children).toHaveLength(8);
  });

  test('affiche l’état vide et l’action autorisée', async () => {
    getAccommodationsAdmin.mockResolvedValue({ accommodations: [], total: 0 });
    render(<ManageAccommodationsPage />);
    expect(await screen.findByText('Aucun hébergement validé')).toBeInTheDocument();
    expect(screen.getByText(/apparaîtront ici après leur validation/)).toBeInTheDocument();
  });

  test('affiche une erreur accessible et permet de réessayer', async () => {
    getAccommodationsAdmin.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ accommodations: [validatedAccommodation], total: 1 });
    render(<ManageAccommodationsPage />);
    const alert = await screen.findByRole('alert');
    fireEvent.click(within(alert).getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Villa Test')).toBeInTheDocument();
  });

  test('déplace les vues opérationnelles vers la route détail préfiltrée', async () => {
    render(<ManageAccommodationsPage />); await screen.findByText('Villa Test');
    expect(screen.getByRole('link', { name: 'Voir' })).toHaveAttribute('href', '/dashboard/hebergements/ACC-1');
    expect(screen.getByRole('link', { name: 'Réservations' })).toHaveAttribute('href', '/dashboard/hebergements/ACC-1?view=reservations');
    expect(screen.getByRole('link', { name: 'Calendrier' })).toHaveAttribute('href', '/dashboard/hebergements/ACC-1?view=calendar');
    expect(screen.getByRole('link', { name: 'Finances' })).toHaveAttribute('href', '/dashboard/hebergements/ACC-1?view=finance');
    expect(screen.queryByText(/OPÉRATIONS/)).not.toBeInTheDocument();
  });

  test('permet la modification avec le formulaire existant', async () => {
    render(<ManageAccommodationsPage />); await screen.findByText('Villa Test');
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(screen.getByText('FORMULAIRE HÉBERGEMENT TEST DATA')).toBeInTheDocument();
  });

  test('archive sans supprimer l’historique après confirmation', async () => {
    deactivateAccommodation.mockResolvedValue();
    render(<ManageAccommodationsPage />); await screen.findByText('Villa Test');
    fireEvent.click(screen.getByRole('button', { name: 'Archiver' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archiver' }));
    await waitFor(() => expect(deactivateAccommodation).toHaveBeenCalledWith('ACC-1'));
  });
});
