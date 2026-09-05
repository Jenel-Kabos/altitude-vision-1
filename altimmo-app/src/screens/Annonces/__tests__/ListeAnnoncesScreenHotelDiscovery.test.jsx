import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ListeAnnoncesScreen from '../ListeAnnoncesScreen';
import api from '../../../services/api';
import { getRecommendedProperties } from '../../../services/annonceService';
import { getActivePublicites } from '../../../services/publiciteService';
import { cache } from '../../../services/cacheService';

// PHASE-H1.5 — un établissement Hotel doit être visuellement distinguable
// (badge "Hôtel") dans le flux Annonces et ouvrir HotelDetailScreen avec
// Hotel._id (jamais Property._id), sans rien casser du rendu générique
// hébergement/vente/location existant (voir ListeAnnoncesScreenRecommended
// pour le même patron de mock du barrel `components`).

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
    FadeInDown: { delay: () => ({ duration: () => ({}) }) },
  };
});
jest.mock('expo-linear-gradient', () => {
  const RN = require('react-native');
  return { LinearGradient: RN.View };
});
jest.mock('../../../services/api');
jest.mock('../../../services/annonceService', () => ({ getRecommendedProperties: jest.fn() }));
jest.mock('../../../services/publiciteService', () => ({ getActivePublicites: jest.fn() }));
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const { useEffect } = require('react');
  return { ...actual, useFocusEffect: (cb) => useEffect(() => { cb(); }, []) };
});
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

const HOTEL_ITEM = {
  _id: 'property-hotel-1', title: 'Mila Hotel', type: 'Commerce', status: 'hebergement', price: 25000,
  images: ['https://res.cloudinary.com/dop8vzm5z/image/upload/v1/hotel.jpg'],
  address: { arrondissement: 'Moungali', city: 'Brazzaville' },
  accommodationType: 'hotel', hotel: 'hotel-object-id-1',
};
const GENERIC_HEBERGEMENT_ITEM = {
  _id: 'property-heb-1', title: 'Villa Meublée', type: 'Villa', status: 'hebergement', price: 40000,
  images: ['https://res.cloudinary.com/dop8vzm5z/image/upload/v1/villa.jpg'],
  address: { arrondissement: 'Bacongo', city: 'Brazzaville' },
};

beforeEach(() => {
  jest.clearAllMocks();
  cache.clear();
  getActivePublicites.mockResolvedValue([]);
  getRecommendedProperties.mockResolvedValue([]);
});

describe('ListeAnnoncesScreen — découverte Hotel (PHASE-H1.5)', () => {
  test('un item accommodationType=hotel affiche le badge "Hôtel"', async () => {
    api.get.mockResolvedValue({ data: { data: { properties: [HOTEL_ITEM], total: 1 } } });
    render(<ListeAnnoncesScreen navigation={navigation} />);
    expect(await screen.findByText('Mila Hotel')).toBeTruthy();
    expect(screen.getByText('Hôtel')).toBeTruthy();
    expect(screen.queryByText('Hébergement')).toBeNull();
  });

  test('un hébergement générique (non-hôtel) garde le badge "Hébergement" existant', async () => {
    api.get.mockResolvedValue({ data: { data: { properties: [GENERIC_HEBERGEMENT_ITEM], total: 1 } } });
    render(<ListeAnnoncesScreen navigation={navigation} />);
    expect(await screen.findByText('Villa Meublée')).toBeTruthy();
    expect(screen.getByText('Hébergement')).toBeTruthy();
    expect(screen.queryByText('Hôtel')).toBeNull();
  });

  test('appuyer sur une carte Hotel navigue vers HotelDetailScreen avec Hotel._id, jamais Property._id', async () => {
    api.get.mockResolvedValue({ data: { data: { properties: [HOTEL_ITEM], total: 1 } } });
    render(<ListeAnnoncesScreen navigation={navigation} />);
    const card = await screen.findByText('Mila Hotel');
    fireEvent.press(card);
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalled());
    const [screenName, params] = navigation.navigate.mock.calls[0];
    expect(screenName).toBe('Profil');
    expect(params.screen).toBe('HotelDetail');
    expect(params.params.hotelId).toBe('hotel-object-id-1');
    expect(params.params.hotelId).not.toBe(HOTEL_ITEM._id);
  });

  test('appuyer sur une carte hébergement générique navigue toujours vers DetailAnnonce (comportement inchangé)', async () => {
    api.get.mockResolvedValue({ data: { data: { properties: [GENERIC_HEBERGEMENT_ITEM], total: 1 } } });
    render(<ListeAnnoncesScreen navigation={navigation} />);
    const card = await screen.findByText('Villa Meublée');
    fireEvent.press(card);
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('DetailAnnonce', expect.objectContaining({ resourceType: 'property', resourceId: 'property-heb-1' })));
  });

  test('appuyer sur une carte vente/location existante reste inchangé', async () => {
    const venteItem = { _id: 'p-vente', title: 'Villa Vente', type: 'Villa', status: 'vente', price: 90000000, images: [], address: { arrondissement: 'Bacongo', city: 'Brazzaville' } };
    api.get.mockResolvedValue({ data: { data: { properties: [venteItem], total: 1 } } });
    render(<ListeAnnoncesScreen navigation={navigation} />);
    const card = await screen.findByText('Villa Vente');
    fireEvent.press(card);
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('DetailAnnonce', expect.objectContaining({ resourceType: 'property', resourceId: 'p-vente' })));
  });
});
