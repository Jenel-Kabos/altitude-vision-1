jest.mock('../models/Notification', () => ({ create: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../socket', () => ({
  getIO: jest.fn(() => ({ to: jest.fn(() => ({ emit: jest.fn() })) })),
  isUserOnline: jest.fn(() => true),
}));
jest.mock('../utils/expoPush', () => ({ sendExpoPushNotification: jest.fn() }));

const Notification = require('../models/Notification');
const User = require('../models/User');
const socket = require('../socket');
const { sendExpoPushNotification } = require('../utils/expoPush');
const { notify, visitSocketEventFor } = require('../services/notificationService');

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
});
