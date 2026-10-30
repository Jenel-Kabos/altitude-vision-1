const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const PlatformOperator = require('../models/PlatformOperator');
const Notification = require('../models/Notification');
const {
  notifyPropertyLifecycleEvent,
  PROPERTY_LIFECYCLE_NOTIFICATION_EVENTS,
} = require('../services/propertyPublicationNotificationService');

jest.setTimeout(180000);
beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function fixture() {
  const createUser = (name, role = 'Admin') => User.create({
    name, email: `${name.toLowerCase().replaceAll(' ', '-')}-${Date.now()}-${Math.random()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true,
  });
  const owner = await createUser('Owner Notification', 'Proprietaire');
  const commercial = await createUser('Commercial Notification');
  const secondCommercial = await createUser('Second Commercial Notification');
  const unauthorized = await createUser('Unauthorized Notification');
  await PlatformOperator.create([
    { user: commercial._id, capabilities: ['platform.commercial.manage'], grantedBy: commercial._id, grantReason: 'TEST DATA' },
    { user: secondCommercial._id, capabilities: ['platform.commercial.manage'], grantedBy: commercial._id, grantReason: 'TEST DATA' },
    { user: unauthorized._id, capabilities: ['platform.properties.read'], grantedBy: commercial._id, grantReason: 'TEST DATA' },
  ]);
  const property = await Property.create({
    title: 'Villa notifications', description: 'Description notifications', price: 100000,
    status: 'vente', type: 'Villa', pole: 'Altimmo', owner: owner._id,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.2,
    longitude: 15.2, images: ['notification.jpg'], surface: 120,
    availability: 'Disponible', statusAdmin: 'En attente', isPublished: false,
  });
  return { owner, commercial, secondCommercial, unauthorized, property };
}

const commercialEvents = [
  'submitted', 'changed', 'withdrawn', 'rented', 'sold', 'unavailable',
  'reactivation_requested', 'suspension_review_requested',
];
const ownerEvents = ['approved', 'rejected', 'admin_suspended', 'suspension_lifted'];

test.each(commercialEvents)('%s notifie uniquement les opérateurs commerciaux actifs', async (event) => {
  const { owner, commercial, secondCommercial, unauthorized, property } = await fixture();
  await notifyPropertyLifecycleEvent({ event, property, actor: owner, reason: 'Motif public', transitionKey: `${event}-1` });
  const rows = await Notification.find({ entityId: property._id, type: PROPERTY_LIFECYCLE_NOTIFICATION_EVENTS[event].type }).lean();
  expect(rows.map((row) => String(row.recipient)).sort()).toEqual([String(commercial._id), String(secondCommercial._id)].sort());
  expect(rows.map((row) => String(row.recipient))).not.toContain(String(unauthorized._id));
  expect(rows.every((row) => !JSON.stringify(row).includes(owner.email))).toBe(true);
});

test.each(ownerEvents)('%s notifie uniquement le propriétaire avec le motif communicable', async (event) => {
  const { owner, commercial, property } = await fixture();
  await notifyPropertyLifecycleEvent({ event, property, actor: commercial, reason: 'Motif communicable', transitionKey: `${event}-1` });
  const rows = await Notification.find({ entityId: property._id, type: PROPERTY_LIFECYCLE_NOTIFICATION_EVENTS[event].type }).lean();
  expect(rows).toHaveLength(1);
  expect(String(rows[0].recipient)).toBe(String(owner._id));
  expect(rows[0].body).toContain('Motif communicable');
});

test('une répétition avec la même transition ne duplique aucune notification', async () => {
  const { owner, property } = await fixture();
  const payload = { event: 'withdrawn', property, actor: owner, reason: 'Retrait', transitionKey: 'transition-stable' };
  await Promise.all([notifyPropertyLifecycleEvent(payload), notifyPropertyLifecycleEvent(payload)]);
  expect(await Notification.countDocuments({ entityId: property._id, type: 'property_owner_withdrawn' })).toBe(2);
});

test('un événement inconnu ou une transition métier échouée ne crée aucune notification de succès', async () => {
  const { owner, property } = await fixture();
  await expect(notifyPropertyLifecycleEvent({ event: 'not_recorded', property, actor: owner, transitionKey: 'bad' }))
    .rejects.toMatchObject({ code: 'PROPERTY_NOTIFICATION_EVENT_INVALID' });
  expect(await Notification.countDocuments({ entityId: property._id })).toBe(0);
});
