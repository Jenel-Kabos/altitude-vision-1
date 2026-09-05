import { render, screen, waitFor } from '@testing-library/react';
import HotelReviewsDashboardPage from '../pages/dashboard/HotelReviewsDashboardPage';
import { getHotelReviewsForOwner } from '../services/hotelService';

vi.mock('next/navigation', () => ({ useParams: () => ({ hotelId: 'hotel-1' }) }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/hotelService', () => ({ getHotelReviewsForOwner: vi.fn() }));

describe('HotelReviewsDashboardPage — PHASE-HX1 §24 (lecture seule)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  test('affiche la note moyenne et le nombre d’avis réels', async () => {
    getHotelReviewsForOwner.mockResolvedValue({
      summary: { averageRating: 4.5, reviewCount: 2, categories: null },
      reviews: [{ id: 'r1', overallRating: 5, comment: 'Excellent séjour.', author: 'Thibaut K.', verifiedStay: true, createdAt: '2026-01-10T00:00:00.000Z' }],
      pagination: { page: 1, pages: 1, total: 1 },
    });
    render(<HotelReviewsDashboardPage />);
    expect(await screen.findByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('2 avis vérifiés')).toBeInTheDocument();
    expect(screen.getByText('Excellent séjour.')).toBeInTheDocument();
    expect(screen.getByText('Séjour vérifié')).toBeInTheDocument();
  });

  test('aucun avis : état neutre, jamais une note fabriquée', async () => {
    getHotelReviewsForOwner.mockResolvedValue({ summary: { averageRating: null, reviewCount: 0, categories: null }, reviews: [], pagination: { page: 1, pages: 1, total: 0 } });
    render(<HotelReviewsDashboardPage />);
    expect(await screen.findByText('Aucun avis pour le moment.')).toBeInTheDocument();
    expect(screen.queryByText(/5\.0|Nouveau/)).toBeNull();
  });

  test('aucune donnée privée (email, ID) n’est exposée', async () => {
    getHotelReviewsForOwner.mockResolvedValue({
      summary: { averageRating: 5, reviewCount: 1, categories: null },
      reviews: [{ id: 'r1', overallRating: 5, comment: 'x', author: 'Thibaut K.', verifiedStay: true, createdAt: '2026-01-10T00:00:00.000Z' }],
      pagination: { page: 1, pages: 1, total: 1 },
    });
    const { container } = render(<HotelReviewsDashboardPage />);
    await waitFor(() => expect(screen.getByText('x')).toBeInTheDocument());
    expect(container.innerHTML).not.toMatch(/@|reservation|userId/i);
  });

  test('aucun bouton "répondre" (REVIEW_RESPONSE non implémenté)', async () => {
    getHotelReviewsForOwner.mockResolvedValue({
      summary: { averageRating: 5, reviewCount: 1, categories: null },
      reviews: [{ id: 'r1', overallRating: 5, comment: 'x', author: 'Thibaut K.', verifiedStay: true, createdAt: '2026-01-10T00:00:00.000Z' }],
      pagination: { page: 1, pages: 1, total: 1 },
    });
    render(<HotelReviewsDashboardPage />);
    await screen.findByText('x');
    expect(screen.queryByText(/répondre/i)).toBeNull();
  });
});
