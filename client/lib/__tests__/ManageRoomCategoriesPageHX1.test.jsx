import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import ManageRoomCategoriesPage from '../pages/dashboard/ManageRoomCategoriesPage';
import {
  getRoomCategories, updateRoomCategory, uploadRoomCategoryGallery,
} from '../services/hotelService';

vi.mock('next/navigation', () => ({ useParams: () => ({ hotelId: 'hotel-1' }) }));
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

const category = (overrides = {}) => ({
  _id: 'cat-1', name: 'Standard', description: 'Chambre simple',
  capacity: { maxAdults: 2, maxChildren: 1 }, beds: 1, surface: 20, unitsAvailable: 5,
  amenities: { salon: ['TV'] }, gallery: [{ url: 'https://cloudinary.test/existing.jpg', order: 0 }],
  status: 'actif',
  ...overrides,
});

describe('ManageRoomCategoriesPage — PHASE-HX1 §9 (édition complète)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRoomCategories.mockResolvedValue([category()]);
  });

  test('le formulaire d’édition expose tous les champs canoniques, pas seulement le nom', async () => {
    render(<ManageRoomCategoriesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }));
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Adultes max')).toBeInTheDocument();
    expect(screen.getByLabelText('Enfants max')).toBeInTheDocument();
    expect(screen.getByLabelText('Lits')).toBeInTheDocument();
    expect(screen.getByLabelText('Surface')).toBeInTheDocument();
    expect(screen.getByLabelText('Unités disponibles')).toBeInTheDocument();
  });

  test('modifier la capacité et enregistrer envoie tous les champs au backend', async () => {
    updateRoomCategory.mockResolvedValue(category());
    render(<ManageRoomCategoriesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }));
    fireEvent.change(screen.getByLabelText('Adultes max'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Surface'), { target: { value: '35' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(updateRoomCategory).toHaveBeenCalledWith('cat-1', expect.objectContaining({
      capacity: { maxAdults: 4, maxChildren: 1 }, surface: 35,
    })));
  });

  test('les équipements de la catégorie sont éditables (case à cocher)', async () => {
    updateRoomCategory.mockResolvedValue(category());
    render(<ManageRoomCategoriesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }));
    expect(screen.getByRole('checkbox', { name: 'TV' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Climatisation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(updateRoomCategory).toHaveBeenCalledWith('cat-1', expect.objectContaining({
      amenities: expect.objectContaining({ salon: expect.arrayContaining(['TV', 'Climatisation']) }),
    })));
  });

  test('une photo existante peut être supprimée avant enregistrement', async () => {
    updateRoomCategory.mockResolvedValue(category());
    render(<ManageRoomCategoriesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la photo 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(updateRoomCategory).toHaveBeenCalledWith('cat-1', expect.objectContaining({ gallery: [] })));
  });

  test('une nouvelle photo est envoyée à Cloudinary puis fusionnée dans la galerie (réutilise le mécanisme existant)', async () => {
    uploadRoomCategoryGallery.mockResolvedValue(['https://cloudinary.test/new.jpg']);
    updateRoomCategory.mockResolvedValue(category());
    render(<ManageRoomCategoriesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }));
    const file = new File(['data'], 'chambre.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Ajouter des photos de la chambre'), { target: { files: [file] } });
    await waitFor(() => expect(uploadRoomCategoryGallery).toHaveBeenCalledWith('cat-1', [file]));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(updateRoomCategory).toHaveBeenCalledWith('cat-1', expect.objectContaining({
      gallery: expect.arrayContaining([expect.objectContaining({ url: 'https://cloudinary.test/new.jpg' })]),
    })));
  });
});
