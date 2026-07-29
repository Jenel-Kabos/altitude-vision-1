import { fireEvent, render, screen } from '@testing-library/react';
import AccommodationDetailPage from '../pages/dashboard/AccommodationDetailPage';
import { getAccommodation } from '../services/accommodationService';
import { getDashboardAnalytics } from '../services/dashboardAnalyticsService';

let requestedView = null;
vi.mock('next/navigation', () => ({ useSearchParams: () => ({ get: () => requestedView }) }));
vi.mock('next/link', () => ({ default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/accommodationService', () => ({ getAccommodation: vi.fn(), createFullAccommodation: vi.fn(), updateFullAccommodation: vi.fn() }));
vi.mock('../services/dashboardAnalyticsService', () => ({ getDashboardAnalytics: vi.fn() }));
vi.mock('../components/dashboard/AccommodationPropertyForm', () => ({ default: () => <div>FORMULAIRE DÉTAIL</div> }));
vi.mock('../components/dashboard/AccommodationReservationsPanel', () => ({ default: ({ initialTab, initialAccommodationId }) => <div>OPÉRATIONS {initialTab} {initialAccommodationId}</div> }));

const accommodation = { _id: 'ACC-1', accommodationType: 'villa_meublee', capacity: { maxAdults: 4, maxChildren: 2 }, property: { title: 'Villa Test', price: 35000, availability: 'Disponible', address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, images: [] } };

describe('AccommodationDetailPage', () => {
  beforeEach(() => { requestedView = null; vi.clearAllMocks(); getAccommodation.mockResolvedValue(accommodation); getDashboardAnalytics.mockResolvedValue({ kpis: {} }); });

  test('devient le centre opérationnel du bien avec vue d’ensemble et analytics filtrés', async () => {
    render(<AccommodationDetailPage accommodationId="ACC-1"/>);
    expect(await screen.findByRole('heading', { name: 'Villa Test' })).toBeInTheDocument();
    expect(screen.getByText('Informations générales')).toBeInTheDocument();
    expect(screen.getByText('Historique opérationnel')).toBeInTheDocument();
    expect(getDashboardAnalytics).toHaveBeenCalledWith('accommodations', { accommodationId: 'ACC-1' });
  });

  test('ouvre directement réservations, calendrier et finances dans le contexte du bien', async () => {
    requestedView = 'reservations'; const { unmount } = render(<AccommodationDetailPage accommodationId="ACC-1"/>);
    expect(await screen.findByText('OPÉRATIONS reservations ACC-1')).toBeInTheDocument(); unmount();
    requestedView = 'calendar'; render(<AccommodationDetailPage accommodationId="ACC-1"/>);
    expect(await screen.findByText('OPÉRATIONS calendar ACC-1')).toBeInTheDocument();
  });

  test('permet la création manuelle et la modification depuis la fiche', async () => {
    render(<AccommodationDetailPage accommodationId="ACC-1"/>); await screen.findByText('Informations générales');
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle réservation' }));
    expect(screen.getByText('OPÉRATIONS new ACC-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(screen.getByText('FORMULAIRE DÉTAIL')).toBeInTheDocument();
  });
});
