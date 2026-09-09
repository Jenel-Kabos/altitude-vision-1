// HOTEL-ROOM-CATEGORY-RATES-NAV-1 — le bouton "Tarifs" doit rester dans le
// namespace courant (`/mes-hotels/...` pour un Proprietaire, `/dashboard/...`
// pour le staff). Un lien absolu vers `/dashboard/hotels/...` renvoyait le
// Proprietaire sur `/mes-biens` via getPostAuthDestination.

import { render, screen } from '@testing-library/react';
import ManageRoomCategoriesPage from '../pages/dashboard/ManageRoomCategoriesPage';
import { getRoomCategories } from '../services/hotelService';

let currentPathname = '/dashboard/hotels/hotel-42/room-categories';
vi.mock('next/navigation', () => ({
  useParams: () => ({ hotelId: 'hotel-42' }),
  usePathname: () => currentPathname,
}));
vi.mock('next/link', () => ({ default: ({ children, href }) => <a href={href}>{children}</a> }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/hotelService', () => ({
  getRoomCategories: vi.fn(),
  createRoomCategory: vi.fn(),
  updateRoomCategory: vi.fn(),
  deleteRoomCategory: vi.fn(),
  duplicateRoomCategory: vi.fn(),
  activateRoomCategory: vi.fn(),
  deactivateRoomCategory: vi.fn(),
  uploadRoomCategoryGallery: vi.fn(),
}));

const categories = [
  { _id: 'cat-std',  name: 'Chambre Standard', capacity: { maxAdults: 2, maxChildren: 0 }, beds: 1, unitsAvailable: 3, status: 'actif' },
  { _id: 'cat-dlx',  name: 'Chambre Deluxe',   capacity: { maxAdults: 2, maxChildren: 1 }, beds: 1, unitsAvailable: 2, status: 'actif' },
  { _id: 'cat-suit', name: 'Suite Panoramique', capacity: { maxAdults: 4, maxChildren: 2 }, beds: 2, unitsAvailable: 1, status: 'actif' },
];

describe('ManageRoomCategoriesPage — Tarifs navigation', () => {
  beforeEach(() => { vi.clearAllMocks(); getRoomCategories.mockResolvedValue(categories); });

  test('rend un lien Tarifs par catégorie (3 catégories → 3 liens)', async () => {
    currentPathname = '/mes-hotels/hotel-42/room-categories';
    render(<ManageRoomCategoriesPage />);
    const links = await screen.findAllByRole('link', { name: 'Tarifs' });
    expect(links).toHaveLength(3);
  });

  test('depuis /mes-hotels le lien Tarifs pointe vers /mes-hotels/:hotelId/rates?category=:categoryId', async () => {
    currentPathname = '/mes-hotels/hotel-42/room-categories';
    render(<ManageRoomCategoriesPage />);
    await screen.findByText('Chambre Standard');
    const links = screen.getAllByRole('link', { name: 'Tarifs' });
    expect(links[0]).toHaveAttribute('href', '/mes-hotels/hotel-42/rates?category=cat-std');
    expect(links[1]).toHaveAttribute('href', '/mes-hotels/hotel-42/rates?category=cat-dlx');
    expect(links[2]).toHaveAttribute('href', '/mes-hotels/hotel-42/rates?category=cat-suit');
    for (const link of links) {
      expect(link.getAttribute('href')).not.toMatch(/\/mes-biens/);
      expect(link.getAttribute('href')).not.toMatch(/^\/dashboard/);
    }
  });

  test('depuis /dashboard/hotels le lien Tarifs reste dans le namespace staff', async () => {
    currentPathname = '/dashboard/hotels/hotel-42/room-categories';
    render(<ManageRoomCategoriesPage />);
    await screen.findByText('Chambre Standard');
    const links = screen.getAllByRole('link', { name: 'Tarifs' });
    expect(links[0]).toHaveAttribute('href', '/dashboard/hotels/hotel-42/rates?category=cat-std');
  });

  test('depuis /mes-hotels le lien "Retour à l\'établissement" pointe vers /mes-hotels/:hotelId', async () => {
    currentPathname = '/mes-hotels/hotel-42/room-categories';
    render(<ManageRoomCategoriesPage />);
    const back = await screen.findByRole('link', { name: /Retour à l'établissement/i });
    expect(back).toHaveAttribute('href', '/mes-hotels/hotel-42');
    expect(back.getAttribute('href')).not.toMatch(/\/dashboard\/hotels/);
    expect(back.getAttribute('href')).not.toMatch(/\/mes-biens/);
  });

  test('depuis /dashboard/hotels le lien "Retour à l\'établissement" reste dans le namespace staff', async () => {
    currentPathname = '/dashboard/hotels/hotel-42/room-categories';
    render(<ManageRoomCategoriesPage />);
    const back = await screen.findByRole('link', { name: /Retour à l'établissement/i });
    expect(back).toHaveAttribute('href', '/dashboard/hotels/hotel-42');
  });
});
