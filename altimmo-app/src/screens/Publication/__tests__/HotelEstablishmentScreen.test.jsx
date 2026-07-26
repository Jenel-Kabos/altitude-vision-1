import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import HotelEstablishmentScreen from '../HotelEstablishmentScreen';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => `uuid-${Math.random()}`) }));
jest.mock('@expo/vector-icons', () => {
  const RN = require('react-native');
  const ReactActual = require('react');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});
jest.mock('../../../services/annonceService', () => ({
  createFullAccommodationMobile: jest.fn(),
  uploadToCloudinary: jest.fn(),
}));

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function reachCategoriesStep() {
  render(<HotelEstablishmentScreen navigation={navigation} />);
  fireEvent.changeText(screen.getByLabelText("Nom de l'hôtel"), 'Hôtel Test');
  fireEvent.changeText(screen.getByLabelText('Description commerciale'), 'Description test');
  fireEvent.press(screen.getByTestId('hotel-continue-button'));
  fireEvent.press(screen.getByLabelText('Brazzaville'));
  fireEvent.press(screen.getByLabelText('Bacongo'));
  fireEvent.changeText(screen.getByLabelText('Téléphone principal'), '060000000');
  fireEvent.press(screen.getByTestId('hotel-continue-button'));
  fireEvent.press(screen.getByTestId('hotel-continue-button'));
  expect(screen.getByTestId('hotel-step-4')).toBeTruthy();
}

function addValidCategory() {
  fireEvent.press(screen.getByText('＋ Ajouter une catégorie'));
  fireEvent.changeText(screen.getByLabelText('Nom commercial'), 'Standard');
  fireEvent.changeText(screen.getByLabelText('Code court'), 'STD');
}

describe('HotelEstablishmentScreen — catégories vers tarifs', () => {
  beforeEach(() => jest.clearAllMocks());

  test('affiche une erreur visible si aucune catégorie n’existe', () => {
    reachCategoriesStep();
    fireEvent.press(screen.getByTestId('hotel-continue-button'));
    expect(screen.getByTestId('hotel-step-global-error').props.children)
      .toBe('Ajoutez au moins une catégorie de chambre.');
    expect(screen.getByTestId('hotel-step-4')).toBeTruthy();
  });

  test('catégorie valide sans tarif → étape 5, puis tarif absent → étape 5 bloquée', () => {
    reachCategoriesStep();
    addValidCategory();
    fireEvent.press(screen.getByTestId('hotel-continue-button'));
    expect(screen.getByTestId('hotel-step-5')).toBeTruthy();
    fireEvent.press(screen.getByTestId('hotel-continue-button'));
    expect(screen.getByText('Tarif public requis')).toBeTruthy();
    expect(screen.getByTestId('hotel-step-5')).toBeTruthy();
  });

  test('un code dupliqué bloque l’étape 4, sa correction permet le passage à l’étape 5', () => {
    reachCategoriesStep();
    addValidCategory();
    fireEvent.press(screen.getByText('Dupliquer'));
    const codeInputs = screen.getAllByLabelText('Code court');
    fireEvent.changeText(codeInputs[1], 'STD');
    fireEvent.press(screen.getByTestId('hotel-continue-button'));
    expect(screen.getAllByText('Le code de catégorie doit être unique.')).toHaveLength(2);
    expect(screen.getByTestId('hotel-step-4')).toBeTruthy();
    fireEvent.changeText(codeInputs[1], 'STD2');
    fireEvent.press(screen.getByTestId('hotel-continue-button'));
    expect(screen.getByTestId('hotel-step-5')).toBeTruthy();
  });

  test('un double appui rapide ne saute pas deux étapes', () => {
    reachCategoriesStep();
    addValidCategory();
    const button = screen.getByTestId('hotel-continue-button');
    fireEvent.press(button);
    fireEvent.press(button);
    expect(screen.getByTestId('hotel-step-5')).toBeTruthy();
  });
});
