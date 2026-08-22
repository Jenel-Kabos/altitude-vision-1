import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HotelModerationPage from '../pages/dashboard/HotelModerationPage';
import { getPendingHotels, reviewHotel } from '../services/hotelService';

vi.mock('../utils/toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/hotelService', () => ({ getPendingHotels: vi.fn(), reviewHotel: vi.fn() }));

// AUDIT-HOTEL-MODERATION-TEST-DRIFT-1 — HOTFIX-MODERATION-HOTEL-UI-1 a aligné
// cette page sur le pattern déjà en place dans PropertyModerationPage.jsx /
// AccommodationModerationPage.jsx : une grille de cartes compactes ("Voir les
// détails") ouvrant une modale qui porte désormais les actions de modération
// et la comparaison de version proposée — auparavant affichées directement
// inline dans chaque carte. Endpoints, payloads, règle du motif de rejet
// obligatoire et transitions métier sont restés strictement identiques (voir
// server/docs/AUDIT_HOTEL_MODERATION_TEST_DRIFT1_DIFF_MATRIX.md) ; seul le
// chemin d'interaction pour les atteindre a changé — les tests ouvrent donc
// désormais la modale via son vrai déclencheur ("Voir les détails") avant
// d'asserter sur son contenu, sans jamais affaiblir la portée des assertions
// métier d'origine.
describe('HotelModerationPage — versions sensibles proposées', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPendingHotels.mockResolvedValue([{
      _id: 'HOTEL-1', name: 'Nom publié', starRating: 4,
      property: { title: 'Nom publié', address: { city: 'Brazzaville' }, images: [] },
      categories: [], hotelServices: {},
      proposedVersion: { status: 'pending', hotelChanges: { name: 'Nom proposé' }, propertyChanges: { address: { city: 'Pointe-Noire' } } },
    }]);
    reviewHotel.mockResolvedValue({});
  });

  const openDetails = async () => {
    render(<HotelModerationPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Voir les détails/i }));
  };

  test('compare la proposition en rappelant que la version publiée reste active', async () => {
    await openDetails();
    // Le texte apparaît deux fois dans la modale (badge + en-tête de section) —
    // les deux affichages sont attendus, même pattern que
    // PropertyModerationPage.test.jsx pour un contenu dupliqué légitimement.
    expect((await screen.findAllByText('Modification sensible proposée')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/version actuellement publiée reste exploitée/i)).toBeInTheDocument();
    expect(screen.getByText(/Nom proposé/)).toBeInTheDocument();
    expect(screen.getByText(/Pointe-Noire/)).toBeInTheDocument();
  });

  test('valide la proposition uniquement depuis Modération Hôtellerie', async () => {
    await openDetails();
    fireEvent.click(await screen.findByRole('button', { name: 'Valider' }));
    await waitFor(() => expect(reviewHotel).toHaveBeenCalledWith('HOTEL-1', 'validate'));
  });

  test('le rejet exige un motif et appelle reviewHotel avec le bon payload', async () => {
    await openDetails();
    fireEvent.click(await screen.findByRole('button', { name: 'Rejeter' }));

    // Motif vide : aucun appel réseau ne doit partir.
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer le rejet' }));
    expect(reviewHotel).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText(/Expliquez pourquoi cet hôtel est rejeté/i), {
      target: { value: 'Photos insuffisantes' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le rejet' }));
    await waitFor(() => expect(reviewHotel).toHaveBeenCalledWith('HOTEL-1', 'reject', { reason: 'Photos insuffisantes' }));
  });
});
