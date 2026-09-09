import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import HotelLocationMap from '../HotelLocationMap';

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { googleMapsConfigured: true } } },
}));
jest.mock('react-native-maps', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: (props) => ReactActual.createElement(RN.View, { testID: 'hotel-map', ...props }, props.children),
    Marker: (props) => ReactActual.createElement(RN.View, { testID: 'hotel-map-marker', ...props }),
    PROVIDER_DEFAULT: 'default',
    PROVIDER_GOOGLE: 'google',
  };
});
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ themeColors: {
    border: '#ddd', bgCardAlt: '#eee', gold: '#996f00', text: '#111', textSub: '#555',
  } }),
}));

describe('HotelLocationMap', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    Constants.expoConfig.extra.googleMapsConfigured = true;
    jest.spyOn(Linking, 'openURL').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  test('monte la carte Android lorsque la clé est intégrée au build', () => {
    render(<HotelLocationMap latitude={-4.26} longitude={15.24} title="Altitude Palace" />);
    expect(screen.getByTestId('hotel-map')).toBeTruthy();
    expect(screen.getByTestId('hotel-map-marker')).toBeTruthy();
  });

  test('ne monte jamais MapView et garde l’itinéraire si la clé native manque', () => {
    Constants.expoConfig.extra.googleMapsConfigured = false;
    render(<HotelLocationMap latitude={-4.26} longitude={15.24} title="Altitude Palace" />);

    expect(screen.queryByTestId('hotel-map')).toBeNull();
    expect(screen.getByText('Carte indisponible')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Obtenir l’itinéraire'));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('destination=-4.26,15.24'));
  });
});
