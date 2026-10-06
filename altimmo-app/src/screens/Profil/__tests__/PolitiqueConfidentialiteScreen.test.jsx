import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import PolitiqueConfidentialiteScreen from '../PolitiqueConfidentialiteScreen';

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => {
  const RN = require('react-native');
  return { SafeAreaView: RN.View };
});
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ themeColors: require('../../../theme/colors').colors }),
}));

describe('PolitiqueConfidentialiteScreen — conformité P0', () => {
  test('documente les services, la suppression et le contact sans durée non confirmée', () => {
    render(<PolitiqueConfidentialiteScreen />);

    fireEvent.press(screen.getByText('Partage des données'));
    expect(screen.getByText(/Cloudinary/)).toBeTruthy();
    expect(screen.getByText(/Expo Push/)).toBeTruthy();
    expect(screen.getByText(/Sentry/)).toBeTruthy();
    expect(screen.getByText(/Google Sign-In et Google Maps SDK/)).toBeTruthy();

    fireEvent.press(screen.getByText('Suppression de votre compte'));
    expect(screen.getByText(/Zone sensible/)).toBeTruthy();
    expect(screen.getAllByText('support@altitudevision.agency').length).toBeGreaterThan(0);

    fireEvent.press(screen.getByText('Durée de conservation'));
    expect(screen.queryByText(/30 jours|90 jours|12 mois|24 mois/i)).toBeNull();
    expect(screen.getByText(/revue juridique humaine requise/i)).toBeTruthy();
  });
});
