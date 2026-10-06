const { discoverOrganizationAssetInvariants } = require('../services/platformTenant/organizationAssetDiscoveryService');

const model = (documents) => ({
  find: jest.fn(() => {
    const query = {
      select: () => query,
      lean: () => query,
      cursor: () => ({ async *[Symbol.asyncIterator]() { for (const document of documents) yield document; } }),
    };
    return query;
  }),
});

test('C2.7 discovery classifies the graph with six bounded read queries and no writes', async () => {
  const models = {
    PlatformTenant: model([
      { _id: 'tenant-a', rootOrgUnit: 'root-a', createdBy: 'owner-a' },
      { _id: 'tenant-b', rootOrgUnit: 'root-b', createdBy: 'ex-operator' },
    ]),
    OrgMembership: model([
      { user: 'owner-a', orgUnit: 'root-a', roleInUnit: 'owner', businessRole: 'Admin' },
      { user: 'manager-b', orgUnit: 'root-b', roleInUnit: 'member', businessRole: 'Collaborateur' },
    ]),
    Property: model([
      { _id: 'p-null', owner: 'owner-a', tenant: null, pole: 'Altimmo', status: 'location', availability: 'Disponible' },
      { _id: 'p-history', owner: 'historical-owner', tenant: null, pole: 'Altimmo', status: 'vente', availability: 'Vendu', assetCycle: 'vendu' },
      { _id: 'p-independent', owner: 'independent', tenant: null, pole: 'Altimmo', status: 'location', availability: 'Disponible' },
    ]),
    Hotel: model([
      { _id: 'hotel-null', tenant: null, manager: 'owner-a', property: 'p-null' },
      { _id: 'hotel-a', tenant: 'tenant-a', manager: 'manager-b', property: 'p-null' },
    ]),
    PlatformOperator: model([{ user: 'ex-operator', status: 'revoked' }]),
    HotelReservation: model([{ hotel: 'hotel-a', status: 'confirmed' }]),
  };
  const result = await discoverOrganizationAssetInvariants({ batchSize: 2, models });
  expect(result.readOnly).toBe(true);
  expect(result.metrics).toMatchObject({ queries: 6, documentsScanned: 11, batchSize: 2 });
  expect(result.counts).toMatchObject({
    HYBRID_OWNER: 1, INDEPENDENT_CLEAN: 1, HISTORICAL_ONLY: 1,
    HOTEL_TENANT_NULL: 1, HOTEL_MANAGER_TENANT_CONTRADICTION: 1,
    ACTIVE_RESERVATION_BLOCKER: 1, LEGACY_FOUNDER: 1, EX_OPERATOR_PROVENANCE_ONLY: 1,
  });
  Object.values(models).forEach((entry) => {
    expect(entry.find).toHaveBeenCalledTimes(1);
    expect(entry.updateOne).toBeUndefined();
  });
});
