jest.mock('../models/User');
jest.mock('../models/PlatformTenant');
jest.mock('../models/OrgMembership');
jest.mock('../models/PlatformOperator');

const User = require('../models/User');
const PlatformTenant = require('../models/PlatformTenant');
const OrgMembership = require('../models/OrgMembership');
const PlatformOperator = require('../models/PlatformOperator');
const { expandScopeWithUnaffiliatedUsersIfSoleTenant } = require('../services/unaffiliatedUserScopeService');

describe('unaffiliatedUserScopeService — contrat legacy mono-tenant', () => {
  beforeEach(() => jest.clearAllMocks());

  test('normalise et déduplique le scope sans élargir quand le nombre de tenants actifs est ambigu', async () => {
    PlatformTenant.countDocuments.mockResolvedValue(2);

    await expect(expandScopeWithUnaffiliatedUsersIfSoleTenant([12, '12', 13])).resolves.toEqual(['12', '13']);
    expect(PlatformTenant.countDocuments).toHaveBeenCalledWith({ status: { $in: ['trial', 'active'] } });
    expect(OrgMembership.distinct).not.toHaveBeenCalled();
    expect(PlatformOperator.distinct).not.toHaveBeenCalled();
    expect(User.find).not.toHaveBeenCalled();
  });

  test('retourne un scope vide pour une entrée absente et zéro tenant actif', async () => {
    PlatformTenant.countDocuments.mockResolvedValue(0);
    await expect(expandScopeWithUnaffiliatedUsersIfSoleTenant()).resolves.toEqual([]);
  });

  test('sur tenant unique, exclut membres et opérateurs puis ajoute seulement les utilisateurs éligibles', async () => {
    PlatformTenant.countDocuments.mockResolvedValue(1);
    OrgMembership.distinct.mockResolvedValue(['member-1']);
    PlatformOperator.distinct.mockResolvedValue(['operator-1']);
    const lean = jest.fn().mockResolvedValue([{ _id: 'public-1' }, { _id: 'already-scoped' }]);
    const select = jest.fn().mockReturnValue({ lean });
    User.find.mockReturnValue({ select });

    await expect(expandScopeWithUnaffiliatedUsersIfSoleTenant(['already-scoped'])).resolves
      .toEqual(['already-scoped', 'public-1']);
    expect(OrgMembership.distinct).toHaveBeenCalledWith('user');
    expect(PlatformOperator.distinct).toHaveBeenCalledWith('user');
    expect(User.find).toHaveBeenCalledWith({
      isTechnical: { $ne: true },
      isActive: { $ne: false },
      status: { $nin: ['Suspendu', 'Banni', 'Supprimé'] },
      _id: { $nin: ['member-1', 'operator-1'] },
    });
    expect(select).toHaveBeenCalledWith('_id');
  });

  test('propage les erreurs afin que chaque appelant conserve son fallback historique', async () => {
    PlatformTenant.countDocuments.mockRejectedValue(new Error('mongo unavailable'));
    await expect(expandScopeWithUnaffiliatedUsersIfSoleTenant(['raw-scope']))
      .rejects.toThrow('mongo unavailable');
  });
});
