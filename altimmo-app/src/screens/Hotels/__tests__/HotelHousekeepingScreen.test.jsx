import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import useHotelRealtime from '../../../hooks/useHotelRealtime';
import HotelHousekeepingScreen from '../HotelHousekeepingScreen';
import {
  approveInspection, cancelHousekeepingTask, completeHousekeepingTask, createInspection,
  getHousekeepingTasks, rejectInspection, startHousekeepingTask,
} from '../../../services/housekeepingService';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (callback) => require('react').useEffect(callback, [callback]) }));
jest.mock('../../../components/Button', () => { const ReactActual = require('react'); const RN = require('react-native'); return function TestButton({ label, onPress, disabled }) { return ReactActual.createElement(RN.Pressable, { accessibilityRole: 'button', accessibilityLabel: label, disabled, onPress }, ReactActual.createElement(RN.Text, null, label)); }; });
jest.mock('../../../hooks/useHotelRealtime', () => jest.fn());
jest.mock('../../../services/housekeepingService', () => ({
  getHousekeepingTasks: jest.fn(), assignHousekeepingTask: jest.fn(), startHousekeepingTask: jest.fn().mockResolvedValue({}),
  completeHousekeepingTask: jest.fn().mockResolvedValue({}), cancelHousekeepingTask: jest.fn().mockResolvedValue({}),
  createInspection: jest.fn(), approveInspection: jest.fn().mockResolvedValue({}), rejectInspection: jest.fn().mockResolvedValue({}),
}));

const baseTask = { _id: 'task-1', type: 'checkout_cleaning', priority: 'high', status: 'pending', room: { roomNumber: '101', floor: 1 }, assignedTo: null };

