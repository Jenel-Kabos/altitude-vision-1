const {
  registerNotificationObserver,
  publishNotificationObserved,
} = require('../services/notificationObservationPort');

describe('notificationObservationPort', () => {
  let unregister;

  afterEach(() => unregister?.());

  test('transmet deux événements exactement une fois chacun avec le payload et le tenant intacts', async () => {
    const observer = jest.fn().mockResolvedValue([{ status: 'success' }]);
    unregister = registerNotificationObserver(observer);
    const first = { type: 'rental_notice_started', recipient: 'user-a', platformTenantId: 'tenant-a', metadata: { source: 'lease' } };
    const second = { type: 'quote_received', recipient: 'user-b', platformTenantId: 'tenant-b', metadata: { source: 'quote' } };

    await Promise.all([publishNotificationObserved(first), publishNotificationObserved(second)]);

    expect(observer).toHaveBeenCalledTimes(2);
    expect(observer).toHaveBeenNthCalledWith(1, first);
    expect(observer).toHaveBeenNthCalledWith(2, second);
  });

  test('préserve le contrat best-effort si l’observateur échoue', async () => {
    unregister = registerNotificationObserver(jest.fn().mockRejectedValue(new Error('CRM unavailable')));
    await expect(publishNotificationObserved({ type: 'quote_received', platformTenantId: 'tenant-a' })).resolves.toEqual([]);
  });

  test('refuse une double registration différente et accepte l’initialisation idempotente', () => {
    const observer = jest.fn();
    unregister = registerNotificationObserver(observer);
    expect(() => registerNotificationObserver(observer)).not.toThrow();
    expect(() => registerNotificationObserver(jest.fn())).toThrow('already registered');
  });

  test('sans observateur, la publication reste un no-op best-effort', async () => {
    await expect(publishNotificationObserved({ type: 'quote_received' })).resolves.toEqual([]);
  });
});
