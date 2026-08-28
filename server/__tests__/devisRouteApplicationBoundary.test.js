jest.mock('../models/Devis');
jest.mock('../utils/email', () => jest.fn());
jest.mock('../services/notificationService', () => ({ notifyStaff: jest.fn() }));
jest.mock('../controllers/authController', () => ({
  protect: (req, res, next) => {
    const role = req.get('x-test-role');
    if (!role) return res.status(401).json({ status: 'fail', message: 'Unauthenticated' });
    req.user = { id: '507f1f77bcf86cd799439011', role };
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
const Devis = require('../models/Devis');
const sendEmail = require('../utils/email');
const { notifyStaff } = require('../services/notificationService');
const devisRoutes = require('../routes/devisRoutes');

const app = express();
app.use(express.json());
app.use('/api/devis', devisRoutes);

const validPayload = {
  nom: 'Ada Client',
  email: 'ada@example.test',
  telephone: '+242061112233',
  adresseBien: 'Bacongo',
  typeBien: 'Appartement',
  surface: 85,
  loyerSouhaite: 350000,
  nbBiens: 2,
  message: 'Merci de me rappeler.',
};

describe('devisRoutes — contrat historique avant/après extraction', () => {
  let errorSpy;
  let logSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    sendEmail.mockResolvedValue(true);
    notifyStaff.mockResolvedValue(undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  test('POST rejette les champs obligatoires manquants sans accès modèle ni side effect', async () => {
    const response = await request(app).post('/api/devis').send({ nom: 'Ada' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      status: 'fail',
      message: 'Champs obligatoires manquants : nom, email, adresse du bien, type de bien.',
    });
    expect(Devis.create).not.toHaveBeenCalled();
    expect(notifyStaff).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('POST persiste les mêmes champs puis conserve notification, email et réponse 201', async () => {
    const saved = { _id: 'devis-1', ...validPayload, statut: 'En attente' };
    Devis.create.mockResolvedValue(saved);

    const response = await request(app).post('/api/devis').send(validPayload);

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({
      status: 'success',
      message: 'Votre demande de devis a été envoyée ! Notre équipe vous contactera sous 24h.',
      data: { devis: saved },
    });
    expect(Devis.create).toHaveBeenCalledWith(validPayload);
    expect(notifyStaff).toHaveBeenCalledWith({
      type: 'devis_received',
      title: 'Nouvelle demande de devis de Ada Client',
      body: 'Appartement à Bacongo',
      data: { screen: 'Devis' },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toEqual(expect.objectContaining({
      email: process.env.ZOHO_FROM_EMAIL || 'support@altitudevision.agency',
      subject: '🏢 Nouvelle demande de devis — Appartement à Bacongo',
    }));
  });

  test('POST conserve le succès lorsque l’email best-effort échoue', async () => {
    const saved = { _id: 'devis-2', ...validPayload };
    Devis.create.mockResolvedValue(saved);
    sendEmail.mockRejectedValue(new Error('provider unavailable'));

    const response = await request(app).post('/api/devis').send(validPayload);

    expect(response.statusCode).toBe(201);
    expect(response.body.data.devis).toEqual(saved);
    expect(errorSpy).toHaveBeenCalledWith(
      "❌ [Devis] Échec de l'email de notification (devis conservé):",
      'provider unavailable'
    );
  });

  test('POST conserve l’erreur 500 si la création échoue et ne déclenche aucun side effect', async () => {
    Devis.create.mockRejectedValue(new Error('mongo down'));

    const response = await request(app).post('/api/devis').send(validPayload);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      status: 'error',
      message: "Erreur lors de l'envoi de votre demande. Veuillez réessayer.",
    });
    expect(notifyStaff).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('GET anonyme est bloqué avant la query', async () => {
    const response = await request(app).get('/api/devis');
    expect(response.statusCode).toBe(401);
    expect(Devis.find).not.toHaveBeenCalled();
  });

  test('GET rôle refusé est bloqué avant la query', async () => {
    const response = await request(app).get('/api/devis').set('x-test-role', 'Client');
    expect(response.statusCode).toBe(403);
    expect(Devis.find).not.toHaveBeenCalled();
  });

  test('GET staff conserve populate, tri et body', async () => {
    const rows = [{ _id: 'devis-2' }, { _id: 'devis-1' }];
    const sort = jest.fn().mockResolvedValue(rows);
    const populate = jest.fn().mockReturnValue({ sort });
    Devis.find.mockReturnValue({ populate });

    const response = await request(app).get('/api/devis').set('x-test-role', 'Admin');

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ status: 'success', results: 2, data: { devis: rows } });
    expect(Devis.find).toHaveBeenCalledWith();
    expect(populate).toHaveBeenCalledWith('traitePar', 'name');
    expect(sort).toHaveBeenCalledWith('-createdAt');
  });

  test('GET conserve l’erreur 500 de query', async () => {
    const sort = jest.fn().mockRejectedValue(new Error('query failed'));
    Devis.find.mockReturnValue({ populate: jest.fn().mockReturnValue({ sort }) });

    const response = await request(app).get('/api/devis').set('x-test-role', 'Collaborateur');

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ status: 'error', message: 'Erreur lors de la récupération des demandes.' });
  });

  test('PATCH conserve 404 lorsque le devis est absent', async () => {
    Devis.findById.mockResolvedValue(null);

    const response = await request(app)
      .patch('/api/devis/507f1f77bcf86cd799439012')
      .set('x-test-role', 'Admin')
      .send({ statut: 'Traité' });

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ status: 'fail', message: 'Demande de devis introuvable.' });
  });

  test('PATCH modifie seulement les champs fournis, attribue le staff, sauvegarde puis populate', async () => {
    const document = {
      statut: 'En attente',
      noteInterne: 'inchangée',
      save: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockResolvedValue(undefined),
      toJSON() {
        return { statut: this.statut, noteInterne: this.noteInterne, traitePar: this.traitePar };
      },
    };
    Devis.findById.mockResolvedValue(document);

    const response = await request(app)
      .patch('/api/devis/507f1f77bcf86cd799439012')
      .set('x-test-role', 'Collaborateur')
      .send({ statut: 'En cours' });

    expect(response.statusCode).toBe(200);
    expect(document.statut).toBe('En cours');
    expect(document.noteInterne).toBe('inchangée');
    expect(document.traitePar).toBe('507f1f77bcf86cd799439011');
    expect(document.save).toHaveBeenCalledTimes(1);
    expect(document.populate).toHaveBeenCalledWith('traitePar', 'name');
    expect(response.body.data.devis).toEqual({
      statut: 'En cours',
      noteInterne: 'inchangée',
      traitePar: '507f1f77bcf86cd799439011',
    });
  });
});
