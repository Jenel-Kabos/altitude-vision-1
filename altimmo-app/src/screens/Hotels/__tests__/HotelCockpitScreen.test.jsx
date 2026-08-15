import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import HotelCockpitScreen from '../HotelCockpitScreen';
import { getHotelCockpitAnalytics } from '../../../services/hotelReservationService';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (callback) => require('react').useEffect(callback, [callback]) }));
jest.mock('../../../components/Button', () => { const ReactActual = require('react'); const RN = require('react-native'); return function TestButton({ label, onPress, disabled }) { return ReactActual.createElement(RN.Pressable, { accessibilityRole: 'button', accessibilityLabel: label, disabled, onPress }, ReactActual.createElement(RN.Text, null, label)); }; });
jest.mock('../../../hooks/useHotelRealtime', () => jest.fn());
jest.mock('../../../services/hotelReservationService', () => ({ getHotelCockpitAnalytics: jest.fn() }));

describe('HotelCockpitScreen — uniquement des KPI réellement fournis par le backend (mandat §14)', () => {
  const navigation = { navigate: jest.fn() };
  beforeEach(() => { jest.clearAllMocks(); });

  test('sans hotelId : aucun appel réseau', () => {
    render(<HotelCockpitScreen route={{ params: {} }} navigation={navigation} />);
    expect(getHotelCockpitAnalytics).not.toHaveBeenCalled();
  });

  test('affiche exactement les champs kpis du backend, jamais de revenu/ADR/RevPAR inventés', async () => {
    getHotelCockpitAnalytics.mockResolvedValue({
      kpis: { occupiedRooms: 3, totalRooms: 8, checkInsToday: 2, pendingCheckIns: 1, checkOutsToday: 1, pendingCheckOuts: 0, cleaningRooms: 2, housekeeping: 2, inspectionRooms: 1, maintenance: 1, outOfServiceRooms: 1, remainingAmount: 0 },
    });
    render(<HotelCockpitScreen route={{ params: { hotelId: 'hotel-1' } }} navigation={navigation} />);
    await waitFor(() => expect(getHotelCockpitAnalytics).toHaveBeenCalledWith('hotel-1'));
    expect(await screen.findByText('3/8')).toBeTruthy();
    expect(screen.queryByText(/revenu|ADR|RevPAR|occupancy rate/i)).toBeNull();
  });

  test('une panne d’agrégat reste non bloquante — message affiché, écran utilisable', async () => {
    getHotelCockpitAnalytics.mockRejectedValue(new Error('agrégat indisponible'));
    render(<HotelCockpitScreen route={{ params: { hotelId: 'hotel-1' } }} navigation={navigation} />);
    await waitFor(() => expect(screen.getByText(/Indicateurs indisponibles/)).toBeTruthy());
    expect(screen.getByLabelText('Actualiser')).toBeTruthy();
  });

  test('un solde émis restant affiche l’alerte financière en lecture seule', async () => {
    getHotelCockpitAnalytics.mockResolvedValue({ kpis: { occupiedRooms: 0, totalRooms: 5, remainingAmount: 15000 } });
    render(<HotelCockpitScreen route={{ params: { hotelId: 'hotel-1' } }} navigation={navigation} />);
    expect(await screen.findByText('Solde émis restant')).toBeTruthy();
  });
});
