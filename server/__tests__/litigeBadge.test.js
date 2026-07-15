jest.mock('../models/Litige', () => ({
  countDocuments: jest.fn(),
  findById: jest.fn(),
}));
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../utils/email', () => jest.fn());
jest.mock('../config/cloudinary', () => ({ uploadToCloudinary: jest.fn() }));

const Litige = require('../models/Litige');
const { getUnreadCount, getLitige } = require('../controllers/litigeController');

const response = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe('badge Litiges', () => {
  beforeEach(() => jest.clearAllMocks());

  test('compte uniquement les litiges jamais consultés par le staff', async () => {
    Litige.countDocuments.mockResolvedValue(1);
    const res = response();

    await getUnreadCount({}, res);

    expect(Litige.countDocuments).toHaveBeenCalledWith({ staffViewedAt: null });
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { unreadCount: 1 } });
  });

  test('l’ouverture staff marque le litige vu sans modifier son statut ouvert', async () => {
    const litige = { staffViewedAt: null, statut: 'Ouvert', save: jest.fn().mockResolvedValue() };
    Litige.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(litige) });
    const res = response();
    const req = { params: { id: '507f1f77bcf86cd799439011' }, user: { role: 'Admin', _id: 'staff' } };

    await getLitige(req, res);

    expect(litige.staffViewedAt).toBeInstanceOf(Date);
    expect(litige.statut).toBe('Ouvert');
    expect(litige.save).toHaveBeenCalledTimes(1);
  });

  test('un identifiant invalide retourne 404 sans CastError', async () => {
    const res = response();
    await getLitige({ params: { id: 'invalid' }, user: { role: 'Admin' } }, res);
    expect(Litige.findById).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
