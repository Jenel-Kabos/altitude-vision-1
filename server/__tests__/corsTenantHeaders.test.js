jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../scripts/sync-facebook', () => ({ syncFacebook: jest.fn() }));
jest.mock('../services/zohoImapService', () => ({ pollZohoInbox: jest.fn() }));
jest.mock('../services/alerteService', () => ({ verifierPaiementsEnRetard: jest.fn() }));
jest.mock('../utils/generateSitemap', () => jest.fn().mockResolvedValue('<xml/>'));

const request = require('supertest');
const { app } = require('../server');

describe('CORS tenant selection headers', () => {
  test('authorizes the production frontend preflight with X-Platform-Tenant-Id', async () => {
    const response = await request(app)
      .options('/api/properties/latest?pole=Altimmo&limit=5')
      .set('Origin', 'https://www.altitudevision.agency')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'x-platform-tenant-id');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://www.altitudevision.agency');
    expect(response.headers['access-control-allow-credentials']).toBe('true');

    const allowedHeaders = response.headers['access-control-allow-headers']
      .split(',')
      .map((header) => header.trim().toLowerCase());
    expect(allowedHeaders).toEqual(expect.arrayContaining(['x-platform-tenant-id', 'x-tenant-id']));
  });
});
