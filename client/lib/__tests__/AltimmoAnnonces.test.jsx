import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AltimmoAnnonces from '../pages/AltimmoAnnonces';
import * as propertyService from '../services/propertyService';

// Audit filtrage Altimmo — nomenclature canonique (offerType/propertyType/city/
// arrondissement/minPrice/maxPrice), fix de l'URL réécrite (/immobilier/annonces),
// compatibilité des anciens noms d'URL (status/type/ville/priceMin/priceMax).

const replace = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => currentSearchParams,
}));

vi.mock('framer-motion', () => {
  const strip = ({ initial, animate, exit, transition, whileInView, viewport, whileHover, whileTap, variants, children, ...props }) => ({ children, props });
  const make = (Tag) => (props) => {
    const clean = strip(props);
    return React.createElement(Tag, clean.props, clean.children);
  };
  return { motion: new Proxy({}, { get: (_t, tag) => make(tag) }), AnimatePresence: ({ children }) => children };
});

vi.mock('../components/PropertyCard', () => ({ default: ({ property }) => <div>{property.title}</div> }));
vi.mock('../components/PropertySkeleton', () => ({
  PropertySkeletonGrid: () => <div data-testid="skeleton-grid" />,
  PropertySkeletonList: () => <div data-testid="skeleton-list" />,
}));

vi.mock('../services/propertyService', () => ({
  getPropertiesWithFilters: vi.fn(),
}));

const property = (overrides = {}) => ({ _id: 'P1', title: 'Bel appartement', ...overrides });

beforeEach(() => {
  vi.clearAllMocks();
  currentSearchParams = new URLSearchParams();
  propertyService.getPropertiesWithFilters.mockResolvedValue({ properties: [property()], total: 1 });
});

describe('AltimmoAnnonces — initialisation depuis l’URL (nomenclature canonique)', () => {
  test('lit offerType/propertyType/city/arrondissement/minPrice/maxPrice depuis l’URL et les transmet au service', async () => {
    currentSearchParams = new URLSearchParams('offerType=location&propertyType=Villa&city=Brazzaville&arrondissement=Bacongo&minPrice=100000&maxPrice=900000');
    render(<AltimmoAnnonces />);
    await waitFor(() => expect(propertyService.getPropertiesWithFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        offerType: 'location', propertyType: 'Villa', city: 'Brazzaville', arrondissement: 'Bacongo',
        minPrice: 100000, maxPrice: 900000,
      }),
    ));
  });

  test('compatibilité legacy : status/type/ville/priceMin/priceMax (anciens liens partagés) sont toujours lus', async () => {
    currentSearchParams = new URLSearchParams('status=vente&type=Studio&ville=Dolisie&priceMin=50000&priceMax=200000');
    render(<AltimmoAnnonces />);
    await waitFor(() => expect(propertyService.getPropertiesWithFilters).toHaveBeenCalledWith(
      expect.objectContaining({ offerType: 'vente', propertyType: 'Studio', city: 'Dolisie', minPrice: 50000, maxPrice: 200000 }),
    ));
  });
});

describe('AltimmoAnnonces — réécriture de l’URL', () => {
  test('réécrit vers /immobilier/annonces (jamais /altimmo/annonces)', async () => {
    render(<AltimmoAnnonces />);
    await waitFor(() => expect(replace).toHaveBeenCalled());
    replace.mock.calls.forEach(([url]) => {
      expect(url.startsWith('/immobilier/annonces')).toBe(true);
      expect(url).not.toContain('/altimmo/annonces');
    });
  });

  test('mêmes critères = mêmes paramètres d’URL que ceux envoyés à l’API', async () => {
    currentSearchParams = new URLSearchParams('offerType=hebergement&city=Pointe-Noire');
    render(<AltimmoAnnonces />);
    await waitFor(() => expect(propertyService.getPropertiesWithFilters).toHaveBeenCalled());
    const [[apiParams]] = propertyService.getPropertiesWithFilters.mock.calls.slice(-1);
    const lastUrl = replace.mock.calls.at(-1)[0];
    const urlParams = new URLSearchParams(lastUrl.split('?')[1] || '');
    expect(urlParams.get('offerType')).toBe(apiParams.offerType);
    expect(urlParams.get('city')).toBe(apiParams.city);
  });
});

describe('AltimmoAnnonces — réinitialisation', () => {
  test('le bouton "Réinitialiser" remet les filtres par défaut et refetch', async () => {
    currentSearchParams = new URLSearchParams('offerType=vente&city=Brazzaville');
    render(<AltimmoAnnonces />);
    await waitFor(() => expect(propertyService.getPropertiesWithFilters).toHaveBeenCalled());
    propertyService.getPropertiesWithFilters.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /Voir tous les biens/i }));

    await waitFor(() => expect(propertyService.getPropertiesWithFilters).toHaveBeenCalledWith(
      expect.objectContaining({ offerType: 'tous', propertyType: 'tous', city: 'Toutes', arrondissement: 'Tous' }),
    ));
  });
});

describe('AltimmoAnnonces — filtres combinés', () => {
  test('type de bien + transaction combinés sont tous deux transmis à l’API', async () => {
    render(<AltimmoAnnonces />);
    await waitFor(() => expect(propertyService.getPropertiesWithFilters).toHaveBeenCalled());
    propertyService.getPropertiesWithFilters.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Filtres' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hébergement' }));
    fireEvent.change(screen.getByLabelText('Type de bien'), { target: { value: 'Studio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    await waitFor(() => expect(propertyService.getPropertiesWithFilters).toHaveBeenCalledWith(
      expect.objectContaining({ offerType: 'hebergement', propertyType: 'Studio' }),
    ));
  });
});

describe('AltimmoAnnonces — pagination', () => {
  test('un changement de page conserve les filtres appliqués', async () => {
    propertyService.getPropertiesWithFilters.mockResolvedValue({
      properties: Array.from({ length: 12 }, (_, i) => property({ _id: `P${i}`, title: `Bien ${i}` })),
      total: 24,
    });
    currentSearchParams = new URLSearchParams('offerType=vente');
    render(<AltimmoAnnonces />);
    await waitFor(() => expect(propertyService.getPropertiesWithFilters).toHaveBeenCalled());
    propertyService.getPropertiesWithFilters.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));

    await waitFor(() => expect(propertyService.getPropertiesWithFilters).toHaveBeenCalledWith(
      expect.objectContaining({ offerType: 'vente', page: 2 }),
    ));
  });
});

describe('AltimmoAnnonces — aucun résultat', () => {
  test('affiche un état vide explicite quand la recherche ne retourne aucun bien', async () => {
    propertyService.getPropertiesWithFilters.mockResolvedValue({ properties: [], total: 0 });
    render(<AltimmoAnnonces />);
    expect(await screen.findByText('Aucun bien trouvé')).toBeInTheDocument();
  });
});
