jest.mock('../services/platformTenant/organizationAssetInvariantService', () => ({
  resolvePropertyCreationTenant: jest.fn(),
}));
const { resolvePropertyCreationTenant } = require('../services/platformTenant/organizationAssetInvariantService');
const { preventOrganizationOwnerPersonalProfessionalAsset } = require('../middleware/organizationAssetInvariant');

const run = async ({ tenantId = null, error = null } = {}) => {
  if (error) resolvePropertyCreationTenant.mockRejectedValueOnce(Object.assign(new Error(error.code), error));
  else resolvePropertyCreationTenant.mockResolvedValueOnce(tenantId);
  const req = { user: { _id: 'user-a' } };
  const res = { status: jest.fn() };
  const next = jest.fn();
  await preventOrganizationOwnerPersonalProfessionalAsset(req, res, next);
  return { req, res, error: next.mock.calls[0]?.[0] };
};

test('independent and ordinary member keep a personal tenant:null creation', async () => {
  const result = await run();
  expect(result.error).toBeUndefined();
  expect(result.req.propertyCreationTenantId).toBeNull();
});

test('organization owner receives the canonical tenant derived by the service', async () => {
  const result = await run({ tenantId: 'tenant-a' });
  expect(result.error).toBeUndefined();
  expect(result.req.propertyCreationTenantId).toBe('tenant-a');
});

test('ambiguous and inconsistent states fail closed before the controller', async () => {
  const result = await run({ error: { statusCode: 409, code: 'OWNER_ORGANIZATION_AMBIGUOUS' } });
  expect(result.res.status).toHaveBeenCalledWith(409);
  expect(result.error).toMatchObject({ statusCode: 409, code: 'OWNER_ORGANIZATION_AMBIGUOUS' });
});
