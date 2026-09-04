const express = require('express');
const request = require('supertest');

jest.mock('../controllers/authController', () => ({
  protect: (req, res, next) => {
    const role = req.get('x-test-role');
    if (!role) return res.status(401).json({ status: 'fail' });
    req.user = { id: '507f1f77bcf86cd799439011', role };
    return next();
  },
  restrictTo: (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ status: 'fail' }),
}));
jest.mock('../controllers/rentalManagementController', () => new Proxy({
  ownerPayments: (req, res) => res.json({ status: 'success', data: { resolvedOwner: req.user.id, suppliedOwner: req.query.ownerId || null } }),
}, { get: (target, property) => target[property] || ((_req, res) => res.json({ status: 'success' })) }));
jest.mock('../services/platformTenant/tenantResourceAttributionService', () => ({ assertResourceTenantOrUnattributed: jest.fn() }));
jest.mock('../services/platformTenant/tenantContextService', () => ({ resolveTenantForUser: jest.fn() }));
jest.mock('../middleware/tenantContext', () => ({ requireTenantScope: (_req, _res, next) => next() }));
jest.mock('../middleware/capabilityMiddleware', () => ({ requireCapability: () => (_req, _res, next) => next() }));

const router = require('../routes/rentalManagementRoutes');
const app = express(); app.use(router);

test('owner payments exige authentification et rôle Proprietaire', async () => {
  await request(app).get('/owner/payments').expect(401);
  await request(app).get('/owner/payments').set('x-test-role', 'Client').expect(403);
  const response = await request(app).get('/owner/payments?ownerId=malicious').set('x-test-role', 'Proprietaire').expect(200);
  expect(response.body.data).toEqual({ resolvedOwner: '507f1f77bcf86cd799439011', suppliedOwner: 'malicious' });
});
