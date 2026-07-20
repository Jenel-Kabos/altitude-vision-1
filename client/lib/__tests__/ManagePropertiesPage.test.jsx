import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ManagePropertiesPage from '../pages/dashboard/ManagePropertiesPage';
import {
  getAllProperties, getPropertyById, addProperty, updateProperty,
} from '../services/propertyService';
import { createFullAccommodation, updateFullAccommodation, getHotels } from '../services/accommodationService';

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
  getHotels: vi.fn(),
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
    getHotels.mockResolvedValue([]);
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

  test("les types historiques (residence_meublee, bungalow) ne sont pas proposés à la création", async () => {
    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    fireEvent.change(await screen.findByLabelText('Statut'), { target: { value: 'hebergement' } });

    const typeSelect = screen.getByLabelText("Type d'hébergement");
    const values = within(typeSelect).getAllByRole('option').map((o) => o.value);
    expect(values).not.toContain('residence_meublee');
    expect(values).not.toContain('bungalow');
  });

  test("l'édition d'une ancienne annonce 'bungalow' affiche et conserve cette valeur historique", async () => {
    const property = {
      _id: 'TEST-DATA-PROPERTY', title: 'TEST DATA BUNGALOW', status: 'hebergement',
      price: 50000, address: { city: 'Brazzaville', arrondissement: '', neighborhood: 'Q' },
      images: ['https://example.com/a.jpg'],
    };
    getAllProperties.mockResolvedValue([property]);
    getPropertyById.mockResolvedValue({
      ...property,
      accommodation: {
        accommodationType: 'bungalow',
        capacity: { maxAdults: 2 },
        checkInTime: '14:00', checkOutTime: '11:00',
        rates: [],
      },
    });

    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByTitle('Modifier'));

    await waitFor(() => expect(screen.getByLabelText("Type d'hébergement").value).toBe('bungalow'));
    const typeSelect = screen.getByLabelText("Type d'hébergement");
    // La valeur historique doit être présente dans la liste (sinon le
    // <select> retomberait silencieusement sur la 1ère option au rendu) ET
    // rester sélectionnée si l'admin enregistre sans changer le type.
    const values = within(typeSelect).getAllByRole('option').map((o) => o.value);
    expect(values).toContain('bungalow');
    expect(typeSelect.value).toBe('bungalow');
  });
});

