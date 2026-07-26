import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import ChoixTypeAnnonceScreen from '../ChoixTypeAnnonceScreen';

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

describe('ChoixTypeAnnonceScreen — parcours d\'entrée (mission §2)', () => {
  test('affiche les 3 choix Vente/Location/Hébergement (jamais un formulaire unique)', () => {
    render(<ChoixTypeAnnonceScreen navigation={{ navigate: jest.fn() }} />);
    expect(screen.getByText('Vendre un bien')).toBeTruthy();
    expect(screen.getByText('Mettre un bien en location')).toBeTruthy();
    expect(screen.getByText('Proposer un hébergement')).toBeTruthy();
  });

  test('sélectionner "Vendre un bien" ouvre AddSaleProperty', () => {
    const navigate = jest.fn();
    render(<ChoixTypeAnnonceScreen navigation={{ navigate }} />);
    fireEvent.press(screen.getByText('Vendre un bien'));
    expect(navigate).toHaveBeenCalledWith('AddSaleProperty');
  });

  test('sélectionner "Mettre un bien en location" ouvre AddRentalProperty', () => {
    const navigate = jest.fn();
    render(<ChoixTypeAnnonceScreen navigation={{ navigate }} />);
    fireEvent.press(screen.getByText('Mettre un bien en location'));
    expect(navigate).toHaveBeenCalledWith('AddRentalProperty');
  });

  test('sélectionner "Proposer un hébergement" affiche les deux familles puis ouvre le bon parcours', () => {
    const navigate = jest.fn();
    render(<ChoixTypeAnnonceScreen navigation={{ navigate }} />);
    fireEvent.press(screen.getByText('Proposer un hébergement'));
    expect(screen.getByText('Logement meublé')).toBeTruthy();
    expect(screen.getByText('Établissement hôtelier')).toBeTruthy();
    fireEvent.press(screen.getByText('Établissement hôtelier'));
    expect(navigate).toHaveBeenCalledWith('AddAccommodation', { publicationKind: 'hotel_establishment' });
  });
});
