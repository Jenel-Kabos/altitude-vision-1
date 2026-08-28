jest.mock('../utils/email', () => jest.fn().mockResolvedValue(true));
jest.mock('../services/notificationService', () => ({ notifyStaff: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../controllers/authController', () => ({
  protect: (req, res, next) => {
    req.user = { id: req.get('x-test-user-id'), role: req.get('x-test-role') };
    return next();
  },
  restrictTo: (...roles) => (req, res, next) => (
    roles.includes(req.user.role)
      ? next()
      : res.status(403).json({ status: 'fail', message: 'Forbidden' })
  ),
}));

const express = require('express');
const request = require('supertest');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Devis = require('../models/Devis');
const User = require('../models/User');
const devisRoutes = require('../routes/devisRoutes');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/devis', devisRoutes);

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function makeStaff() {
  return User.create({
    name: 'Staff Devis',
    email: `staff-devis-${Date.now()}@example.test`,
    password: 'Password123!',
    passwordConfirm: 'Password123!',
    role: 'Admin',
  });
}

describe('devisRoutes — caractérisation Mongo réelle', () => {
  test('POST persiste les valeurs et les defaults historiques', async () => {
    const response = await request(app).post('/api/devis').send({
      nom: 'Client Mongo',
      email: 'client-mongo@example.test',
      adresseBien: 'Poto-Poto',
      typeBien: 'Villa',
    });

    expect(response.statusCode).toBe(201);
    const persisted = await Devis.findById(response.body.data.devis._id).lean();
    expect(persisted).toEqual(expect.objectContaining({
      nom: 'Client Mongo',
      email: 'client-mongo@example.test',
      adresseBien: 'Poto-Poto',
      typeBien: 'Villa',
      nbBiens: 1,
      statut: 'En attente',
      noteInterne: '',
    }));
  });

  test('GET trie du plus récent au plus ancien et PATCH persiste statut/note/auteur', async () => {
    const staff = await makeStaff();
    const older = await Devis.create({
      nom: 'Ancien', email: 'ancien@example.test', adresseBien: 'A', typeBien: 'Villa', createdAt: new Date('2026-01-01'),
    });
    const newer = await Devis.create({
      nom: 'Nouveau', email: 'nouveau@example.test', adresseBien: 'B', typeBien: 'Studio', createdAt: new Date('2026-02-01'),
    });
    const headers = { 'x-test-role': 'Admin', 'x-test-user-id': String(staff._id) };

    const list = await request(app).get('/api/devis').set(headers);
    expect(list.statusCode).toBe(200);
    expect(list.body.results).toBe(2);
    expect(list.body.data.devis.map((item) => item._id)).toEqual([String(newer._id), String(older._id)]);

    const update = await request(app)
      .patch(`/api/devis/${older._id}`)
      .set(headers)
      .send({ statut: 'Traité', noteInterne: 'Appelé le client' });
    expect(update.statusCode).toBe(200);
    expect(update.body.data.devis).toEqual(expect.objectContaining({
      statut: 'Traité',
      noteInterne: 'Appelé le client',
    }));
    expect(update.body.data.devis.traitePar).toEqual(expect.objectContaining({ name: 'Staff Devis' }));

    const persisted = await Devis.findById(older._id).lean();
    expect(persisted.statut).toBe('Traité');
    expect(persisted.noteInterne).toBe('Appelé le client');
    expect(String(persisted.traitePar)).toBe(String(staff._id));
  });
});
