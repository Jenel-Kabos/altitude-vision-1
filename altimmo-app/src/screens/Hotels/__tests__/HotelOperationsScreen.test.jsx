import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import HotelOperationsScreen from '../HotelOperationsScreen';
import {
  assignHotelRoom, getAccessibleHotels, getHotelRooms, getOwnerHotelReservations, getReservationAssignments,
} from '../../../services/hotelReservationService';

jest.mock('@expo/vector-icons', () => { const ReactActual = require('react'); const RN = require('react-native'); return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) }; });
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (callback) => require('react').useEffect(callback, [callback]) }));
jest.mock('../../../components/Button', () => { const ReactActual = require('react'); const RN = require('react-native'); return function TestButton({ label, onPress, disabled }) { return ReactActual.createElement(RN.Pressable, { accessibilityRole: 'button', accessibilityLabel: label, disabled, onPress }, ReactActual.createElement(RN.Text, null, label)); }; });
jest.mock('../../../services/hotelReservationService', () => ({
  assignHotelRoom: jest.fn().mockResolvedValue({}), autoAssignHotelRooms: jest.fn().mockResolvedValue([]), changeHotelRoom: jest.fn().mockResolvedValue({}),
  checkInHotelReservation: jest.fn().mockResolvedValue({}), checkOutHotelReservation: jest.fn().mockResolvedValue({}),
  getAccessibleHotels: jest.fn(), getHotelInventory: jest.fn(), getHotelRooms: jest.fn(), getOwnerHotelReservations: jest.fn(), getReservationAssignments: jest.fn(), updateHotelInventory: jest.fn(),
}));

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
});