describe('ManagePropertiesPage — Hébergement — Établissement hôtelier (Sprint Hôtel) — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllProperties.mockResolvedValue([]);
    getHotels.mockResolvedValue([]);
  });

  const openHebergementForm = async () => {
    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    fireEvent.change(await screen.findByLabelText('Statut'), { target: { value: 'hebergement' } });
  };

  test("l'option Hôtel apparaît dans la liste des types d'hébergement", async () => {
    await openHebergementForm();
    const typeSelect = screen.getByLabelText("Type d'hébergement");
    const values = within(typeSelect).getAllByRole('option').map((o) => o.value);
    expect(values).toContain('hotel');
  });

  test("choisir un type non-hôtel ne montre jamais la section Établissement hôtelier", async () => {
    await openHebergementForm();
    fireEvent.change(screen.getByLabelText("Type d'hébergement"), { target: { value: 'villa_meublee' } });
    expect(screen.queryByText('Établissement hôtelier')).not.toBeInTheDocument();
  });

  test("choisir le type Hôtel affiche la section Établissement hôtelier et charge la liste", async () => {
    getHotels.mockResolvedValue([{ _id: 'HOTEL-1', name: 'Hôtel Le Panorama' }]);
    await openHebergementForm();
    fireEvent.change(screen.getByLabelText("Type d'hébergement"), { target: { value: 'hotel' } });

    expect(await screen.findByText('Établissement hôtelier')).toBeInTheDocument();
    await waitFor(() => expect(getHotels).toHaveBeenCalledTimes(1));
  });

  test("mode 'existant' : le sélecteur d'hôtel liste les établissements chargés", async () => {
    getHotels.mockResolvedValue([{ _id: 'HOTEL-1', name: 'Hôtel Le Panorama' }]);
    await openHebergementForm();
    fireEvent.change(screen.getByLabelText("Type d'hébergement"), { target: { value: 'hotel' } });
    await screen.findByText('Établissement hôtelier');

    fireEvent.click(screen.getByLabelText('Sélectionner un établissement existant'));
    const hotelSelect = await screen.findByLabelText('Établissement hôtelier');
    expect(await within(hotelSelect).findByRole('option', { name: 'Hôtel Le Panorama' })).toBeInTheDocument();
  });

  test("validation — accommodationType=hotel sans mode de rattachement est refusé sans appeler l'API", async () => {
    await openHebergementForm();
    fillCommonFields();
    addFakeImage();
    fireEvent.change(screen.getByLabelText("Type d'hébergement"), { target: { value: 'hotel' } });
    fireEvent.change(screen.getByLabelText('Capacité maximale en adultes'), { target: { value: '2' } });

    fireEvent.click(screen.getByText('Enregistrer le bien'));

    expect(await screen.findByText('Sélectionnez un établissement existant ou créez-en un nouveau.')).toBeInTheDocument();
    expect(createFullAccommodation).not.toHaveBeenCalled();
  });

  test("validation — création d'un nouvel hôtel sans nom est refusée", async () => {
    await openHebergementForm();
    fillCommonFields();
    addFakeImage();
    fireEvent.change(screen.getByLabelText("Type d'hébergement"), { target: { value: 'hotel' } });
    fireEvent.change(screen.getByLabelText('Capacité maximale en adultes'), { target: { value: '2' } });
    fireEvent.click(screen.getByLabelText('Créer un nouvel établissement'));

    fireEvent.click(screen.getByText('Enregistrer le bien'));

    expect(await screen.findByText("Le nom de l'hôtel est requis.")).toBeInTheDocument();
    expect(createFullAccommodation).not.toHaveBeenCalled();
  });

  test("un rattachement à un hôtel existant envoie hotelMode='existing' et hotelId dans le payload", async () => {
    getHotels.mockResolvedValue([{ _id: 'HOTEL-1', name: 'Hôtel Le Panorama' }]);
    createFullAccommodation.mockResolvedValue({
      property: { _id: 'TEST-DATA-PROPERTY', status: 'hebergement' },
      accommodation: { _id: 'TEST-DATA-ACC' },
      rate: null,
      hotel: 'HOTEL-1',
    });
    await openHebergementForm();
    fillCommonFields();
    addFakeImage();
    fireEvent.change(screen.getByLabelText("Type d'hébergement"), { target: { value: 'hotel' } });
    fireEvent.change(screen.getByLabelText('Capacité maximale en adultes'), { target: { value: '2' } });
    fireEvent.click(screen.getByLabelText('Sélectionner un établissement existant'));
    const hotelSelect = await screen.findByLabelText('Établissement hôtelier');
    await waitFor(() => expect(within(hotelSelect).getAllByRole('option').length).toBeGreaterThan(1));
    fireEvent.change(hotelSelect, { target: { value: 'HOTEL-1' } });

    fireEvent.click(screen.getByText('Enregistrer le bien'));

    await waitFor(() => expect(createFullAccommodation).toHaveBeenCalledTimes(1));
    const sentFormData = createFullAccommodation.mock.calls[0][0];
    expect(sentFormData.get('hotelMode')).toBe('existing');
    expect(sentFormData.get('hotelId')).toBe('HOTEL-1');
    expect(sentFormData.get('hotelName')).toBeNull();
  });

  test("la création d'un nouvel hôtel envoie hotelMode='create' et les champs de l'établissement", async () => {
    createFullAccommodation.mockResolvedValue({
      property: { _id: 'TEST-DATA-PROPERTY', status: 'hebergement' },
      accommodation: { _id: 'TEST-DATA-ACC' },
      rate: null,
      hotel: 'NEW-HOTEL-ID',
    });
    await openHebergementForm();
    fillCommonFields();
    addFakeImage();
    fireEvent.change(screen.getByLabelText("Type d'hébergement"), { target: { value: 'hotel' } });
    fireEvent.change(screen.getByLabelText('Capacité maximale en adultes'), { target: { value: '2' } });
    fireEvent.click(screen.getByLabelText('Créer un nouvel établissement'));
    fireEvent.change(screen.getByLabelText("Nom de l'hôtel"), { target: { value: 'Hôtel Le Panorama' } });
    fireEvent.change(screen.getByLabelText("Nombre d'étoiles"), { target: { value: '4' } });

    fireEvent.click(screen.getByText('Enregistrer le bien'));

    await waitFor(() => expect(createFullAccommodation).toHaveBeenCalledTimes(1));
    const sentFormData = createFullAccommodation.mock.calls[0][0];
    expect(sentFormData.get('hotelMode')).toBe('create');
    expect(sentFormData.get('hotelName')).toBe('Hôtel Le Panorama');
    expect(sentFormData.get('hotelStarRating')).toBe('4');
    expect(sentFormData.get('hotelId')).toBeNull();
  });

  test("l'édition d'un hébergement de type hôtel précharge le mode 'existant' et l'établissement rattaché", async () => {
    const property = {
      _id: 'TEST-DATA-PROPERTY', title: 'TEST DATA HOTEL', status: 'hebergement',
      price: 50000, address: { city: 'Brazzaville', arrondissement: '', neighborhood: 'Q' },
      images: ['https://example.com/a.jpg'],
    };
    getAllProperties.mockResolvedValue([property]);
    getHotels.mockResolvedValue([{ _id: 'HOTEL-1', name: 'Hôtel Le Panorama' }]);
    getPropertyById.mockResolvedValue({
      ...property,
      accommodation: {
        accommodationType: 'hotel',
        hotel: 'HOTEL-1',
        capacity: { maxAdults: 2 },
        checkInTime: '14:00', checkOutTime: '11:00',
        rates: [],
      },
    });

    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByTitle('Modifier'));

    await waitFor(() => expect(screen.getByLabelText("Type d'hébergement").value).toBe('hotel'));
    await screen.findByText('Établissement hôtelier');
    expect(screen.getByLabelText('Sélectionner un établissement existant').checked).toBe(true);
    const hotelSelect = await screen.findByLabelText('Établissement hôtelier');
    await waitFor(() => expect(hotelSelect.value).toBe('HOTEL-1'));
  });
});
