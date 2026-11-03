// ALTIMMO-E2E-IMMOBILIER-02 — régressions des anomalies prouvées par la certification de bout en bout
// IMMOBILIER-01 (D-01, D-02, D-03, D-05, D-06, D-07, D-12). Parcours HTTP réels (dépôt → modération →
// lecture publique), jamais de bien inséré directement « déjà publié » pour le cycle de publication :
// c'est précisément ce raccourci qui avait masqué D-01.
jest.mock('../config/cloudinary', () => ({
  ...jest.requireActual('../config/cloudinary'),
  uploadToCloudinary: jest.fn(async () => ({ secure_url: 'https://res.cloudinary.test/e2e-02.jpg' })),
}));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Transaction = require('../models/Transaction');
const PaiementTransaction = require('../models/PaiementTransaction');
const RealEstateReservation = require('../models/RealEstateReservation');
const PlatformOperator = require('../models/PlatformOperator');
const CommercialPublicationRevision = require('../models/CommercialPublicationRevision');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const { finalizeRealEstateTransaction } = require('../services/finance/realEstateTransactionFinalizationService');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);
const app = express();
app.use(express.json());
app.use('/api/properties', require('../routes/propertyRoutes'));
app.use('/api/real-estate-applications', require('../routes/realEstateApplicationRoutes'));
app.use(errorHandler);
const bearer = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

const INTERNAL_PUBLIC_KEYS = ['commissionRate', 'hasSpecialCommission', 'internalManagedOnly', 'reservationLock', 'hasReservationHistory',
  'publicationLifecycleHistory', 'publicationLifecycleState', 'approvedPublicSnapshot', 'currentPublicationRevision',
  'commercialPublicationVersion', 'documents', 'tenant', 'agent', 'likes', 'latitude', 'longitude', 'location'];

