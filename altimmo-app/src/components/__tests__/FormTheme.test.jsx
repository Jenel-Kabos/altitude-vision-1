import React from 'react';
import { StyleSheet, Switch } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import Input from '../Input';
import Button from '../Button';
import Card from '../Card';
import Checkbox from '../Checkbox';
import FormSwitch from '../FormSwitch';
import Chip from '../Chip';
import { colors } from '../../theme/colors';
import { colorsDark } from '../../theme/colorsDark';

let mockActiveTheme = colors;

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});

jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ themeColors: mockActiveTheme }),
}));

const flattenedStyle = (node) => StyleSheet.flatten(node.props.style);

describe.each([
  ['clair', colors],
  ['sombre', colorsDark],
])('Design System des formulaires — thème %s', (_name, theme) => {
  beforeEach(() => {
    mockActiveTheme = theme;
  });

  test('rend label, placeholder, curseur, helper et surface depuis le thème', () => {
    const screen = render(
      <Input label="Adresse" placeholder="Rue et quartier" helperText="Indiquez un repère précis" />,
    );
    const input = screen.getByLabelText('Adresse');

    expect(input.props.placeholderTextColor).toBe(theme.placeholder);
    expect(input.props.cursorColor).toBe(theme.gold);
    expect(input.props.selectionColor).toBe(theme.borderGold);
    expect(flattenedStyle(input)).toMatchObject({
      backgroundColor: theme.bgCardAlt,
      borderColor: theme.inputBorder,
      color: theme.text,
      minHeight: 48,
    });
    expect(screen.getByText('Indiquez un repère précis')).toBeTruthy();
  });

  test('rend le focus et l’erreur avec un contraste explicite', () => {
    const screen = render(<Input label="Email" error="Email invalide" />);
    const input = screen.getByLabelText('Email');

    fireEvent(input, 'focus', {});
    expect(flattenedStyle(input).borderColor).toBe(theme.error);
    expect(screen.getByText('Email invalide')).toBeTruthy();
  });

  test('rend les états désactivés et le bouton primaire avec les couleurs sémantiques', () => {
    const screen = render(
      <>
        <Input label="Référence" disabled value="ALT-42" />
        <Button label="Continuer" onPress={jest.fn()} />
        <Button label="Retour" variant="outline" onPress={jest.fn()} />
        <Button label="Indisponible" disabled onPress={jest.fn()} />
        <Card accessibilityLabel="Carte formulaire"><Input label="Ville" /></Card>
      </>,
    );

    const disabledInput = screen.getByLabelText('Référence');
    expect(disabledInput.props.editable).toBe(false);
    expect(disabledInput.props.accessibilityState).toEqual({ disabled: true, invalid: false });

    const button = screen.getByRole('button', { name: 'Continuer' });
    expect(flattenedStyle(button).backgroundColor).toBe(theme.gold);
    expect(flattenedStyle(screen.getByText('Continuer')).color).toBe(theme.onAccent);
    expect(flattenedStyle(screen.getByRole('button', { name: 'Retour' })).borderColor).toBe(theme.gold);
    expect(screen.getByRole('button', { name: 'Indisponible' }).props.accessibilityState.disabled).toBe(true);
    expect(flattenedStyle(screen.getByLabelText('Carte formulaire')).borderColor).toBe(theme.border);
    expect(screen.getByText('Ville')).toBeTruthy();
  });

  test('rend Checkbox et Switch dans leurs états cochés, erreur et désactivé', () => {
    const screen = render(
      <>
        <Checkbox checked label="Conditions acceptées" onPress={jest.fn()} />
        <Checkbox label="Consentement" error="Consentement requis" onPress={jest.fn()} />
        <FormSwitch value disabled accessibilityLabel="Notifications" />
      </>,
    );

    expect(screen.getByRole('checkbox', { name: 'Conditions acceptées' }).props.accessibilityState)
      .toEqual(expect.objectContaining({ checked: true, disabled: false }));
    expect(screen.getByText('Consentement requis').props.style.color).toBe(theme.error);
    const toggle = screen.UNSAFE_getByType(Switch);
    expect(toggle.props.trackColor).toEqual({ false: theme.inputBorder, true: theme.gold });
    expect(toggle.props.thumbColor).toBe(theme.onAccent);
    expect(toggle.props.accessibilityState).toEqual({ checked: true, disabled: true });
  });

  // UI-MOB-1 — Chip.jsx importait auparavant le token 'colors' (clair) en dur,
  // au lieu de useTheme() : en mode sombre les chips restaient rendus avec
  // les couleurs claires, invisibles/incohérentes sur fond sombre.
  test('Chip suit le thème actif (clair/sombre), jamais figé sur les couleurs claires', () => {
    const screen = render(
      <>
        <Chip label="Appartement meublé" active onPress={jest.fn()} />
        <Chip label="Studio" onPress={jest.fn()} />
      </>,
    );

    const active = screen.getByRole('button', { name: 'Appartement meublé' });
    const inactive = screen.getByRole('button', { name: 'Studio' });

    expect(flattenedStyle(active)).toMatchObject({
      borderColor: theme.borderGoldFull,
      backgroundColor: theme.goldMuted,
    });
    expect(flattenedStyle(inactive)).toMatchObject({
      borderColor: theme.inputBorder,
      backgroundColor: theme.bgCardAlt,
    });
    expect(flattenedStyle(screen.getByText('Appartement meublé')).color).toBe(theme.gold);
    expect(flattenedStyle(screen.getByText('Studio')).color).toBe(theme.text);
    expect(active.props.accessibilityState).toEqual({ selected: true, disabled: false });
  });

  test('le label du bouton reste sur une seule ligne (bug "Précédent" coupé)', () => {
    const screen = render(<Button label="Précédent" variant="outline" onPress={jest.fn()} />);
    expect(screen.getByText('Précédent').props.numberOfLines).toBe(1);
  });
});

test('recalcule les styles après un changement de thème à chaud', () => {
  mockActiveTheme = colors;
  const screen = render(<Input label="Recherche" />);
  expect(flattenedStyle(screen.getByLabelText('Recherche')).backgroundColor).toBe(colors.bgCardAlt);

  mockActiveTheme = colorsDark;
  screen.rerender(<Input label="Recherche" />);
  expect(flattenedStyle(screen.getByLabelText('Recherche')).backgroundColor).toBe(colorsDark.bgCardAlt);
  expect(flattenedStyle(screen.getByLabelText('Recherche')).color).toBe(colorsDark.text);
});
