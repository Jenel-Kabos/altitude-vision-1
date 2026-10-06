const {
  discoverAssetProjectionConsistency,
} = require('../services/platformTenant/assetProjectionConsistencyDiscoveryService');
const {
  parseAndValidateArgs,
} = require('../scripts/discoverAssetProjectionConsistency');

const queryModel = (documents) => ({
  find: jest.fn(() => {
    const query = {
      select: () => query,
      lean: () => Promise.resolve(documents),
    };
    return query;
  }),
});

// C2.8M — preuve canonique de l'organisation cible (même règle que
// tenantApplicationService.assertApplicantEligibleForProvisioning) :
// exactement une OrgMembership active roleInUnit owner + businessRole Admin,
// aucun historique owner inactif, racine résolue vers le tenant cible actif.
const ownershipModels = ({ active = [{ orgUnit: 'root-a', businessRole: 'Admin' }], inactive = [], tenants = [{ _id: 'tenant-a', rootOrgUnit: 'root-a', status: 'active' }] } = {}) => ({
  OrgMembership: {
    find: jest.fn((filter) => {
      const documents = filter.status === 'active' ? active : inactive;
      const query = { select: () => query, lean: () => Promise.resolve(documents) };
      return query;
    }),
  },
  PlatformTenant: queryModel(tenants),
});

