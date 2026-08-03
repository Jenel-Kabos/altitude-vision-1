// DOC-EVO-1 — Moteur générique de dossier métier : agrégation en lecture
// seule sur les modèles existants, jamais une nouvelle collection ni une
// copie de données. Couvre les 4 adaptateurs enregistrés
// (gestion_locative/vente_location/hebergement/hotellerie), leur RBAC et la
// forme de l'enveloppe uniforme (résumé/sections/timeline/statut).
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Proprietaire = require('../models/Proprietaire');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');
const RentalManagement = require('../models/RentalManagement');
const Paiement = require('../models/Paiement');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const Transaction = require('../models/Transaction');
const RealEstateReservation = require('../models/RealEstateReservation');
const Document = require('../models/Document');
const FinancialDocument = require('../models/FinancialDocument');
const dossierRoutes = require('../routes/dossierRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();

const app = express();
app.use(express.json());
app.use('/api/dossiers', dossierRoutes);
app.use(errorHandler);

const signToken = (userId, tokenVersion = 0) => jwt.sign({ id: userId, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Test User', email: `dossier${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('domaine inconnu : 404 explicite, jamais un crash', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const res = await request(app).get(`/api/dossiers/inexistant/${id()}`).set('Authorization', `Bearer ${signToken(admin._id)}`);
  expect(res.status).toBe(404);
  expect(res.body.code).toBe('DOSSIER_DOMAIN_UNKNOWN');
});

test('401 sans authentification, quel que soit le domaine', async () => {
  const res = await request(app).get(`/api/dossiers/gestion_locative/${id()}`);
  expect(res.status).toBe(401);
});

describe('gestion_locative — dossier bail complet', () => {
  async function buildLease() {
    const owner = await makeUser({ role: 'Proprietaire' });
    const tenantUser = await makeUser({ role: 'Client' });
    const property = await Property.create({
      title: 'Villa Dossier Test', description: 'Description suffisamment longue pour la validation du modèle Property.',
      pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
      address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
      statusAdmin: 'Validée', availability: 'Loué', owner: owner._id,
    });
    const proprietaire = await Proprietaire.create({ nom: 'Nkounkou', prenom: 'Alice', telephone: '+242060000010' });
    const locataire = await Locataire.create({ nom: 'Moke', prenom: 'Paul', telephone: '+242060000011', user: tenantUser._id });
    const contrat = await Contrat.create({
      type: 'location', bien: property._id, proprietaire: proprietaire._id, locataire: locataire._id, statut: 'actif',
      dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000,
      documents: [{ nom: 'Bail signé', type: 'bail', url: 'https://cdn.test/bail.pdf', dateGeneration: new Date('2027-01-01') }],
    });
    await RentalManagement.create({ property: property._id, owner: owner._id, managementActivated: true, occupancyStatus: 'occupe', activeLease: contrat._id });
    await Paiement.create({ contrat: contrat._id, mois: 1, annee: 2027, montant: 300000, statut: 'payé', datePaiement: new Date('2027-01-05') });
    await RentalMaintenanceTicket.create({ property: property._id, lease: contrat._id, category: 'plomberie', description: 'Fuite évier' });
    await Document.create({ type: "Pièce d'identité", status: 'Accepté', refType: 'Locataire', refId: locataire._id, refNom: 'Paul Moke', content: 'https://cdn.test/cni.pdf' });
    return { owner, tenantUser, property, proprietaire, locataire, contrat };
  }

  test('le staff voit le dossier complet (documents, paiements, maintenance, timeline triée, statut Actif)', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const { contrat } = await buildLease();
    const res = await request(app).get(`/api/dossiers/gestion_locative/${contrat._id}`).set('Authorization', `Bearer ${signToken(admin._id)}`);
    expect(res.status).toBe(200);
    const { dossier } = res.body.data;
    expect(dossier.status).toBe('Actif');
    expect(dossier.sections.find((s) => s.key === 'documents').items.length).toBeGreaterThanOrEqual(2);
    expect(dossier.sections.find((s) => s.key === 'paiements').items).toHaveLength(1);
    expect(dossier.sections.find((s) => s.key === 'maintenance').items).toHaveLength(1);
    expect(dossier.relatedLinks.map((l) => l.entityType)).toEqual(expect.arrayContaining(['Property', 'Proprietaire', 'Locataire']));
    const dates = dossier.timeline.map((e) => new Date(e.date).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });

  test('le locataire rattaché voit son propre dossier', async () => {
    const { tenantUser, contrat } = await buildLease();
    const res = await request(app).get(`/api/dossiers/gestion_locative/${contrat._id}`).set('Authorization', `Bearer ${signToken(tenantUser._id)}`);
    expect(res.status).toBe(200);
  });

  test('un locataire tiers (autre dossier) est refusé — 403, jamais de fuite', async () => {
    const { contrat } = await buildLease();
    const other = await makeUser({ role: 'Client' });
    const res = await request(app).get(`/api/dossiers/gestion_locative/${contrat._id}`).set('Authorization', `Bearer ${signToken(other._id)}`);
    expect(res.status).toBe(403);
  });

  test('le propriétaire du bien voit le dossier', async () => {
    const { owner, contrat } = await buildLease();
    const res = await request(app).get(`/api/dossiers/gestion_locative/${contrat._id}`).set('Authorization', `Bearer ${signToken(owner._id)}`);
    expect(res.status).toBe(200);
  });

  test('dossier introuvable : 404', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const res = await request(app).get(`/api/dossiers/gestion_locative/${id()}`).set('Authorization', `Bearer ${signToken(admin._id)}`);
    expect(res.status).toBe(404);
  });
});