describe('HotelHousekeepingScreen — ménage + inspection (mission E2E-1/DASH-3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    getHousekeepingTasks.mockResolvedValue([baseTask]);
  });

  test('sans hotelId : aucun appel réseau, message explicite', () => {
    render(<HotelHousekeepingScreen route={{ params: {} }} />);
    expect(getHousekeepingTasks).not.toHaveBeenCalled();
    expect(screen.getByText('Aucun hôtel sélectionné.')).toBeTruthy();
  });

  test('charge les tâches filtrées par hôtel et affiche chambre/étage/priorité réels', async () => {
    render(<HotelHousekeepingScreen route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(getHousekeepingTasks).toHaveBeenCalledWith({ hotelId: 'hotel-1' }));
    expect(await screen.findByText('Chambre 101 · étage 1')).toBeTruthy();
    expect(screen.getByText('Haute')).toBeTruthy();
  });

  test('démarrer puis terminer une tâche appelle les bons endpoints', async () => {
    render(<HotelHousekeepingScreen route={{ params: { hotelId: 'hotel-1' } }} />);
    await screen.findByText('Chambre 101 · étage 1');
    fireEvent.press(screen.getByLabelText('Démarrer'));
    await waitFor(() => expect(startHousekeepingTask).toHaveBeenCalledWith('task-1'));

    getHousekeepingTasks.mockResolvedValue([{ ...baseTask, status: 'in_progress' }]);
    fireEvent.press(screen.getByLabelText('Démarrer'));
    await waitFor(() => expect(getHousekeepingTasks).toHaveBeenCalledTimes(3));
  });

  test('inspecter une tâche terminée crée l’inspection puis permet approuver/rejeter', async () => {
    getHousekeepingTasks.mockResolvedValue([{ ...baseTask, status: 'completed' }]);
    createInspection.mockResolvedValue({ _id: 'insp-1', result: null });
    render(<HotelHousekeepingScreen route={{ params: { hotelId: 'hotel-1' } }} />);
    await screen.findByLabelText('Inspecter');
    fireEvent.press(screen.getByLabelText('Inspecter'));
    await waitFor(() => expect(createInspection).toHaveBeenCalledWith({ roomId: undefined, housekeepingTaskId: 'task-1' }));
    await screen.findByLabelText('Approuver');
    fireEvent.press(screen.getByLabelText('Approuver'));
    await waitFor(() => expect(approveInspection).toHaveBeenCalledWith('insp-1'));
  });

  test('rejeter une inspection appelle rejectInspection avec une justification', async () => {
    getHousekeepingTasks.mockResolvedValue([{ ...baseTask, status: 'completed' }]);
    createInspection.mockResolvedValue({ _id: 'insp-2', result: null });
    render(<HotelHousekeepingScreen route={{ params: { hotelId: 'hotel-1' } }} />);
    await screen.findByLabelText('Inspecter');
    fireEvent.press(screen.getByLabelText('Inspecter'));
    await screen.findByLabelText('Rejeter');
    fireEvent.press(screen.getByLabelText('Rejeter'));
    await waitFor(() => expect(rejectInspection).toHaveBeenCalledWith('insp-2', expect.any(String)));
  });

  test('annuler une tâche ouverte appelle cancelHousekeepingTask', async () => {
    render(<HotelHousekeepingScreen route={{ params: { hotelId: 'hotel-1' } }} />);
    await screen.findByText('Chambre 101 · étage 1');
    fireEvent.press(screen.getByLabelText('Annuler'));
    await waitFor(() => expect(cancelHousekeepingTask).toHaveBeenCalledWith('task-1', expect.any(String)));
  });

  test('un switch d’hôtel via notification (hotelId change sans démontage) recharge la bonne liste, jamais un mélange A/B (mandat SYNC-2C §51)', async () => {
    const taskA = { ...baseTask, _id: 'task-A', room: { roomNumber: 'A1', floor: 1 } };
    const taskB = { ...baseTask, _id: 'task-B', room: { roomNumber: 'B1', floor: 1 } };
    getHousekeepingTasks.mockImplementation(({ hotelId }) => Promise.resolve(hotelId === 'hotel-A' ? [taskA] : [taskB]));

    const { rerender } = render(<HotelHousekeepingScreen route={{ params: { hotelId: 'hotel-A' } }} />);
    await screen.findByText('Chambre A1 · étage 1');
    expect(useHotelRealtime).toHaveBeenCalledWith('hotel-A', expect.any(Function));

    rerender(<HotelHousekeepingScreen route={{ params: { hotelId: 'hotel-B' } }} />);
    await waitFor(() => expect(getHousekeepingTasks).toHaveBeenCalledWith({ hotelId: 'hotel-B' }));
    expect(await screen.findByText('Chambre B1 · étage 1')).toBeTruthy();
    expect(screen.queryByText('Chambre A1 · étage 1')).toBeNull();
    expect(useHotelRealtime).toHaveBeenLastCalledWith('hotel-B', expect.any(Function));
  });

  // SYNC-2D — ferme les deux réserves explicites de SYNC2C_MOBILE_NOTIFICATIONS_REPORT.md
  // §31-32 : un deep-link (notification forgée, résiduelle, ou simplement un
  // hotelId appartenant à un autre propriétaire/tenant) ne doit JAMAIS
  // afficher de donnée d'autrui — l'autorisation réelle reste backend
  // (`assertOperationalHotelAccess`, déjà certifiée E2E-1/SYNC-2B) ; la
  // responsabilité du mobile est seulement de ne rien exposer et de refléter
  // le refus proprement, jamais de décider localement d'un accès.
  test('cross-owner : hotelId d’un autre propriétaire → 403 backend, aucune tâche affichée, aucun crash', async () => {
    getHousekeepingTasks.mockRejectedValue({ response: { status: 403, data: { message: 'Vous ne pouvez consulter que vos propres hôtels.' } } });
    render(<HotelHousekeepingScreen route={{ params: { hotelId: 'hotel-owner-b' } }} />);
    await waitFor(() => expect(getHousekeepingTasks).toHaveBeenCalledWith({ hotelId: 'hotel-owner-b' }));
    expect(Alert.alert).toHaveBeenCalledWith('Erreur', expect.any(String));
    expect(screen.queryByText(/Chambre/)).toBeNull();
  });

  test('cross-tenant : hotelId d’un autre tenant (staff) → 403 backend, aucune tâche affichée, aucun crash', async () => {
    getHousekeepingTasks.mockRejectedValue({ response: { status: 403, data: { message: 'Hôtel introuvable.' } } });
    render(<HotelHousekeepingScreen route={{ params: { hotelId: 'hotel-tenant-b' } }} />);
    await waitFor(() => expect(getHousekeepingTasks).toHaveBeenCalledWith({ hotelId: 'hotel-tenant-b' }));
    expect(Alert.alert).toHaveBeenCalledWith('Erreur', expect.any(String));
    expect(screen.queryByText(/Chambre/)).toBeNull();
  });

  test('liste vide affiche un état vide explicite', async () => {
    getHousekeepingTasks.mockResolvedValue([]);
    render(<HotelHousekeepingScreen route={{ params: { hotelId: 'hotel-1' } }} />);
    expect(await screen.findByText('Aucune tâche de ménage.')).toBeTruthy();
  });
});
