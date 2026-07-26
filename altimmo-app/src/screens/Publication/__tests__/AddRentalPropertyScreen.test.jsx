import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import AddRentalPropertyScreen from '../AddRentalPropertyScreen';

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

describe('AddRentalPropertyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  test('changer de type de bien nettoie les valeurs incompatibles (Terrain masque chambres/SDB)', () => {
    render(<AddRentalPropertyScreen navigation={navigation} />);
    fireEvent.press(screen.getByLabelText('Appartement'));
    fireEvent.changeText(screen.getByLabelText('Titre'), 'Appart meublé');
    fireEvent.changeText(screen.getByLabelText('Description'), 'Description suffisante');
    fireEvent.press(screen.getByText('Continuer'));
    fireEvent.press(screen.getByLabelText('Brazzaville'));
    fireEvent.press(screen.getByLabelText('Bacongo'));
    fireEvent.press(screen.getByText('Continuer'));
    expect(screen.getByText('Chambres')).toBeTruthy();

    fireEvent.press(screen.getByText('Précédent'));
    fireEvent.press(screen.getByText('Précédent'));
    fireEvent.press(screen.getByLabelText('Terrain'));
    fireEvent.press(screen.getByText('Continuer'));
    fireEvent.press(screen.getByText('Continuer'));
    expect(screen.queryByText('Chambres')).toBeNull();
  });

  test('publication réussie : creerAnnonce appelé avec categorie=location et champs spécifiques (caution/profils/documents)', async () => {
    uploadToCloudinary.mockResolvedValue('https://res.cloudinary.com/x/photo.jpg');
    creerAnnonce.mockResolvedValue({ _id: 'prop-1' });

    render(<AddRentalPropertyScreen navigation={navigation} />);
    fireEvent.press(screen.getByLabelText('Appartement meublé'));
    fireEvent.changeText(screen.getByLabelText('Titre'), 'Appart meublé Bacongo');
    fireEvent.changeText(screen.getByLabelText('Description'), 'Description suffisante');
    fireEvent.press(screen.getByText('Continuer'));

    fireEvent.press(screen.getByLabelText('Brazzaville'));
    fireEvent.press(screen.getByLabelText('Bacongo'));
    fireEvent.press(screen.getByText('Continuer'));

    fireEvent.changeText(screen.getByLabelText('Surface (m²)'), '60');
    fireEvent.press(screen.getByText('Continuer'));

    fireEvent.changeText(screen.getByLabelText('Loyer mensuel (FCFA)'), '150000');
    fireEvent.press(screen.getByLabelText('Salarié'));
    fireEvent.press(screen.getByLabelText('CNI'));
    fireEvent.press(screen.getByText('Continuer'));

    await fireEvent.press(screen.getByText('Ajouter des photos'));
    await waitFor(() => expect(screen.getByLabelText('Supprimer la photo')).toBeTruthy());
    fireEvent.press(screen.getByText('Continuer'));
    fireEvent.press(screen.getByText('Publier'));

    await waitFor(() => expect(creerAnnonce).toHaveBeenCalled());
    expect(creerAnnonce.mock.calls[0][0]).toMatchObject({
      categorie: 'location',
      profilsLocataireRecherches: ['Salarié'],
      documentsRequis: ['CNI'],
    });
  });
});
