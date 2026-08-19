import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import EmptyState from '../EmptyState';
import { colors } from '../../../theme/colors';

// UI-MOB-5.1 — verrou anti-régression : sur la Home (device réel testé :
// Samsung SM_S918B), le header au-dessus du ListEmptyComponent mesure 460.8dp
// pour un viewport FlatList de 589.9dp (mesuré via onLayout réel) — il ne
// reste que ~109dp pour l'EmptyState. Avec son empreinte par défaut
// (illustration 160dp + padding xl 24 + gap title lg 36), le titre/sous-titre
// atterrissaient ~56-110dp sous le pli visible : ni un bug de montage, ni de
// couleur, ni de dimensions nulles (prouvé par onLayout — le texte existait
// bien, correctement dimensionné) mais une empreinte trop grande pour
// l'espace réellement disponible. `compact` réduit cette empreinte. Ce test
// verrouille les valeurs mesurées (pas seulement `toBeTruthy()`, qui passait
// déjà avant le correctif alors que le texte était hors du pli sur device).
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ themeColors: require('../../../theme/colors').colors }),
}));

jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: {
      View: RN.View,
      Text: RN.Text,
      createAnimatedComponent: (Component) => Component,
    },
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: (fn) => fn(),
    withSpring: (v) => v,
    withTiming: (v) => v,
  };
});

const flatten = (style) => StyleSheet.flatten(style);

const StubIllustration = ({ size }) => {
  const { Text } = require('react-native');
  return <Text testID="stub-illustration" data-size={size}>{`size:${size}`}</Text>;
};

describe('EmptyState — empreinte verticale compacte (régression UI-MOB-5.1)', () => {
  test('compact réduit l’illustration à 104dp (au lieu de 160dp par défaut)', () => {
    render(
      <EmptyState
        illustration={StubIllustration}
        title="Aucune annonce trouvée"
        subtitle="Essayez d'élargir vos critères de recherche."
        compact
      />,
    );
    expect(screen.getByText('size:104')).toBeTruthy();
  });

  test('sans compact (comportement historique, tous les autres écrans), illustration reste 160dp', () => {
    render(
      <EmptyState
        illustration={StubIllustration}
        title="Titre"
        subtitle="Sous-titre"
      />,
    );
    expect(screen.getByText('size:160')).toBeTruthy();
  });

  test('compact réduit le padding du container et le marginTop du titre (moins d’espace mort avant le texte)', () => {
    render(
      <EmptyState
        illustration={StubIllustration}
        title="Aucune annonce trouvée"
        subtitle="Essayez d'élargir vos critères de recherche."
        compact
      />,
    );
    const title = screen.getByText('Aucune annonce trouvée');
    const container = screen.getByTestId('empty-state-container');
    expect(flatten(title.props.style).marginTop).toBe(20); // spacing.md
    expect(flatten(container.props.style).padding).toBe(20); // spacing.md
  });

  test('titre et sous-titre restent contrastés (texte foncé sur fond clair), thème clair', () => {
    render(
      <EmptyState
        illustration={StubIllustration}
        title="Aucune annonce trouvée"
        subtitle="Essayez d'élargir vos critères de recherche."
        compact
      />,
    );
    const title = flatten(screen.getByText('Aucune annonce trouvée').props.style);
    const subtitle = flatten(screen.getByText("Essayez d'élargir vos critères de recherche.").props.style);
    expect(title.color).toBe(colors.text);
    expect(subtitle.color).toBe(colors.textSub);
  });
});
