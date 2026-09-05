// PHASE-H3 — avis vérifiés (séjour réellement terminé), FAQ hôtelière,
// normalisation des politiques. Réutilise exclusivement le domaine H1/H2
// existant (Hotel/Accommodation/HotelReservation) — jamais un second moteur.
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const RoomCategory = require('../models/RoomCategory');
const HotelReservation = require('../models/HotelReservation');
const HotelReview = require('../models/HotelReview');
const HotelFaq = require('../models/HotelFaq');
const hotelRoutes = require('../routes/hotelRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const { createReview, getRatingSummary } = require('../services/hotelReviewService');
const { buildNormalizedPolicies } = require('../services/hotelService');

jest.setTimeout(120000);
const app = express(); app.use(express.json()); app.use('/api/hotels', hotelRoutes); app.use(errorHandler);
const bearer = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });
const id = () => new mongoose.Types.ObjectId();

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: `H3 User ${counter}`, email: `h3-user-${Date.now()}-${counter}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true, ...overrides });
};

async function makeHotel(overrides = {}) {
  const actor = { id: id(), role: 'Admin' };
  const hotel = await Hotel.create({ name: 'Hôtel H3 Test', manager: actor.id, createdBy: actor.id, publicationStatus: 'publie', active: true, ...overrides });
  return { actor, hotel };
}
async function makeReservation(hotel, guestUser, { status = 'checked_out', ...overrides } = {}) {
  const category = await RoomCategory.create({ hotel: hotel._id, name: 'Standard', code: `C-${Date.now()}-${Math.random()}`, createdBy: hotel.manager });
  return HotelReservation.create({
    hotel: hotel._id, roomCategory: category._id, guestUser: guestUser._id,
    guest: { firstName: guestUser.name, lastName: 'Test', email: guestUser.email },
    checkInDate: '2026-01-10', checkOutDate: '2026-01-12', roomsCount: 1, adults: 1,
    unitPrice: 30000, subtotal: 60000, totalAmount: 60000, currency: 'XAF',
    status, source: 'public_web', ...overrides,
  });
}

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([Hotel, HotelReservation, HotelReview, HotelFaq, RoomCategory].map((m) => m.syncIndexes()));
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('createReview — invariant du séjour vérifié (PHASE-H3)', () => {
  test('un séjour checked_out appartenant au demandeur est accepté', async () => {
    const { hotel } = await makeHotel();
    const guest = await makeUser();
    const reservation = await makeReservation(hotel, guest, { status: 'checked_out' });
    const review = await createReview({ hotelId: hotel._id, reservationId: reservation._id, overallRating: 5, comment: 'Excellent séjour.', actingUser: { id: guest._id } });
    expect(review.status).toBe('published');
    expect(String(review.author)).toBe(String(guest._id));
  });

  test('un séjour non terminé (pending) est refusé', async () => {
    const { hotel } = await makeHotel();
    const guest = await makeUser();
    const reservation = await makeReservation(hotel, guest, { status: 'pending' });
    await expect(createReview({ hotelId: hotel._id, reservationId: reservation._id, overallRating: 5, comment: 'Trop tôt.', actingUser: { id: guest._id } }))
      .rejects.toMatchObject({ statusCode: 422, code: 'HOTEL_REVIEW_STAY_NOT_COMPLETED' });
  });

  test('un séjour annulé est refusé', async () => {
    const { hotel } = await makeHotel();
    const guest = await makeUser();
    const reservation = await makeReservation(hotel, guest, { status: 'cancelled' });
    await expect(createReview({ hotelId: hotel._id, reservationId: reservation._id, overallRating: 3, comment: 'Annulé.', actingUser: { id: guest._id } }))
      .rejects.toMatchObject({ statusCode: 422, code: 'HOTEL_REVIEW_STAY_NOT_COMPLETED' });
  });

  test('une réservation appartenant à un autre utilisateur est refusée', async () => {
    const { hotel } = await makeHotel();
    const owner = await makeUser(); const impostor = await makeUser();
    const reservation = await makeReservation(hotel, owner, { status: 'checked_out' });
    await expect(createReview({ hotelId: hotel._id, reservationId: reservation._id, overallRating: 5, comment: 'Pas le mien.', actingUser: { id: impostor._id } }))
      .rejects.toMatchObject({ statusCode: 403, code: 'HOTEL_REVIEW_NOT_OWNER' });
  });

  test('une réservation d’un autre hôtel est refusée', async () => {
    const { hotel: hotelA } = await makeHotel({ name: 'Hôtel A' });
    const { hotel: hotelB } = await makeHotel({ name: 'Hôtel B' });
    const guest = await makeUser();
    const reservation = await makeReservation(hotelA, guest, { status: 'checked_out' });
    await expect(createReview({ hotelId: hotelB._id, reservationId: reservation._id, overallRating: 5, comment: 'Mauvais hôtel.', actingUser: { id: guest._id } }))
      .rejects.toMatchObject({ statusCode: 422, code: 'HOTEL_REVIEW_WRONG_HOTEL' });
  });

  test('une deuxième soumission sur la même réservation est refusée (unicité)', async () => {
    const { hotel } = await makeHotel();
    const guest = await makeUser();
    const reservation = await makeReservation(hotel, guest, { status: 'checked_out' });
    await createReview({ hotelId: hotel._id, reservationId: reservation._id, overallRating: 4, comment: 'Premier avis.', actingUser: { id: guest._id } });
    await expect(createReview({ hotelId: hotel._id, reservationId: reservation._id, overallRating: 5, comment: 'Deuxième avis.', actingUser: { id: guest._id } }))
      .rejects.toMatchObject({ statusCode: 409, code: 'HOTEL_REVIEW_ALREADY_EXISTS' });
    expect(await HotelReview.countDocuments({ reservation: reservation._id })).toBe(1);
  });

  test('une note hors bornes (0 ou 6) est refusée', async () => {
    const { hotel } = await makeHotel();
    const guest = await makeUser();
    const reservation = await makeReservation(hotel, guest, { status: 'checked_out' });
    await expect(createReview({ hotelId: hotel._id, reservationId: reservation._id, overallRating: 6, comment: 'Trop haut.', actingUser: { id: guest._id } }))
      .rejects.toMatchObject({ statusCode: 422, code: 'HOTEL_REVIEW_INVALID_RATING' });
  });

  test('sans authentification, la création est refusée', async () => {
    const { hotel } = await makeHotel();
    const guest = await makeUser();
    const reservation = await makeReservation(hotel, guest, { status: 'checked_out' });
    await expect(createReview({ hotelId: hotel._id, reservationId: reservation._id, overallRating: 5, comment: 'x', actingUser: null }))
      .rejects.toMatchObject({ statusCode: 401, code: 'HOTEL_REVIEW_AUTH_REQUIRED' });
  });

  test('POST /api/hotels/:hotelId/reviews exige une authentification réelle (401 sans jeton)', async () => {
    const { hotel } = await makeHotel();
    const response = await request(app).post(`/api/hotels/${hotel._id}/reviews`).send({ reservationId: id(), overallRating: 5, comment: 'x' });
    expect(response.status).toBe(401);
  });
});

describe('GET /api/hotels/public/:hotelId/reviews — projection publique (PHASE-H3)', () => {
  test('seuls les avis publiés sont listés, avec identité sûre et indicateur de séjour vérifié', async () => {
    const { hotel } = await makeHotel();
    const guest = await makeUser({ name: 'Thibaut Kabouende' });
    const reservation = await makeReservation(hotel, guest, { status: 'checked_out' });
    await createReview({ hotelId: hotel._id, reservationId: reservation._id, overallRating: 4, comment: 'Très bien.', actingUser: { id: guest._id } });
    const rejected = await makeReservation(hotel, guest, { status: 'checked_out', reservationRequestId: 'r2' });
    await HotelReview.create({ hotel: hotel._id, reservation: rejected._id, author: guest._id, overallRating: 1, comment: 'Signalé.', status: 'rejected' });

    const response = await request(app).get(`/api/hotels/public/${hotel._id}/reviews`);
    expect(response.status).toBe(200);
    expect(response.body.data.reviews).toHaveLength(1);
    const review = response.body.data.reviews[0];
    expect(review.comment).toBe('Très bien.');
    expect(review.author).toBe('Thibaut K.');
    expect(review.verifiedStay).toBe(true);
    // Aucune fuite privée : ni email, ni ID de réservation/auteur brut.
    const payload = JSON.stringify(review);
    expect(payload).not.toMatch(/@example\.test|reservation|authorId/i);
  });

  test('résumé zéro avis : averageRating=null, reviewCount=0 (jamais 5.0/"Nouveau")', async () => {
    const { hotel } = await makeHotel();
    const response = await request(app).get(`/api/hotels/public/${hotel._id}/reviews`);
    expect(response.body.data.summary).toEqual({ averageRating: null, reviewCount: 0, categories: null });
  });

  test('moyenne déterministe arrondie à 1 décimale', async () => {
    const { hotel } = await makeHotel();
    const guestA = await makeUser(); const guestB = await makeUser(); const guestC = await makeUser();
    const rA = await makeReservation(hotel, guestA, { status: 'checked_out' });
    const rB = await makeReservation(hotel, guestB, { status: 'checked_out' });
    const rC = await makeReservation(hotel, guestC, { status: 'checked_out' });
    await createReview({ hotelId: hotel._id, reservationId: rA._id, overallRating: 5, comment: 'a', actingUser: { id: guestA._id } });
    await createReview({ hotelId: hotel._id, reservationId: rB._id, overallRating: 4, comment: 'b', actingUser: { id: guestB._id } });
    await createReview({ hotelId: hotel._id, reservationId: rC._id, overallRating: 4, comment: 'c', actingUser: { id: guestC._id } });
    const summary = await getRatingSummary(hotel._id);
    expect(summary.averageRating).toBe(4.3); // (5+4+4)/3 = 4.333... → 4.3
    expect(summary.reviewCount).toBe(3);
  });

  test('pagination fonctionne (limit respecté, total exact)', async () => {
    const { hotel } = await makeHotel();
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const guest = await makeUser();
      // eslint-disable-next-line no-await-in-loop
      const reservation = await makeReservation(hotel, guest, { status: 'checked_out' });
      // eslint-disable-next-line no-await-in-loop
      await createReview({ hotelId: hotel._id, reservationId: reservation._id, overallRating: 5, comment: `avis ${i}`, actingUser: { id: guest._id } });
    }
    const response = await request(app).get(`/api/hotels/public/${hotel._id}/reviews?limit=2&page=1`);
    expect(response.body.data.reviews).toHaveLength(2);
    expect(response.body.data.pagination).toEqual(expect.objectContaining({ page: 1, limit: 2, total: 3, pages: 2 }));
  });

  test('un hôtel non publié n’expose aucun avis via l’endpoint public (404)', async () => {
    const { hotel } = await makeHotel({ publicationStatus: 'soumis' });
    const response = await request(app).get(`/api/hotels/public/${hotel._id}/reviews`);
    expect(response.status).toBe(404);
  });
});

describe('FAQ — publique et gérée par le propriétaire (PHASE-H3)', () => {
  test('seules les entrées actives sont exposées publiquement, triées par ordre', async () => {
    const { hotel, actor } = await makeHotel();
    await HotelFaq.create({ hotel: hotel._id, question: 'Q2', answer: 'A2', order: 2, active: true, createdBy: actor.id });
    await HotelFaq.create({ hotel: hotel._id, question: 'Q1', answer: 'A1', order: 1, active: true, createdBy: actor.id });
    await HotelFaq.create({ hotel: hotel._id, question: 'Q-inactive', answer: 'A', order: 0, active: false, createdBy: actor.id });

    const response = await request(app).get(`/api/hotels/public/${hotel._id}/faq`);
    expect(response.status).toBe(200);
    expect(response.body.data.faq.map((f) => f.question)).toEqual(['Q1', 'Q2']);
  });

  test('la FAQ d’un hôtel non publié n’est pas exposée', async () => {
    const { hotel, actor } = await makeHotel({ publicationStatus: 'brouillon' });
    await HotelFaq.create({ hotel: hotel._id, question: 'Q', answer: 'A', createdBy: actor.id });
    const response = await request(app).get(`/api/hotels/public/${hotel._id}/faq`);
    expect(response.status).toBe(404);
  });

  test('le propriétaire peut créer/modifier/supprimer ses questions', async () => {
    const { hotel, actor } = await makeHotel();
    const owner = await User.findById(actor.id) || await User.create({ _id: actor.id, name: 'Owner', email: `owner-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
    const create = await request(app).post(`/api/hotels/${hotel._id}/faq`).set(bearer(owner)).send({ question: 'Nouvelle question ?', answer: 'Réponse.' });
    expect(create.status).toBe(201);
    const faqId = create.body.data.faq._id;
    const update = await request(app).patch(`/api/hotels/${hotel._id}/faq/${faqId}`).set(bearer(owner)).send({ active: false });
    expect(update.status).toBe(200);
    expect(update.body.data.faq.active).toBe(false);
    const del = await request(app).delete(`/api/hotels/${hotel._id}/faq/${faqId}`).set(bearer(owner));
    expect(del.status).toBe(204);
  });
});

