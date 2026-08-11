const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const Document = require('../models/Document');
const Conversation = require('../models/Conversation');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');
const { resolveResourceTenant, assertResourceTenant } = require('../services/platformTenant/tenantResourceAttributionService');

jest.setTimeout(120000);
const makeUser = (name) => User.create({ name, email: `${name}-${Date.now()}@attribution.test`, role: 'Admin', password: 'Password123!', passwordConfirm: 'Password123!', isEmailVerified: true });

async function tenantWithMember(label, bootstrap) {
  const tenant = await platformTenantService.createTenant({ name: `${label} ${Date.now()}`, actor: bootstrap });
  const user = await makeUser(label);
  await organizationService.grantMembership({ userId: user._id, orgUnitId: tenant.rootOrgUnit, actor: bootstrap });
  return { tenant, user };
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('résout une attribution explicite avec une preuve déterministe', async () => {
  const bootstrap = await makeUser('bootstrap-explicit');
  const { tenant, user } = await tenantWithMember('explicit', bootstrap);
  const document = await Document.create({ tenant: tenant._id, type: 'Contrat', createdBy: user._id });
  await expect(resolveResourceTenant({ resourceType: 'Document', resource: document })).resolves.toMatchObject({ status: 'resolved', tenantId: String(tenant._id), confidence: 1 });
});

test('résout une attribution legacy dérivée des relations réelles', async () => {
  const bootstrap = await makeUser('bootstrap-derived');
  const { tenant, user } = await tenantWithMember('derived', bootstrap);
  const hotel = await Hotel.create({ name: 'Legacy derived', manager: user._id, createdBy: user._id });
  const result = await resolveResourceTenant({ resourceType: 'Hotel', resource: hotel });
  expect(result).toMatchObject({ status: 'resolved', tenantId: String(tenant._id) });
  expect(result.proof.join(' ')).toContain('membership');
});

test('classe ambiguë une ressource dont les preuves pointent vers deux tenants', async () => {
  const bootstrap = await makeUser('bootstrap-ambiguous');
  const a = await tenantWithMember('ambiguous-a', bootstrap);
  const b = await tenantWithMember('ambiguous-b', bootstrap);
  const hotel = await Hotel.create({ name: 'Ambiguous', manager: a.user._id, createdBy: b.user._id });
  await expect(resolveResourceTenant({ resourceType: 'Hotel', resource: hotel })).resolves.toMatchObject({ status: 'ambiguous', tenantId: null, confidence: 0 });
  await expect(assertResourceTenant({ resourceType: 'Hotel', resource: hotel, tenantId: a.tenant._id })).rejects.toMatchObject({ statusCode: 404, code: 'TENANT_ATTRIBUTION_AMBIGUOUS' });
});

test('classe non résolue une ressource orpheline et échoue fermé', async () => {
  const orphan = new Conversation({ participants: [] });
  await expect(resolveResourceTenant({ resourceType: 'Conversation', resource: orphan })).resolves.toMatchObject({ status: 'unresolved', tenantId: null });
  await expect(assertResourceTenant({ resourceType: 'Conversation', resource: orphan, tenantId: orphan._id })).rejects.toMatchObject({ statusCode: 404, code: 'TENANT_RESOURCE_NOT_FOUND' });
});

test('les nouvelles ressources portant le tenant restent isolées malgré des relations incohérentes', async () => {
  const bootstrap = await makeUser('bootstrap-future');
  const a = await tenantWithMember('future-a', bootstrap);
  const b = await tenantWithMember('future-b', bootstrap);
  const conversation = await Conversation.create({ tenant: b.tenant._id, participants: [b.user._id] });
  await expect(assertResourceTenant({ resourceType: 'Conversation', resource: conversation, tenantId: a.tenant._id })).rejects.toMatchObject({ statusCode: 404 });
  await expect(assertResourceTenant({ resourceType: 'Conversation', resource: conversation, tenantId: b.tenant._id })).resolves.toMatchObject({ status: 'resolved' });
});
