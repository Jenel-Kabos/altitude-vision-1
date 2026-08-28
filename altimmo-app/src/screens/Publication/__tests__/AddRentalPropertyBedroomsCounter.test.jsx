import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import AddRentalPropertyScreen from '../AddRentalPropertyScreen';

// HOTFIX-MOB-ADD-PROPERTY-BEDROOMS-1 — complète AddRentalPropertyScreen.test.jsx
// (qui prouve déjà la visibilité conditionnelle Chambres/Terrain) avec les
// scénarios du mandat non encore couverts : compteur +/-, jamais négatif,
// persistance entre étapes, Villa, valeur réelle dans le payload publié.
// Aucun code de production modifié par ce mandat — ces tests caractérisent
// le comportement déjà correct du HEAD actuel.

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@expo/vector-icons', () => {
  const RN = require('react-native');
  const ReactActual = require('react');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});
jest.mock('../../../services/annonceService', () => ({
  creerAnnonce: jest.fn(),
  uploadToCloudinary: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://photo1.jpg' }],
  }),
}));

import { creerAnnonce, uploadToCloudinary } from '../../../services/annonceService';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

describe('AddRentalPropertyScreen — compteur Chambres (HOTFIX-MOB-ADD-PROPERTY-BEDROOMS-1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  test('Villa + location : Chambres visible (type résidentiel supplémentaire, hors du seul cas Appartement déjà testé)', () => {
    render(<AddRentalPropertyScreen navigation={navigation} />);
    fireEvent.press(screen.getByLabelText('Villa'));
    fireEvent.changeText(screen.getByLabelText('Titre'), 'Villa avec piscine');
    fireEvent.changeText(screen.getByLabelText('Description'), 'Description suffisante');
    fireEvent.press(screen.getByText('Continuer'));
    fireEvent.press(screen.getByLabelText('Brazzaville'));
    fireEvent.press(screen.getByLabelText('Bacongo'));
    fireEvent.press(screen.getByText('Continuer'));
    expect(screen.getByText('Chambres')).toBeTruthy();
  });

  test('compteur + incrémente, compteur - décrémente, jamais de valeur négative', () => {
    render(<AddRentalPropertyScreen navigation={navigation} />);
    fireEvent.press(screen.getByLabelText('Maison'));
    fireEvent.changeText(screen.getByLabelText('Titre'), 'Maison familiale');
    fireEvent.changeText(screen.getByLabelText('Description'), 'Description suffisante');
    fireEvent.press(screen.getByText('Continuer'));
    fireEvent.press(screen.getByLabelText('Brazzaville'));
    fireEvent.press(screen.getByLabelText('Bacongo'));
    fireEvent.press(screen.getByText('Continuer'));

    // Valeur initiale = 0 (contrat existant, non modifié par ce mandat) —
    // partagée par défaut avec Salles de bain/Salon/Cuisine, donc non unique
    // à l'écran ; on vérifie l'évolution plutôt que la valeur de départ seule.
    fireEvent.press(screen.getByLabelText('Augmenter Chambres'));
    fireEvent.press(screen.getByLabelText('Augmenter Chambres'));
    expect(screen.getByText('2')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Diminuer Chambres'));
    expect(screen.getByText('1')).toBeTruthy();

    // Décrémenter sous 0 doit rester bloqué à 0 (contrat du composant Counter partagé, min=0 par défaut)
    fireEvent.press(screen.getByLabelText('Diminuer Chambres'));
    fireEvent.press(screen.getByLabelText('Diminuer Chambres'));
    expect(screen.queryByText('-1')).toBeNull();
  });

  test('la valeur de Chambres est conservée en naviguant Step 3 → Step 4 → retour Step 3', () => {
    render(<AddRentalPropertyScreen navigation={navigation} />);
    fireEvent.press(screen.getByLabelText('Maison'));
    fireEvent.changeText(screen.getByLabelText('Titre'), 'Maison familiale');
    fireEvent.changeText(screen.getByLabelText('Description'), 'Description suffisante');
    fireEvent.press(screen.getByText('Continuer'));
    fireEvent.press(screen.getByLabelText('Brazzaville'));
    fireEvent.press(screen.getByLabelText('Bacongo'));
    fireEvent.press(screen.getByText('Continuer'));

    fireEvent.press(screen.getByLabelText('Augmenter Chambres'));
    fireEvent.press(screen.getByLabelText('Augmenter Chambres'));
    fireEvent.press(screen.getByLabelText('Augmenter Chambres'));
    expect(screen.getByText('3')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Surface (m²)'), '120');
    fireEvent.press(screen.getByText('Continuer')); // → Step 4 (price)
    fireEvent.press(screen.getByText('Précédent')); // → retour Step 3

    expect(screen.getByText('3')).toBeTruthy();
  });

  test('la valeur de Chambres arrive bien dans le payload envoyé au backend (creerAnnonce)', async () => {
    uploadToCloudinary.mockResolvedValue('https://res.cloudinary.com/x/photo.jpg');
    creerAnnonce.mockResolvedValue({ _id: 'prop-2' });

    render(<AddRentalPropertyScreen navigation={navigation} />);
    fireEvent.press(screen.getByLabelText('Maison'));
    fireEvent.changeText(screen.getByLabelText('Titre'), 'Maison familiale');
    fireEvent.changeText(screen.getByLabelText('Description'), 'Description suffisante');
    fireEvent.press(screen.getByText('Continuer'));

    fireEvent.press(screen.getByLabelText('Brazzaville'));
    fireEvent.press(screen.getByLabelText('Bacongo'));
    fireEvent.press(screen.getByText('Continuer'));

    fireEvent.changeText(screen.getByLabelText('Surface (m²)'), '120');
    fireEvent.press(screen.getByLabelText('Augmenter Chambres'));
    fireEvent.press(screen.getByLabelText('Augmenter Chambres'));
    fireEvent.press(screen.getByLabelText('Augmenter Chambres'));
    fireEvent.press(screen.getByLabelText('Augmenter Chambres')); // = 4 chambres
    fireEvent.press(screen.getByText('Continuer'));

    fireEvent.changeText(screen.getByLabelText('Loyer mensuel (FCFA)'), '250000');
    fireEvent.press(screen.getByText('Continuer'));

    await fireEvent.press(screen.getByText('Ajouter des photos'));
    await waitFor(() => expect(screen.getByLabelText('Supprimer la photo')).toBeTruthy());
    fireEvent.press(screen.getByText('Continuer'));
    fireEvent.press(screen.getByText('Publier'));

    await waitFor(() => expect(creerAnnonce).toHaveBeenCalled());
    expect(creerAnnonce.mock.calls[0][0]).toMatchObject({ chambres: 4 });
  });
});
