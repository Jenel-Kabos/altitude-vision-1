jest.mock('../models/Estimation', () => ({ countDocuments: jest.fn(), updateMany: jest.fn() }));
const Estimation = require('../models/Estimation');
const { getUnreadEstimationCount } = require('../controllers/estimationController');

const response = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe('badge Estimations', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([
    ['nouvelle estimation En attente', 1],
    ['estimation vue', 0],
    ['estimation En cours déjà vue', 0],
    ['deux non vues et une vue', 2],
    ['statuts En attente, En cours et Traitée non vus', 3],
  ])('%s respecte uniquement staffViewedAt', async (_scenario, unreadCount) => {
    Estimation.countDocuments.mockResolvedValue(unreadCount);
    const res = response();
    await getUnreadEstimationCount({}, res);
    expect(Estimation.countDocuments).toHaveBeenCalledWith({ staffViewedAt: null });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { unreadCount } });
  });
});
