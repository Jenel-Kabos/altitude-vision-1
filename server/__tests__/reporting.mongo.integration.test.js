// REPORTING-1 — Centre de Pilotage : vérifie que ReportingService agrège
// correctement les DomainReport (chacun un pur wrapper d'un service déjà
// existant), reste résilient si un domaine échoue, et que l'export
// PDF/CSV produit un document exploitable. Ne re-teste JAMAIS la correction
// interne des services réutilisés (dashboardAnalyticsController,
// crmService, userKpiService, hotelFinancialDashboardService…) — déjà
// couverts par leurs propres suites.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const AltcomProject = require('../models/AltcomProject');
const Event = require('../models/Event');
const { getExecutiveReport, getDomainReport, DOMAINS } = require('../services/reporting/reportingService');
const { buildCsv, buildPdf } = require('../services/reporting/reportingExportService');
const crmService = require('../services/crmService');
const reportingRoutes = require('../routes/reportingRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/reporting', reportingRoutes);
app.use(errorHandler);

const signToken = (userId) => jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Test User', email: `reporting${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('reportingService — orchestrateur (base vide)', () => {
  test('getExecutiveReport() renvoie les 9 domaines sans jamais lever, même sans aucune donnée', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const report = await getExecutiveReport({ user: admin });
    expect(Object.keys(report.domains)).toEqual(DOMAINS);
    DOMAINS.forEach((domain) => {
      expect(report.domains[domain].status).toBe('ok');
    });
    expect(report.users.status).toBe('ok');
    expect(report.generatedAt).toBeInstanceOf(Date);
  });

  test('getDomainReport() sur un domaine inconnu lève une erreur 404 explicite', async () => {
    await expect(getDomainReport('inexistant', {})).rejects.toMatchObject({ statusCode: 404 });
  });

  test('un domaine défaillant ne bloque jamais les autres (résilience Promise.allSettled)', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const spy = jest.spyOn(crmService, 'getDashboard').mockRejectedValueOnce(new Error('Panne simulée CRM'));
    const report = await getExecutiveReport({ user: admin });
    // getExecutiveReport appelle getDashboard() une fois pour lui-même (share)
    // ET getCrmReport() en fait un second appel réel (non partagé, voir
    // reportingService.js) — seul le premier échoue ici : le rapport entier
    // ne doit pas planter pour autant, chaque domaine reste isolé.
    expect(report.domains.immobilier.status).toBe('ok');
    expect(report.domains.location.status).toBe('ok');
    spy.mockRestore();
  });
});

describe('reportingService — communication/évenementiel (revenu réel uniquement)', () => {
  test('les projets Altcom sont regroupés par statut et tranche de budget, sans revenu inventé', async () => {
    await AltcomProject.create({
      contactName: 'Contact A', email: 'a@test.com', phone: '+242060000001',
      projectName: 'Projet A', projectType: 'Branding & Design', targetAudience: 'Grand public',
      objectives: 'Augmenter la notoriété', budget: '1M-3M', status: 'En cours',
      detailedDescription: 'Description suffisamment longue pour la validation du modèle AltcomProject ici présent.',
    });
    const report = await getDomainReport('communication', {});
    expect(report.projectsByStatus.some((r) => r._id === 'En cours')).toBe(true);
    expect(report.projectsByBudgetBracket.some((r) => r._id === '1M-3M')).toBe(true);
    expect(typeof report.revenueMinor).toBe('number');
  });

  test('les événements sont regroupés par statut, sans revenu ni fréquentation inventés', async () => {
    await Event.create({ name: 'Salon Immo', description: 'Description suffisamment longue pour la validation du modèle Event ici présent.', date: new Date(Date.now() + 86400000), location: 'Brazzaville', status: 'Publié' });
    const report = await getDomainReport('evenementiel', {});
    expect(report.eventsByStatus.some((r) => r._id === 'Publié')).toBe(true);
    expect(report.upcoming).toBeGreaterThanOrEqual(1);
    expect(report.revenueMinor).toBe(0);
  });
});

describe('reportingService — patrimoine (période)', () => {
  test('periodSupported est déclaré true pour Patrimoine et false pour Immobilier (jamais un filtre silencieusement ignoré)', async () => {
    const [patrimoine, immobilier] = await Promise.all([
      getDomainReport('patrimoine', { dateFrom: '2026-01-01', dateTo: '2026-01-31' }),
      getDomainReport('immobilier', {}),
    ]);
    expect(patrimoine.periodSupported).toBe(true);
    expect(immobilier.periodSupported).toBe(false);
  });
});

describe('reportingExportService — PDF/CSV', () => {
  test('buildCsv() produit un CSV valide avec en-tête et au moins une ligne par domaine sain', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const report = await getExecutiveReport({ user: admin });
    const csv = buildCsv(report);
    expect(csv).toContain('Domaine,Indicateur,Valeur');
    expect(csv.split('\n').length).toBeGreaterThan(1);
  });

  test('buildPdf() produit un buffer PDF non vide', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const report = await getExecutiveReport({ user: admin });
    const buffer = await buildPdf(report);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });
});

describe('HTTP /api/reporting — réservé à la Direction', () => {
  test('401 sans authentification', async () => {
    const res = await request(app).get('/api/reporting/executive');
    expect(res.status).toBe(401);
  });

  test('403 pour un rôle non-Direction (Secretaire)', async () => {
    const secretaire = await makeUser({ role: 'Secretaire' });
    const res = await request(app).get('/api/reporting/executive').set('Authorization', `Bearer ${signToken(secretaire._id)}`);
    expect(res.status).toBe(403);
  });

  test('200 pour un Admin, avec les 9 domaines', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const res = await request(app).get('/api/reporting/executive').set('Authorization', `Bearer ${signToken(admin._id)}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data.report.domains)).toEqual(DOMAINS);
  });

  test('GET /domains/:domain renvoie 404 pour un domaine inconnu, 200 pour un domaine valide', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const token = `Bearer ${signToken(admin._id)}`;
    const unknown = await request(app).get('/api/reporting/domains/inexistant').set('Authorization', token);
    expect(unknown.status).toBe(404);
    const known = await request(app).get('/api/reporting/domains/crm').set('Authorization', token);
    expect(known.status).toBe(200);
  });

  test('GET /export/csv et /export/pdf répondent avec les bons Content-Type', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const token = `Bearer ${signToken(admin._id)}`;
    const csvRes = await request(app).get('/api/reporting/export/csv').set('Authorization', token);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    const pdfRes = await request(app).get('/api/reporting/export/pdf').set('Authorization', token);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
  });
});