describe('C2.8 — dry-run de cohérence des projections patrimoniales', () => {
  test('classe les actifs candidats, déjà rattachés et bloqués, et détecte les ancres Hotel orphelines sans écriture', async () => {
    const ownerProperties = [
      { _id: 'p-sale', owner: 'owner-a', tenant: null, pole: 'Altimmo', status: 'vente', availability: 'Disponible' },
      { _id: 'p-rental', owner: 'owner-a', tenant: null, pole: 'Altimmo', status: 'location', availability: 'Disponible' },
      { _id: 'p-target', owner: 'owner-a', tenant: 'tenant-a', pole: 'Altimmo', status: 'hebergement', availability: 'Disponible' },
      { _id: 'p-blocked', owner: 'owner-a', tenant: null, pole: 'Altimmo', status: 'vente', availability: 'Disponible' },
    ];
    const Property = {
      find: jest.fn((filter) => {
        const documents = filter.owner ? ownerProperties : [...ownerProperties, { _id: 'p-other' }];
        const query = { select: () => query, lean: () => Promise.resolve(documents) };
        return query;
      }),
    };
    const models = {
      Property,
      Accommodation: queryModel([]),
      Hotel: queryModel([
        { _id: 'hotel-target', tenant: 'tenant-a', property: 'p-target' },
        { _id: 'hotel-other-owner', tenant: 'tenant-a', property: 'p-other' },
        { _id: 'hotel-dangling', tenant: 'tenant-a', property: 'p-missing' },
      ]),
      Transaction: queryModel([{ property: 'p-blocked', status: 'En cours' }]),
      AccommodationReservation: queryModel([]),
      HotelReservation: queryModel([]),
      ...ownershipModels(),
    };

    const report = await discoverAssetProjectionConsistency({
      ownerId: 'owner-a', targetTenantId: 'tenant-a', models,
    });

    expect(report).toMatchObject({
      readOnly: true,
      counts: { ELIGIBLE_ACTIVE_ASSET: 2, ALREADY_IN_TARGET: 1, ACTIVE_WORKFLOW_BLOCKER: 1 },
      migrationCandidatePropertyIds: ['p-sale', 'p-rental'],
      targetOwnership: { proven: true, reason: 'CANONICAL_OWNER_ORGANIZATION', ownerOrganizationTenantIds: ['tenant-a'] },
      danglingHotelAnchors: [{ hotelId: 'hotel-dangling', propertyId: 'p-missing', tenantId: 'tenant-a' }],
    });
    expect(Property.find).toHaveBeenCalledTimes(2);
    Object.values(models).filter((entry) => entry !== Property && entry !== models.OrgMembership).forEach((entry) => {
      expect(entry.find).toHaveBeenCalledTimes(1);
      expect(entry.updateOne).toBeUndefined();
      expect(entry.updateMany).toBeUndefined();
    });
    expect(Property.updateOne).toBeUndefined();
    expect(Property.updateMany).toBeUndefined();
  });

  test.each(['--apply', '--write', '--force', '--backfill', '--migrate', '--repair',
    '--commit', '--execute', '--live', '--fix', '--update', '--delete', '--mutate'])(
    'refuse %s avant toute connexion',
    (flag) => expect(() => parseAndValidateArgs([
      '--owner-id=owner-a', '--target-tenant-id=tenant-a', '--confirm-database=test', flag,
    ])).toThrow('ASSET_PROJECTION_DISCOVERY_WRITE_FLAG_REFUSED'),
  );

  test('exige les identifiants et la confirmation explicite de la base', () => {
    expect(() => parseAndValidateArgs([])).toThrow('ASSET_PROJECTION_DISCOVERY_OWNER_REQUIRED');
    expect(() => parseAndValidateArgs(['--owner-id=owner-a'])).toThrow('ASSET_PROJECTION_DISCOVERY_TARGET_TENANT_REQUIRED');
    expect(() => parseAndValidateArgs(['--owner-id=owner-a', '--target-tenant-id=tenant-a']))
      .toThrow('ASSET_PROJECTION_DISCOVERY_DATABASE_NOT_CONFIRMED');
  });

  // C2.8M — l'organisation cible n'est jamais acceptée sur parole : sans preuve
  // canonique, aucun candidat n'est proposé (aucune inférence, aucun choix).
  const baseModels = () => ({
    Property: queryModel([{ _id: 'p-sale', owner: 'owner-a', tenant: null, pole: 'Altimmo', status: 'vente', availability: 'Disponible' }]),
    Accommodation: queryModel([]),
    Hotel: queryModel([]),
    Transaction: queryModel([]),
    AccommodationReservation: queryModel([]),
    HotelReservation: queryModel([]),
  });
  test.each([
    ['NOT_ORGANIZATION_OWNER', { active: [] }],
    ['OWNER_ORGANIZATION_AMBIGUOUS', { active: [{ orgUnit: 'root-a', businessRole: 'Admin' }, { orgUnit: 'root-b', businessRole: 'Admin' }], tenants: [{ _id: 'tenant-a', rootOrgUnit: 'root-a', status: 'active' }, { _id: 'tenant-b', rootOrgUnit: 'root-b', status: 'active' }] }],
    ['OWNER_MEMBERSHIP_HISTORY_CONFLICT', { inactive: [{ _id: 'old-owner' }] }],
    ['OWNER_BUSINESS_ROLE_NOT_ADMIN', { active: [{ orgUnit: 'root-a', businessRole: 'Collaborateur' }] }],
    ['OWNER_ORGANIZATION_UNRESOLVED', { tenants: [] }],
    ['TARGET_TENANT_MISMATCH', { active: [{ orgUnit: 'root-b', businessRole: 'Admin' }], tenants: [{ _id: 'tenant-b', rootOrgUnit: 'root-b', status: 'active' }] }],
    ['TARGET_TENANT_INACTIVE', { tenants: [{ _id: 'tenant-a', rootOrgUnit: 'root-a', status: 'suspended' }] }],
  ])('organisation cible non prouvée (%s) → aucun candidat de migration', async (reason, ownership) => {
    const report = await discoverAssetProjectionConsistency({
      ownerId: 'owner-a', targetTenantId: 'tenant-a', models: { ...baseModels(), ...ownershipModels(ownership) },
    });
    expect(report.targetOwnership).toMatchObject({ proven: false, reason });
    expect(report.migrationCandidatePropertyIds).toEqual([]);
    expect(report.classifications[0].classification).toBe('ELIGIBLE_ACTIVE_ASSET');
  });
});
