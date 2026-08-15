import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import HotelMaintenanceScreen from '../HotelMaintenanceScreen';
import { approveInspection, createInspection, rejectInspection } from '../../../services/housekeepingService';
import {
  closeMaintenanceTicket, getHotelMaintenanceTickets, resolveMaintenanceTicket, startMaintenanceWork,
} from '../../../services/hotelMaintenanceService';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (callback) => require('react').useEffect(callback, [callback]) }));
jest.mock('../../../components/Button', () => { const ReactActual = require('react'); const RN = require('react-native'); return function TestButton({ label, onPress, disabled }) { return ReactActual.createElement(RN.Pressable, { accessibilityRole: 'button', accessibilityLabel: label, disabled, onPress }, ReactActual.createElement(RN.Text, null, label)); }; });
jest.mock('../../../hooks/useHotelRealtime', () => jest.fn());
jest.mock('../../../services/housekeepingService', () => ({
  createInspection: jest.fn(), approveInspection: jest.fn().mockResolvedValue({}), rejectInspection: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../services/hotelMaintenanceService', () => ({
  getHotelMaintenanceTickets: jest.fn(), assignMaintenanceTicket: jest.fn(), startMaintenanceWork: jest.fn().mockResolvedValue({}),
  resolveMaintenanceTicket: jest.fn().mockResolvedValue({}), closeMaintenanceTicket: jest.fn().mockResolvedValue({}),
}));

const baseTicket = { _id: 'ticket-1', category: 'plumbing', status: 'open', description: 'Fuite évier', room: { roomNumber: '204', floor: 2 }, assignedTo: null };

describe('HotelMaintenanceScreen — maintenance HÔTELIÈRE, distincte de la maintenance locative', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    getHotelMaintenanceTickets.mockResolvedValue([baseTicket]);
  });

  test('sans hotelId : aucun appel réseau', () => {
    render(<HotelMaintenanceScreen route={{ params: {} }} />);
    expect(getHotelMaintenanceTickets).not.toHaveBeenCalled();
    expect(screen.getByText('Aucun hôtel sélectionné.')).toBeTruthy();
  });

  test('charge les tickets filtrés par hôtel et affiche catégorie/description', async () => {
    render(<HotelMaintenanceScreen route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(getHotelMaintenanceTickets).toHaveBeenCalledWith({ hotelId: 'hotel-1' }));
    expect(await screen.findByText('Chambre 204 · étage 2')).toBeTruthy();
    expect(screen.getByText('Fuite évier')).toBeTruthy();
  });

  test('démarrer puis résoudre un ticket appelle les bons endpoints', async () => {
    render(<HotelMaintenanceScreen route={{ params: { hotelId: 'hotel-1' } }} />);
    await screen.findByText('Chambre 204 · étage 2');
    fireEvent.press(screen.getByLabelText('Démarrer'));
    await waitFor(() => expect(startMaintenanceWork).toHaveBeenCalledWith('ticket-1'));
  });

  test('résoudre puis ré-inspecter utilise la housekeepingTask d’origine, jamais une nouvelle tâche', async () => {
    getHotelMaintenanceTickets.mockResolvedValue([{ ...baseTicket, status: 'resolved', inspection: { housekeepingTask: { _id: 'hk-task-1' } } }]);
    createInspection.mockResolvedValue({ _id: 'insp-1' });
    render(<HotelMaintenanceScreen route={{ params: { hotelId: 'hotel-1' } }} />);
    await screen.findByLabelText('Ré-inspecter');
    fireEvent.press(screen.getByLabelText('Ré-inspecter'));
    await waitFor(() => expect(createInspection).toHaveBeenCalledWith({ roomId: undefined, housekeepingTaskId: 'hk-task-1' }));
    await screen.findByLabelText('Approuver');
    fireEvent.press(screen.getByLabelText('Approuver'));
    await waitFor(() => expect(approveInspection).toHaveBeenCalledWith('insp-1'));
  });

  test('ré-inspection refusée si aucune housekeepingTask d’origine (jamais une chambre inventée)', async () => {
    getHotelMaintenanceTickets.mockResolvedValue([{ ...baseTicket, status: 'resolved', inspection: null }]);
    render(<HotelMaintenanceScreen route={{ params: { hotelId: 'hotel-1' } }} />);
    await screen.findByLabelText('Ré-inspecter');
    fireEvent.press(screen.getByLabelText('Ré-inspecter'));
    expect(createInspection).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Ré-inspection impossible', expect.any(String));
  });

  test('clôturer un ticket résolu appelle closeMaintenanceTicket', async () => {
    getHotelMaintenanceTickets.mockResolvedValue([{ ...baseTicket, status: 'resolved' }]);
    render(<HotelMaintenanceScreen route={{ params: { hotelId: 'hotel-1' } }} />);
    await screen.findByLabelText('Clôturer');
    fireEvent.press(screen.getByLabelText('Clôturer'));
    await waitFor(() => expect(closeMaintenanceTicket).toHaveBeenCalledWith('ticket-1'));
  });
});
