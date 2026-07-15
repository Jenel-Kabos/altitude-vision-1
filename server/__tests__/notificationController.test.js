jest.mock('../models/Notification', () => ({
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
}));

const Notification = require('../models/Notification');
const controller = require('../controllers/notificationController');

const ownerId = '507f1f77bcf86cd799439011';
const otherNotificationId = '507f1f77bcf86cd799439012';

function response() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}

describe('notificationController ownership and invalid IDs', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([
    ['markRead', 'findOneAndUpdate'],
    ['deleteNotification', 'findOneAndDelete'],
  ])('%s scopes an existing notification to the authenticated recipient', async (method, modelMethod) => {
    Notification[modelMethod].mockResolvedValue(null);
    const res = response();
    const next = jest.fn();

    await controller[method]({ params: { id: otherNotificationId }, user: { _id: ownerId } }, res, next);

    expect(Notification[modelMethod].mock.calls[0][0]).toEqual(
      expect.objectContaining({ _id: otherNotificationId, recipient: ownerId }),
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Notification introuvable.' }));
  });

  test.each(['markRead', 'deleteNotification'])('%s returns 404 for an invalid ObjectId', async (method) => {
    const res = response();
    const next = jest.fn();

    await controller[method]({ params: { id: 'not-an-object-id' }, user: { _id: ownerId } }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Notification introuvable.' }));
  });
});
