jest.mock('../models/Notification', () => ({ create: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../socket', () => ({
  getIO: jest.fn(() => ({ to: jest.fn(() => ({ emit: jest.fn() })) })),
  isUserOnline: jest.fn(() => true),
}));
jest.mock('../utils/expoPush', () => ({ sendExpoPushNotification: jest.fn() }));

const Notification = require('../models/Notification');
const { notify } = require('../services/notificationService');

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
});
