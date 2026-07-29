import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ManagePropertiesPage from '../pages/dashboard/ManagePropertiesPage';
import {
  getAllProperties, getPropertyById,
} from '../services/propertyService';
import { createFullAccommodation, updateFullAccommodation, getHotels } from '../services/accommodationService';
import { createFullSaleProperty, updateFullSaleProperty } from '../services/salePropertyService';
import { createFullRentalProperty } from '../services/rentalPropertyService';
import { useSearchParams } from 'next/navigation';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { _id: 'TEST-ADMIN', id: 'TEST-ADMIN', role: 'Admin', name: 'TEST ADMIN' },
    canEdit: true, canDelete: true,
  }),
}));

// Sprint 0 (architecture Altimmo) — ManagePropertiesPage lit désormais
// ?status= depuis l'URL (liens dédiés Vente/Location/Hébergement du
// domaine Immobilier). Aucun filtre actif par défaut ; surchargé par test
// au besoin via useSearchParams.mockReturnValue(...).
vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => new URLSearchParams()),
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
// (Vente/Location/Hébergement) avant tout formulaire.
const chooseBusinessCard = async (label) => {
  fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(label, 'i') }));
  if (label === 'Hébergement') {
    // Étape 2 du PropertyWizard (Sprint 0) : un type doit être choisi avant
    // d'atteindre le formulaire. "Villa" par défaut pour les tests qui ne
    // portent pas spécifiquement sur cette étape.
    fireEvent.click(await screen.findByRole('button', { name: /^Villa$/i }));
  }
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
    // Ré-affirmé explicitement à chaque test : mockReturnValue (contrairement
    // à mockReturnValueOnce) survit aux multiples re-renders du composant
    // (ManagePropertiesPage appelle useSearchParams() à chaque rendu, pas
    // une seule fois), donc ne pas fuiter vers le test suivant sans reset ici.
    useSearchParams.mockReturnValue(new URLSearchParams());
  });

  test("le sélecteur métier propose Vente, Location et Hébergement", async () => {
    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByRole('button', { name: /Vente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Location/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hébergement/i })).toBeInTheDocument();
  });

  test('choisir Hébergement affiche les bons champs (statut déjà réglé, pas de re-sélection)', async () => {
    render(<ManagePropertiesPage />);
    await chooseBusinessCard('Hébergement');

    expect(screen.getByText("Informations d'hébergement")).toBeInTheDocument();
    expect(screen.getByText('Tarification')).toBeInTheDocument();
    expect(screen.getByLabelText("Type d'hébergement")).toBeInTheDocument();
    expect(screen.getByLabelText('Capacité maximale en adultes')).toBeInTheDocument();
    expect(screen.getByLabelText('Heure de check-in')).toBeInTheDocument();
    expect(screen.getByLabelText('Prix par nuit')).toBeInTheDocument();
    expect(screen.getByLabelText('Statut').value).toBe('hebergement');
  });

  test("PropertyWizard étape 2 — choisir Résidence meublée préremplit accommodationType (Sprint B1)", async () => {
    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    fireEvent.click(await screen.findByRole('button', { name: /Hébergement/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^Résidence meublée$/i }));

    await waitFor(() => expect(screen.getByLabelText("Type d'hébergement").value).toBe('residence_meublee'));
  });

  test("Sprint B2 — Hôtel est de nouveau proposé à l'étape 2 du wizard et ouvre HotelPropertyForm", async () => {
    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    fireEvent.click(await screen.findByRole('button', { name: /Hébergement/i }));
    expect(screen.getByRole('button', { name: /^Hôtel$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Hôtel$/i }));
    expect(await screen.findByLabelText("Nom de l'hôtel")).toBeInTheDocument();
  });

  test.each(["Chambre d'hôtes", 'Résidence hôtelière'])(
    '%s utilise aussi HotelPropertyForm conformément au contrat room_based',
    async (label) => {
      render(<ManagePropertiesPage />);
      fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
      fireEvent.click(await screen.findByRole('button', { name: /Hébergement/i }));
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(await screen.findByLabelText("Nom de l'hôtel")).toBeInTheDocument();
      expect(screen.queryByLabelText("Type d'hébergement")).not.toBeInTheDocument();
    },
  );

  test("PropertyWizard étape 2 — le bouton Retour ramène à l'étape 1 sans perdre le contexte", async () => {
    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    fireEvent.click(await screen.findByRole('button', { name: /Hébergement/i }));
    expect(await screen.findByText("Quel type d'hébergement ?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(await screen.findByRole('button', { name: /Vente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Location/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hébergement/i })).toBeInTheDocument();
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
    await chooseBusinessCard('Hébergement');
    fillCommonFields();
    addFakeImage();
    // Le PropertyWizard préremplit accommodationType (étape 2) — on le
    // revide manuellement ici pour vérifier que la validation de secours
    // dans PropertyForm/handleSubmit fonctionne toujours si l'utilisateur
    // revient en arrière sur le <select>.
    fireEvent.change(screen.getByLabelText("Type d'hébergement"), { target: { value: '' } });

    fireEvent.click(screen.getByText('Ajouter le bien'));

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
    await chooseBusinessCard('Hébergement');
    fillCommonFields();
    addFakeImage();
    fireEvent.change(screen.getByLabelText("Type d'hébergement"), { target: { value: 'villa_meublee' } });
    fireEvent.change(screen.getByLabelText('Capacité maximale en adultes'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Prix par nuit'), { target: { value: '35000' } });

    fireEvent.click(screen.getByText('Ajouter le bien'));

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

  test('Sprint B1 — cocher des équipements/services/règles les inclut dans le payload envoyé', async () => {
    createFullAccommodation.mockResolvedValue({
      property: { _id: 'TEST-DATA-PROPERTY', status: 'hebergement' },
      accommodation: { _id: 'TEST-DATA-ACC' },
      rate: null,
    });
    render(<ManagePropertiesPage />);
    await chooseBusinessCard('Hébergement');
    fillCommonFields();
    addFakeImage();
    fireEvent.change(screen.getByLabelText('Capacité maximale en adultes'), { target: { value: '4' } });

    fireEvent.click(screen.getByLabelText('Cuisine — Four'));
    fireEvent.click(screen.getByLabelText('Ménage'));
    fireEvent.click(screen.getByLabelText('Animaux acceptés'));

    fireEvent.click(screen.getByText('Ajouter le bien'));

    await waitFor(() => expect(createFullAccommodation).toHaveBeenCalledTimes(1));
    const sentFormData = createFullAccommodation.mock.calls[0][0];
    expect(JSON.parse(sentFormData.get('accommodationAmenities')).cuisine).toContain('Four');
    expect(JSON.parse(sentFormData.get('includedServices')).menage).toBe(true);
    expect(JSON.parse(sentFormData.get('rules')).petsAllowed).toBe(true);
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

  test("le type historique 'bungalow' n'est pas proposé à la création (residence_meublee, promue Sprint B1, l'est désormais)", async () => {
    render(<ManagePropertiesPage />);
    await chooseBusinessCard('Hébergement');

    const typeSelect = screen.getByLabelText("Type d'hébergement");
    const values = within(typeSelect).getAllByRole('option').map((o) => o.value);
    expect(values).toContain('residence_meublee');
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

  test("un lien du domaine Immobilier (?status=vente) filtre la liste sans appel API supplémentaire (Sprint 0)", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams('status=vente'));
    getAllProperties.mockResolvedValue([
      { _id: 'P-VENTE', title: 'TEST DATA VENTE', status: 'vente', images: [] },
      { _id: 'P-LOCATION', title: 'TEST DATA LOCATION', status: 'location', images: [] },
    ]);

    render(<ManagePropertiesPage />);

    expect(await screen.findByText('TEST DATA VENTE')).toBeInTheDocument();
    expect(screen.queryByText('TEST DATA LOCATION')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /^Vente$/i })).toBeInTheDocument();
    expect(getAllProperties).toHaveBeenCalledTimes(1);
  });
});

describe('ManagePropertiesPage — Hébergement — Établissement hôtelier (Sprint Hôtel) — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllProperties.mockResolvedValue([]);
    getHotels.mockResolvedValue([]);
    useSearchParams.mockReturnValue(new URLSearchParams());
  });

  const openHebergementForm = async () => {
    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    fireEvent.click(await screen.findByRole('button', { name: /Hébergement/i }));
    // Étape 2 du PropertyWizard (Sprint 0) : ces tests changent ensuite
    // eux-mêmes le type via le <select> de PropertyForm, donc le choix
    // initial ici n'a pas d'importance.
    fireEvent.click(await screen.findByRole('button', { name: /^Villa$/i }));
  };

  test("l'option Hôtel apparaît dans la liste des types d'hébergement", async () => {
    await openHebergementForm();
    const typeSelect = screen.getByLabelText("Type d'hébergement");
    const values = within(typeSelect).getAllByRole('option').map((o) => o.value);
    expect(values).toContain('hotel');
  });

  test("choisir un type non-hôtel ne montre jamais HotelPropertyForm ni la section Établissement hôtelier embarquée", async () => {
    await openHebergementForm();
    fireEvent.change(screen.getByLabelText("Type d'hébergement"), { target: { value: 'villa_meublee' } });
    expect(screen.queryByText('Établissement hôtelier')).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nom de l'hôtel")).not.toBeInTheDocument();
  });

  test("Sprint B2 — choisir/basculer vers le type Hôtel dans le wizard ou le <select> ouvre HotelPropertyForm (jamais PropertyForm)", async () => {
    await openHebergementForm();
    fireEvent.change(screen.getByLabelText("Type d'hébergement"), { target: { value: 'hotel' } });

    // PropertyForm (et son ancien sélecteur embarqué "existant/nouveau") a
    // disparu — remplacé par le formulaire dédié HotelPropertyForm.
    expect(screen.queryByLabelText("Type d'hébergement")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Nom de l'hôtel")).toBeInTheDocument();
    expect(screen.getByText('Catégories de chambres')).toBeInTheDocument();
  });

  test("Sprint B2 — choisir directement Hôtel à l'étape 2 du wizard ouvre HotelPropertyForm", async () => {
    render(<ManagePropertiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    fireEvent.click(await screen.findByRole('button', { name: /Hébergement/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^Hôtel$/i }));

    expect(await screen.findByLabelText("Nom de l'hôtel")).toBeInTheDocument();
  });

  test("l'édition d'un hébergement de type hôtel précharge le mode 'existant' et l'établissement rattaché (legacy, PropertyForm)", async () => {
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
