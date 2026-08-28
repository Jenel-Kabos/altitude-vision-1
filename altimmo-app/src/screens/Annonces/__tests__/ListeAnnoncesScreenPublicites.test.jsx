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
    default: { View: RN.View, Text: RN.Text, createAnimatedComponent: (Component) => Component },
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: (factory) => factory(),
    withRepeat: (value) => value,
    withTiming: (value) => value,
    Easing: { inOut: (value) => value, ease: 'ease' },
    FadeInDown: { delay: () => ({ duration: () => ({}) }), duration: () => ({}) },
  };
});
jest.mock('../../../services/api');
jest.mock('../../../services/annonceService', () => ({
  getRecommendedProperties: jest.fn(),
}));
jest.mock('../../../services/publiciteService', () => ({
  getActivePublicites: jest.fn(),
}));
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

const navigation = { navigate: jest.fn() };
const PUBLICITE = {
  _id: 'pub-1',
  titre: 'Campagne Altimmo',
  media: 'https://res.cloudinary.com/dop8vzm5z/image/upload/v1/pub.jpg',
};

const renderHome = () => render(<ListeAnnoncesScreen navigation={navigation} />);

const pullToRefresh = async () => {
  const list = screen.UNSAFE_getAllByType(FlatList).find((node) => node.props.refreshControl);
  await act(async () => list.props.refreshControl.props.onRefresh());
};

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockReset();
  getRecommendedProperties.mockReset();
  getActivePublicites.mockReset();
  mockFocusCallbacks.length = 0;
  cache.clear();
  api.get.mockResolvedValue({ data: { data: { properties: [], total: 0 } } });
  getRecommendedProperties.mockResolvedValue([]);
});

describe('ListeAnnoncesScreen — pipeline publicités', () => {
  test('un succès avec publicité alimente le carousel et masque le fallback', async () => {
    getActivePublicites.mockResolvedValue([PUBLICITE]);
    renderHome();

    expect(await screen.findByText('Campagne Altimmo')).toBeTruthy();
    expect(screen.queryByText(/Votre futur bien/)).toBeNull();
    expect(getActivePublicites).toHaveBeenCalledTimes(1);
  });

  test('un succès vide conserve le fallback Altimmo', async () => {
    getActivePublicites.mockResolvedValue([]);
    renderHome();

    expect(await screen.findByText(/Votre futur bien/)).toBeTruthy();
    expect(screen.queryByText('Campagne Altimmo')).toBeNull();
  });

  test('une erreur est observable sans faire crasher la Home', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    getActivePublicites.mockRejectedValue(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }));
    renderHome();

    expect(await screen.findByText(/Votre futur bien/)).toBeTruthy();
    await waitFor(() => expect(warn).toHaveBeenCalledWith(
      '[Publicites] load failed',
      expect.objectContaining({ code: 'ERR_NETWORK' }),
    ));
    warn.mockRestore();
  });

  test('error → pull-to-refresh → success affiche la publicité sans redémarrage', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    getActivePublicites
      .mockRejectedValueOnce(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }))
      .mockResolvedValueOnce([PUBLICITE]);
    renderHome();
    await screen.findByText(/Votre futur bien/);

    await pullToRefresh();

    expect(await screen.findByText('Campagne Altimmo')).toBeTruthy();
    expect(getActivePublicites).toHaveBeenCalledTimes(2);
    console.warn.mockRestore();
  });

  test('empty → pull-to-refresh → success ne reste pas bloqué sur le cache vide', async () => {
    getActivePublicites.mockResolvedValueOnce([]).mockResolvedValueOnce([PUBLICITE]);
    renderHome();
    await screen.findByText(/Votre futur bien/);

    await pullToRefresh();

    expect(await screen.findByText('Campagne Altimmo')).toBeTruthy();
    expect(getActivePublicites).toHaveBeenCalledTimes(2);
  });

  test('un nouveau focus revalide une fois, sans boucle de fetch', async () => {
    getActivePublicites.mockResolvedValueOnce([]).mockResolvedValueOnce([PUBLICITE]);
    renderHome();
    await screen.findByText(/Votre futur bien/);
    expect(getActivePublicites).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockFocusCallbacks.forEach((callback) => callback());
    });

    expect(await screen.findByText('Campagne Altimmo')).toBeTruthy();
    expect(getActivePublicites).toHaveBeenCalledTimes(2);
    await act(async () => Promise.resolve());
    expect(getActivePublicites).toHaveBeenCalledTimes(2);
  });
});
