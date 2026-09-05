import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HotelPublicDetailPage from '../pages/HotelPublicDetailPage';
import { getPublicHotel } from '../services/hotelService';
import { searchHotelPublicAvailability, getHotelPublicReviews, getNearbyPublicHotels, createPublicHotelReservation } from '../services/hotelReservationService';

vi.mock('next/navigation', () => ({ useParams: () => ({ hotelId: 'hotel-1' }) }));
vi.mock('../services/hotelService', () => ({ getPublicHotel: vi.fn() }));
vi.mock('../services/hotelReservationService', () => ({
  searchHotelPublicAvailability: vi.fn(), getHotelPublicReviews: vi.fn(), getNearbyPublicHotels: vi.fn(),
  getHotelAvailability: vi.fn(), createPublicHotelReservation: vi.fn(),
}));

const fullDetail = {
  id: 'hotel-1', name: 'Altitude Palace', hotelType: 'hotel', starRating: 4,
  description: 'A'.repeat(50),
  gallery: [{ url: 'https://placehold.co/800x600/png?text=1' }, { url: 'https://placehold.co/800x600/png?text=2' }],
  location: { address: 'Avenue de la Paix', district: 'Bacongo', city: 'Brazzaville', coordinates: [15.24, -4.26] },
  amenities: { hotelServices: { restaurant: true, wifi: true, piscine: false }, services: [] },
  policies: { checkIn: '14:00', checkOut: '11:00', cancellation: 'Gratuite 48h avant', pets: null, children: 'Bienvenus', visitors: null, accessibility: null, smoking: null, deposit: null, paymentMethods: null, minimumAge: null },
  roomCategories: [{ id: 'cat-1', name: 'Chambre Deluxe', capacity: { maxAdults: 2 }, bedCount: 2, size: 28, rates: [{ id: 'rate-1', rateType: 'public', amount: 45000, currency: 'XAF' }] }],
  reviewSummary: { averageRating: 4.5, reviewCount: 2, categories: null },
  faq: [{ id: 'faq-1', question: 'Le petit-déjeuner est-il inclus ?', answer: 'Selon le tarif.' }],
};

const fullPayload = {
  hotel: { _id: 'hotel-1', name: 'Altitude Palace' },
  categories: [{ _id: 'cat-1', name: 'Chambre Deluxe', rates: [{ _id: 'rate-1', rateType: 'public', amount: 45000, currency: 'XAF' }] }],
  detail: fullDetail,
};

