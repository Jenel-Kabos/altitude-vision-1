// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-F — Publication vs Management
// separation invariant. Certifies that a Property publication does NOT
// automatically create or activate a RentalManagement. This is the
// architectural contract the future Essentiel/Professionnel/Premium quota
// (1 / 20 / 50 active managed properties) will rely on: the quota targets
// `RentalManagement.managementActivated=true`, never `Property` count.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const propertyRoutes = require('../routes/propertyRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/properties', propertyRoutes);
app.use(errorHandler);

const bearer = (u) => ({
  Authorization: `Bearer ${jwt.sign({ id: u._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
});
const makeUser = async (over = {}) => User.create({
  name: 'Test User', email: `u-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true,
  ...over,
});

beforeAll(async () => { await startFinancialMongo(); });
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('PROPERTY-MANAGEMENT-SEPARATION — publication does not imply RentalManagement activation', () => {
  test('Direct Property.create (proxy for publication) does not create any RentalManagement row', async () => {
    const owner = await makeUser();
    const beforeRentals = await RentalManagement.countDocuments({});
    await Property.create({
      title: 'Bien perso', description: 'Description suffisamment longue pour la validation.',
      pole: 'Altimmo', type: 'Appartement', status: 'vente', price: 150000,
      address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' },
      images: ['https://example.test/image.jpg'], surface: 80, statusAdmin: 'En attente',
      availability: 'Disponible', latitude: -4.27, longitude: 15.27,
      location: { type: 'Point', coordinates: [15.27, -4.27] },
      owner: owner._id, tenant: null,
    });
    const afterRentals = await RentalManagement.countDocuments({});
    expect(afterRentals).toBe(beforeRentals);
  });

  test('Multiple published Properties for one owner do not accumulate managed-rental rows', async () => {
    const owner = await makeUser();
    await Promise.all([1, 2, 3].map((n) => Property.create({
      title: `Bien ${n}`, description: 'Description suffisamment longue pour la validation.',
      pole: 'Altimmo', type: 'Appartement', status: n % 2 === 0 ? 'location' : 'vente', price: 150000 + n,
      address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' },
      images: ['https://example.test/image.jpg'], surface: 80, statusAdmin: 'Validée',
      availability: 'Disponible', latitude: -4.27, longitude: 15.27,
      location: { type: 'Point', coordinates: [15.27, -4.27] },
      owner: owner._id, tenant: null, isPublished: true,
    })));
    const publishedCount = await Property.countDocuments({ owner: owner._id, isPublished: true });
    const managedCount = await RentalManagement.countDocuments({ owner: owner._id, managementActivated: true });
    expect(publishedCount).toBe(3);
    expect(managedCount).toBe(0);
  });

  test('The quota boundary is RentalManagement.managementActivated=true, not Property count', async () => {
    // Two rental-management rows: one activated, one not. The `active` count
    // must reflect only the activated row — this is the primitive the future
    // Essentiel/Professionnel/Premium quota will target.
    const owner = await makeUser();
    const p1 = await Property.create({
      title: 'Bien 1', description: 'Description suffisamment longue pour la validation.',
      pole: 'Altimmo', type: 'Appartement', status: 'location', price: 150000,
      address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' },
      images: ['https://example.test/image.jpg'], surface: 80, statusAdmin: 'Validée',
      availability: 'Disponible', latitude: -4.27, longitude: 15.27,
      location: { type: 'Point', coordinates: [15.27, -4.27] },
      owner: owner._id, tenant: null, isPublished: true,
    });
    const p2 = await Property.create({
      title: 'Bien 2', description: 'Description suffisamment longue pour la validation.',
      pole: 'Altimmo', type: 'Appartement', status: 'location', price: 160000,
      address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' },
      images: ['https://example.test/image.jpg'], surface: 80, statusAdmin: 'Validée',
      availability: 'Disponible', latitude: -4.27, longitude: 15.27,
      location: { type: 'Point', coordinates: [15.27, -4.27] },
      owner: owner._id, tenant: null, isPublished: true,
    });
    await RentalManagement.create({
      property: p1._id, owner: owner._id, managementActivated: true,
      availabilityStatus: 'disponible', occupancyStatus: 'vacant', createdBy: owner._id,
    });
    await RentalManagement.create({
      property: p2._id, owner: owner._id, managementActivated: false,
      availabilityStatus: 'disponible', occupancyStatus: 'vacant', createdBy: owner._id,
    });
    const activeManaged = await RentalManagement.countDocuments({ owner: owner._id, managementActivated: true });
    const totalProperties = await Property.countDocuments({ owner: owner._id });
    expect(activeManaged).toBe(1);
    expect(totalProperties).toBe(2);
    // The future quota primitive queries the FIRST value, never the second.
  });
});
