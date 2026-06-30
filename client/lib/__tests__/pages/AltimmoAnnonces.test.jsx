import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────
// vi.hoisted : nécessaire car vi.mock est hoisted mais const ne l'est pas
const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter:       () => ({ replace: mockReplace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/link', () => ({ default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }));
vi.mock('framer-motion', () => ({
  motion: {
    div:    ({ children, ...p }) => <div {...p}>{children}</div>,
    section:({ children, ...p }) => <section {...p}>{children}</section>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

// Mock des propriétés de test
const FAKE_PROPERTIES = [
  { _id: '1', title: 'Appartement T3', price: 500000, status: 'À vendre', type: 'Appartement', availability: 'Disponible', images: [], address: { city: 'Brazzaville' }, createdAt: new Date().toISOString() },
  { _id: '2', title: 'Villa Moderne',  price: 200000, status: 'À vendre', type: 'Villa',        availability: 'Disponible', images: [], address: { city: 'Brazzaville' }, createdAt: new Date().toISOString() },
  { _id: '3', title: 'Studio Centre',  price: 100000, status: 'En location', type: 'Appartement', availability: 'Loué',    images: [], address: { city: 'Brazzaville' }, createdAt: new Date().toISOString() },
];

const { mockGetAll } = vi.hoisted(() => ({ mockGetAll: vi.fn() }));
vi.mock('../../services/propertyService', () => ({
  getAllProperties: (...args) => mockGetAll(...args),
}));

// Mock PropertyCard → affiche simplement le titre
vi.mock('../../components/PropertyCard', () => ({
  default: ({ property }) => <div data-testid="property-card">{property.title}</div>,
}));
vi.mock('../../components/PropertySkeleton', () => ({
  PropertySkeletonGrid: () => <div data-testid="skeleton" />,
  PropertySkeletonList: () => <div data-testid="skeleton" />,
}));

import AltimmoAnnonces from '../../pages/AltimmoAnnonces';

// ─────────────────────────────────────────────────────────────
describe('AltimmoAnnonces — rendu initial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue(FAKE_PROPERTIES);
  });

  it('affiche les 3 annonces après chargement', async () => {
    render(<AltimmoAnnonces />);
    await waitFor(() => {
      expect(screen.getAllByTestId('property-card')).toHaveLength(3);
    });
  });

  it('affiche le titre de section', async () => {
    render(<AltimmoAnnonces />);
    expect(screen.getByText(/Nos Biens Immobiliers/i)).toBeInTheDocument();
  });

  it('affiche le skeleton pendant le chargement', () => {
    // Simule une requête lente
    mockGetAll.mockImplementation(() => new Promise(() => {}));
    render(<AltimmoAnnonces />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('AltimmoAnnonces — validation prix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue(FAKE_PROPERTIES);
  });

  const openFilters = async () => {
    render(<AltimmoAnnonces />);
    // Attendre que les annonces soient chargées
    await waitFor(() => expect(screen.getAllByTestId('property-card')).toHaveLength(3));
    // Ouvrir le panneau de filtres
    await userEvent.click(screen.getByRole('button', { name: /Filtres/i }));
  };

  it('affiche le message d\'erreur quand prix min > max', async () => {
    await openFilters();

    const minInput = screen.getByRole('spinbutton', { name: /Prix minimum/i });
    const maxInput = screen.getByRole('spinbutton', { name: /Prix maximum/i });

    await userEvent.type(minInput, '500000');
    await userEvent.type(maxInput, '100000');

    expect(await screen.findByText(/Le prix minimum ne peut pas dépasser le maximum/i)).toBeInTheDocument();
  });

  it('n\'affiche pas l\'erreur quand prix min ≤ max', async () => {
    await openFilters();

    const minInput = screen.getByRole('spinbutton', { name: /Prix minimum/i });
    const maxInput = screen.getByRole('spinbutton', { name: /Prix maximum/i });

    await userEvent.type(minInput, '100000');
    await userEvent.type(maxInput, '500000');

    expect(screen.queryByText(/Le prix minimum ne peut pas dépasser le maximum/i)).not.toBeInTheDocument();
  });

  it('n\'affiche pas l\'erreur avec un seul prix renseigné', async () => {
    await openFilters();

    const minInput = screen.getByRole('spinbutton', { name: /Prix minimum/i });
    await userEvent.type(minInput, '999999');

    expect(screen.queryByText(/Le prix minimum ne peut pas dépasser le maximum/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AltimmoAnnonces — URL de redirection (bug corrigé)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue(FAKE_PROPERTIES);
  });

  it('remplace l\'URL avec /altimmo/annonces (et non /immobilier/annonces)', async () => {
    render(<AltimmoAnnonces />);
    await waitFor(() => expect(screen.getAllByTestId('property-card')).toHaveLength(3));

    // router.replace doit toujours être appelé avec le bon chemin
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringMatching(/^\/altimmo\/annonces/),
    );
    expect(mockReplace).not.toHaveBeenCalledWith(
      expect.stringMatching(/\/immobilier\/annonces/),
    );
  });
});

// ─────────────────────────────────────────────────────────────
describe('AltimmoAnnonces — logique de filtre (pure)', () => {
  // Test de la logique métier sans UI
  const applyFilters = (properties, { searchTerm = '', status = 'Tous', type = 'Tous', avail = 'Tous', priceMin = '', priceMax = '' } = {}) => {
    let f = [...properties];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      f = f.filter(p =>
        [p.title, p.type, p.address?.city].filter(Boolean).join(' ').toLowerCase().includes(q)
      );
    }
    if (status !== 'Tous') f = f.filter(p => p.status === status);
    if (type   !== 'Tous') f = f.filter(p => p.type === type);
    if (avail  !== 'Tous') f = f.filter(p => p.availability === avail);
    if (priceMin && !isNaN(priceMin)) f = f.filter(p => (p.price || 0) >= Number(priceMin));
    if (priceMax && !isNaN(priceMax)) f = f.filter(p => (p.price || 0) <= Number(priceMax));
    return f;
  };

  it('filtre par terme de recherche', () => {
    const result = applyFilters(FAKE_PROPERTIES, { searchTerm: 'villa' });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Villa Moderne');
  });

  it('filtre par statut', () => {
    const result = applyFilters(FAKE_PROPERTIES, { status: 'En location' });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Studio Centre');
  });

  it('filtre par type de bien', () => {
    const result = applyFilters(FAKE_PROPERTIES, { type: 'Appartement' });
    expect(result).toHaveLength(2);
  });

  it('filtre par fourchette de prix (min seulement)', () => {
    const result = applyFilters(FAKE_PROPERTIES, { priceMin: '300000' });
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(500000);
  });

  it('filtre par fourchette de prix (min + max)', () => {
    const result = applyFilters(FAKE_PROPERTIES, { priceMin: '150000', priceMax: '600000' });
    expect(result).toHaveLength(2);
  });

  it('retourne 0 résultats si aucun bien ne correspond', () => {
    const result = applyFilters(FAKE_PROPERTIES, { searchTerm: 'inexistant' });
    expect(result).toHaveLength(0);
  });

  it('retourne tout si aucun filtre actif', () => {
    const result = applyFilters(FAKE_PROPERTIES);
    expect(result).toHaveLength(3);
  });

  const priceRangeInvalid = (min, max) =>
    min && max && Number(min) > Number(max);

  it('priceRangeInvalid est vrai quand min > max', () => {
    expect(priceRangeInvalid('500000', '100000')).toBeTruthy();
  });

  it('priceRangeInvalid est faux quand min < max', () => {
    expect(priceRangeInvalid('100000', '500000')).toBeFalsy();
  });

  it('priceRangeInvalid est faux avec un seul champ renseigné', () => {
    expect(priceRangeInvalid('100000', '')).toBeFalsy();
    expect(priceRangeInvalid('', '500000')).toBeFalsy();
  });
});
