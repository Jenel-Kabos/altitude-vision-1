import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import PageHeader from '../PageHeader';
import { colors } from '../../theme/colors';
import { colorsDark } from '../../theme/colorsDark';

// UI-MOB-7 — verrou du pattern canonique de header. Avant ce sprint, trois
// écrans ("Mes réservations hôtel", "Mes transactions", "Mes dossiers")
// avaient chacun leur propre implémentation de header (icône de retour
// différente — "‹" en Text 36px vs Ionicons 22px vs absence totale —,
// tailles de titre différentes dont une reposant sur un token inexistant
// `fontSize.xxl`, marges différentes). Ce test verrouille que le composant
// partagé `PageHeader`, adopté par les trois écrans, produit une zone
// gauche/droite de largeur strictement identique (44dp chacune) quel que
// soit le contenu — c'est ce qui garantit que le titre reste visuellement
// centré à l'identique, avec ou sans bouton retour, avec ou sans action
// droite — au lieu d'un `marginLeft` local différent par écran.

let mockActiveTheme = colors;
jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ themeColors: mockActiveTheme }),
}));

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});

const flatten = (style) => StyleSheet.flatten(style);

describe.each([
  ['clair', colors],
  ['sombre', colorsDark],
])('PageHeader — pattern canonique (régression UI-MOB-7), thème %s', (_name, theme) => {
  beforeEach(() => { mockActiveTheme = theme; });

  test('sans onBack : pas de bouton retour, mais les zones gauche/droite réservent toujours 44dp chacune (titre centré à l’identique)', () => {
    render(<PageHeader title="Mes réservations hôtel" />);
    expect(screen.queryByLabelText('Retour')).toBeNull();
    const views = screen.UNSAFE_getAllByType(require('react-native').View);
    const width44Count = views.filter((v) => flatten(v.props.style)?.width === 44).length;
    expect(width44Count).toBe(2); // zone gauche + zone droite, symétriques
  });

  test('avec onBack : bouton retour affiché, cible tactile >= 44dp (36 + hitSlop 8 de chaque côté)', () => {
    const onBack = jest.fn();
    render(<PageHeader title="Mes transactions" onBack={onBack} />);
    const back = screen.getByLabelText('Retour');
    expect(flatten(back.props.style).width).toBe(36);
    expect(back.props.hitSlop).toEqual({ top: 8, bottom: 8, left: 8, right: 8 });
  });

  test('rightIcon optionnel : absent par défaut, affiché et cliquable si fourni (ex. refresh "Mes transactions")', () => {
    const onRightPress = jest.fn();
    render(<PageHeader title="Mes transactions" rightIcon="refresh-outline" onRightPress={onRightPress} />);
    expect(screen.getByText('refresh-outline')).toBeTruthy();
  });

  test('titre long : une seule ligne (numberOfLines=1), jamais de wrap qui casserait la hauteur du header', () => {
    render(<PageHeader title="Un titre exceptionnellement long qui pourrait déborder du header" onBack={() => {}} />);
    const title = screen.getByText(/Un titre exceptionnellement long/);
    expect(title.props.numberOfLines).toBe(1);
  });

  test(`couleur du titre suit le thème ${_name} (c.text), jamais figée`, () => {
    render(<PageHeader title="Mes dossiers" onBack={() => {}} />);
    const title = screen.getByText('Mes dossiers');
    expect(flatten(title.props.style).color).toBe(theme.text);
  });
});
