const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Event = require('../models/Event');
const PortfolioItem = require('../models/portfolioItemModel');
const { getDashboardKpis } = require('../services/dashboardKpiQueryService');

jest.setTimeout(120000);

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

let userSequence = 0;
async function makeUser(role = 'Client') {
  userSequence += 1;
  return User.create({
    name: 'Dashboard User',
    email: `dashboard-kpi-${userSequence}-${Date.now()}@example.com`,
    password: 'Password123!',
    passwordConfirm: 'Password123!',
    role,
  });
}

describe('dashboardKpiQueryService — Mongo réel', () => {
  test('retourne le contrat historique exact sur une base vide', async () => {
    await expect(getDashboardKpis()).resolves.toEqual({
      Altimmo: 0,
      MilaEvents: 0,
      Altcom: 0,
      Users: 0,
      Owners: 0,
    });
  });

  test('compte des fixtures partielles réalistes et seulement le portfolio publié', async () => {
    const owner = await makeUser('Proprietaire');
    await makeUser();
    await Property.create({
      title: 'Villa KPI dashboard',
      description: 'Description suffisamment longue pour la fixture Mongo du dashboard.',
      pole: 'Altimmo',
      type: 'Villa',
      status: 'location',
      price: 300000,
      address: { arrondissement: 'Bacongo', city: 'Brazzaville' },
      latitude: -4.26,
      longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Dashboard'],
      surface: 90,
      statusAdmin: 'Validée',
      availability: 'Disponible',
      owner: owner._id,
    });
    await Event.create({
      name: 'Gala KPI',
      description: 'Événement de caractérisation du dashboard.',
      date: new Date('2026-09-10T18:00:00.000Z'),
      location: 'Brazzaville',
    });
    await PortfolioItem.create([
      {
        title: 'Campagne publiée',
        description: 'Fixture publiée',
        category: 'Campagne Publicitaire',
        images: ['https://placehold.co/1200x800/png?text=Published'],
        isPublished: true,
      },
      {
        title: 'Campagne brouillon',
        description: 'Fixture non publiée',
        category: 'Campagne Publicitaire',
        images: ['https://placehold.co/1200x800/png?text=Draft'],
        isPublished: false,
      },
    ]);

    await expect(getDashboardKpis()).resolves.toEqual({
      Altimmo: 1,
      MilaEvents: 1,
      Altcom: 1,
      Users: 2,
      Owners: 1,
    });
  });
});
