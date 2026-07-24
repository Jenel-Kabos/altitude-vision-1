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
  { _id: '1', title: 'Appartement T3', price: 500000, status: 'vente',    type: 'Appartement', images: [], address: { city: 'Brazzaville', arrondissement: 'Bacongo' }, createdAt: new Date().toISOString() },
  { _id: '2', title: 'Villa Moderne',  price: 200000, status: 'vente',    type: 'Villa',        images: [], address: { city: 'Brazzaville', arrondissement: 'Bacongo' }, createdAt: new Date().toISOString() },
  { _id: '3', title: 'Studio Centre',  price: 100000, status: 'location', type: 'Appartement', images: [], address: { city: 'Brazzaville', arrondissement: 'Bacongo' }, createdAt: new Date().toISOString() },
];

const { mockGetAll } = vi.hoisted(() => ({ mockGetAll: vi.fn() }));
vi.mock('../../services/propertyService', () => ({
  getPropertiesWithFilters: (...args) => mockGetAll(...args),
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
    mockGetAll.mockResolvedValue({ properties: FAKE_PROPERTIES, total: FAKE_PROPERTIES.length });
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
    mockGetAll.mockResolvedValue({ properties: FAKE_PROPERTIES, total: FAKE_PROPERTIES.length });
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
describe('AltimmoAnnonces — URL de redirection (audit filtrage Altimmo : correctif du bug)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue({ properties: FAKE_PROPERTIES, total: FAKE_PROPERTIES.length });
  });

  it('remplace l\'URL avec /immobilier/annonces (route réelle — /altimmo/annonces était un bug, corrigé)', async () => {
    render(<AltimmoAnnonces />);
    await waitFor(() => expect(screen.getAllByTestId('property-card')).toHaveLength(3));

    // router.replace doit toujours être appelé avec le bon chemin (route Next.js réelle)
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringMatching(/^\/immobilier\/annonces/),
    );
    expect(mockReplace).not.toHaveBeenCalledWith(
      expect.stringMatching(/\/altimmo\/annonces/),
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Le filtrage se fait désormais côté serveur (getPropertiesWithFilters) :
// on vérifie que le composant envoie les bons paramètres de requête,
// plutôt que de dupliquer la logique de filtrage en local.
describe('AltimmoAnnonces — paramètres envoyés au serveur', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue({ properties: FAKE_PROPERTIES, total: FAKE_PROPERTIES.length });
  });

  it('ne filtre par défaut sur aucun champ (transaction/type/ville/arrondissement = tous/toutes)', async () => {
    render(<AltimmoAnnonces />);
    await waitFor(() => expect(screen.getAllByTestId('property-card')).toHaveLength(3));

    expect(mockGetAll).toHaveBeenCalledWith(expect.objectContaining({
      offerType:      'tous',
      propertyType:   'tous',
      city:           'Toutes',
      arrondissement: 'Tous',
      page:           1,
      limit:          12,
    }));
  });

  it('ne déclenche AUCUN appel API quand on clique sur un chip/select (draft seul)', async () => {
    render(<AltimmoAnnonces />);
    await waitFor(() => expect(screen.getAllByTestId('property-card')).toHaveLength(3));
    mockGetAll.mockClear();

    await userEvent.click(screen.getByRole('button', { name: /Filtres/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Vente' }));
    await userEvent.selectOptions(screen.getByLabelText('Ville'), 'Brazzaville');

    expect(mockGetAll).not.toHaveBeenCalled();
  });

  it('envoie offerType=vente uniquement après avoir cliqué sur "Rechercher"', async () => {
    render(<AltimmoAnnonces />);
    await waitFor(() => expect(screen.getAllByTestId('property-card')).toHaveLength(3));
    await userEvent.click(screen.getByRole('button', { name: /Filtres/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Vente' }));
    await userEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalledWith(expect.objectContaining({ offerType: 'vente' }));
    });
  });

  it('réinitialise l\'arrondissement à "Tous" quand la ville change (draft)', async () => {
    render(<AltimmoAnnonces />);
    await waitFor(() => expect(screen.getAllByTestId('property-card')).toHaveLength(3));
    await userEvent.click(screen.getByRole('button', { name: /Filtres/i }));

    await userEvent.selectOptions(screen.getByLabelText('Ville'), 'Brazzaville');
    await userEvent.selectOptions(screen.getByLabelText('Arrondissement'), 'Bacongo');
    await userEvent.selectOptions(screen.getByLabelText('Ville'), 'Pointe-Noire');

    expect(screen.getByLabelText('Arrondissement').value).toBe('Tous');
  });

  it('"Réinitialiser" remet le draft ET les filtres appliqués aux valeurs par défaut', async () => {
    render(<AltimmoAnnonces />);
    await waitFor(() => expect(screen.getAllByTestId('property-card')).toHaveLength(3));
    await userEvent.click(screen.getByRole('button', { name: /Filtres/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Vente' }));
    await userEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalledWith(expect.objectContaining({ offerType: 'vente' }));
    });

    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalledWith(expect.objectContaining({ offerType: 'tous' }));
    });
  });

  it('désactive le bouton "Rechercher" quand le prix min > max', async () => {
    render(<AltimmoAnnonces />);
    await waitFor(() => expect(screen.getAllByTestId('property-card')).toHaveLength(3));
    await userEvent.click(screen.getByRole('button', { name: /Filtres/i }));

    await userEvent.type(screen.getByRole('spinbutton', { name: /Prix minimum/i }), '500000');
    await userEvent.type(screen.getByRole('spinbutton', { name: /Prix maximum/i }), '100000');

    expect(screen.getByRole('button', { name: 'Rechercher' })).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────
// Bug corrigé : un changement de filtre déclenchait 2 appels API
// (un avec l'ancienne page, un avec page=1) au lieu d'un seul.
describe('AltimmoAnnonces — pagination et fetch unique par changement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 25 résultats avec limit=12 → 3 pages, de quoi tester un clic manuel sur la page 2.
    mockGetAll.mockResolvedValue({ properties: FAKE_PROPERTIES, total: 25 });
  });

  it('un seul appel API après un changement de filtre alors qu\'on est en page 2', async () => {
    render(<AltimmoAnnonces />);
    await waitFor(() => expect(screen.getAllByTestId('property-card')).toHaveLength(3));

    // Se déplacer en page 2 via la pagination.
    await userEvent.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => {
      expect(mockGetAll).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    });

    mockGetAll.mockClear();

    // Changer un filtre pendant qu'on est en page 2 : doit revenir à la page 1
    // avec UN SEUL appel réseau (pas un premier avec page=2 puis un second avec page=1).
    await userEvent.click(screen.getByRole('button', { name: /Filtres/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Vente' }));
    await userEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalledWith(expect.objectContaining({ offerType: 'vente', page: 1 }));
    });
    expect(mockGetAll).toHaveBeenCalledTimes(1);
  });

  it('un clic sur la page 3 déclenche un seul appel avec page=3', async () => {
    render(<AltimmoAnnonces />);
    await waitFor(() => expect(screen.getAllByTestId('property-card')).toHaveLength(3));
    mockGetAll.mockClear();

    await userEvent.click(screen.getByRole('button', { name: 'Page 3' }));

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalledWith(expect.objectContaining({ page: 3 }));
    });
    expect(mockGetAll).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────
describe('AltimmoAnnonces — validation prix (logique pure)', () => {
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
