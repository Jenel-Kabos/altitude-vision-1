import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import LoadingSpinner from '../LoadingSpinner';
import Divider from '../Divider';
import Skeleton from '../Skeleton';
import SkeletonPropertyCard from '../SkeletonPropertyCard';
import PrixFCFA from '../../PrixFCFA';
import { colors } from '../../../theme/colors';
import { colorsDark } from '../../../theme/colorsDark';

let mockActiveTheme = colors;

jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: { View: RN.View },
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: (fn) => fn(),
    withRepeat: (v) => v,
    withTiming: (v) => v,
    Easing: { inOut: () => () => {}, ease: {} },
  };
});

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ themeColors: mockActiveTheme }),
}));

const flattenedStyle = (node) => StyleSheet.flatten(node.props.style);

// UI-MOB-3 — ces 5 composants importaient auparavant le token `colors`
// (thème clair) en dur au lieu d'appeler `useTheme()` : SkeletonPropertyCard
// en particulier restait blanc (colors.bgCard) en mode sombre, produisant un
// bloc blanc agressif sur fond sombre (mandat §54).
describe.each([
  ['clair', colors],
  ['sombre', colorsDark],
])('Composants UI partagés — suivent le thème actif (mandat UI-MOB-3 §38-40), thème %s', (_name, theme) => {
  beforeEach(() => {
    mockActiveTheme = theme;
  });

  test('LoadingSpinner utilise la couleur gold du thème actif', () => {
    render(<LoadingSpinner />);
    const spinner = screen.UNSAFE_getByType(ActivityIndicator);
    expect(spinner.props.color).toBe(theme.gold);
  });

  test('Divider utilise la couleur border du thème actif', () => {
    render(<Divider />);
    const divider = screen.UNSAFE_getByType(View);
    expect(flattenedStyle(divider).backgroundColor).toBe(theme.border);
  });

  test('Skeleton utilise bgCardAlt, jamais figé sur le clair', () => {
    render(<Skeleton width={10} height={10} />);
    const node = screen.UNSAFE_getByType(View);
    expect(flattenedStyle(node).backgroundColor).toBe(theme.bgCardAlt);
  });

  test('SkeletonPropertyCard n\'affiche jamais un bloc bgCard clair figé en mode sombre', () => {
    render(<SkeletonPropertyCard />);
    // Deux couches (shadow + card) doivent toutes deux suivre bgCard du thème actif.
    const nodes = screen.UNSAFE_root.findAllByProps({});
    const bgCardNodes = nodes.filter((n) => {
      const s = n.props?.style && StyleSheet.flatten(n.props.style);
      return s?.backgroundColor === theme.bgCard;
    });
    expect(bgCardNodes.length).toBeGreaterThanOrEqual(2);
  });

  test('PrixFCFA (variant par défaut) utilise gold/textSub du thème actif', () => {
    render(<PrixFCFA montant={185000} />);
    expect(flattenedStyle(screen.getByText('185 000')).color).toBe(theme.gold);
    expect(flattenedStyle(screen.getByText(' fcfa')).color).toBe(theme.textSub);
  });

  test('PrixFCFA (variant onImage) reste blanc fixe, indépendant du thème (overlay sur photo)', () => {
    render(<PrixFCFA montant={185000} variant="onImage" />);
    expect(flattenedStyle(screen.getByText('185 000')).color).toBe('#FFFFFF');
  });
});
