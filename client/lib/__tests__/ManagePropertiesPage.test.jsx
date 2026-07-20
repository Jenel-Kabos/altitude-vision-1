import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ManagePropertiesPage from '../pages/dashboard/ManagePropertiesPage';
import {
  getAllProperties, getPropertyById, addProperty, updateProperty,
} from '../services/propertyService';
import { createFullAccommodation, updateFullAccommodation } from '../services/accommodationService';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { _id: 'TEST-ADMIN', id: 'TEST-ADMIN', role: 'Admin', name: 'TEST ADMIN' },
    canEdit: true, canDelete: true,
  }),
}));

vi.mock('../components/dashboard/MapLeaflet', () => ({ default: () => <div>TEST DATA MAP</div> }));

vi.mock('../services/propertyService', () => ({
  getAllProperties: vi.fn(),
  getPropertyById: vi.fn(),
  deleteProperty: vi.fn(),
  updateProperty: vi.fn(),
  addProperty: vi.fn(),
  toggleRecommande: vi.fn(),
}));

vi.mock('../services/accommodationService', () => ({
  createFullAccommodation: vi.fn(),
  updateFullAccommodation: vi.fn(),
}));

const fillCommonFields = () => {
  fireEvent.change(screen.getByLabelText('Titre du bien'), { target: { value: 'TEST DATA VILLA' } });
  fireEvent.change(screen.getByLabelText('Description du bien'), { target: { value: 'TEST DATA DESCRIPTION' } });
  fireEvent.change(screen.getByLabelText('Prix en FCFA'), { target: { value: '50000' } });
  fireEvent.change(screen.getByLabelText('Ville'), { target: { value: 'Brazzaville' } });
  fireEvent.change(screen.getByLabelText('Quartier'), { target: { value: 'TEST DATA QUARTIER' } });
  // Champ requis par PropertyForm.jsx (HTML5 required) — sans lui, la
  // soumission native du formulaire est bloquée par jsdom avant que
  // handleSubmit ne s'exécute.
  fireEvent.change(screen.getByLabelText('Arrondissement'), { target: { value: 'Bacongo' } });
};

