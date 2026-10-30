const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const CommercialPublicationRevision = require('../models/CommercialPublicationRevision');
const {
  PUBLICATION_STATES,
  derivePublicationState,
  isPropertyCommerciallyAvailable,
  ownerWithdrawProperty,
  ownerRequestReactivation,
  adminSuspendProperty,
  adminLiftSuspension,
} = require('../services/propertyPublicationLifecycleService');

jest.setTimeout(180000);

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function fixture(overrides = {}) {
  const owner = await User.create({
    name: 'Owner Lifecycle',
    email: `owner-lifecycle-${Date.now()}-${Math.random()}@example.test`,
    password: 'Password123!',
    passwordConfirm: 'Password123!',
    role: 'Proprietaire',
    isEmailVerified: true,
  });
  const operator = await User.create({
    name: 'Operator Lifecycle',
    email: `operator-lifecycle-${Date.now()}-${Math.random()}@example.test`,
    password: 'Password123!',
    passwordConfirm: 'Password123!',
    role: 'Admin',
    isEmailVerified: true,
  });
  const snapshot = {
    title: 'Villa cycle', description: 'Description cycle', price: 100000,
    status: 'vente', type: 'Villa', address: { arrondissement: 'Bacongo', city: 'Brazzaville' },
    latitude: -4.2, longitude: 15.2, images: ['cycle.jpg'], surface: 120,
    availability: 'Disponible',
  };
  const property = await Property.create({
    ...snapshot, pole: 'Altimmo', owner: owner._id, statusAdmin: 'Validée',
    isPublished: true, commercialPublicationVersion: 1,
    approvedPublicSnapshot: snapshot, publicationLifecycleState: 'published', ...overrides,
  });
  return { owner, operator, property, snapshot };
}

test('le fallback legacy dérive la visibilité sans imposer une migration', async () => {
  const { property } = await fixture();
  await Property.collection.updateOne(
    { _id: property._id },
    { $unset: { publicationLifecycleState: '' } },
  );
  const legacy = await Property.findById(property._id).lean();
  expect(derivePublicationState(legacy)).toBe(PUBLICATION_STATES.PUBLISHED);
  expect(isPropertyCommerciallyAvailable(legacy)).toBe(true);
  expect(isPropertyCommerciallyAvailable({ ...legacy, availability: 'Loué' })).toBe(false);
});

test.each([
  ['Retiré', 'owner_withdrawn'],
  ['Loué', 'owner_withdrawn'],
  ['Vendu', 'owner_withdrawn'],
  ['Indisponible', 'owner_withdrawn'],
])('le propriétaire retire immédiatement avec disponibilité %s', async (availability, expectedState) => {
  const { owner, property } = await fixture();
  const fresh = await ownerWithdrawProperty({
    propertyId: property._id, actor: owner, availability, reason: 'Décision propriétaire',
  });
  expect(fresh).toMatchObject({
    availability, publicationLifecycleState: expectedState,
    isPublished: false, statusAdmin: 'Validée',
  });
  expect(fresh.publicationLifecycleHistory.at(-1)).toMatchObject({
    from: 'published', to: expectedState, action: 'owner_withdraw', actor: owner._id,
  });
});

test('le retrait supersède la révision pendante et conserve les snapshots', async () => {
  const { owner, property, snapshot } = await fixture();
  const revision = await CommercialPublicationRevision.create({
    resourceType: 'Property', resource: property._id, owner: owner._id,
    baseVersion: 1, proposedSnapshot: { ...snapshot, price: 120000 }, changedFields: ['price'],
    status: 'pending', submissionType: 'content_change', submittedBy: owner._id,
    history: [{ event: 'submitted', actor: owner._id }],
  });
  await Property.updateOne({ _id: property._id }, {
    currentPublicationRevision: revision._id, publicationLifecycleState: 'change_pending', isPublished: false,
  });
  await ownerWithdrawProperty({ propertyId: property._id, actor: owner, availability: 'Retiré', reason: 'Retrait' });
  expect(await CommercialPublicationRevision.findById(revision._id)).toMatchObject({ status: 'superseded' });
  expect((await Property.findById(property._id).lean()).approvedPublicSnapshot.price).toBe(100000);
});

