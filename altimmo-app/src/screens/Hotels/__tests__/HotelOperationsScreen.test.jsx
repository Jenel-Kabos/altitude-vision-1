import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import HotelOperationsScreen from '../HotelOperationsScreen';
import { colors } from '../../../theme/colors';
import {
  assignHotelRoom, checkOutHotelReservation, getAccessibleHotels, getCheckoutFinancialReadiness,
  getHotelRooms, getOwnerHotelReservations, getReservationAssignments,
} from '../../../services/hotelReservationService';

jest.mock('@expo/vector-icons', () => { const ReactActual = require('react'); const RN = require('react-native'); return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) }; });
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (callback) => require('react').useEffect(callback, [callback]) }));
jest.mock('../../../components/Button', () => { const ReactActual = require('react'); const RN = require('react-native'); return function TestButton({ label, onPress, disabled }) { return ReactActual.createElement(RN.Pressable, { accessibilityRole: 'button', accessibilityLabel: label, disabled, onPress }, ReactActual.createElement(RN.Text, null, label)); }; });
jest.mock('../../../services/hotelReservationService', () => ({
  assignHotelRoom: jest.fn().mockResolvedValue({}), autoAssignHotelRooms: jest.fn().mockResolvedValue([]), changeHotelRoom: jest.fn().mockResolvedValue({}),
  checkInHotelReservation: jest.fn().mockResolvedValue({}), checkOutHotelReservation: jest.fn().mockResolvedValue({}),
  getAccessibleHotels: jest.fn(), getHotelInventory: jest.fn(), getHotelRooms: jest.fn(), getOwnerHotelReservations: jest.fn(), getReservationAssignments: jest.fn(), updateHotelInventory: jest.fn(),
  getCheckoutFinancialReadiness: jest.fn().mockResolvedValue(null), getHotelCockpitAnalytics: jest.fn().mockResolvedValue({ kpis: {} }),
}));
jest.mock('../../../hooks/useHotelRealtime', () => jest.fn());

describe('HotelOperationsScreen — exploitation Mobile C/D.1.2', () => {
  beforeEach(() => {
    jest.clearAllMocks(); jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    getAccessibleHotels.mockResolvedValue([{ id: 'hotel-1', name: 'Altitude Hôtel' }]);
    getOwnerHotelReservations.mockResolvedValue({ reservations: [{ _id: 'reservation-1', reference: 'RES-001', status: 'confirmed', roomsCount: 1, hotel: { _id: 'hotel-1', name: 'Altitude Hôtel' }, roomCategory: { _id: 'category-1', name: 'Standard' }, guest: { firstName: 'Ada', lastName: 'Lovelace' } }] });
    getHotelRooms.mockResolvedValue([{ _id: 'room-101', roomNumber: '101', floor: 1 }]);
    getReservationAssignments.mockResolvedValue({ activeRoomAssignments: [] });
  });

  test('sélectionne hôtel et chambre par leur libellé sans saisir d’identifiant technique', async () => {
    render(<HotelOperationsScreen />);
    await waitFor(() => expect(screen.getByLabelText('Altitude Hôtel')).toBeTruthy());
    expect(screen.queryByText(/identifiant/i)).toBeNull();
    fireEvent.press(screen.getByLabelText('Altitude Hôtel'));
    await waitFor(() => expect(getOwnerHotelReservations).toHaveBeenCalledWith(expect.objectContaining({ hotelId: 'hotel-1' })));
    fireEvent.press(screen.getByLabelText('Choisir une chambre disponible'));
    await waitFor(() => expect(screen.getByLabelText('Chambre 101 · étage 1')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Chambre 101 · étage 1'));
    fireEvent.press(screen.getByLabelText('Affecter'));
    await waitFor(() => expect(assignHotelRoom).toHaveBeenCalledWith('reservation-1', 'room-101'));
  });

  test('un check-out bloqué financièrement affiche l’état et désactive le bouton (E2E-1)', async () => {
    getOwnerHotelReservations.mockResolvedValue({ reservations: [{ _id: 'reservation-2', reference: 'RES-002', status: 'checked_in', roomsCount: 1, hotel: { _id: 'hotel-1', name: 'Altitude Hôtel' }, guest: { firstName: 'Ada', lastName: 'Lovelace' } }] });
    getCheckoutFinancialReadiness.mockResolvedValue({ status: 'blocked', blockers: [{ code: 'FINANCIAL_BALANCE_REMAINING' }] });
    render(<HotelOperationsScreen />);
    await waitFor(() => expect(screen.getByText('Check-out bloqué')).toBeTruthy());
    const blocker = screen.getByText('FINANCIAL_BALANCE_REMAINING');
    expect(blocker).toBeTruthy();
    // UI-MOB-2 — utilisait `c.danger || '#B91C1C'` alors que le token
    // s'appelle `error` (pas `danger`) : le fallback était donc TOUJOURS
    // actif, ignorant silencieusement le thème. Corrigé vers `c.error`.
    expect(StyleSheet.flatten(blocker.props.style).color).toBe(colors.error);
    expect(screen.getByLabelText('Check-out / départ anticipé').props.accessibilityState.disabled).toBe(true);
  });

  test('un check-out prêt reste actionnable et appelle réellement le check-out', async () => {
    getOwnerHotelReservations.mockResolvedValue({ reservations: [{ _id: 'reservation-3', reference: 'RES-003', status: 'checked_in', roomsCount: 1, hotel: { _id: 'hotel-1', name: 'Altitude Hôtel' }, guest: { firstName: 'Ada', lastName: 'Lovelace' } }] });
    getCheckoutFinancialReadiness.mockResolvedValue({ status: 'ready', blockers: [] });
    render(<HotelOperationsScreen />);
    await waitFor(() => expect(screen.getByText('Prêt pour check-out')).toBeTruthy());
    const button = screen.getByLabelText('Check-out / départ anticipé');
    expect(button.props.accessibilityState?.disabled).toBeFalsy();
    fireEvent.press(button);
    await waitFor(() => expect(checkOutHotelReservation).toHaveBeenCalledWith('reservation-3'));
  });
});
