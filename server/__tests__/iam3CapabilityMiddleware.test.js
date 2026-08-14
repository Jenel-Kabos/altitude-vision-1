const express = require('express');
const request = require('supertest');
const { requireCapability } = require('../middleware/capabilityMiddleware');

const appFor = (role, capability) => {
  const app = express();
  app.use((req, res, next) => { req.user = { role }; next(); });
  app.all('/resource', requireCapability(capability), (req, res) => res.status(200).json({ ok: true }));
  app.use((error, req, res, _next) => res.status(res.statusCode >= 400 ? res.statusCode : 500).json({ message: error.message }));
  return app;
};

describe('IAM-3 — appels API directs par rôle', () => {
  test.each([
    ['Secretaire', 'documents.read', 200], ['Secretaire', 'payments.manage', 200],
    ['Secretaire', 'rental.manage', 403], ['Secretaire', 'visits.manage', 403],
    ['GestionnaireImmobilier', 'rental.read', 200], ['GestionnaireImmobilier', 'maintenance.manage', 200],
    ['GestionnaireImmobilier', 'payments.manage', 403], ['GestionnaireImmobilier', 'documents.manage', 403],
    ['CommunityManager', 'altcom.read', 200], ['CommunityManager', 'events.manage', 200],
    ['CommunityManager', 'rental.manage', 403], ['CommunityManager', 'visits.manage', 403],
    ['Admin', 'documents.manage', 200], ['Admin', 'payments.manage', 200],
    ['Admin', 'rental.manage', 200], ['Admin', 'events.manage', 200],
  ])('%s / %s → %i', async (role, capability, status) => {
    const response = await request(appFor(role, capability)).patch('/resource');
    expect(response.statusCode).toBe(status);
  });
});
