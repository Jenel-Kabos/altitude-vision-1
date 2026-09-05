import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import CarteScreen from '../CarteScreen';
import api from '../../../services/api';
import { cache } from '../../../services/cacheService';

// PHASE-H1.5 — première couverture de CarteScreen (gap pré-existant, aucun
// test ne rendait cet écran auparavant). Se limite au périmètre H1.5 :
// marqueur Hotel distinct, aperçu, navigation vers HotelDetailScreen, et
// absence de crash pour un item sans coordonnées.

jest.mock('@expo/vector-icons', () => { const ReactActual = require('react'); const RN = require('react-native'); return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) }; });
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-image', () => ({ Image: require('react-native').Image }));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('react-native-safe-area-context', () => {
  const RN = require('react-native');
  return { SafeAreaView: RN.View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('react-native-maps', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  const MockMapView = ReactActual.forwardRef((props, ref) => ReactActual.createElement(RN.View, { testID: 'carte-map', ...props }, props.children));
  const MockMarker = (props) => ReactActual.createElement(
    RN.TouchableOpacity,
    { testID: `marker-${props.accessibilityLabel}`, onPress: props.onPress, accessibilityLabel: props.accessibilityLabel },
    props.children,
  );
  return { __esModule: true, default: MockMapView, Marker: MockMarker, PROVIDER_DEFAULT: 'default', PROVIDER_GOOGLE: 'google' };
});
jest.mock('../../../components', () => {
  const React = require('react');
  return { SearchPanel: () => React.createElement(React.Fragment) };
});
// `supercluster` est ESM pur (comme @miblanchard/react-native-slider, voir
// ListeAnnoncesScreenRecommended.test.jsx) — non transpilé par ce preset
// Jest, sans rapport avec ce test. Mock minimal : un point isolé (jamais 2
// dans ces scénarios, `minPoints:2` dans CarteScreen.jsx) reste un point
// individuel, jamais un cluster — comportement réel de la librairie ici.
jest.mock('supercluster', () => {
  return class MockSupercluster {
    load(points) { this.points = points; return this; }
    getClusters() {
      return (this.points || []).map((p) => ({
        type: 'Feature', geometry: p.geometry, properties: { ...p.properties, cluster: false },
      }));
    }
    getLeaves() { return []; }
  };
});
jest.mock('../../../services/api');

const navigation = { navigate: jest.fn() };

const HOTEL_ANNONCE = {
  _id: 'property-hotel-1', title: 'Mila Hotel', status: 'hebergement', price: 25000,
  latitude: -4.26, longitude: 15.24, images: [],
  accommodationType: 'hotel', hotel: 'hotel-object-id-1',
};
const GENERIC_ANNONCE = {
  _id: 'property-heb-1', title: 'Villa Meublée', status: 'hebergement', price: 40000,
  latitude: -4.27, longitude: 15.25, images: [],
};
const NO_COORDS_ANNONCE = {
  _id: 'property-no-coords', title: 'Sans Coordonnées', status: 'hebergement', price: 10000,
  accommodationType: 'hotel', hotel: 'hotel-object-id-2', images: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  cache.clear();
});

describe('CarteScreen — découverte Hotel (PHASE-H1.5)', () => {
  test('un Hotel publié avec coordonnées apparaît comme marqueur, sans crash', async () => {
    api.get.mockResolvedValue({ data: { data: { properties: [HOTEL_ANNONCE], total: 1 } } });
    render(<CarteScreen navigation={navigation} />);
    await waitFor(() => expect(screen.getByTestId('carte-map')).toBeTruthy());
    await waitFor(() => expect(screen.getByLabelText('Mila Hotel')).toBeTruthy());
  });

  test('un item sans coordonnées est exclu du rendu carte sans planter', async () => {
    api.get.mockResolvedValue({ data: { data: { properties: [NO_COORDS_ANNONCE], total: 1 } } });
    render(<CarteScreen navigation={navigation} />);
    await waitFor(() => expect(screen.getByTestId('carte-map')).toBeTruthy());
    expect(screen.queryByLabelText('Sans Coordonnées')).toBeNull();
  });

  test('appuyer sur le marqueur Hotel ouvre l’aperçu, puis la carte de l’aperçu navigue vers HotelDetailScreen', async () => {
    api.get.mockResolvedValue({ data: { data: { properties: [HOTEL_ANNONCE], total: 1 } } });
    render(<CarteScreen navigation={navigation} />);
    const marker = await screen.findByLabelText('Mila Hotel');
    fireEvent.press(marker);
    const previewCard = await screen.findByText('Mila Hotel');
    fireEvent.press(previewCard);
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalled());
    const [screenName, params] = navigation.navigate.mock.calls[0];
    expect(screenName).toBe('Profil');
    expect(params.screen).toBe('HotelDetail');
    expect(params.params.hotelId).toBe('hotel-object-id-1');
  });

  test('un établissement non-hôtelier navigue toujours vers DetailAnnonce (comportement inchangé)', async () => {
    api.get.mockResolvedValue({ data: { data: { properties: [GENERIC_ANNONCE], total: 1 } } });
    render(<CarteScreen navigation={navigation} />);
    const marker = await screen.findByLabelText('Villa Meublée');
    fireEvent.press(marker);
    const previewCard = await screen.findByText('Villa Meublée');
    fireEvent.press(previewCard);
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('Annonces', expect.objectContaining({
      screen: 'DetailAnnonce',
      params: expect.objectContaining({ resourceType: 'property', resourceId: 'property-heb-1' }),
    })));
  });
});
