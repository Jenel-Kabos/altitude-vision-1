import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CREATION_STEPS, HotelCreationWizard } from '../components/dashboard/HotelPropertyForm';
import { toast } from 'react-hot-toast';
import { createFullHotel } from '../services/hotelService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/link', () => ({ default: ({ children, href }) => <a href={href}>{children}</a> }));
vi.mock('../services/hotelService', () => ({
  createFullHotel: vi.fn(), createMyHotel: vi.fn(), updateFullHotel: vi.fn(),
  updateMyHotel: vi.fn(), submitHotel: vi.fn(),
}));

describe('HotelCreationWizard — création puis modération', () => {
  beforeEach(() => vi.clearAllMocks());
  test('parcourt 8 étapes, calcule la capacité dans les catégories et conserve le payload final', async () => {
    createFullHotel.mockResolvedValue({ hotel: { publicationStatus: 'soumis' } });
    const onSuccess = vi.fn();
    render(<HotelCreationWizard accommodationType="hotel" scope="admin" onSuccess={onSuccess} />);

    expect(CREATION_STEPS).toHaveLength(8);
    expect(CREATION_STEPS).not.toContain('Capacité générale');
    expect(screen.getByText('Étape 1/8')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nom de l'hôtel"), { target: { value: 'Altitude Hôtel' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Un hôtel complet' } });
    fireEvent.change(screen.getByLabelText('Téléphone'), { target: { value: '+242060000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    fireEvent.change(screen.getByLabelText('Arrondissement'), { target: { value: 'Poto-Poto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getByRole('heading', { name: 'Catégories de chambres' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une catégorie' }));
    fireEvent.change(screen.getByLabelText('Nom catégorie 1'), { target: { value: 'Standard' } });
    fireEvent.change(screen.getByLabelText('Code catégorie 1'), { target: { value: 'std' } });
    fireEvent.change(screen.getByLabelText('Nombre de chambres 1'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Enfants par chambre 1'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Lits par chambre 1'), { target: { value: '2' } });
    expect(screen.getByRole('heading', { name: /Résumé de capacité/ })).toBeInTheDocument();
    expect(screen.getByText(/3 chambres · 9 personnes · 6 lits/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    fireEvent.change(screen.getByLabelText('Tarif Standard 1'), { target: { value: '35000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    const photo = new File(['photo'], 'hotel.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText("Photos de l'hôtel"), { target: { files: [photo] } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getByText('Étape 8/8')).toBeInTheDocument();
    expect(screen.getByText(/35[\s ]?000 à 35[\s ]?000 XAF/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: "Créer et soumettre l'hôtel" }));
    await waitFor(() => expect(createFullHotel).toHaveBeenCalledTimes(1));
    const submittedData = createFullHotel.mock.calls[0][0];
    const payload = JSON.parse(submittedData.get('publicationPayload'));
    expect(payload).toMatchObject({
      publicationKind: 'hotel_establishment',
      property: { titre: 'Altitude Hôtel', prix: 35000 },
      accommodation: { capacity: { maxAdults: 9 }, hotel: { name: 'Altitude Hôtel' } },
    });
    expect(payload.roomCategories[0]).toMatchObject({ code: 'STD', quantity: 3, beds: 2 });
    expect(onSuccess).toHaveBeenCalledWith({ hotel: { publicationStatus: 'soumis' } });
  });

  test('un conflit de nom conserve le wizard, revient au nom et n’affiche aucun faux succès', async () => {
    createFullHotel.mockRejectedValue({
      response: { status: 409, data: { code: 'HOTEL_NAME_ALREADY_EXISTS', message: 'Un établissement portant ce nom existe déjà dans ce contexte.' } },
    });
    const onSuccess = vi.fn();
    render(<HotelCreationWizard accommodationType="hotel" scope="admin" onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText("Nom de l'hôtel"), { target: { value: 'MILA HOTEL' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Un hôtel complet' } });
    fireEvent.change(screen.getByLabelText('Téléphone'), { target: { value: '+242060000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.change(screen.getByLabelText('Arrondissement'), { target: { value: 'Poto-Poto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une catégorie' }));
    fireEvent.change(screen.getByLabelText('Nom catégorie 1'), { target: { value: 'Standard' } });
    fireEvent.change(screen.getByLabelText('Code catégorie 1'), { target: { value: 'STD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.change(screen.getByLabelText('Tarif Standard 1'), { target: { value: '35000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.change(screen.getByLabelText("Photos de l'hôtel"), { target: { files: [new File(['photo'], 'hotel.jpg', { type: 'image/jpeg' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getByRole('button', { name: "Créer et soumettre l'hôtel" }));

    await waitFor(() => expect(screen.getByText('Étape 1/8')).toBeInTheDocument());
    expect(screen.getByLabelText("Nom de l'hôtel")).toHaveValue('MILA HOTEL');
    expect(screen.getByRole('alert')).toHaveTextContent(/existe déjà/i);
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/existe déjà/i));
    expect(toast.success).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
