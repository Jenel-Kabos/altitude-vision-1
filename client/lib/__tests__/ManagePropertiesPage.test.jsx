import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ManagePropertiesPage from '../pages/dashboard/ManagePropertiesPage';
import {
  getAllProperties, getPropertyById,
} from '../services/propertyService';
import { createFullAccommodation, updateFullAccommodation, getHotels } from '../services/accommodationService';
import { createFullSaleProperty, updateFullSaleProperty } from '../services/salePropertyService';
import { createFullRentalProperty } from '../services/rentalPropertyService';

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

vi.mock('../services/salePropertyService', () => ({
  createFullSaleProperty: vi.fn(),
  updateFullSaleProperty: vi.fn(),
}));

vi.mock('../services/rentalPropertyService', () => ({
  createFullRentalProperty: vi.fn(),
  updateFullRentalProperty: vi.fn(),
}));

// Sprint A — cliquer "Ajouter" ouvre désormais un sélecteur métier
// (Vente/Location/Hébergement meublé) avant tout formulaire.
const chooseBusinessCard = async (label) => {
  fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(label, 'i') }));
};

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

  test("le sélecteur métier propose Vente, Location et Hébergement meublé", async () => {
    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByRole('button', { name: /Vente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Location/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hébergement meublé/i })).toBeInTheDocument();
  });

  test('choisir Hébergement meublé affiche les bons champs (statut déjà réglé, pas de re-sélection)', async () => {
    render(<ManagePropertiesPage />);
    await chooseBusinessCard('Hébergement meublé');

    expect(screen.getByText("Informations d'hébergement")).toBeInTheDocument();
    expect(screen.getByText('Tarification')).toBeInTheDocument();
    expect(screen.getByLabelText("Type d'hébergement")).toBeInTheDocument();
    expect(screen.getByLabelText('Capacité maximale en adultes')).toBeInTheDocument();
    expect(screen.getByLabelText('Heure de check-in')).toBeInTheDocument();
    expect(screen.getByLabelText('Prix par nuit')).toBeInTheDocument();
    expect(screen.getByLabelText('Statut').value).toBe('hebergement');
  });

  test('choisir Location ouvre RentalPropertyForm (formulaire dédié, plus PropertyForm)', async () => {
    render(<ManagePropertiesPage />);
    await chooseBusinessCard('Location');

    expect(screen.getByText('Loyer et charges')).toBeInTheDocument();
    expect(screen.getByText('Conditions du bail')).toBeInTheDocument();
    expect(screen.getByLabelText('Loyer mensuel')).toBeInTheDocument();
    // Aucun champ hôtelier/hébergement ni statut technique dans ce formulaire dédié.
    expect(screen.queryByLabelText('Statut')).not.toBeInTheDocument();
    expect(screen.queryByText("Informations d'hébergement")).not.toBeInTheDocument();
  });

  test('choisir Vente ouvre SalePropertyForm (formulaire dédié, plus PropertyForm)', async () => {
    render(<ManagePropertiesPage />);
    await chooseBusinessCard('Vente');

    expect(screen.getByText('Situation juridique')).toBeInTheDocument();
    expect(screen.getByText('Prix et négociation')).toBeInTheDocument();
    expect(screen.getByLabelText('Prix de vente')).toBeInTheDocument();
    // Aucun champ de loyer, de tarif par nuit, ni statut technique.
    expect(screen.queryByLabelText('Statut')).not.toBeInTheDocument();
    expect(screen.queryByText('Loyer et charges')).not.toBeInTheDocument();
    expect(screen.queryByText("Informations d'hébergement")).not.toBeInTheDocument();
  });

  test("changer de carte (Annuler) avant soumission ne conserve aucune donnée saisie dans l'autre formulaire (Sprint A, audit sécurité)", async () => {
    render(<ManagePropertiesPage />);
    await chooseBusinessCard('Vente');
    fireEvent.change(screen.getByLabelText("Titre de l'annonce"), { target: { value: 'TEST DATA NE DOIT PAS FUITER' } });

    // Retour au sélecteur puis choix d'un autre type métier — le composant
    // SalePropertyForm est démonté (pas juste masqué), donc RentalPropertyForm
    // repart d'un état totalement neuf.
    fireEvent.click(screen.getByText('Annuler'));
    fireEvent.click(await screen.findByRole('button', { name: /Location/i }));

    expect(screen.getByLabelText("Titre de l'annonce").value).toBe('');
    expect(screen.queryByText('TEST DATA NE DOIT PAS FUITER')).not.toBeInTheDocument();
  });

  test('affiche les erreurs de validation près des champs concernés sans appeler l’API', async () => {
    render(<ManagePropertiesPage />);
    await chooseBusinessCard('Hébergement meublé');
    fillCommonFields();
    addFakeImage();
    // accommodationType volontairement laissé vide.

    fireEvent.click(screen.getByText('Enregistrer le bien'));

    expect(await screen.findByText("Le type d'hébergement est requis.")).toBeInTheDocument();
    expect(createFullAccommodation).not.toHaveBeenCalled();
  });

  test('un succès de création Hébergement envoie le payload correct, ferme et réinitialise le formulaire', async () => {
    createFullAccommodation.mockResolvedValue({
      property: { _id: 'TEST-DATA-PROPERTY', status: 'hebergement' },
      accommodation: { _id: 'TEST-DATA-ACC' },
      rate: { amount: 35000 },
    });
    render(<ManagePropertiesPage />);
    await chooseBusinessCard('Hébergement meublé');
    fillCommonFields();
    addFakeImage();
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
    await waitFor(() => expect(screen.queryByText('Ajouter une annonce')).not.toBeInTheDocument());
    expect(await screen.findByText('Hébergement créé avec succès !')).toBeInTheDocument();
  });

  test('une création Vente réussie appelle createFullSaleProperty avec le bon payload (Sprint A)', async () => {
    createFullSaleProperty.mockResolvedValue({
      property: { _id: 'TEST-DATA-PROPERTY', status: 'vente' },
      sale: { _id: 'TEST-DATA-SALE' },
    });
    render(<ManagePropertiesPage />);
    await chooseBusinessCard('Vente');
    fireEvent.change(screen.getByLabelText("Titre de l'annonce"), { target: { value: 'TEST DATA VILLA VENTE' } });
    fireEvent.change(screen.getByLabelText("Description de l'annonce"), { target: { value: 'TEST DESC' } });
    fireEvent.change(screen.getByLabelText('Prix de vente'), { target: { value: '75000000' } });
    fireEvent.change(screen.getByLabelText('Surface en m²'), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText('Arrondissement'), { target: { value: 'Bacongo' } });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] } });

    fireEvent.click(screen.getByText("Enregistrer l'annonce"));

    await waitFor(() => expect(createFullSaleProperty).toHaveBeenCalledTimes(1));
    const sentFormData = createFullSaleProperty.mock.calls[0][0];
    expect(sentFormData.get('price')).toBe('75000000');
    expect(sentFormData.get('title')).toBe('TEST DATA VILLA VENTE');
    expect(createFullAccommodation).not.toHaveBeenCalled();
    expect(createFullRentalProperty).not.toHaveBeenCalled();
  });

  test('une création Location réussie appelle createFullRentalProperty avec le bon payload (Sprint A)', async () => {
    createFullRentalProperty.mockResolvedValue({
      property: { _id: 'TEST-DATA-PROPERTY', status: 'location' },
      rental: { _id: 'TEST-DATA-RENTAL' },
    });
    render(<ManagePropertiesPage />);
    await chooseBusinessCard('Location');
    fireEvent.change(screen.getByLabelText("Titre de l'annonce"), { target: { value: 'TEST DATA APPART LOCATION' } });
    fireEvent.change(screen.getByLabelText("Description de l'annonce"), { target: { value: 'TEST DESC' } });
    fireEvent.change(screen.getByLabelText('Loyer mensuel'), { target: { value: '150000' } });
    fireEvent.change(screen.getByLabelText('Surface en m²'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('Arrondissement'), { target: { value: 'Bacongo' } });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] } });

    fireEvent.click(screen.getByText("Enregistrer l'annonce"));

    await waitFor(() => expect(createFullRentalProperty).toHaveBeenCalledTimes(1));
    const sentFormData = createFullRentalProperty.mock.calls[0][0];
    expect(sentFormData.get('price')).toBe('150000');
    expect(sentFormData.get('monthlyRent')).toBe('150000');
    expect(createFullAccommodation).not.toHaveBeenCalled();
    expect(createFullSaleProperty).not.toHaveBeenCalled();
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

  test("l'édition d'une annonce Vente précharge SalePropertyForm avec la fiche SaleManagement (Sprint A)", async () => {
    const property = {
      _id: 'TEST-DATA-PROPERTY', title: 'TEST DATA VILLA VENTE', description: 'TEST DESC',
      status: 'vente', price: 75000000, surface: 200,
      address: { city: 'Brazzaville', arrondissement: 'Bacongo', neighborhood: 'Q' },
      images: ['https://example.com/a.jpg'],
    };
    getAllProperties.mockResolvedValue([property]);
    getPropertyById.mockResolvedValue({ ...property, sale: { negotiable: true, legalStatus: 'regularise' } });
    updateFullSaleProperty.mockResolvedValue({ property: { ...property }, sale: { negotiable: true } });

    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByTitle('Modifier'));

    await waitFor(() => expect(getPropertyById).toHaveBeenCalledWith('TEST-DATA-PROPERTY'));
    await waitFor(() => expect(screen.getByLabelText("Titre de l'annonce").value).toBe('TEST DATA VILLA VENTE'));
    expect(screen.getByLabelText('Prix de vente').value).toBe('75000000');
    expect(screen.getByLabelText('Prix négociable').checked).toBe(true);
    // Type de transaction verrouillé et indiqué clairement en édition (audit sécurité Sprint A).
    expect(screen.getByText(/non modifiable en édition/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Statut')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Enregistrer l'annonce"));
    await waitFor(() => expect(updateFullSaleProperty).toHaveBeenCalledTimes(1));
    expect(updateFullSaleProperty).toHaveBeenCalledWith('TEST-DATA-PROPERTY', expect.any(FormData));
  });

  test("l'édition d'une annonce Location précharge RentalPropertyForm avec la fiche RentalManagement (Sprint A)", async () => {
    const property = {
      _id: 'TEST-DATA-PROPERTY', title: 'TEST DATA APPART', status: 'location',
      price: 150000, address: { city: 'Brazzaville', arrondissement: 'Bacongo', neighborhood: 'Q' },
      images: ['https://example.com/a.jpg'],
    };
    getAllProperties.mockResolvedValue([property]);
    getPropertyById.mockResolvedValue({ ...property, rental: { monthlyRent: 150000, cautionMultiplicateur: 3 } });

    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByTitle('Modifier'));

    await waitFor(() => expect(getPropertyById).toHaveBeenCalledWith('TEST-DATA-PROPERTY'));
    await waitFor(() => expect(screen.getByLabelText("Titre de l'annonce").value).toBe('TEST DATA APPART'));
    expect(screen.getByLabelText('Loyer mensuel').value).toBe('150000');
    expect(screen.getByLabelText('Multiplicateur de caution').value).toBe('3');
    // Type de transaction verrouillé et indiqué clairement en édition (audit sécurité Sprint A).
    expect(screen.getByText(/non modifiable en édition/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Statut')).not.toBeInTheDocument();
  });

  test("les types historiques (residence_meublee, bungalow) ne sont pas proposés à la création", async () => {
    render(<ManagePropertiesPage />);
    await chooseBusinessCard('Hébergement meublé');

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
    fireEvent.click(await screen.findByRole('button', { name: /Hébergement meublé/i }));
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
