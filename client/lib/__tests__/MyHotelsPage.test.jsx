import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import MyHotelsPage from '../pages/dashboard/MyHotelsPage';
import {
  getMyHotels, submitHotel, deactivateHotel, reactivateHotel, duplicateHotel, deleteHotel,
} from '../services/hotelService';

// Sprint B2 — dashboard propriétaire "Mes hôtels" : cycle de vie
// (soumettre/désactiver/réactiver/dupliquer/supprimer) + score de complétude.

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/link', () => ({ default: ({ children, href }) => <a href={href}>{children}</a> }));
vi.mock('../services/hotelService', () => ({
  getMyHotels: vi.fn(),
  submitHotel: vi.fn(),
  deactivateHotel: vi.fn(),
  reactivateHotel: vi.fn(),
  duplicateHotel: vi.fn(),
  deleteHotel: vi.fn(),
  createMyHotel: vi.fn(),
  updateMyHotel: vi.fn(),
}));

const hotel = (overrides = {}) => ({
  _id: 'HOTEL-1',
  name: 'Hôtel Le Panorama',
  publicationStatus: 'brouillon',
  active: true,
  property: { address: { city: 'Brazzaville' } },
  completion: { score: 60, complete: false },
  ...overrides,
});

describe('MyHotelsPage — Sprint B2 (dashboard propriétaire) — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("affiche le bouton 'Ajouter un hôtel' et le score de complétude", async () => {
    getMyHotels.mockResolvedValue([hotel()]);
    render(<MyHotelsPage />);
    expect(await screen.findByText('Hôtel Le Panorama')).toBeInTheDocument();
    expect(screen.getByText('Complétude 60%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ajouter un hôtel/i })).toBeInTheDocument();
  });

  test("un hôtel brouillon propose 'Soumettre pour validation'", async () => {
    getMyHotels.mockResolvedValue([hotel()]);
    submitHotel.mockResolvedValue({});
    render(<MyHotelsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Soumettre pour validation' }));
    await waitFor(() => expect(submitHotel).toHaveBeenCalledWith('HOTEL-1'));
  });

  test('un hôtel publié et actif propose "Désactiver"', async () => {
    getMyHotels.mockResolvedValue([hotel({ publicationStatus: 'publie' })]);
    deactivateHotel.mockResolvedValue({});
    render(<MyHotelsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Désactiver' }));
    await waitFor(() => expect(deactivateHotel).toHaveBeenCalledWith('HOTEL-1'));
  });

  test('un hôtel désactivé affiche le badge "Désactivé" et propose "Réactiver"', async () => {
    getMyHotels.mockResolvedValue([hotel({ publicationStatus: 'publie', active: false })]);
    reactivateHotel.mockResolvedValue({});
    render(<MyHotelsPage />);
    expect(await screen.findByText('Désactivé')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réactiver' }));
    await waitFor(() => expect(reactivateHotel).toHaveBeenCalledWith('HOTEL-1'));
  });

  test('dupliquer un hôtel appelle le service', async () => {
    getMyHotels.mockResolvedValue([hotel()]);
    duplicateHotel.mockResolvedValue({});
    render(<MyHotelsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dupliquer' }));
    await waitFor(() => expect(duplicateHotel).toHaveBeenCalledWith('HOTEL-1'));
  });

  test('supprimer un hôtel demande confirmation avant d\'appeler le service', async () => {
    getMyHotels.mockResolvedValue([hotel()]);
    deleteHotel.mockResolvedValue();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MyHotelsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(deleteHotel).toHaveBeenCalledWith('HOTEL-1'));
    confirmSpy.mockRestore();
  });

  test("cliquer 'Ajouter un hôtel' affiche HotelPropertyForm (scope owner)", async () => {
    getMyHotels.mockResolvedValue([]);
    render(<MyHotelsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter un hôtel/i }));
    expect(await screen.findByLabelText("Nom de l'hôtel")).toBeInTheDocument();
  });

  test("cliquer 'Modifier la fiche' ouvre le même HotelPropertyForm prérempli en mode édition", async () => {
    getMyHotels.mockResolvedValue([hotel({ description: 'Vue sur le fleuve', phone: '+242060000000' })]);
    render(<MyHotelsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier la fiche' }));
    expect(await screen.findByText('Modifier un hôtel')).toBeInTheDocument();
    expect(screen.getByLabelText("Nom de l'hôtel")).toHaveValue('Hôtel Le Panorama');
  });
});
