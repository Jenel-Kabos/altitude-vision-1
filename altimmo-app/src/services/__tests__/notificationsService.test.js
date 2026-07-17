jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(() => Promise.resolve()),
  },
  getToken: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../navigationService', () => ({ navigate: jest.fn() }));

import api from '../api';
import * as Notifications from 'expo-notifications';
import {
  dissocierNotifications,
  enregistrerNotifications,
  removeNotificationListeners,
  resolveNavigation,
  setupNotificationListeners,
} from '../notificationsService';

describe('navigation de notification', () => {
  test.each([
    ['visite_new', ['Visites']],
    ['payment_success', ['Profil', { screen: 'Transactions' }]],
    ['account_verified', ['Profil']],
  ])('mappe %s vers une route autorisée', async (type, expected) => {
    await expect(resolveNavigation({ type })).resolves.toEqual(expected);
  });

  test('rejette un écran arbitraire fourni par un payload', async () => {
    await expect(resolveNavigation({ screen: 'StaffDashboard' })).resolves.toBeNull();
  });

  test('retombe sur la liste des messages si la conversation manque', async () => {
    await expect(resolveNavigation({ type: 'new_message' })).resolves.toEqual(['Messages', {}]);
  });

  test.each([
    ['rental_payment_overdue', ['Profil', { screen: 'MesAnnonces' }]],
    ['rental_contract_expiring', ['Profil', { screen: 'MesAnnonces' }]],
    ['visite_sur_mon_bien', ['Visites']],
    ['paiement_echoue', ['Visites']],
  ])('mappe le workflow propriétaire %s', async (type, expected) => {
    await expect(resolveNavigation({ type })).resolves.toEqual(expected);
  });

  test('enregistre le token push via le backend', async () => {
    api.patch.mockResolvedValue({});
    await expect(enregistrerNotifications('user-test')).resolves
      .toBe('ExponentPushToken[test]');
    expect(api.patch).toHaveBeenCalledWith('/users/push-token', {
      pushToken: 'ExponentPushToken[test]',
      userId: 'user-test',
    });
  });

  test('dissocie le token au logout', async () => {
    await dissocierNotifications();
    expect(api.patch).toHaveBeenCalledWith('/users/push-token', { pushToken: null });
  });

  test('réinstalle les listeners sans les dupliquer puis les retire', () => {
    setupNotificationListeners();
    setupNotificationListeners();
    expect(Notifications.addNotificationReceivedListener).toHaveBeenCalledTimes(2);
    expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(2);
    removeNotificationListeners();
  });
});
