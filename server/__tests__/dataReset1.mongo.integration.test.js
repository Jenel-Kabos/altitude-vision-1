const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const PlatformTenant = require('../models/PlatformTenant');
const OrgUnit = require('../models/OrgUnit');
const OrgMembership = require('../models/OrgMembership');
const PlatformOperator = require('../models/PlatformOperator');
const CrmCustomer = require('../models/CrmCustomer');
const Property = require('../models/Property');
const Conversation = require('../models/Conversation');
const platformTenantService = require('../services/platformTenant/platformTenantService');
const organizationService = require('../services/organizationService');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const { PLATFORM_OPERATOR_CAPABILITIES } = require('../constants/platformOperatorConstants');

jest.setTimeout(180000);

async function recreateCriticalIndexes() {
  await Promise.all([User, PlatformTenant, OrgUnit, OrgMembership, PlatformOperator, CrmCustomer, Property, Conversation].map((model) => model.createCollection().catch(() => {})));
  await Promise.all([User, PlatformTenant, OrgUnit, OrgMembership, PlatformOperator, CrmCustomer, Property, Conversation].map((model) => model.syncIndexes()));
}

async function bootstrap() {
  const password = `Reset-Test-${new mongoose.Types.ObjectId()}!`;
  const admin = await User.create({ name: 'Admin Principal', email: 'admin-reset@example.test', password, passwordConfirm: password, role: 'Admin', isEmailVerified: true });
  const tenant = await platformTenantService.createTenant({ name: 'Altitude Vision', actor: admin, req: null });
  await organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, roleInUnit: 'owner', actor: admin, metadata: { reason: 'DATA-RESET-1 test' }, req: null });
  await grantOperator({ userId: admin._id, capabilities: PLATFORM_OPERATOR_CAPABILITIES, actor: admin, reason: 'DATA-RESET-1 test', req: null, allowSelfGrant: true });
  return { admin, tenant };
}

async function resetAndBootstrap() {
  await mongoose.connection.db.dropDatabase();
  await recreateCriticalIndexes();
  return bootstrap();
}

beforeAll(startFinancialMongo);
afterAll(stopFinancialMongo);

test('legacy → reset → indexes actuels → bootstrap minimal → CRM propre', async () => {
  await User.create({ name: 'Legacy User', email: 'legacy@example.test', password: 'Legacy-Test-123!', passwordConfirm: 'Legacy-Test-123!', role: 'Client' });
  const { tenant } = await resetAndBootstrap();
  expect(await User.countDocuments()).toBe(1);
  expect(await PlatformTenant.countDocuments()).toBe(1);
  expect(await OrgUnit.countDocuments()).toBe(1);
  expect(await OrgMembership.countDocuments()).toBe(1);
  expect(await PlatformOperator.countDocuments()).toBe(1);
  expect(await Property.countDocuments()).toBe(0);
  expect(await Conversation.countDocuments()).toBe(0);
  const index = (await CrmCustomer.collection.indexes()).find((item) => item.name === 'one_crm_customer_per_tenant_source');
  expect(index.partialFilterExpression).toEqual({ 'sourceRefs.entityType': { $type: 'string' }, 'sourceRefs.entityId': { $type: 'objectId' } });
  await CrmCustomer.create({ tenant: tenant._id, displayName: 'Manual A', identityKeys: ['manual:a'] });
  await expect(CrmCustomer.create({ tenant: tenant._id, displayName: 'Manual B', identityKeys: ['manual:b'] })).resolves.toBeTruthy();
});

test('second reset produit le même état minimal sans doublons', async () => {
  await resetAndBootstrap();
  expect(await Promise.all([User.countDocuments(), PlatformTenant.countDocuments(), OrgUnit.countDocuments(), OrgMembership.countDocuments(), PlatformOperator.countDocuments()])).toEqual([1, 1, 1, 1, 1]);
});

test('crash après drop est détectable comme RESET_DONE / BOOTSTRAP_PENDING', async () => {
  await mongoose.connection.db.dropDatabase();
  const collections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
  expect(collections).toHaveLength(0);
  expect(await User.countDocuments()).toBe(0);
  await recreateCriticalIndexes();
  await bootstrap();
  expect(await PlatformTenant.countDocuments()).toBe(1);
});
