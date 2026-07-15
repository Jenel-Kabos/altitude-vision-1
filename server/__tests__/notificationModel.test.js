const Notification = require('../models/Notification');

describe('Notification model', () => {
  const baseNotification = {
    recipient: '507f1f77bcf86cd799439011',
    title: 'Notification de test',
    body: 'Contenu de test',
  };

  test.each([
    'visite_auto_cancelled',
    'visite_auto_cancelled_owner',
    'visite_confirmee',
  ])('accepts the emitted type %s', (type) => {
    const notification = new Notification({ ...baseNotification, type });

    expect(notification.validateSync()).toBeUndefined();
  });

  test('keeps read as the sole unread-state field', () => {
    const notification = new Notification({ ...baseNotification, type: 'visite_status' });

    expect(notification.read).toBe(false);
    expect(notification.schema.path('isRead')).toBeUndefined();
  });
});