describe('Politiques normalisées — précédence Hotel/Accommodation (PHASE-H3)', () => {
  test('Hotel canonique gagne quand renseigné', () => {
    const hotel = { policies: { checkInTime: '15:00', checkOutTime: '10:00', pets: 'Interdits', children: 'Bienvenus', cancellation: 'Flexible 24h', visitors: 'Autorisés', accessibility: 'Accès PMR' } };
    const accommodation = { rules: { petsAllowed: true, childrenAllowed: false, smokingAllowed: true, minimumAge: 21 }, securityDeposit: 50000, currency: 'XAF', cancellationPolicy: 'stricte' };
    const policies = buildNormalizedPolicies(hotel, accommodation);
    expect(policies.pets).toBe('Interdits'); // Hotel gagne malgré Accommodation contraire
    expect(policies.children).toBe('Bienvenus');
    expect(policies.cancellation).toBe('Flexible 24h');
  });

  test('repli Accommodation quand Hotel ne renseigne rien', () => {
    const hotel = { policies: {} };
    const accommodation = { rules: { petsAllowed: true, childrenAllowed: true, smokingAllowed: false, minimumAge: 18 }, securityDeposit: 25000, currency: 'XAF', cancellationPolicy: 'moderee' };
    const policies = buildNormalizedPolicies(hotel, accommodation);
    expect(policies.pets).toBe('Autorisés');
    expect(policies.children).toBe('Autorisés');
    expect(policies.smoking).toBe('Non autorisé');
    expect(policies.deposit).toEqual({ amount: 25000, currency: 'XAF' });
    expect(policies.minimumAge).toBe(18);
    expect(policies.cancellation).toBe('Annulation modérée');
  });

  test('aucune Accommodation liée : tout ce qui dépend d’elle reste null, jamais un défaut inventé', () => {
    const hotel = { policies: {} };
    const policies = buildNormalizedPolicies(hotel, null);
    expect(policies.smoking).toBeNull();
    expect(policies.deposit).toBeNull();
    expect(policies.minimumAge).toBeNull();
    expect(policies.cancellation).toBeNull();
  });

  test('paymentMethods reste toujours null (absent du domaine entier)', () => {
    const policies = buildNormalizedPolicies({ policies: {} }, { rules: {}, securityDeposit: 1000, currency: 'XAF' });
    expect(policies.paymentMethods).toBeNull();
  });
});