const addFakeImage = () => {
  const input = document.querySelector('input[type="file"]');
  const file = new File(['x'], 'photo.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
};

describe('ManagePropertiesPage — Hébergement (dashboard admin) — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllProperties.mockResolvedValue([]);
  });

  test("l'option Hébergement apparaît dans le formulaire admin", async () => {
    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    const statusSelect = await screen.findByLabelText('Statut');
    const options = within(statusSelect).getAllByRole('option').map((o) => o.value);
    expect(options).toContain('hebergement');
  });

  test('sélectionner Hébergement affiche les bons champs et masque les conditions de bail', async () => {
    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    const statusSelect = await screen.findByLabelText('Statut');
    fireEvent.change(statusSelect, { target: { value: 'hebergement' } });

    expect(screen.getByText("Informations d'hébergement")).toBeInTheDocument();
    expect(screen.getByText('Tarification')).toBeInTheDocument();
    expect(screen.getByLabelText("Type d'hébergement")).toBeInTheDocument();
    expect(screen.getByLabelText('Capacité maximale en adultes')).toBeInTheDocument();
    expect(screen.getByLabelText('Heure de check-in')).toBeInTheDocument();
    expect(screen.getByLabelText('Prix par nuit')).toBeInTheDocument();

    // Champs de location longue durée jamais affichés pour Hébergement.
    expect(screen.queryByText('Conditions de bail')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Caution demandée')).not.toBeInTheDocument();
  });

  test('Location affiche toujours les conditions de bail (non-régression)', async () => {
    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    fireEvent.change(await screen.findByLabelText('Statut'), { target: { value: 'location' } });
    expect(screen.getByText('Conditions de bail')).toBeInTheDocument();
    expect(screen.queryByText("Informations d'hébergement")).not.toBeInTheDocument();
  });

  test('Vente ne montre ni conditions de bail ni section hébergement (non-régression)', async () => {
    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    // 'vente' est déjà la valeur par défaut du formulaire.
    expect(screen.queryByText('Conditions de bail')).not.toBeInTheDocument();
    expect(screen.queryByText("Informations d'hébergement")).not.toBeInTheDocument();
  });

  test('affiche les erreurs de validation près des champs concernés sans appeler l’API', async () => {
    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    fillCommonFields();
    addFakeImage();
    fireEvent.change(await screen.findByLabelText('Statut'), { target: { value: 'hebergement' } });
    // accommodationType volontairement laissé vide.

    fireEvent.click(screen.getByText('Enregistrer le bien'));

    expect(await screen.findByText("Le type d'hébergement est requis.")).toBeInTheDocument();
    expect(createFullAccommodation).not.toHaveBeenCalled();
  });

  test('un succès de création envoie le payload correct, ferme et réinitialise le formulaire', async () => {
    createFullAccommodation.mockResolvedValue({
      property: { _id: 'TEST-DATA-PROPERTY', status: 'hebergement' },
      accommodation: { _id: 'TEST-DATA-ACC' },
      rate: { amount: 35000 },
    });
    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    fillCommonFields();
    addFakeImage();
    fireEvent.change(await screen.findByLabelText('Statut'), { target: { value: 'hebergement' } });
    fireEvent.change(screen.getByLabelText("Type d'hébergement"), { target: { value: 'villa_meublee' } });
    fireEvent.change(screen.getByLabelText('Capacité maximale en adultes'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Prix par nuit'), { target: { value: '35000' } });

    fireEvent.click(screen.getByText('Enregistrer le bien'));

    await waitFor(() => expect(createFullAccommodation).toHaveBeenCalledTimes(1));
    const sentFormData = createFullAccommodation.mock.calls[0][0];
    expect(sentFormData.get('accommodationType')).toBe('villa_meublee');
    expect(sentFormData.get('capacity[maxAdults]')).toBe('4');
    expect(sentFormData.get('nightlyPrice')).toBe('35000');
    expect(sentFormData.get('title')).toBe('TEST DATA VILLA');

    // Formulaire fermé/réinitialisé après succès.
    await waitFor(() => expect(screen.queryByText('Ajouter un nouveau bien')).not.toBeInTheDocument());
    expect(await screen.findByText('Hébergement créé avec succès !')).toBeInTheDocument();
  });

  test('une Vente réussie utilise toujours addProperty (non-régression du chemin existant)', async () => {
    addProperty.mockResolvedValue({ _id: 'TEST-DATA-PROPERTY', status: 'vente' });
    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    fillCommonFields();
    addFakeImage();

    fireEvent.click(screen.getByText('Enregistrer le bien'));

    await waitFor(() => expect(addProperty).toHaveBeenCalledTimes(1));
    expect(createFullAccommodation).not.toHaveBeenCalled();
  });

  test("l'édition d'un hébergement précharge les champs Accommodation existants", async () => {
    const property = {
      _id: 'TEST-DATA-PROPERTY', title: 'TEST DATA VILLA', status: 'hebergement',
      price: 50000, address: { city: 'Brazzaville', arrondissement: '', neighborhood: 'Q' },
      images: ['https://example.com/a.jpg'],
    };
    getAllProperties.mockResolvedValue([property]);
    getPropertyById.mockResolvedValue({
      ...property,
      accommodation: {
        accommodationType: 'studio_meuble',
        capacity: { maxAdults: 2, maxChildren: 1 },
        checkInTime: '15:00', checkOutTime: '10:00',
        rates: [{ mode: 'nightly', amount: 20000 }],
      },
    });

    render(<ManagePropertiesPage />);
    const editButton = await screen.findByTitle('Modifier');
    fireEvent.click(editButton);

    await waitFor(() => expect(getPropertyById).toHaveBeenCalledWith('TEST-DATA-PROPERTY'));
    await waitFor(() => expect(screen.getByLabelText("Type d'hébergement").value).toBe('studio_meuble'));
    expect(screen.getByLabelText('Capacité maximale en adultes').value).toBe('2');
    expect(screen.getByLabelText('Heure de check-in').value).toBe('15:00');
    expect(screen.getByLabelText('Prix par nuit').value).toBe('20000');
  });
});
