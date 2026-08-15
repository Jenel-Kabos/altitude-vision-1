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

  // SYNC-2C — types hospitality réels (server/services/housekeepingService.js,
  // inspectionService.js, maintenanceService.js, hotelReservationService.js),
  // résolus via `destination` (registre partagé), jamais un type inventé.
  test('résout une notification housekeeping/inspection via le registre, contextualisée par hotelId', async () => {
    await expect(resolveNavigation({ type: 'housekeeping_task_created', destination: 'HOUSEKEEPING', entityId: 'task-1', data: { hotelId: 'hotel-1' } }))
      .resolves.toEqual(['Profil', { screen: 'HotelHousekeeping', params: { hotelId: 'hotel-1' } }]);
    await expect(resolveNavigation({ type: 'room_inspection_failed', destination: 'HOUSEKEEPING', entityId: 'insp-1', data: { hotelId: 'hotel-1' } }))
      .resolves.toEqual(['Profil', { screen: 'HotelHousekeeping', params: { hotelId: 'hotel-1' } }]);
  });

  test('résout une notification maintenance hôtelière via le registre, jamais confondue avec la maintenance locative', async () => {
    await expect(resolveNavigation({ type: 'maintenance_ticket_created', destination: 'HOTEL_MAINTENANCE', entityId: 'ticket-1', data: { hotelId: 'hotel-1' } }))
      .resolves.toEqual(['Profil', { screen: 'HotelMaintenance', params: { hotelId: 'hotel-1' } }]);
  });

  test('résout hotel_reservation_pending (propriétaire) vers HotelOperations, jamais l’écran voyageur', async () => {
    await expect(resolveNavigation({ type: 'hotel_reservation_pending', destination: 'HOTEL_OPERATIONS', entityId: 'res-1', data: { hotelId: 'hotel-1' } }))
      .resolves.toEqual(['Profil', { screen: 'HotelOperations', params: { hotelId: 'hotel-1' } }]);
  });

  test('un type totalement inconnu ne plante jamais — fallback sûr (null, aucune navigation)', async () => {
    await expect(resolveNavigation({ type: 'un_type_qui_n_existe_pas_encore' })).resolves.toBeNull();
    await expect(resolveNavigation({})).resolves.toBeNull();
    await expect(resolveNavigation(undefined)).resolves.toBeNull();
  });

  test('une destination reconnue mais sans metadata exploitable ne plante pas (hotelId manquant)', async () => {
    // interpolate() laisse le placeholder ':hotelId' littéral plutôt que planter —
    // aucune navigation vers un écran PMS avec un hotelId invalide n'est jamais
    // supposée sûre par le mobile ; c'est un comportement dégradé volontaire,
    // pas une garantie de sécurité (le backend revaliderait de toute façon).
    const result = await resolveNavigation({ type: 'housekeeping_task_created', destination: 'HOUSEKEEPING', entityId: 'task-1' });
    expect(result[0]).toBe('Profil');
    expect(result[1].screen).toBe('HotelHousekeeping');
  });

  test('hotel_financial_draft_failed (finance Web/Admin-only) ne navigue nulle part sur mobile', async () => {
    await expect(resolveNavigation({ type: 'hotel_financial_draft_failed', data: { hotelId: 'hotel-1' } })).resolves.toBeNull();
  });

  test('réinstalle les listeners sans les dupliquer puis les retire', () => {
    setupNotificationListeners();
    setupNotificationListeners();
    expect(Notifications.addNotificationReceivedListener).toHaveBeenCalledTimes(2);
    expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(2);
    removeNotificationListeners();
  });
});