test('la réactivation crée une nouvelle révision, reste non publiée et remplace la précédente', async () => {
  const { owner, property } = await fixture({
    publicationLifecycleState: 'owner_withdrawn', availability: 'Retiré', isPublished: false,
  });
  const first = await ownerRequestReactivation({ propertyId: property._id, actor: owner, reason: 'Retour au marché' });
  const second = await ownerRequestReactivation({ propertyId: property._id, actor: owner, reason: 'Nouvelle demande' });
  const fresh = await Property.findById(property._id).lean();
  expect(fresh).toMatchObject({ publicationLifecycleState: 'pending', availability: 'Disponible', isPublished: false });
  expect(first.revision.submissionType).toBe('reactivation');
  expect(await CommercialPublicationRevision.findById(first.revision._id)).toMatchObject({ status: 'superseded' });
  expect(second.revision).toMatchObject({ status: 'pending', submissionType: 'reactivation' });
  expect(await CommercialPublicationRevision.countDocuments({ resource: property._id, status: 'pending' })).toBe(1);
});

test('la suspension Altimmo est immédiate et aucune action propriétaire ne la lève', async () => {
  const { owner, operator, property } = await fixture();
  const suspended = await adminSuspendProperty({ propertyId: property._id, actor: operator, reason: 'Contrôle requis' });
  expect(suspended).toMatchObject({ publicationLifecycleState: 'admin_suspended', isPublished: false });
  await expect(ownerRequestReactivation({ propertyId: property._id, actor: owner, reason: 'Je souhaite republier' }))
    .rejects.toMatchObject({ code: 'PROPERTY_ADMIN_SUSPENDED' });
  await expect(ownerWithdrawProperty({ propertyId: property._id, actor: owner, availability: 'Disponible', reason: 'Tentative' }))
    .rejects.toMatchObject({ code: 'PROPERTY_ADMIN_SUSPENDED' });
});

test('la levée de suspension crée une révision de contrôle sans republication', async () => {
  const { operator, property } = await fixture({ publicationLifecycleState: 'admin_suspended', isPublished: false });
  const result = await adminLiftSuspension({ propertyId: property._id, actor: operator, reason: 'Réexamen autorisé' });
  expect(result.property).toMatchObject({ publicationLifecycleState: 'pending', isPublished: false });
  expect(result.revision).toMatchObject({ status: 'pending', submissionType: 'suspension_review' });
});

test('course A: deux retraits concurrents produisent une seule transition gagnante', async () => {
  const { owner, property } = await fixture();
  const results = await Promise.allSettled([
    ownerWithdrawProperty({ propertyId: property._id, actor: owner, availability: 'Loué', reason: 'Loué' }),
    ownerWithdrawProperty({ propertyId: property._id, actor: owner, availability: 'Vendu', reason: 'Vendu' }),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((result) => result.status === 'rejected')[0].reason).toMatchObject({ statusCode: 409 });
});

test('courses B-F: retrait, réactivation et suspension ne laissent jamais deux révisions pendantes ni une publication implicite', async () => {
  const { owner, operator, property } = await fixture({
    publicationLifecycleState: 'owner_withdrawn', availability: 'Retiré', isPublished: false,
  });
  const attempts = await Promise.allSettled([
    ownerRequestReactivation({ propertyId: property._id, actor: owner, reason: 'Demande A' }),
    ownerRequestReactivation({ propertyId: property._id, actor: owner, reason: 'Demande B' }),
    adminSuspendProperty({ propertyId: property._id, actor: operator, reason: 'Suspension concurrente' }),
  ]);
  expect(attempts.some((result) => result.status === 'fulfilled')).toBe(true);
  expect(await CommercialPublicationRevision.countDocuments({ resource: property._id, status: 'pending' })).toBeLessThanOrEqual(1);
  const fresh = await Property.findById(property._id).lean();
  expect(fresh.isPublished).toBe(false);
  expect(['pending', 'admin_suspended']).toContain(fresh.publicationLifecycleState);
});
