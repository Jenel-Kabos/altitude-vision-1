import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ManageHotelRatesPage from '../pages/dashboard/ManageHotelRatesPage';
import { getRoomCategories, getRoomCategoryRates, upsertRoomCategoryRate } from '../services/hotelService';

vi.mock('next/navigation', () => ({ useParams: () => ({ hotelId: 'hotel-1' }), useSearchParams: () => new URLSearchParams() }));
vi.mock('next/link', () => ({ default: ({ children, href }) => <a href={href}>{children}</a> }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/hotelService', () => ({
  getRoomCategories: vi.fn(), getRoomCategoryRates: vi.fn(), upsertRoomCategoryRate: vi.fn(), archiveRoomCategoryRate: vi.fn(),
}));

describe('ManageHotelRatesPage — PHASE-HX1 §13-14 (conditions commerciales H5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRoomCategories.mockResolvedValue([{ _id: 'cat-1', name: 'Standard' }]);
    getRoomCategoryRates.mockResolvedValue([]);
  });

  test('expose un sélecteur de plan repas et de conditions d’annulation (jamais paymentPolicy)', async () => {
    render(<ManageHotelRatesPage />);
    await screen.findByText('Standard');
    expect(screen.getByLabelText("Plan repas Tarif public")).toBeInTheDocument();
    expect(screen.getByLabelText("Conditions d'annulation Tarif public")).toBeInTheDocument();
    expect(screen.queryByLabelText(/paiement/i)).toBeNull();
  });

  test('choisir un plan repas et l’enregistrer envoie l’enum canonique au backend', async () => {
    upsertRoomCategoryRate.mockResolvedValue({});
    render(<ManageHotelRatesPage />);
    await screen.findByText('Standard');
    fireEvent.change(screen.getByLabelText('Tarif de base Tarif public'), { target: { value: '50000' } });
    fireEvent.change(screen.getByLabelText('Plan repas Tarif public'), { target: { value: 'breakfast_included' } });
    fireEvent.click(screen.getAllByText('OK')[0]);
    await waitFor(() => expect(upsertRoomCategoryRate).toHaveBeenCalledWith('cat-1', expect.objectContaining({ mealPlan: 'breakfast_included' })));
  });

  test('choisir "flexible" révèle délai/pénalité ; "non remboursable" les masque', async () => {
    render(<ManageHotelRatesPage />);
    await screen.findByText('Standard');
    fireEvent.change(screen.getByLabelText("Conditions d'annulation Tarif public"), { target: { value: 'flexible' } });
    expect(screen.getByLabelText("Délai d'annulation Tarif public (heures)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Conditions d'annulation Tarif public"), { target: { value: 'non_refundable' } });
    expect(screen.queryByLabelText("Délai d'annulation Tarif public (heures)")).toBeNull();
  });

  test('une politique flexible complète est soumise avec délai et pénalité canoniques', async () => {
    upsertRoomCategoryRate.mockResolvedValue({});
    render(<ManageHotelRatesPage />);
    await screen.findByText('Standard');
    fireEvent.change(screen.getByLabelText('Tarif de base Tarif public'), { target: { value: '50000' } });
    fireEvent.change(screen.getByLabelText("Conditions d'annulation Tarif public"), { target: { value: 'flexible' } });
    fireEvent.change(screen.getByLabelText("Délai d'annulation Tarif public (heures)"), { target: { value: '48' } });
    fireEvent.change(screen.getByLabelText('Type de pénalité Tarif public'), { target: { value: 'percentage' } });
    fireEvent.change(screen.getByLabelText('Valeur de la pénalité Tarif public'), { target: { value: '30' } });
    fireEvent.click(screen.getAllByText('OK')[0]);
    await waitFor(() => expect(upsertRoomCategoryRate).toHaveBeenCalledWith('cat-1', expect.objectContaining({
      cancellation: { type: 'flexible', deadlineHoursBeforeCheckIn: 48, penaltyType: 'percentage', penaltyValue: 30 },
    })));
  });

  test('sans condition renseignée, aucun champ commercial n’est envoyé (jamais un enum fabriqué)', async () => {
    upsertRoomCategoryRate.mockResolvedValue({});
    render(<ManageHotelRatesPage />);
    await screen.findByText('Standard');
    fireEvent.change(screen.getByLabelText('Tarif de base Tarif public'), { target: { value: '50000' } });
    fireEvent.click(screen.getAllByText('OK')[0]);
    await waitFor(() => expect(upsertRoomCategoryRate).toHaveBeenCalledWith('cat-1', expect.objectContaining({ mealPlan: undefined, cancellation: undefined })));
  });
});
