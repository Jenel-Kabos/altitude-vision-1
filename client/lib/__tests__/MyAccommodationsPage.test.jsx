import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import MyAccommodationsPage from '../pages/dashboard/MyAccommodationsPage';
import { getMyProperties } from '../services/propertyService';
import {
  getMyAccommodations,
  deactivateAccommodation,
  reactivateAccommodation,
  duplicateAccommodation,
  deleteAccommodation,
} from '../services/accommodationService';

// Sprint B1 — cycle de vie propriétaire (désactiver/dupliquer/supprimer) +
// affichage du score de complétude.

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/propertyService', () => ({ getMyProperties: vi.fn() }));
vi.mock('../services/accommodationService', () => ({
  getMyAccommodations: vi.fn(),
  createAccommodation: vi.fn(),
  updateAccommodation: vi.fn(),
  submitAccommodation: vi.fn(),
  upsertAccommodationRate: vi.fn(),
  deactivateAccommodation: vi.fn(),
  reactivateAccommodation: vi.fn(),
  duplicateAccommodation: vi.fn(),
  deleteAccommodation: vi.fn(),
}));

const PROPERTY = { _id: 'PROP-1', title: 'Villa Test', status: 'hebergement', address: { city: 'Brazzaville' } };

const accommodation = (overrides = {}) => ({
  _id: 'ACC-1',
  property: PROPERTY,
  accommodationType: 'villa_meublee',
  publicationStatus: 'publie',
  active: true,
  capacity: { maxAdults: 4, maxChildren: 0 },
  completion: { score: 80, complete: false, breakdown: { informations: 20, photos: 20, tarifs: 20, equipements: 0, regles: 10, services: 10 } },
  ...overrides,
});

describe('MyAccommodationsPage — Sprint B1 (cycle de vie propriétaire) — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMyProperties.mockResolvedValue([PROPERTY]);
  });

  test("contrôle final Sprint B2 — un hébergement de type 'hotel' n'apparaît plus ici (géré depuis Mes hôtels)", async () => {
    const hotelProperty = { _id: 'PROP-HOTEL', title: 'Hôtel Test', status: 'hebergement', address: { city: 'Brazzaville' } };
    getMyProperties.mockResolvedValue([PROPERTY, hotelProperty]);
    getMyAccommodations.mockResolvedValue([
      accommodation(),
      accommodation({ _id: 'ACC-HOTEL', property: hotelProperty, accommodationType: 'hotel' }),
    ]);
    render(<MyAccommodationsPage />);
    expect(await screen.findByText('Villa Test')).toBeInTheDocument();
    expect(screen.queryByText('Hôtel Test')).not.toBeInTheDocument();
  });

  test('affiche le score de complétude de l\'hébergement', async () => {
    getMyAccommodations.mockResolvedValue([accommodation()]);
    render(<MyAccommodationsPage />);
    expect(await screen.findByText('Complétude 80%')).toBeInTheDocument();
  });

  test('un hébergement publié et actif propose "Désactiver"', async () => {
    getMyAccommodations.mockResolvedValue([accommodation()]);
    render(<MyAccommodationsPage />);
    const button = await screen.findByRole('button', { name: 'Désactiver' });
    deactivateAccommodation.mockResolvedValue({});
    fireEvent.click(button);
    await waitFor(() => expect(deactivateAccommodation).toHaveBeenCalledWith('ACC-1'));
    expect(toast.success).toHaveBeenCalled();
  });

  test('un hébergement désactivé affiche le badge "Désactivée" et propose "Réactiver"', async () => {
    getMyAccommodations.mockResolvedValue([accommodation({ active: false })]);
    render(<MyAccommodationsPage />);
    expect(await screen.findByText('Désactivée')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Réactiver' });
    reactivateAccommodation.mockResolvedValue({});
    fireEvent.click(button);
    await waitFor(() => expect(reactivateAccommodation).toHaveBeenCalledWith('ACC-1'));
  });

  test('dupliquer un hébergement appelle le service et recharge la liste', async () => {
    getMyAccommodations.mockResolvedValue([accommodation()]);
    duplicateAccommodation.mockResolvedValue({ property: {}, accommodation: {} });
    render(<MyAccommodationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dupliquer' }));
    await waitFor(() => expect(duplicateAccommodation).toHaveBeenCalledWith('ACC-1'));
    expect(toast.success).toHaveBeenCalled();
  });

  test('supprimer un hébergement demande confirmation avant d\'appeler le service', async () => {
    getMyAccommodations.mockResolvedValue([accommodation()]);
    deleteAccommodation.mockResolvedValue();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MyAccommodationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(deleteAccommodation).toHaveBeenCalledWith('ACC-1'));
    confirmSpy.mockRestore();
  });

  test('annuler la confirmation de suppression n\'appelle pas le service', async () => {
    getMyAccommodations.mockResolvedValue([accommodation()]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MyAccommodationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));
    expect(deleteAccommodation).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