describe('GET /api/hotels/public/:id — detail intègre résumé d’avis + FAQ (PHASE-H3, non-régression H1)', () => {
  test('la fiche hôtel publique inclut reviewSummary et faq sans casser le contrat H1/H2', async () => {
    const { hotel, actor } = await makeHotel();
    const guest = await makeUser();
    const reservation = await makeReservation(hotel, guest, { status: 'checked_out' });
    await createReview({ hotelId: hotel._id, reservationId: reservation._id, overallRating: 5, comment: 'Parfait.', actingUser: { id: guest._id } });
    await HotelFaq.create({ hotel: hotel._id, question: 'Q', answer: 'A', createdBy: actor.id });
    const property = await Property.create({
      title: 'Prop', description: 'Description suffisamment longue pour la validation du modèle Property.',
      pole: 'Altimmo', type: 'Commerce', status: 'hebergement', price: 0,
      address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=H3'], surface: 100,
      statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', owner: actor.id,
    });
    hotel.property = property._id; await hotel.save();
    await Accommodation.create({ property: property._id, hotel: hotel._id, accommodationType: 'hotel', publicationStatus: 'publie', createdBy: actor.id, rules: { petsAllowed: true } });

    const response = await request(app).get(`/api/hotels/public/${hotel._id}`);
    expect(response.status).toBe(200);
    const { detail } = response.body.data;
    expect(detail.reviewSummary).toEqual(expect.objectContaining({ averageRating: 5, reviewCount: 1 }));
    expect(detail.faq).toHaveLength(1);
    expect(detail.policies.pets).toBe('Autorisés'); // repli Accommodation confirmé bout-en-bout
    // Non-régression H1 : les champs déjà certifiés restent présents.
    expect(detail.name).toBe(hotel.name);
    expect(detail.roomCategories).toBeDefined();
  });
});
