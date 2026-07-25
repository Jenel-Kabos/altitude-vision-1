import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import SearchPanel from '../SearchPanel';

// @miblanchard/react-native-slider est distribué en ESM non transpilé — stub minimal
// suffisant pour ce test (le glissement du slider n'est pas sous test ici, seuls les
// presets/chips/dropdowns le sont).
jest.mock('@miblanchard/react-native-slider', () => ({ Slider: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@expo/vector-icons', () => {
  const RN = require('react-native');
  const React_ = require('react');
  return { Ionicons: (props) => React_.createElement(RN.Text, props, props.name) };
});

// Audit filtrage Altimmo — nomenclature canonique mobile (offerType/propertyType/city),
// parité avec le web : ouverture, sélection type d'offre/type de bien, dépendance
// ville→arrondissement, application, réinitialisation.

describe('SearchPanel — nomenclature canonique + dépendances', () => {
  test('propose Vente, Location ET Hébergement (jamais limité à Vente/Location)', () => {
    render(<SearchPanel visible onClose={() => {}} onSearch={() => {}} />);
    expect(screen.getByText('Vente')).toBeTruthy();
    expect(screen.getByText('Location')).toBeTruthy();
    expect(screen.getByText('Hébergement')).toBeTruthy();
  });

  test('sélection Vente + type de bien, application → payload canonique offerType/propertyType (jamais accommodationType)', () => {
    const onSearch = jest.fn();
    render(<SearchPanel visible onClose={() => {}} onSearch={onSearch} />);

    fireEvent.press(screen.getByText('Vente'));
    fireEvent.press(screen.getByLabelText('Sélectionner type de bien'));
    fireEvent.press(screen.getByLabelText('Villa'));

    fireEvent.press(screen.getByLabelText(/Appliquer|Voir tous les biens/));

    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({
      offerType: 'vente', propertyType: 'Villa', accommodationType: 'tous',
    }));
  });

  test('correctif architecture recherche Altimmo (2026-07-25) : sélection Hébergement bascule le dropdown vers les catégories d’hébergement (jamais Terrain/Bureau/Entrepôt), application → accommodationType (jamais propertyType)', () => {
    const onSearch = jest.fn();
    render(<SearchPanel visible onClose={() => {}} onSearch={onSearch} />);

    fireEvent.press(screen.getByText('Hébergement'));

    expect(screen.queryByLabelText('Sélectionner type de bien')).toBeNull();
    fireEvent.press(screen.getByLabelText("Sélectionner catégorie d'hébergement"));
    expect(screen.queryByLabelText('Terrain')).toBeNull();
    expect(screen.queryByLabelText('Bureau')).toBeNull();
    fireEvent.press(screen.getByLabelText('Villa meublée'));

    fireEvent.press(screen.getByLabelText(/Appliquer|Voir tous les biens/));

    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({
      offerType: 'hebergement', accommodationType: 'villa_meublee', propertyType: 'tous',
    }));
  });

  test('revenir à Vente après Hébergement réinitialise immédiatement le filtre secondaire incompatible', () => {
    const onSearch = jest.fn();
    render(<SearchPanel visible onClose={() => {}} onSearch={onSearch} />);

    fireEvent.press(screen.getByLabelText('Sélectionner type de bien'));
    fireEvent.press(screen.getByLabelText('Villa'));
    fireEvent.press(screen.getByText('Hébergement'));
    fireEvent.press(screen.getByLabelText("Sélectionner catégorie d'hébergement"));
    fireEvent.press(screen.getByLabelText('Hôtel'));
    fireEvent.press(screen.getByText('Vente'));

    expect(screen.queryByLabelText("Sélectionner catégorie d'hébergement")).toBeNull();
    expect(screen.getByLabelText('Sélectionner type de bien')).toBeTruthy();

    fireEvent.press(screen.getByLabelText(/Appliquer|Voir tous les biens/));
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({
      offerType: 'vente', propertyType: 'tous', accommodationType: 'tous',
    }));
  });

  test('dépendance ville→arrondissement : l’arrondissement se réinitialise à "Tous" quand la ville change', () => {
    const onSearch = jest.fn();
    render(<SearchPanel visible onClose={() => {}} onSearch={onSearch} />);

    fireEvent.press(screen.getByLabelText('Sélectionner ville'));
    fireEvent.press(screen.getByLabelText('Brazzaville'));
    fireEvent.press(screen.getByLabelText('Sélectionner arrondissement'));
    fireEvent.press(screen.getByLabelText('Bacongo'));

    // Changer de ville doit réinitialiser l'arrondissement précédemment choisi.
    fireEvent.press(screen.getByLabelText('Sélectionner ville'));
    fireEvent.press(screen.getByLabelText('Pointe-Noire'));

    fireEvent.press(screen.getByLabelText(/Appliquer|Voir tous les biens/));
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({
      city: 'Pointe-Noire', arrondissement: 'Tous',
    }));
  });

  test('réinitialisation remet tous les filtres à leurs valeurs par défaut canoniques', () => {
    const onSearch = jest.fn();
    render(<SearchPanel visible onClose={() => {}} onSearch={onSearch} />);

    fireEvent.press(screen.getByText('Hébergement'));
    fireEvent.press(screen.getByLabelText('Réinitialiser les filtres'));
    fireEvent.press(screen.getByLabelText(/Voir tous les biens/));

    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({
      offerType: 'tous', propertyType: 'tous', accommodationType: 'tous', city: 'Toutes', arrondissement: 'Tous',
    }));
  });
});
