// ALTIMMO-MAP-LOCALITY-NAV-FIX-8 — quand la carte agrégée pousse
// `route.params.initialFilters`, ListeAnnoncesScreen doit appliquer ces
// filtres même lorsque l'écran est déjà monté (cas normal : ListeAnnonces
// est la route initiale du stack Annonces). Sans ce ré-alignement, l'user
// clique sur "Voir les biens" et retombe sur la liste sans filtre, ce qui
// ressemble à un retour Accueil.

import React from 'react';
import { FlatList } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import ListeAnnoncesScreen from '../ListeAnnoncesScreen';
import api from '../../../services/api';
import { getRecommendedProperties } from '../../../services/annonceService';
import { getActivePublicites } from '../../../services/publiciteService';
import { cache } from '../../../services/cacheService';

const mockFocusCallbacks = [];

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ themeColors: require('../../../theme/colors').colors }),
}));
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: { View: RN.View, Text: RN.Text, createAnimatedComponent: (C) => C },
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: (fn) => fn(),
    withRepeat: (v) => v, withTiming: (v) => v,
    Easing: { inOut: (v) => v, ease: 'ease' },
    FadeInDown: { delay: () => ({ duration: () => ({}) }), duration: () => ({}) },
  };
});
jest.mock('../../../services/api');
jest.mock('../../../services/annonceService', () => ({ getRecommendedProperties: jest.fn() }));
jest.mock('../../../services/publiciteService', () => ({ getActivePublicites: jest.fn() }));
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const { useEffect } = require('react');
  return {
    ...actual,
    useFocusEffect: (callback) => useEffect(() => {
      mockFocusCallbacks.push(callback);
      return callback();
    }, [callback]),
  };
});
jest.mock('../../../components', () => {
  const ReactLocal = require('react');
  return {
    Screen: require('../../../components/Screen').default,
    Card: require('../../../components/Card').default,
    PrixFCFA: require('../../../components/PrixFCFA').default,
    RecommendedCarousel: require('../../../components/RecommendedCarousel').default,
    GreetingBar: require('../../../components/GreetingBar').default,
    AdCarousel: require('../../../components/AdCarousel').default,
    SearchPanel: () => ReactLocal.createElement(ReactLocal.Fragment),
  };
});

const navigation = { navigate: jest.fn(), setParams: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockReset();
  getRecommendedProperties.mockReset();
  getActivePublicites.mockReset();
  mockFocusCallbacks.length = 0;
  cache.clear();
  api.get.mockResolvedValue({ data: { data: { properties: [], total: 0 } } });
  getRecommendedProperties.mockResolvedValue([]);
  getActivePublicites.mockResolvedValue([]);
});

const findSearchCall = () => api.get.mock.calls.find(([url]) => typeof url === 'string' && url.startsWith('/altimmo/search'));

describe('ListeAnnoncesScreen — initialFilters injectés par la carte', () => {
  test('NAV-02: route.params.initialFilters (Moungali) est appliqué au montage', async () => {
    const route = { params: { initialFilters: { city: 'Brazzaville', arrondissement: 'Moungali' } } };
    render(<ListeAnnoncesScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(findSearchCall()).toBeTruthy());
    const [url] = findSearchCall();
    expect(url).toMatch(/city=Brazzaville/);
    expect(url).toMatch(/arrondissement=Moungali/);
  });

  test('NAV-03: initialFilters Poto-Poto produit les bons params', async () => {
    const route = { params: { initialFilters: { city: 'Brazzaville', arrondissement: 'Poto-Poto' } } };
    render(<ListeAnnoncesScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(findSearchCall()).toBeTruthy());
    expect(findSearchCall()[0]).toMatch(/arrondissement=Poto-Poto/);
  });

  test('NAV-04: les filtres non couverts par initialFilters conservent les valeurs par défaut', async () => {
    const route = { params: { initialFilters: { arrondissement: 'Moungali' } } };
    render(<ListeAnnoncesScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(findSearchCall()).toBeTruthy());
    const [url] = findSearchCall();
    expect(url).toMatch(/arrondissement=Moungali/);
    // Les DEFAULT_FILTERS ne poussent pas de filtre offerType/propertyType
    // quand ils valent leur valeur par défaut ('tous') — les params query
    // correspondants sont donc absents (comportement de buildPropertyQueryParams).
    expect(url).not.toMatch(/offerType=(vente|location|hebergement)/);
  });

  test('NAV-06: écran déjà monté (setParams sur route existante) → filtres réappliqués', async () => {
    // Montage initial sans initialFilters (l'utilisateur ouvre ListeAnnonces normalement).
    const initialRoute = { params: {} };
    const { rerender } = render(<ListeAnnoncesScreen navigation={navigation} route={initialRoute} />);
    await waitFor(() => expect(findSearchCall()).toBeTruthy());
    api.get.mockClear();

    // Puis la carte pousse un initialFilters via navigation → nouveaux params.
    const updatedRoute = { params: { initialFilters: { city: 'Brazzaville', arrondissement: 'Moungali' } } };
    rerender(<ListeAnnoncesScreen navigation={navigation} route={updatedRoute} />);
    await waitFor(() => expect(findSearchCall()).toBeTruthy());
    expect(findSearchCall()[0]).toMatch(/arrondissement=Moungali/);
  });
});
