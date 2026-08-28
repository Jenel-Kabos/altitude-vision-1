jest.mock('../models/Notification', () => ({ create: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../socket', () => ({
  getIO: jest.fn(() => ({ to: jest.fn(() => ({ emit: jest.fn() })) })),
  isUserOnline: jest.fn(() => true),
}));
jest.mock('../utils/expoPush', () => ({ sendExpoPushNotification: jest.fn() }));
jest.mock('../services/notificationObservationPort', () => ({ publishNotificationObserved: jest.fn().mockResolvedValue([]) }));

const Notification = require('../models/Notification');
const User = require('../models/User');
const socket = require('../socket');
const { sendExpoPushNotification } = require('../utils/expoPush');
const { publishNotificationObserved } = require('../services/notificationObservationPort');
const { notify, visitSocketEventFor, hospitalityLinkFor } = require('../services/notificationService');

describe('notificationService.notify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Notification.create.mockResolvedValue({
      _id: '507f1f77bcf86cd799439012',
      createdAt: new Date(),
    });
  });

  test('supports the canonical object signature', async () => {
    await notify({
      recipient: '507f1f77bcf86cd799439011',
      type: 'visite_status', title: 'Titre', message: 'Contenu',
    });

    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({
      recipient: '507f1f77bcf86cd799439011',
      type: 'visite_status',
    }));
  });

  test('publie une seule observation avec le payload CRM historique et le tenant intacts', async () => {
    await notify({
      recipient: '507f1f77bcf86cd799439011', sender: '507f1f77bcf86cd799439010',
      type: 'rental_notice_started', title: 'Préavis', body: 'Démarré',
      entityType: 'RentalManagement', entityId: '507f1f77bcf86cd799439013',
      data: { source: 'lease' }, audience: 'staff', dedupeKey: 'notice:1',
      platformTenantId: '507f1f77bcf86cd799439099',
    });

    expect(publishNotificationObserved).toHaveBeenCalledTimes(1);
    expect(publishNotificationObserved).toHaveBeenCalledWith({
      type: 'rental_notice_started', recipient: '507f1f77bcf86cd799439011',
      sender: '507f1f77bcf86cd799439010', entityType: 'RentalManagement',
      entityId: '507f1f77bcf86cd799439013', metadata: { source: 'lease' },
      audience: 'staff', dedupeKey: 'notice:1',
      notificationId: '507f1f77bcf86cd799439012',
      platformTenantId: '507f1f77bcf86cd799439099',
    });
  });

  test.each([
    ['housekeeping_task_created', '/dashboard/housekeeping?hotelId=507f1f77bcf86cd799439099'],
    ['room_inspection_failed', '/dashboard/housekeeping?hotelId=507f1f77bcf86cd799439099'],
    ['maintenance_ticket_created', '/dashboard/maintenance?hotelId=507f1f77bcf86cd799439099'],
    ['hotel_financial_draft_failed', '/dashboard/hotel-finance?hotelId=507f1f77bcf86cd799439099'],
  ])('contextualise %s pour le staff', (type, link) => {
    expect(hospitalityLinkFor({ type, audience: 'staff', data: { hotelId: '507f1f77bcf86cd799439099' } })).toBe(link);
  });

  test('la réservation propriétaire pointe vers le bon hôtel', async () => {
    await notify({
      recipient: '507f1f77bcf86cd799439011', type: 'hotel_reservation_pending',
      title: 'Réservation', body: 'Nouvelle réservation', entityType: 'HotelReservation',
      entityId: '507f1f77bcf86cd799439012', data: { hotelId: '507f1f77bcf86cd799439099' },
    });
    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({
      link: '/mes-hotels/reservations?hotelId=507f1f77bcf86cd799439099',
      entityType: 'HotelReservation', entityId: '507f1f77bcf86cd799439012',
    }));
  });

  test('maps legacy body/data fields without changing the persisted API payload', async () => {
    await notify({
      recipient: '507f1f77bcf86cd799439011',
      type: 'account_verified', title: 'Titre', body: 'Contenu', data: { screen: 'Profil' },
    });

    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({
      recipient: '507f1f77bcf86cd799439011',
      type: 'account_verified',
      body: 'Contenu',
      data: { screen: 'Profil' },
    }));
  });

  test.each([
    ['visite_new', 'visite:created'],
    ['visite_confirmee', 'visite:confirmed'],
    ['visite_status', 'visite:status_changed'],
    ['visite_cancelled', 'visite:cancelled'],
  ])('maps %s to %s', (type, event) => {
    expect(visitSocketEventFor(type)).toBe(event);
  });

  test('émet uniquement le contrat Socket minimal pour une visite', async () => {
    const emit = jest.fn();
    socket.getIO.mockReturnValue({ to: jest.fn(() => ({ emit })) });
    await notify({
      recipient: '507f1f77bcf86cd799439011', type: 'visite_confirmee',
      title: 'Rendez-vous confirmé', body: 'Votre rendez-vous est confirmé.',
      entityId: '507f1f77bcf86cd799439013', data: { route: 'Visites' },
    });
    expect(emit).toHaveBeenCalledWith('visite:confirmed', {
      visiteId: '507f1f77bcf86cd799439013', eventType: 'visite_confirmee',
      updatedAt: expect.any(Date),
    });
  });

  test('le push Expo contient la navigation minimale sans donnée privée', async () => {
    socket.isUserOnline.mockReturnValue(false);
    User.findById.mockReturnValue({ select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ pushToken: 'TEST DATA PUSH TOKEN' }) })) });
    await notify({
      recipient: '507f1f77bcf86cd799439011', type: 'visite_rappel',
      title: 'Rappel', body: 'Votre rendez-vous approche.',
      entityId: '507f1f77bcf86cd799439013',
      data: { visiteId: '507f1f77bcf86cd799439013', route: 'Visites' },
    });
    expect(sendExpoPushNotification).toHaveBeenCalledWith(
      'TEST DATA PUSH TOKEN', 'Rappel', 'Votre rendez-vous approche.',
      expect.objectContaining({ type: 'visite_rappel', visiteId: '507f1f77bcf86cd799439013', route: 'Visites' }),
    );
    expect(JSON.stringify(sendExpoPushNotification.mock.calls[0])).not.toMatch(/phone|address|commission|coordinates/i);
  });

  test('une collision de dedupeKey retourne la notification existante sans nouvel effet', async () => {
    const duplicate = Object.assign(new Error('duplicate'), { code: 11000 });
    Notification.create.mockRejectedValueOnce(duplicate);
    Notification.findOne.mockResolvedValueOnce({ _id: 'existing' });
    await expect(notify({
      recipient: '507f1f77bcf86cd799439011', type: 'rental_property_available',
      title: 'Disponible', body: 'Bien disponible', dedupeKey: 'rental:test:available:1',
    })).resolves.toEqual({ _id: 'existing' });
    expect(Notification.findOne).toHaveBeenCalledWith({ recipient: '507f1f77bcf86cd799439011', dedupeKey: 'rental:test:available:1' });
  });

  test('émet un payload Socket locatif minimal sans données privées', async () => {
    const emit = jest.fn();
    socket.getIO.mockReturnValue({ to: jest.fn(() => ({ emit })) });
    await notify({
      recipient: '507f1f77bcf86cd799439011', type: 'rental_maintenance_started',
      title: 'Maintenance', body: 'Maintenance démarrée', entityId: '507f1f77bcf86cd799439014',
      data: { rentalManagementId: '507f1f77bcf86cd799439014', propertyId: '507f191e810c19729de860ea' },
    });
    expect(emit).toHaveBeenCalledWith('rental:maintenance_changed', {
      rentalManagementId: '507f1f77bcf86cd799439014', propertyId: '507f191e810c19729de860ea',
      eventType: 'rental_maintenance_started', updatedAt: expect.any(Date),
    });
    expect(JSON.stringify(emit.mock.calls)).not.toMatch(/tenant|phone|document|payment/i);
  });
});
