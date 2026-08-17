import React from 'react';
import { render } from '@testing-library/react-native';
import StepFooter from '../StepFooter';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});

// UI-MOB-1 — StepFooter utilisait un ratio flex 1/2 (33 %/67 %) sans
// numberOfLines sur le Button, ce qui coupait "Précédent" sur plusieurs
// lignes sur les écrans étroits. Corrigé : ratio ~35 %/65 % + Button à
// une seule ligne (voir FormTheme.test.jsx).
describe('StepFooter — layout des boutons (mandat UI-MOB-1 §15-16)', () => {
  test('le bouton Précédent reste sur une seule ligne et garde une largeur raisonnable (~35 %)', () => {
    const screen = render(
      <StepFooter onBack={jest.fn()} onNext={jest.fn()} />,
    );

    const backLabel = screen.getByText('Précédent');
    expect(backLabel.props.numberOfLines).toBe(1);

    const nextLabel = screen.getByText('Continuer');
    expect(nextLabel.props.numberOfLines).toBe(1);
  });

  test('affiche "Publier" comme dernière étape', () => {
    const screen = render(
      <StepFooter onBack={jest.fn()} onNext={jest.fn()} isLast />,
    );
    expect(screen.getByText('Publier')).toBeTruthy();
  });

  test('sans onBack, seul le bouton suivant est rendu', () => {
    const screen = render(<StepFooter onNext={jest.fn()} />);
    expect(screen.queryByText('Précédent')).toBeNull();
    expect(screen.getByText('Continuer')).toBeTruthy();
  });
});
