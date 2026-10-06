const { ASSET_CLASSIFICATION: C, classifyOrganizationAsset } = require('../services/platformTenant/organizationAssetInvariantService');

const base = { _id: 'p1', owner: 'owner-a', tenant: null, pole: 'Altimmo', status: 'location', availability: 'Disponible', assetCycle: 'disponible' };
const classify = (property = base, extra = {}) => classifyOrganizationAsset({ property, ownerId: 'owner-a', targetTenantId: 'tenant-a', ...extra }).classification;

describe('C2 organization asset classifier', () => {
  test('active Altimmo asset directly owned by applicant is eligible', () => expect(classify()).toBe(C.ELIGIBLE_ACTIVE_ASSET));
  test.each([
    [{ ...base, assetCycle: 'vendu' }],
    [{ ...base, assetCycle: 'archive' }],
    [{ ...base, availability: 'Vendu' }],
    [{ ...base, availability: 'Retiré' }],
  ])('sold/archived history is retained', (property) => expect(classify(property)).toBe(C.HISTORICAL_KEEP));
  test('foreign tenant is a conflict', () => expect(classify({ ...base, tenant: 'tenant-b' })).toBe(C.OTHER_TENANT_CONFLICT));
  test('forged owner is ambiguous', () => expect(classify({ ...base, owner: 'owner-b' })).toBe(C.OWNERSHIP_AMBIGUOUS));
  test('active workflow blocks migration', () => expect(classify(base, { activeWorkflow: true })).toBe(C.ACTIVE_WORKFLOW_BLOCKER));
  test('non-Altimmo asset is not guessed', () => expect(classify({ ...base, pole: 'Altcom' })).toBe(C.PERSONAL_OR_UNCLASSIFIED));
  test('already canonical asset is idempotent', () => expect(classify({ ...base, tenant: 'tenant-a' })).toBe(C.ALREADY_IN_TARGET));
});