describe('HotelPublicDetailPage — PHASE-HW1 (parité mobile H1-H5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getHotelPublicReviews.mockResolvedValue({ reviews: [], pagination: { page: 1, limit: 5, total: 0, pages: 1 } });
    getNearbyPublicHotels.mockResolvedValue([]);
  });

  test('hôtel non publié (404) : état explicite, jamais un rendu générique Property', async () => {
    getPublicHotel.mockRejectedValue({ response: { status: 404 } });
    render(<HotelPublicDetailPage />);
    expect(await screen.findByText("Cet hôtel n'est pas disponible.")).toBeInTheDocument();
  });

  test('affiche la galerie (hero) avec le nombre de photos', async () => {
    getPublicHotel.mockResolvedValue(fullPayload);
    render(<HotelPublicDetailPage />);
    expect(await screen.findByText('2 photo(s)')).toBeInTheDocument();
  });

  test('sans galerie, un état vide explicite est affiché (jamais un écran cassé)', async () => {
    getPublicHotel.mockResolvedValue({ ...fullPayload, detail: { ...fullDetail, gallery: [] } });
    render(<HotelPublicDetailPage />);
    expect(await screen.findByText('Aucune photo disponible')).toBeInTheDocument();
  });

  test('affiche l’identité réelle (nom, étoiles, localisation, type)', async () => {
    getPublicHotel.mockResolvedValue(fullPayload);
    render(<HotelPublicDetailPage />);
    expect(await screen.findByText('Altitude Palace')).toBeInTheDocument();
    expect(screen.getByText('Bacongo, Brazzaville')).toBeInTheDocument();
    expect(screen.getByText('hotel')).toBeInTheDocument();
  });

  test('affiche le résumé d’avis réel (jamais une note fabriquée si reviewCount=0)', async () => {
    getPublicHotel.mockResolvedValue({ ...fullPayload, detail: { ...fullDetail, reviewSummary: { averageRating: null, reviewCount: 0, categories: null } } });
    render(<HotelPublicDetailPage />);
    await screen.findByText('Altitude Palace');
    expect(screen.queryByText(/avis$/)).toBeNull();
  });

  test('affiche le résumé d’avis quand des avis existent', async () => {
    getPublicHotel.mockResolvedValue(fullPayload);
    render(<HotelPublicDetailPage />);
    expect(await screen.findByText('4.5 · 2 avis')).toBeInTheDocument();
  });

  test('affiche le catalogue de catégories avant toute recherche (état statique H1)', async () => {
    getPublicHotel.mockResolvedValue(fullPayload);
    render(<HotelPublicDetailPage />);
    expect(await screen.findByText('Chambre Deluxe')).toBeInTheDocument();
    expect(screen.getByText(/Dès 45.000.FCFA/)).toBeInTheDocument();
  });

  test('la recherche de disponibilité multi-catégories affiche les offres réelles avec mealPlan/annulation', async () => {
    getPublicHotel.mockResolvedValue(fullPayload);
    searchHotelPublicAvailability.mockResolvedValue({
      hotelId: 'hotel-1', search: { nights: 2 },
      roomCategories: [{
        id: 'cat-1', name: 'Chambre Deluxe', capacity: { maxAdults: 2 }, beds: 2, size: 28, availableQuantity: 3,
        offers: [{ ratePlanId: 'rate-1', rateType: 'public', amount: 45000, currency: 'XAF', nights: 2, totalAmount: 90000, mealPlan: 'breakfast_included', cancellation: { type: 'free_until', deadlineAt: '2026-09-12T00:00:00.000Z' } }],
      }],
    });
    render(<HotelPublicDetailPage />);
    await screen.findByText('Altitude Palace');
    fireEvent.change(screen.getByLabelText("Date d'arrivée"), { target: { value: '2026-09-20' } });
    fireEvent.change(screen.getByLabelText('Date de départ'), { target: { value: '2026-09-22' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    await waitFor(() => expect(searchHotelPublicAvailability).toHaveBeenCalledWith('hotel-1', expect.objectContaining({ checkIn: '2026-09-20', checkOut: '2026-09-22' })));
    expect(await screen.findByText(/Total 2 nuit\(s\) : 90.000.FCFA/)).toBeInTheDocument();
    expect(screen.getByText('Petit-déjeuner inclus')).toBeInTheDocument();
    expect(screen.getByText(/Annulation gratuite jusqu'au/)).toBeInTheDocument();
  });

  test('aucune disponibilité pour les dates choisies : message dédié', async () => {
    getPublicHotel.mockResolvedValue(fullPayload);
    searchHotelPublicAvailability.mockResolvedValue({ hotelId: 'hotel-1', search: {}, roomCategories: [] });
    render(<HotelPublicDetailPage />);
    await screen.findByText('Altitude Palace');
    fireEvent.change(screen.getByLabelText("Date d'arrivée"), { target: { value: '2026-09-20' } });
    fireEvent.change(screen.getByLabelText('Date de départ'), { target: { value: '2026-09-22' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(await screen.findByText('Aucune chambre disponible pour ces dates.')).toBeInTheDocument();
  });

  test('choisir une offre verrouille le contexte transmis au widget de réservation (jamais recalculé)', async () => {
    getPublicHotel.mockResolvedValue(fullPayload);
    searchHotelPublicAvailability.mockResolvedValue({
      hotelId: 'hotel-1', search: {},
      roomCategories: [{ id: 'cat-1', name: 'Chambre Deluxe', capacity: {}, beds: 2, size: 28, availableQuantity: 3, offers: [{ ratePlanId: 'rate-1', rateType: 'public', amount: 45000, currency: 'XAF', nights: 2, totalAmount: 90000, mealPlan: null, cancellation: null }] }],
    });
    createPublicHotelReservation.mockResolvedValue({ reference: 'RES-1' });
    render(<HotelPublicDetailPage />);
    await screen.findByText('Altitude Palace');
    fireEvent.change(screen.getByLabelText("Date d'arrivée"), { target: { value: '2026-09-20' } });
    fireEvent.change(screen.getByLabelText('Date de départ'), { target: { value: '2026-09-22' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    fireEvent.click(await screen.findByText('Choisir'));
    expect(await screen.findByText('Votre sélection')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Jean' } });
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Dupont' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jean@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Demander la réservation' }));
    await waitFor(() => expect(createPublicHotelReservation).toHaveBeenCalledWith('hotel-1', expect.objectContaining({
      roomCategoryId: 'cat-1', ratePlanId: 'rate-1', checkInDate: '2026-09-20', checkOutDate: '2026-09-22',
    })));
  });

  test('affiche les politiques normalisées réelles', async () => {
    getPublicHotel.mockResolvedValue(fullPayload);
    render(<HotelPublicDetailPage />);
    expect(await screen.findByText('Gratuite 48h avant')).toBeInTheDocument();
    expect(screen.getByText('Bienvenus')).toBeInTheDocument();
    expect(screen.queryByText('Animaux')).toBeNull();
  });

  test('affiche les avis publiés (H3), jamais un composant de commentaires générique Property', async () => {
    getPublicHotel.mockResolvedValue(fullPayload);
    getHotelPublicReviews.mockResolvedValue({
      reviews: [{ id: 'r1', overallRating: 5, comment: 'Excellent séjour.', author: 'Thibaut K.', verifiedStay: true }],
      pagination: { page: 1, limit: 5, total: 1, pages: 1 },
    });
    render(<HotelPublicDetailPage />);
    expect(await screen.findByText('Excellent séjour.')).toBeInTheDocument();
    expect(screen.getByText('Séjour vérifié')).toBeInTheDocument();
    expect(screen.queryByText(/laisser un commentaire/i)).toBeNull();
  });

  test('n’expose aucune donnée privée d’avis (email, ID)', async () => {
    getPublicHotel.mockResolvedValue(fullPayload);
    getHotelPublicReviews.mockResolvedValue({
      reviews: [{ id: 'r1', overallRating: 5, comment: 'x', author: 'Thibaut K.', verifiedStay: true }],
      pagination: { page: 1, limit: 5, total: 1, pages: 1 },
    });
    const { container } = render(<HotelPublicDetailPage />);
    await waitFor(() => expect(screen.getByText('x')).toBeInTheDocument());
    expect(container.innerHTML).not.toMatch(/@|reservationId|userId/i);
  });

  test('affiche la FAQ réelle (jamais fabriquée)', async () => {
    getPublicHotel.mockResolvedValue(fullPayload);
    render(<HotelPublicDetailPage />);
    expect(await screen.findByText('Le petit-déjeuner est-il inclus ?')).toBeInTheDocument();
  });

  test('sans FAQ, aucune section FAQ n’est affichée', async () => {
    getPublicHotel.mockResolvedValue({ ...fullPayload, detail: { ...fullDetail, faq: [] } });
    render(<HotelPublicDetailPage />);
    await screen.findByText('Altitude Palace');
    expect(screen.queryByText('Questions fréquentes')).toBeNull();
  });

  test('affiche les hôtels à proximité réels (H4)', async () => {
    getPublicHotel.mockResolvedValue(fullPayload);
    getNearbyPublicHotels.mockResolvedValue([{ hotelId: 'hotel-2', name: 'Hôtel Voisin', distanceMeters: 850, startingPrice: 32000, heroImage: null }]);
    render(<HotelPublicDetailPage />);
    expect(await screen.findByText('Hôtel Voisin')).toBeInTheDocument();
    expect(screen.getByText('850 m')).toBeInTheDocument();
    const link = screen.getByText('Hôtel Voisin').closest('a');
    expect(link).toHaveAttribute('href', '/immobilier/hotels/hotel-2');
  });
});