async function actors() {
  const make = (name, role) => User.create({
    name, email: `${name.replaceAll(' ', '-').toLowerCase()}-${Date.now()}-${Math.random()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true,
  });
  const owner = await make('Owner E2E 02', 'Proprietaire');
  const buyer = await make('Buyer E2E 02', 'Client');
  const operator = await make('Operator E2E 02', 'Admin');
  await PlatformOperator.create({ user: operator._id, capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES], grantedBy: operator._id, grantReason: 'TEST DATA E2E-IMMOBILIER-02' });
  return { owner, buyer, operator };
}

function depositWeb(owner, overrides = {}) {
  const fields = {
    title: 'Villa régression 02', description: 'Annonce fictive de régression.', price: '50000000', status: 'vente', type: 'Villa',
    surface: '180', bedrooms: '3', pole: 'Altimmo', latitude: '-4.27', longitude: '15.28',
    address: JSON.stringify({ street: 'Rue privée fictive', arrondissement: 'Poto-Poto', city: 'Brazzaville' }), ...overrides,
  };
  const req = request(app).post('/api/properties').set(bearer(owner));
  Object.entries(fields).forEach(([key, value]) => req.field(key, value));
  return req.attach('images', Buffer.from('fictive-image'), { filename: 'photo.png', contentType: 'image/png' });
}
const approve = (operator, id) => request(app).patch(`/api/properties/admin/${id}/validate`).set(bearer(operator)).send({ reason: 'Dossier vérifié (test).' });

describe('D-01 — approbation directe d’une annonce déposée', () => {
  test('dépôt web : révision rattachée, approbation 200, fiche publique 200', async () => {
    const { owner, operator } = await actors();
    const created = await depositWeb(owner);
    expect(created.status).toBe(201);
    const pending = await Property.findById(created.body.data.property._id);
    expect(pending).toMatchObject({ statusAdmin: 'En attente', publicationLifecycleState: 'pending', isPublished: false });
    expect(pending.currentPublicationRevision).toBeTruthy();
    const decision = await approve(operator, pending._id);
    expect(decision.status).toBe(200);
    const published = await Property.findById(pending._id);
    expect(published).toMatchObject({ statusAdmin: 'Validée', publicationLifecycleState: 'published', isPublished: true, commercialPublicationVersion: 1 });
    const revision = await CommercialPublicationRevision.findById(published.currentPublicationRevision);
    expect(revision.status).toBe('approved');
    expect((await request(app).get(`/api/properties/${pending._id}`)).status).toBe(200);
  });

  test('dépôt mobile : approbation directe 200', async () => {
    const { owner, operator } = await actors();
    const created = await request(app).post('/api/properties/mobile').set(bearer(owner)).send({
      titre: 'Maison mobile 02', description: 'Annonce mobile fictive.', prix: 30000000, superficie: 120, chambres: 2,
      ville: 'Brazzaville', arrondissement: 'Moungali', type: 'Maison', categorie: 'vente', photos: ['https://res.cloudinary.test/m.jpg'],
      latitude: -4.26, longitude: 15.27,
    });
    expect(created.status).toBe(201);
    expect((await approve(operator, created.body.data.property._id)).status).toBe(200);
  });

  test('correction après rejet puis approbation ; deux décisions simultanées : une seule promotion', async () => {
    const { owner, operator } = await actors();
    const created = await depositWeb(owner);
    const id = created.body.data.property._id;
    expect((await request(app).patch(`/api/properties/admin/${id}/reject`).set(bearer(operator)).send({ reason: 'Photos insuffisantes.' })).status).toBe(200);
    expect((await request(app).get(`/api/properties/${id}`)).status).toBe(403);
    expect((await request(app).put(`/api/properties/${id}`).set(bearer(owner)).send({ description: 'Annonce fictive corrigée.' })).status).toBe(200);
    const decisions = await Promise.all([approve(operator, id), approve(operator, id)]);
    expect(decisions.map((x) => x.status).sort()).toEqual([200, 409]);
    expect((await Property.findById(id)).commercialPublicationVersion).toBe(1);
  });
});

describe('D-02 — liste blanche des champs modifiables', () => {
  test('les champs internes sont ignorés, la modification légitime est soumise à révision', async () => {
    const { owner, operator } = await actors();
    const id = (await depositWeb(owner)).body.data.property._id;
    await approve(operator, id);
    const response = await request(app).put(`/api/properties/${id}`).set(bearer(owner)).send({
      title: 'Villa régression 02 — nouveau titre', hasSpecialCommission: true, commissionRate: 50, internalManagedOnly: true,
      recommande: true, approvedPublicSnapshot: { title: 'NON MODÉRÉ', price: 1 }, publicationLifecycleState: 'published',
      reservationLock: { active: true }, owner: String(new mongoose.Types.ObjectId()), commercialPublicationVersion: 99,
      'reservationLock.active': true, inconnu: 'x',
    });
    expect(response.status).toBe(200);
    const property = await Property.findById(id).lean();
    expect(property).toMatchObject({ hasSpecialCommission: false, commissionRate: 5, internalManagedOnly: false, recommande: false, commercialPublicationVersion: 1, publicationLifecycleState: 'change_pending', isPublished: false });
    expect(String(property.owner)).toBe(String(owner._id));
    expect(property.approvedPublicSnapshot.title).toBe('Villa régression 02');
    expect(property.inconnu).toBeUndefined();
    expect((await request(app).get(`/api/properties/${id}`)).status).toBe(403);
    expect((await approve(operator, id)).status).toBe(200);
    expect((await request(app).get(`/api/properties/${id}`)).body.data.property.title).toBe('Villa régression 02 — nouveau titre');
  });
});

describe('D-03 — projection publique stricte', () => {
  test('liste et fiche anonymes sans champ interne ni rue exacte', async () => {
    const { owner, operator } = await actors();
    const id = (await depositWeb(owner)).body.data.property._id;
    await approve(operator, id);
    const list = await request(app).get('/api/properties?offerType=vente');
    const detail = await request(app).get(`/api/properties/${id}`);
    for (const item of [list.body.data.properties[0], detail.body.data.property]) {
      expect(item).toBeTruthy();
      for (const key of INTERNAL_PUBLIC_KEYS) expect(item[key]).toBeUndefined();
      expect(item.address.street).toBeUndefined();
      expect(item.address).toMatchObject({ arrondissement: 'Poto-Poto', city: 'Brazzaville' });
      expect(item).toMatchObject({ title: 'Villa régression 02', price: 50000000, type: 'Villa' });
    }
    expect(typeof list.body.data.properties[0].owner).toBe('undefined');
    expect(Object.keys(detail.body.data.property.owner).sort()).toEqual(['name', 'photo']);
  });
});

async function openSale({ owner, buyer, operator, amount = 60000000 }) {
  const id = (await depositWeb(owner, { price: String(amount) })).body.data.property._id;
  await approve(operator, id);
  const reservation = await RealEstateReservation.create({ property: id, client: buyer._id, application: new mongoose.Types.ObjectId(), type: 'sale', status: 'active', idempotencyKey: `e2e-02-${new mongoose.Types.ObjectId()}`, expiresAt: new Date(Date.now() + 86400000), history: [] });
  await Property.updateOne({ _id: id }, { $set: { availability: 'Réservé', reservationLock: { reservation: reservation._id, lockedAt: new Date(), expiresAt: reservation.expiresAt } } });
  const transaction = await Transaction.create({ property: id, client: buyer._id, agent: operator._id, reservation: reservation._id, finalAmount: amount, transactionType: 'vente', commission: { taux: 10, total: amount / 10, ownerPayout: 0, agencyNet: amount / 10 }, status: 'Paiement en attente', paymentStatus: 'confirmé' });
  await RealEstateReservation.updateOne({ _id: reservation._id }, { $set: { transaction: transaction._id } });
  return { id, reservation, transaction };
}

describe('D-05 / D-06 / D-07 — intégrité de la transaction', () => {
  test('D-05 : un statut « confirmé » sans encaissements couvrant le prix ne finalise pas', async () => {
    const actorsSet = await actors();
    const { transaction } = await openSale(actorsSet);
    await PaiementTransaction.create({ transaction: transaction._id, initiéPar: actorsSet.operator._id, montant: 1, methode: 'especes', provider: 'Espèces', statut: 'confirmé' });
    await expect(finalizeRealEstateTransaction({ transactionId: transaction._id, actorId: actorsSet.operator._id })).rejects.toMatchObject({ code: 'PAYMENT_BALANCE_INSUFFICIENT' });
    expect((await Transaction.findById(transaction._id)).status).toBe('Paiement en attente');
  });

  test('D-06 : ni le client ni le propriétaire n’annulent une réservation liée à une transaction', async () => {
    const actorsSet = await actors();
    const { id, reservation } = await openSale(actorsSet);
    const attempts = await Promise.all([
      request(app).post(`/api/real-estate-applications/reservations/${reservation._id}/cancel`).set(bearer(actorsSet.buyer)).send({ reason: 'x' }),
      request(app).post(`/api/real-estate-applications/reservations/${reservation._id}/cancel`).set(bearer(actorsSet.owner)).send({ reason: 'x' }),
    ]);
    expect(attempts.map((x) => x.status)).toEqual([409, 409]);
    expect((await RealEstateReservation.findById(reservation._id)).status).toBe('active');
    expect((await Property.findById(id)).availability).toBe('Réservé');
  });

  test('D-07 : un bien vendu ne revient pas sur le marché', async () => {
    const actorsSet = await actors();
    const { id, transaction } = await openSale(actorsSet);
    await PaiementTransaction.create({ transaction: transaction._id, initiéPar: actorsSet.operator._id, montant: transaction.finalAmount, methode: 'especes', provider: 'Espèces', statut: 'confirmé' });
    await finalizeRealEstateTransaction({ transactionId: transaction._id, actorId: actorsSet.operator._id });
    expect((await Property.findById(id)).availability).toBe('Vendu');
    const edit = await request(app).put(`/api/properties/${id}`).set(bearer(actorsSet.owner)).send({ availability: 'Disponible' });
    const reactivation = await request(app).post(`/api/properties/${id}/reactivation`).set(bearer(actorsSet.owner)).send({ reason: 'revente' });
    const withdraw = await request(app).patch(`/api/properties/${id}/lifecycle`).set(bearer(actorsSet.owner)).send({ availability: 'Retiré', reason: 'x' });
    expect([edit.status, reactivation.status, withdraw.status]).toEqual([409, 409, 409]);
    expect(await Property.findById(id)).toMatchObject({ availability: 'Vendu', isPublished: false });
  });
});

test('D-12 : un identifiant de dossier invalide répond 400 sans rester pendant', async () => {
  const { buyer } = await actors();
  const response = await request(app).get('/api/real-estate-applications/pas-un-id').set(bearer(buyer)).timeout(5000);
  expect(response.status).toBe(400);
});
