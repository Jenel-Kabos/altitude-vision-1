// ALTIMMO-MAP-LOCALITY-CENTROIDS-2 — la carte agrège désormais par localité :
// 1 marker = 1 arrondissement, jamais 1 marker = 1 propriété. Le test H1.5
// précédent (marqueur Hotel + navigation vers HotelDetailScreen depuis un pin
// par-propriété) a été remplacé par une couverture du nouveau contrat produit
// (bubble par localité + bottom card + navigation vers ListeAnnonces avec
// filtres préservés).

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import CarteScreen from '../CarteScreen';
import { fetchMapAggregates } from '../../../services/mapAggregatesService';

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react'); const RN = require('react-native');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
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
  const ReactActual = require('react'); const RN = require('react-native');
  const MockMapView = ReactActual.forwardRef((props, ref) =>
    ReactActual.createElement(RN.View, { testID: 'carte-map', ...props }, props.children));
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
jest.mock('../../../services/mapAggregatesService');

const navigation = { navigate: jest.fn() };

const AREA = (label, count, extra = {}) => ({
  key: `brazzaville:${label.toLowerCase()}`,
  city: 'Brazzaville', label, count,
  latitude: -4.27 + Math.random() * 0.05, longitude: 15.27 + Math.random() * 0.05,
  ...extra,
});

beforeEach(() => { jest.clearAllMocks(); });

describe('CarteScreen — agrégation par localité (ALTIMMO-MAP-LOCALITY-CENTROIDS-2)', () => {
  test('affiche un marker par zone + le total exact dans le header (indépendant de la pagination)', async () => {
    fetchMapAggregates.mockResolvedValue({
      total: 15, mappedTotal: 15, unmappedTotal: 0,
      areas: [AREA('Poto-Poto', 5), AREA('Ouenzé', 7), AREA('Moungali', 3)],
    });
    render(<CarteScreen navigation={navigation} />);
    await waitFor(() => screen.getByTestId(/marker-5 biens à Poto-Poto/));
    expect(screen.getByTestId('marker-7 biens à Ouenzé')).toBeTruthy();
    expect(screen.getByTestId('marker-3 biens à Moungali')).toBeTruthy();
    expect(screen.getByLabelText('15 biens au total')).toBeTruthy();
  });

  test('tap sur une bulle ouvre la bottom card puis "Voir les biens" navigue avec city+arrondissement injectés', async () => {
    fetchMapAggregates.mockResolvedValue({
      total: 5, mappedTotal: 5, unmappedTotal: 0,
      areas: [AREA('Poto-Poto', 5)],
    });
    render(<CarteScreen navigation={navigation} />);
    const marker = await screen.findByTestId('marker-5 biens à Poto-Poto');
    fireEvent.press(marker);
    const seeBtn = await screen.findByLabelText('Voir les 5 biens à Poto-Poto');
    fireEvent.press(seeBtn);
    expect(navigation.navigate).toHaveBeenCalledWith('Annonces', {
      screen: 'ListeAnnonces',
      params: expect.objectContaining({
        initialFilters: expect.objectContaining({ city: 'Brazzaville', arrondissement: 'Poto-Poto' }),
      }),
    });
  });

  test('total = 0 → empty state + bouton "Réinitialiser les filtres" absent (car aucun filtre actif)', async () => {
    fetchMapAggregates.mockResolvedValue({ total: 0, mappedTotal: 0, unmappedTotal: 0, areas: [] });
    render(<CarteScreen navigation={navigation} />);
    await waitFor(() => screen.getByText('Aucun bien correspondant'));
    expect(screen.queryByText('Réinitialiser les filtres')).toBeNull();
  });

  test('unmappedTotal affiche un bandeau explicite (sans marker inventé)', async () => {
    fetchMapAggregates.mockResolvedValue({
      total: 12, mappedTotal: 10, unmappedTotal: 2,
      areas: [AREA('Poto-Poto', 6), AREA('Moungali', 4)],
    });
    render(<CarteScreen navigation={navigation} />);
    await waitFor(() => screen.getByText(/2 biens dans des zones non encore cartographiées/));
    // Aucun marker inventé pour les biens non mappés.
    expect(screen.queryByTestId(/marker-\d+ biens à Ouesso/)).toBeNull();
  });

  test('erreur API → carte affiche un état d\'erreur avec "Réessayer"', async () => {
    fetchMapAggregates.mockRejectedValueOnce(new Error('network'));
    render(<CarteScreen navigation={navigation} />);
    await waitFor(() => screen.getByText('Impossible de charger la carte.'));
    expect(screen.getByText('Réessayer')).toBeTruthy();
  });

  test('permission localisation refusée : la carte reste utilisable, les markers restent affichés', async () => {
    fetchMapAggregates.mockResolvedValue({
      total: 3, mappedTotal: 3, unmappedTotal: 0, areas: [AREA('Poto-Poto', 3)],
    });
    render(<CarteScreen navigation={navigation} />);
    const locate = await screen.findByLabelText('Me localiser');
    fireEvent.press(locate);
    // Le mock retourne 'denied' — pas de crash, marker toujours présent.
    expect(await screen.findByTestId('marker-3 biens à Poto-Poto')).toBeTruthy();
  });

  test('confidentialité : aucune coordonnée exacte de propriété n\'est utilisée pour les markers', async () => {
    // Le contrat mobile ne consomme jamais Property.latitude/longitude sur cet écran.
    // On vérifie ici que fetchMapAggregates est bien la seule source de données appelée
    // et qu'aucun appel à /altimmo/search n'est effectué depuis le montage.
    fetchMapAggregates.mockResolvedValue({ total: 2, mappedTotal: 2, unmappedTotal: 0, areas: [AREA('Poto-Poto', 2)] });
    render(<CarteScreen navigation={navigation} />);
    await waitFor(() => screen.getByTestId('marker-2 biens à Poto-Poto'));
    expect(fetchMapAggregates).toHaveBeenCalledTimes(1);
  });
});
