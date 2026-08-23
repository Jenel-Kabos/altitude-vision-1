import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import AddSalePropertyScreen from '../AddSalePropertyScreen';

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

const fillInfoStep = () => {
  fireEvent.press(screen.getByLabelText('Appartement'));
  fireEvent.changeText(screen.getByLabelText('Titre'), 'Belle maison');
  fireEvent.changeText(screen.getByLabelText('Description'), 'Une description suffisante');
  fireEvent.press(screen.getByText('Continuer'));
};

const fillLocationStep = () => {
  fireEvent.press(screen.getByLabelText('Brazzaville'));
  fireEvent.press(screen.getByLabelText('Bacongo'));
  fireEvent.press(screen.getByText('Continuer'));
};

const fillFeaturesStep = () => {
  fireEvent.changeText(screen.getByLabelText('Surface (m²)'), '200');
  fireEvent.press(screen.getByText('Continuer'));
};

const fillPriceStep = () => {
  fireEvent.changeText(screen.getByLabelText('Prix de vente (FCFA)'), '50000000');
  fireEvent.press(screen.getByText('Continuer'));
};

describe('AddSalePropertyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  test('bloque la progression tant que titre/description/type ne sont pas renseignés', () => {
    render(<AddSalePropertyScreen navigation={navigation} />);
    fireEvent.press(screen.getByText('Continuer'));
    expect(screen.getByText('Titre requis')).toBeTruthy();
    expect(screen.getByText('Description requise')).toBeTruthy();
    expect(screen.getByText('Choisissez un type de bien')).toBeTruthy();
  });

  test('sélectionner "Terrain" masque chambres et salles de bain à l\'étape caractéristiques', () => {
    render(<AddSalePropertyScreen navigation={navigation} />);
    fireEvent.press(screen.getByLabelText('Terrain'));
    fireEvent.changeText(screen.getByLabelText('Titre'), 'Terrain à vendre');
    fireEvent.changeText(screen.getByLabelText('Description'), 'Beau terrain viabilisé');
    fireEvent.press(screen.getByText('Continuer'));
    fillLocationStep();
    expect(screen.queryByText('Chambres')).toBeNull();
    expect(screen.queryByText('Salles de bain')).toBeNull();
  });

  test('type "Appartement" affiche chambres et salles de bain', () => {
    render(<AddSalePropertyScreen navigation={navigation} />);
    fillInfoStep();
    fillLocationStep();
    expect(screen.getByText('Chambres')).toBeTruthy();
    expect(screen.getByText('Salles de bain')).toBeTruthy();
  });

  test('étape photos : bloque tant qu\'aucune photo n\'est ajoutée', () => {
    render(<AddSalePropertyScreen navigation={navigation} />);
    fillInfoStep();
    fillLocationStep();
    fillFeaturesStep();
    fillPriceStep();
    fireEvent.press(screen.getByText('Continuer'));
    expect(screen.getByText('Ajoutez au moins une photo')).toBeTruthy();
  });

  test('publication réussie : upload de la photo puis creerAnnonce avec categorie=vente', async () => {
    uploadToCloudinary.mockResolvedValue('https://res.cloudinary.com/x/photo.jpg');
    creerAnnonce.mockResolvedValue({ _id: 'prop-1' });

    render(<AddSalePropertyScreen navigation={navigation} />);
    fillInfoStep();
    fillLocationStep();
    fillFeaturesStep();
    fillPriceStep();

    await fireEvent.press(screen.getByText('Ajouter des photos'));
    await waitFor(() => expect(screen.getByLabelText('Supprimer la photo')).toBeTruthy());
    fireEvent.press(screen.getByText('Continuer')); // photos -> summary
    fireEvent.press(screen.getByText('Publier')); // summary -> publication

    await waitFor(() => expect(creerAnnonce).toHaveBeenCalled());
    // HOTFIX-MOB-PROPERTY-PUBLISH-FAILURE-2 — index/total sont une
    // instrumentation DEV optionnelle ajoutée pour distinguer, sur un lot de
    // plusieurs photos, laquelle échoue réellement.
    expect(uploadToCloudinary).toHaveBeenCalledWith('file://photo1.jpg', { index: 0, total: 1 });
    expect(creerAnnonce.mock.calls[0][0]).toMatchObject({ categorie: 'vente', titre: 'Belle maison' });
  });

  test("erreur API à la publication : message d'erreur affiché sans crash", async () => {
    uploadToCloudinary.mockResolvedValue('https://res.cloudinary.com/x/photo.jpg');
    creerAnnonce.mockRejectedValue(new Error('Erreur serveur'));

    render(<AddSalePropertyScreen navigation={navigation} />);
    fillInfoStep();
    fillLocationStep();
    fillFeaturesStep();
    fillPriceStep();
    await fireEvent.press(screen.getByText('Ajouter des photos'));
    await waitFor(() => expect(screen.getByLabelText('Supprimer la photo')).toBeTruthy());
    fireEvent.press(screen.getByText('Continuer'));
    fireEvent.press(screen.getByText('Publier'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Erreur', 'Erreur serveur'));
  });

  test('bouton Retour à la première étape appelle navigation.goBack', () => {
    render(<AddSalePropertyScreen navigation={navigation} />);
    fireEvent.press(screen.getByLabelText('Retour'));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
