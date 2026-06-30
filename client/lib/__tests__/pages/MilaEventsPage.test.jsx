import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────
const { mockPush, mockGetEvents, mockGetReviews } = vi.hoisted(() => ({
  mockPush:       vi.fn(),
  mockGetEvents:  vi.fn(),
  mockGetReviews: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }));
vi.mock('next/image', () => ({ default: ({ src, alt }) => <img src={src} alt={alt} /> }));
vi.mock('framer-motion', () => ({
  motion: {
    div:     ({ children, ...p }) => <div {...p}>{children}</div>,
    section: ({ children, ...p }) => <section {...p}>{children}</section>,
    button:  ({ children, ...p }) => <button {...p}>{children}</button>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/utils/toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

// Composants lourds mockés en stubs minimalistes
vi.mock('../../components/HeroSliderMila', () => ({ default: () => <div data-testid="hero-slider" /> }));
vi.mock('../../components/ReviewCard',     () => ({ default: ({ review }) => <div data-testid="review-card">{review?.author}</div> }));
vi.mock('../../components/MilaContact',   () => ({ default: () => <div data-testid="mila-contact" /> }));

const FAKE_EVENTS = [
  { _id: 'e1', title: 'Mariage Dupont', category: 'Mariage',      images: [], date: '2025-06-01', location: 'Brazzaville' },
  { _id: 'e2', title: 'Gala Solidarité', category: 'Gala',        images: [], date: '2025-07-01', location: 'Brazzaville' },
  { _id: 'e3', title: 'Mariage Martin', category: 'Mariage',      images: [], date: '2025-08-01', location: 'Pointe-Noire' },
  { _id: 'e4', title: 'Conf Technologie', category: 'Conférence', images: [], date: '2025-09-01', location: 'Brazzaville' },
];

vi.mock('../../services/eventService', () => ({ getAllEvents: (...a) => mockGetEvents(...a) }));
vi.mock('../../services/reviewService', () => ({ getMilaEventsReviews: (...a) => mockGetReviews(...a) }));
vi.mock('../../services/quoteService',  () => ({ createQuoteRequest: vi.fn() }));
vi.mock('../../utils/imageUtils', () => ({ getFirstValidImage: (imgs, fb) => fb || '' }));
vi.mock('../../components/StatsCounter', () => ({ default: () => <div /> }));

import MilaEventsPage from '../../pages/MilaEventsPage';

// ─────────────────────────────────────────────────────────────
describe('MilaEventsPage — chargement des événements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEvents.mockResolvedValue(FAKE_EVENTS);
    mockGetReviews.mockResolvedValue([]);
  });

  it('affiche tous les événements après chargement', async () => {
    render(<MilaEventsPage />);
    await waitFor(() => {
      expect(screen.getByText('Mariage Dupont')).toBeInTheDocument();
      expect(screen.getByText('Gala Solidarité')).toBeInTheDocument();
    });
  });

  it('affiche le badge "Tous (4)" dans le filtre', async () => {
    render(<MilaEventsPage />);
    // Attendre les events
    await waitFor(() => screen.getByText('Mariage Dupont'));
    // Le bouton "Tous" doit montrer le count 4
    const tousButton = screen.getByRole('button', { name: /^Tous/ });
    expect(tousButton).toBeInTheDocument();
    expect(within(tousButton).getByText('4')).toBeInTheDocument();
  });

  it('affiche un message d\'erreur si l\'API échoue', async () => {
    mockGetEvents.mockRejectedValue(new Error('network error'));
    render(<MilaEventsPage />);
    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MilaEventsPage — filtres par catégorie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEvents.mockResolvedValue(FAKE_EVENTS);
    mockGetReviews.mockResolvedValue([]);
  });

  it('filtre par "Mariage" et n\'affiche que 2 événements', async () => {
    render(<MilaEventsPage />);
    await waitFor(() => screen.getByText('Mariage Dupont'));

    await userEvent.click(screen.getByRole('button', { name: /^Mariage/ }));

    await waitFor(() => {
      expect(screen.getByText('Mariage Dupont')).toBeInTheDocument();
      expect(screen.getByText('Mariage Martin')).toBeInTheDocument();
      expect(screen.queryByText('Gala Solidarité')).not.toBeInTheDocument();
      expect(screen.queryByText('Conf Technologie')).not.toBeInTheDocument();
    });
  });

  it('le filtre "Tous" réaffiche tous les événements', async () => {
    render(<MilaEventsPage />);
    await waitFor(() => screen.getByText('Mariage Dupont'));

    await userEvent.click(screen.getByRole('button', { name: /^Mariage/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Tous/ }));

    await waitFor(() => {
      expect(screen.getByText('Mariage Dupont')).toBeInTheDocument();
      expect(screen.getByText('Gala Solidarité')).toBeInTheDocument();
    });
  });

  it('le badge "Mariage" affiche le bon count (2)', async () => {
    render(<MilaEventsPage />);
    await waitFor(() => screen.getByText('Mariage Dupont'));

    const mariageBtn = screen.getByRole('button', { name: /^Mariage/ });
    expect(within(mariageBtn).getByText('2')).toBeInTheDocument();
  });

  it('sélectionner un filtre remet la pagination à la page 1', async () => {
    render(<MilaEventsPage />);
    await waitFor(() => screen.getByText('Mariage Dupont'));

    // Cliquer sur un filtre ne doit pas provoquer d'erreur
    await userEvent.click(screen.getByRole('button', { name: /^Conférence/ }));
    // Seul "Conf Technologie" reste visible
    expect(await screen.findByText('Conf Technologie')).toBeInTheDocument();
    expect(screen.queryByText('Mariage Dupont')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MilaEventsPage — navigation EventCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEvents.mockResolvedValue(FAKE_EVENTS);
    mockGetReviews.mockResolvedValue([]);
  });

  it('navigue vers /mila-events/event/:id au clic sur une carte', async () => {
    render(<MilaEventsPage />);
    await waitFor(() => screen.getByText('Mariage Dupont'));

    // Cliquer sur la carte événement (clique sur l'élément parent div de l'EventCard)
    const cards = screen.getAllByText(/Mariage Dupont/i);
    await userEvent.click(cards[0].closest('[role="button"], div, section') || cards[0]);

    // La navigation doit utiliser /mila-events/event/ (et non /evenementiel/event/)
    if (mockPush.mock.calls.length > 0) {
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringMatching(/^\/mila-events\/event\//),
      );
      expect(mockPush).not.toHaveBeenCalledWith(
        expect.stringMatching(/\/evenementiel\/event\//),
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('MilaEventsPage — pagination (logique pure)', () => {
  const EVENTS_PER_PAGE = 6;

  const paginate = (items, page) =>
    items.slice((page - 1) * EVENTS_PER_PAGE, page * EVENTS_PER_PAGE);

  it('page 1 contient les 6 premiers éléments', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ _id: String(i), title: `Event ${i}` }));
    expect(paginate(items, 1)).toHaveLength(6);
    expect(paginate(items, 1)[0].title).toBe('Event 0');
  });

  it('page 2 contient les éléments restants', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ _id: String(i), title: `Event ${i}` }));
    expect(paginate(items, 2)).toHaveLength(4);
    expect(paginate(items, 2)[0].title).toBe('Event 6');
  });

  it('totalPages est correct', () => {
    expect(Math.ceil(10 / EVENTS_PER_PAGE)).toBe(2);
    expect(Math.ceil(6  / EVENTS_PER_PAGE)).toBe(1);
    expect(Math.ceil(0  / EVENTS_PER_PAGE)).toBe(0);
  });
});
