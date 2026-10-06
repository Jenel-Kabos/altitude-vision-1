const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const PlatformTenant = require('../models/PlatformTenant');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
const PlatformTenantFeature = require('../models/PlatformTenantFeature');
const IndividualSubscription = require('../models/IndividualSubscription');
const {
  MODULE_SCOPE,
  canUseModule,
  assertCanUseModule,
} = require('../services/subscription/moduleEntitlementService');
const { changeIndividualSubscription, cancelIndividualSubscription } = require('../services/subscription/individualSubscriptionService');

jest.setTimeout(120000);

let seq = 0;
const makeUser = () => User.create({
  name: `C210B User ${++seq}`,
  email: `c210b-entitlement-${seq}-${Date.now()}@example.test`,
  password: 'Password123!',
  passwordConfirm: 'Password123!',
  role: 'Proprietaire',
  isEmailVerified: true,
});

beforeAll(startFinancialMongo);
afterAll(stopFinancialMongo);

beforeEach(async () => {
  await Promise.all([
    IndividualSubscription.deleteMany({}),
    PlatformTenantSubscription.deleteMany({}),
    PlatformTenantFeature.deleteMany({}),
    PlatformTenant.deleteMany({}),
    User.deleteMany({}),
  ]);
  await IndividualSubscription.syncIndexes();
});

describe('C2.10B B1 — entitlement individuel', () => {
  test.each([
    ['NO_SUBSCRIPTION', null, false, 'NO_SUBSCRIPTION'],
    ['TRIALING', 'trialing', true, 'ENTITLED'],
    ['ACTIVE', 'active', true, 'ENTITLED'],
    ['PAST_DUE', 'past_due', false, 'SUBSCRIPTION_INELIGIBLE'],
    ['CANCELLED', 'cancelled', false, 'SUBSCRIPTION_INELIGIBLE'],
  ])('%s', async (_label, status, allowed, reason) => {
    const user = await makeUser();
    if (status) {
      await IndividualSubscription.create({
        user: user._id,
        plan: 'essentiel',
        status,
        modulesIncluded: ['location'],
      });
    }

    const decision = await canUseModule({
      scope: MODULE_SCOPE.INDIVIDUAL,
      userId: user._id,
      module: 'location',
    });

    expect(decision).toMatchObject({ allowed, reason, status: status || null, subjectId: String(user._id) });
    expect(await IndividualSubscription.countDocuments({ user: user._id })).toBe(status ? 1 : 0);
  });

  test('un abonnement sans module location reste inéligible', async () => {
    const user = await makeUser();
    await IndividualSubscription.create({ user: user._id, plan: 'essentiel', status: 'active', modulesIncluded: ['immobilier'] });
    await expect(assertCanUseModule({ scope: MODULE_SCOPE.INDIVIDUAL, userId: user._id, module: 'location' }))
      .rejects.toMatchObject({ code: 'INDIVIDUAL_MODULE_UNAVAILABLE', statusCode: 403 });
  });

  test('l’abonnement appartient au User et ne donne aucun droit à un autre User', async () => {
    const [ownerA, ownerB] = await Promise.all([makeUser(), makeUser()]);
    await IndividualSubscription.create({ user: ownerA._id, plan: 'essentiel', status: 'active', modulesIncluded: ['location'] });

    await expect(canUseModule({ scope: MODULE_SCOPE.INDIVIDUAL, userId: ownerA._id, module: 'location' }))
      .resolves.toMatchObject({ allowed: true });
    await expect(canUseModule({ scope: MODULE_SCOPE.INDIVIDUAL, userId: ownerB._id, module: 'location' }))
      .resolves.toMatchObject({ allowed: false, reason: 'NO_SUBSCRIPTION' });
  });

  test('un seul abonnement trialing/active peut exister par User', async () => {
    const user = await makeUser();
    await IndividualSubscription.create({ user: user._id, plan: 'essentiel', status: 'trialing', modulesIncluded: ['location'] });
    await expect(IndividualSubscription.create({ user: user._id, plan: 'professionnel', status: 'active', modulesIncluded: ['location'] }))
      .rejects.toMatchObject({ code: 11000 });
  });

  test('la branche ORGANIZATION conserve la sémantique feature/subscription existante', async () => {
    const { tenant } = await createTenantFixture({ label: `C210B Entitlement ${Date.now()}` });
    await PlatformTenantSubscription.deleteMany({ tenant: tenant._id });
    await PlatformTenantSubscription.create({ tenant: tenant._id, plan: 'essentiel', status: 'active', modulesIncluded: ['location'] });

    await expect(canUseModule({ scope: MODULE_SCOPE.ORGANIZATION, tenantId: tenant._id, module: 'location' }))
      .resolves.toMatchObject({ allowed: true, reason: 'ENTITLED', subjectId: String(tenant._id) });

    await PlatformTenantFeature.create({ tenant: tenant._id, module: 'location', enabled: false });
    await expect(canUseModule({ scope: MODULE_SCOPE.ORGANIZATION, tenantId: tenant._id, module: 'location' }))
      .resolves.toMatchObject({ allowed: false, reason: 'MODULE_DISABLED' });
  });

  test('les paramètres de sujet invalides échouent fermés', async () => {
    await expect(canUseModule({ scope: MODULE_SCOPE.INDIVIDUAL, userId: null, module: 'location' }))
      .resolves.toMatchObject({ allowed: false, reason: 'SUBJECT_REQUIRED', subjectId: null });
    await expect(canUseModule({ scope: 'UNKNOWN', userId: 'x', module: 'location' }))
      .rejects.toThrow('moduleEntitlementService: unknown scope');
  });

  test('changement et annulation conservent l’historique sans abonnement automatique', async () => {
    const user = await makeUser();
    const actor = await makeUser();
    const first = await changeIndividualSubscription(user._id, { plan: 'essentiel', modulesIncluded: ['location'], actor });
    const second = await changeIndividualSubscription(user._id, { plan: 'premium', modulesIncluded: ['location'], actor });
    expect(first.status).toBe('active');
    expect(second.status).toBe('active');
    expect(await IndividualSubscription.countDocuments({ user: user._id })).toBe(2);
    expect((await IndividualSubscription.findById(first._id).lean()).status).toBe('cancelled');
    await cancelIndividualSubscription(user._id, { actor, reason: 'Fin de souscription' });
    expect((await IndividualSubscription.findById(second._id).lean()).status).toBe('cancelled');
  });
});
