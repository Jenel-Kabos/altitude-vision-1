const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const { listPublicProperties, getPublicPropertyById } = require('../services/publicApi/publicPropertyService');

jest.setTimeout(180000);
beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function propertyFixture(overrides = {}) {
  const owner = await User.create({
    name: 'Owner Availability', email: `owner-availability-${Date.now()}-${Math.random()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true,
  });
  return Property.create({
    title: 'Villa disponibilité', description: 'Description disponibilité', price: 100000,
    status: 'vente', type: 'Villa', pole: 'Altimmo', owner: owner._id,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.2,
    longitude: 15.2, images: ['availability.jpg'], surface: 120,
    availability: 'Disponible', statusAdmin: 'Validée', isPublished: true,
    publicationLifecycleState: 'published', ...overrides,
  });
}

test.each(['owner_withdrawn', 'admin_suspended', 'change_pending', 'pending', 'rejected'])('la liste et le détail publics excluent l’état %s même avec les anciens drapeaux publics', async (state) => {
  const property = await propertyFixture({ publicationLifecycleState: state });
  expect((await listPublicProperties({})).properties).toHaveLength(0);
  expect(await getPublicPropertyById(property._id)).toBeNull();
});

test.each(['Loué', 'Vendu', 'Indisponible', 'Retiré'])('la disponibilité %s exclut liste et détail', async (availability) => {
  const property = await propertyFixture({ availability });
  expect((await listPublicProperties({})).properties).toHaveLength(0);
  expect(await getPublicPropertyById(property._id)).toBeNull();
});

test('une annonce legacy validée et disponible reste visible sans nouvel état', async () => {
  const property = await propertyFixture();
  await Property.collection.updateOne({ _id: property._id }, { $unset: { publicationLifecycleState: '' } });
  expect((await listPublicProperties({})).properties).toHaveLength(1);
  expect(await getPublicPropertyById(property._id)).toMatchObject({ title: 'Villa disponibilité' });
});
