import React from 'react';
import { FlatList } from 'react-native';
import { render, screen, waitFor, act } from '@testing-library/react-native';
import ListeAnnoncesScreen from '../ListeAnnoncesScreen';
import api from '../../../services/api';
import { getRecommendedProperties } from '../../../services/annonceService';
import { getActivePublicites } from '../../../services/publiciteService';
import { cache } from '../../../services/cacheService';

// HOTFIX-MOB-RECOMMENDED-PROPERTIES-1 — caractérise puis prouve la
// fermeture du bug réel : la section "Biens recommandés" est chargée une
// seule fois au montage (useEffect [], ListeAnnoncesScreen.jsx:290-293) et
// n'est JAMAIS rechargée par le pull-to-refresh (`onRefresh` n'invalide/
// refetch que le préfixe 'properties:', jamais 'recommended:') ni par le
// focus d'écran. Preuve backend (production, requête directe) : les deux
// biens réels du rapport (PARCELLE A VENDRE, BUREAU A LOUER) sont TOUS LES
// DEUX déjà renvoyés correctement par /api/properties/recommended,
// recommande:true, images en tableau de chaînes valides — voir
// HOTFIX_MOB_RECOMMENDED_PROPERTIES1_PROPERTY_MATRIX.md. Le bug est donc
// entièrement côté mobile : cache jamais invalidé/refetch jamais déclenché,
// pas un défaut de données ni de filtre vente/location.

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ themeColors: require('../../../theme/colors').colors }),
}));
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: { View: RN.View, Text: RN.Text, createAnimatedComponent: (Component) => Component },
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: (fn) => fn(),
    withRepeat: (v) => v,
    withTiming: (v) => v,
    Easing: { inOut: (v) => v, ease: 'ease' },
    FadeInDown: { duration: () => ({}) },
  };
});
jest.mock('../../../services/api');
jest.mock('../../../services/annonceService', () => ({
  getRecommendedProperties: jest.fn(),
}));
jest.mock('../../../services/publiciteService', () => ({
  getActivePublicites: jest.fn(),
}));
// `useFocusEffect` exige un vrai `NavigationContainer` ; ce test ne porte
// pas sur la logique de focus (déjà hors du chemin recommandé, cf.
// ListeAnnoncesScreen.jsx:349-356 qui ne touche que le préfixe
// 'properties:') — remplacé par un simple effet au montage, comportement
// suffisant pour ces scénarios.
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const { useEffect } = require('react');
  return { ...actual, useFocusEffect: (cb) => useEffect(() => { cb(); }, []) };
});
// Le barrel `components/index.js` importe statiquement `SearchPanel.jsx`,
// qui importe `@miblanchard/react-native-slider` (ESM pur, non transpilé
// par le preset Jest de ce projet, sans rapport avec ce hotfix) — charger
// le barrel réel ferait échouer le parsing avant même de pouvoir le
// mocker. On reconstruit donc l'objet exporté à partir des modules
// individuels réels (dont `RecommendedCarousel`, réellement exercé par ces
// tests), sans jamais passer par `SearchPanel.jsx`.
jest.mock('../../../components', () => {
  const React = require('react');
  return {
    Screen: require('../../../components/Screen').default,
    Card: require('../../../components/Card').default,
    PrixFCFA: require('../../../components/PrixFCFA').default,
    RecommendedCarousel: require('../../../components/RecommendedCarousel').default,
    GreetingBar: require('../../../components/GreetingBar').default,
    AdCarousel: require('../../../components/AdCarousel').default,
    SearchPanel: () => React.createElement(React.Fragment),
  };
});

const navigation = { navigate: jest.fn() };

const VENTE_RECOMMENDED = [{
  _id: 'parcelle-1', title: 'PARCELLE A VENDRE', type: 'Parcelle', status: 'vente', price: 5000000,
  images: ['https://res.cloudinary.com/dop8vzm5z/image/upload/v1/parcelle.jpg'],
  address: { arrondissement: 'Bacongo', city: 'Brazzaville' },
}];

const VENTE_AND_LOCATION_RECOMMENDED = [
  ...VENTE_RECOMMENDED,
  {
    _id: 'bureau-1', title: 'BUREAU A LOUER', type: 'Bureau', status: 'location', price: 250000,
    images: ['https://res.cloudinary.com/dop8vzm5z/image/upload/v1/bureau.jpg'],
    address: { arrondissement: 'Poto-Poto', city: 'Brazzaville' },
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  cache.clear();
  api.get.mockResolvedValue({ data: { data: { properties: [], total: 0 } } });
  getActivePublicites.mockResolvedValue([]);
});

describe('ListeAnnoncesScreen — section "Biens recommandés" (HOTFIX-MOB-RECOMMENDED-PROPERTIES-1)', () => {
  test('vente seule recommandée au montage : la carte PARCELLE apparaît', async () => {
    getRecommendedProperties.mockResolvedValue(VENTE_RECOMMENDED);
    render(<ListeAnnoncesScreen navigation={navigation} />);
    await screen.findByText('Biens recommandés');
    expect(await screen.findByText('PARCELLE A VENDRE')).toBeTruthy();
  });

  test('vente et location recommandées ensemble : les deux cartes apparaissent', async () => {
    getRecommendedProperties.mockResolvedValue(VENTE_AND_LOCATION_RECOMMENDED);
    render(<ListeAnnoncesScreen navigation={navigation} />);
    await screen.findByText('Biens recommandés');
    expect(await screen.findByText('PARCELLE A VENDRE')).toBeTruthy();
    expect(await screen.findByText('BUREAU A LOUER')).toBeTruthy();
  });

  test('aucun bien recommandé : la section reste absente (jamais de faux bouton/section vide)', async () => {
    getRecommendedProperties.mockResolvedValue([]);
    render(<ListeAnnoncesScreen navigation={navigation} />);
    await waitFor(() => expect(getRecommendedProperties).toHaveBeenCalled());
    expect(screen.queryByText('Biens recommandés')).toBeNull();
  });

  test('BUG PROUVÉ PUIS FERMÉ : le pull-to-refresh recharge la section recommandée quand la donnée a changé côté serveur', async () => {
    // 1er appel (montage) : seule la Parcelle est recommandée (ex. le Bureau
    // vient tout juste d'être marqué recommandé côté admin, pas encore vu
    // par ce montage).
    getRecommendedProperties.mockResolvedValueOnce(VENTE_RECOMMENDED);
    render(<ListeAnnoncesScreen navigation={navigation} />);
    await screen.findByText('PARCELLE A VENDRE');
    expect(screen.queryByText('BUREAU A LOUER')).toBeNull();
    expect(getRecommendedProperties).toHaveBeenCalledTimes(1);

    // 2e appel : le serveur a maintenant les deux (le Bureau vient d'être
    // marqué recommandé). L'utilisateur tire pour rafraîchir.
    getRecommendedProperties.mockResolvedValueOnce(VENTE_AND_LOCATION_RECOMMENDED);
    const list = screen.UNSAFE_getByType(FlatList);
    await act(async () => {
      list.props.refreshControl.props.onRefresh();
    });

    // Preuve du correctif : getRecommendedProperties doit être rappelé par
    // le pull-to-refresh (avant correctif : jamais rappelé, ce test échoue
    // ici avec "Called 1 times" et le Bureau reste absent indéfiniment).
    await waitFor(() => expect(getRecommendedProperties).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('BUREAU A LOUER')).toBeTruthy();
  });
});