describe('vente_location — dossier transaction', () => {
  test('le staff voit le dossier, avec la facture de finalisation en section documents', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await Property.create({
      title: 'Villa Vente Dossier', description: 'Description suffisamment longue pour la validation du modèle Property.',
      pole: 'Altimmo', type: 'Villa', status: 'vente', price: 50000000,
      address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Test'], surface: 200,
      statusAdmin: 'Validée', availability: 'Vendu', owner: agent._id,
    });
    const reservationId = id();
    const transactionId = id();
    await RealEstateReservation.collection.insertOne({ _id: reservationId, property: property._id, client: client._id, application: id(), type: 'sale', status: 'converted', expiresAt: new Date(Date.now() + 60000), idempotencyKey: `dossier-test-${transactionId}`, transaction: transactionId, history: [], createdAt: new Date(), updatedAt: new Date() });
    const invoice = await Document.create({ type: 'Facture', status: 'Envoyé', client: client._id, totalAmount: 5000000, pole: 'Altimmo', service: 'vente', categorie: 'Factures', entityType: 'Transaction', entityId: transactionId });
    await Transaction.collection.insertOne({ _id: transactionId, property: property._id, client: client._id, agent: agent._id, reservation: reservationId, finalAmount: 50000000, transactionType: 'vente', commission: { taux: 10, total: 5000000, ownerPayout: 0, agencyNet: 5000000 }, status: 'Réussie', paymentStatus: 'confirmé', linkedInvoice: invoice._id, paiements: [], createdAt: new Date(), updatedAt: new Date() });

    const res = await request(app).get(`/api/dossiers/vente_location/${transactionId}`).set('Authorization', `Bearer ${signToken(admin._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.dossier.status).toBe('Terminé');
    expect(res.body.data.dossier.sections[0].items).toHaveLength(1);
  });

  test('le client de la transaction voit son propre dossier ; un tiers est refusé', async () => {
    const client = await makeUser({ role: 'Client' });
    const stranger = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await Property.create({
      title: 'Villa Vente Dossier 2', description: 'Description suffisamment longue pour la validation du modèle Property.',
      pole: 'Altimmo', type: 'Villa', status: 'vente', price: 50000000,
      address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Test'], surface: 200,
      statusAdmin: 'Validée', availability: 'Disponible', owner: agent._id,
    });
    const reservationId = id();
    const transactionId = id();
    await RealEstateReservation.collection.insertOne({ _id: reservationId, property: property._id, client: client._id, application: id(), type: 'sale', status: 'active', expiresAt: new Date(Date.now() + 60000), idempotencyKey: `dossier-test-b-${transactionId}`, transaction: transactionId, history: [], createdAt: new Date(), updatedAt: new Date() });
    await Transaction.collection.insertOne({ _id: transactionId, property: property._id, client: client._id, agent: agent._id, reservation: reservationId, finalAmount: 50000000, transactionType: 'vente', commission: { taux: 10, total: 0, ownerPayout: 0, agencyNet: 0 }, status: 'Paiement en attente', paymentStatus: 'en_attente', paiements: [], createdAt: new Date(), updatedAt: new Date() });

    const okRes = await request(app).get(`/api/dossiers/vente_location/${transactionId}`).set('Authorization', `Bearer ${signToken(client._id)}`);
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.dossier.status).toBe('En cours');

    const deniedRes = await request(app).get(`/api/dossiers/vente_location/${transactionId}`).set('Authorization', `Bearer ${signToken(stranger._id)}`);
    expect(deniedRes.status).toBe(403);
  });
});

describe('hebergement / hotellerie — dossiers légers (FinancialDocument, jamais dupliqué)', () => {
  test('hebergement : le staff et l’invité voient le dossier, un tiers est refusé', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const guest = await makeUser({ role: 'Client' });
    const stranger = await makeUser({ role: 'Client' });
    const ownerUser = await makeUser({ role: 'Proprietaire' });
    const accommodationId = id();
    const reservationId = id();
    await FinancialDocument.create({
      domain: 'real_estate', establishmentType: 'Accommodation', establishmentId: accommodationId, documentType: 'invoice',
      status: 'issued', currency: 'XAF', subjectType: 'AccommodationReservation', subjectId: reservationId,
      totalMinor: 1000000, businessOperationKey: `dossier-test-acc-${reservationId}`, createdBy: admin._id,
    });
    await mongoose.connection.collection('accommodationreservations').insertOne({
      _id: reservationId, accommodation: accommodationId, guest: guest._id, owner: ownerUser._id,
      checkInDate: new Date('2027-03-01'), checkOutDate: new Date('2027-03-05'), nights: 4, guestCount: 2, adults: 2, children: 0,
      status: 'confirmed', totalAmount: 10000, remainingAmount: 0, createdBy: admin._id, createdAt: new Date(), updatedAt: new Date(),
    });

    const staffRes = await request(app).get(`/api/dossiers/hebergement/${reservationId}`).set('Authorization', `Bearer ${signToken(admin._id)}`);
    expect(staffRes.status).toBe(200);
    expect(staffRes.body.data.dossier.sections[0].items).toHaveLength(1);

    const guestRes = await request(app).get(`/api/dossiers/hebergement/${reservationId}`).set('Authorization', `Bearer ${signToken(guest._id)}`);
    expect(guestRes.status).toBe(200);

    const strangerRes = await request(app).get(`/api/dossiers/hebergement/${reservationId}`).set('Authorization', `Bearer ${signToken(stranger._id)}`);
    expect(strangerRes.status).toBe(403);
  });

  test('hotellerie : réservé au staff (aucun compte lié au client hôtelier)', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const client = await makeUser({ role: 'Client' });
    const hotelId = id();
    const reservationId = id();
    await mongoose.connection.collection('hotels').insertOne({ _id: hotelId, name: 'Hotel Dossier Test', createdBy: admin._id, createdAt: new Date(), updatedAt: new Date() });
    await FinancialDocument.create({
      domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotelId, documentType: 'invoice',
      status: 'issued', currency: 'XAF', subjectType: 'HotelReservation', subjectId: reservationId,
      totalMinor: 500000, businessOperationKey: `dossier-test-hotel-${reservationId}`, createdBy: admin._id,
    });
    await mongoose.connection.collection('hotelreservations').insertOne({
      _id: reservationId, hotel: hotelId, roomCategory: id(), guest: { firstName: 'Jean', lastName: 'Test', email: 'jean@test.example' },
      checkInDate: new Date('2027-04-01'), checkOutDate: new Date('2027-04-03'), roomsCount: 1, adults: 1,
      unitPrice: 50000, subtotal: 100000, totalAmount: 100000, status: 'confirmed', source: 'direct', createdAt: new Date(), updatedAt: new Date(),
    });

    const staffRes = await request(app).get(`/api/dossiers/hotellerie/${reservationId}`).set('Authorization', `Bearer ${signToken(admin._id)}`);
    expect(staffRes.status).toBe(200);
    expect(staffRes.body.data.dossier.sections[0].items).toHaveLength(1);

    const clientRes = await request(app).get(`/api/dossiers/hotellerie/${reservationId}`).set('Authorization', `Bearer ${signToken(client._id)}`);
    expect(clientRes.status).toBe(403);
  });
});
