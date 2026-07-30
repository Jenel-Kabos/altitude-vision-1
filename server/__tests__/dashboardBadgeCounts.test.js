jest.mock('../models/Visite', () => ({ countDocuments: jest.fn() }));
jest.mock('../models/Property', () => ({ countDocuments: jest.fn() }));

const Visite = require('../models/Visite');
const Property = require('../models/Property');
const { getUnreadCount: getVisitesUnreadCount } = require('../controllers/visiteController');
const { getPendingPropertiesCount } = require('../controllers/propertyController');

const response = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe('badges dashboard : visites et modération', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([
    ['nouvelle visite non consultée', 1],
    ['visite vue même encore En attente', 0],
    ['deux visites non vues et une vue', 2],
  ])('visites — %s', async (_scenario, unreadCount) => {
    Visite.countDocuments.mockResolvedValue(unreadCount);
    const res = response();
    await getVisitesUnreadCount({}, res);
    expect(Visite.countDocuments).toHaveBeenCalledWith({ staffViewedAt: null });
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { unreadCount } });
  });

  test.each([
    ['un bien en attente', 1],
    ['lecture sans modération', 1],
    ['validation ou rejet', 0],
    ['deux en attente, un validé, un rejeté', 2],
  ])('modération — %s', async (_scenario, unreadCount) => {
    Property.countDocuments.mockResolvedValue(unreadCount);
    const res = response();
    await getPendingPropertiesCount({}, res);
    expect(Property.countDocuments).toHaveBeenCalledWith({ statusAdmin: 'En attente', status: { $in: ['vente', 'location'] } });
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { unreadCount } });
  });
});
