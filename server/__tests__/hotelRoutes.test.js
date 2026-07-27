// __tests__/hotelRoutes.test.js — Sprint B2 (domaine Hôtellerie, modèles mockés)

jest.mock('../models/Accommodation');
jest.mock('../models/RatePlan');
jest.mock('../models/Property');
jest.mock('../models/User');
jest.mock('../models/Hotel');
jest.mock('../models/RoomCategory');
jest.mock('../models/SaleManagement');
jest.mock('../models/RentalManagement');
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../scripts/sync-facebook', () => ({ syncFacebook: jest.fn() }));
jest.mock('../services/zohoImapService', () => ({ pollZohoInbox: jest.fn() }));
jest.mock('../services/alerteService', () => ({ verifierPaiementsEnRetard: jest.fn() }));
jest.mock('../utils/generateSitemap', () => jest.fn().mockResolvedValue('<xml/>'));
jest.mock('../services/notificationService', () => ({
  notify: jest.fn().mockResolvedValue(),
  notifyStaff: jest.fn().mockResolvedValue(),
  notifyMany: jest.fn().mockResolvedValue(),
}));
jest.mock('../config/cloudinary', () => ({
  ...jest.requireActual('../config/cloudinary'),
  destroyFromCloudinary: jest.fn().mockResolvedValue(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const Accommodation = require('../models/Accommodation');
const RatePlan = require('../models/RatePlan');
const Property = require('../models/Property');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const SaleManagement = require('../models/SaleManagement');
const RentalManagement = require('../models/RentalManagement');

SaleManagement.findOne = jest.fn().mockResolvedValue(null);
RentalManagement.findOne = jest.fn().mockResolvedValue(null);
Accommodation.ACCOMMODATION_TYPES = ['villa_meublee', 'maison_meublee', 'appartement_meuble', 'studio_meuble', 'residence_meublee', 'bungalow', 'hotel', 'residence_hoteliere', 'chambre_hotes', 'autre'];
Accommodation.HOTEL_ACCOMMODATION_TYPES = ['hotel'];
RatePlan.RATE_MODES = ['nightly', 'weekly', 'monthly', 'yearly'];
RatePlan.RATE_TYPES = ['public', 'entreprise', 'weekend', 'promotion', 'haute_saison'];

const OWNER_ID = '507f1f77bcf86cd799439011';
const OTHER_OWNER_ID = '507f1f77bcf86cd799439099';
const ADMIN_ID = '507f1f77bcf86cd799439012';
const PROPERTY_ID = '507f191e810c19729de860ea';
const HOTEL_ID = '707f1f77bcf86cd799439055';
const CATEGORY_ID = '807f1f77bcf86cd799439066';

const makeToken = (id) => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const fakeUser = (id, role = 'Proprietaire') => ({
  _id: id, id, name: 'Test User', email: 'test@altitude.com',
  role, isActive: true, status: 'Actif', tokenVersion: 0,
});
const mockUserAuth = (id, role) => {
  User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(id, role)) });
  User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
};

describe('GET /api/hotels/public + /api/hotels/public/:id — pages publiques (Sprint B2)', () => {
  afterEach(() => jest.clearAllMocks());

  test('200 — liste publique, aucune authentification requise', async () => {
    Hotel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }) }),
    });
    const res = await request(app).get('/api/hotels/public');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.hotels).toEqual([]);
  });

  test('404 — fiche publique d\'un hôtel non publié', async () => {
    Hotel.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue({ publicationStatus: 'brouillon', active: true }) }),
    });
    const res = await request(app).get(`/api/hotels/public/${HOTEL_ID}`);
    expect(res.statusCode).toBe(404);
  });

  test('200 — fiche publique d\'un hôtel publié et actif', async () => {
    Hotel.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: HOTEL_ID, publicationStatus: 'publie', active: true,
          property: { statusAdmin: 'Validée', availability: 'Disponible' },
        }),
      }),
    });
    RoomCategory.find = jest.fn().mockResolvedValue([]);
    const res = await request(app).get(`/api/hotels/public/${HOTEL_ID}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.hotel._id).toBe(HOTEL_ID);
  });

  test('200 — la fiche publique ne renvoie que les champs sûrs (pas manager/createdBy/rejectionReason)', async () => {
    const selectSpy = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: HOTEL_ID, publicationStatus: 'publie', active: true,
        property: { statusAdmin: 'Validée', availability: 'Disponible' },
      }),
    });
    Hotel.findById = jest.fn().mockReturnValue({ select: selectSpy });
    RoomCategory.find = jest.fn().mockResolvedValue([]);
    await request(app).get(`/api/hotels/public/${HOTEL_ID}`);
    const projection = selectSpy.mock.calls[0][0];
    expect(projection).not.toMatch(/manager|createdBy|updatedBy|reviewedBy|rejectionReason|suspensionReason/);
  });
});

describe('POST /api/hotels/admin vs /api/hotels/mine — permissions de création (Sprint B2)', () => {
  afterEach(() => jest.clearAllMocks());

  test("403 — un propriétaire ne peut pas créer via /admin (réservé au staff)", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const res = await request(app)
      .post('/api/hotels/admin')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ name: 'Hôtel Test' });
    expect(res.statusCode).toBe(403);
  });

  test("422 — /api/hotels/mine sans nom est refusé", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const res = await request(app)
      .post('/api/hotels/mine')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ title: 'Annonce', description: 'x', price: 1000 });
    expect(res.statusCode).toBe(422);
    expect(res.body.message).toMatch(/nom de l'hôtel/i);
  });

  test("201 — un propriétaire crée son propre hôtel via /mine (owner forcé à req.user.id, jamais au body)", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Property.create = jest.fn().mockResolvedValue({ _id: PROPERTY_ID, title: 'Hôtel Test', images: [] });
    Hotel.create = jest.fn().mockResolvedValue({ _id: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, name: 'Hôtel Test' });
    Accommodation.create = jest.fn().mockResolvedValue({ _id: 'ACC-1' });

    const res = await request(app)
      .post('/api/hotels/mine')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({
        name: 'Hôtel Test', title: 'Annonce Hôtel Test', description: 'Un bel hôtel', price: 50000,
        owner: OTHER_OWNER_ID, // tentative d'usurpation — doit être ignorée
        address: JSON.stringify({ city: 'Brazzaville', arrondissement: 'Centre-ville' }),
      });
    expect(res.statusCode).toBe(201);
    const propertyCreateArg = Property.create.mock.calls[0][0];
    expect(propertyCreateArg.owner).toBe(OWNER_ID); // jamais OTHER_OWNER_ID
  });
});

describe('PATCH /api/hotels/:id/:action — décision admin (validate/reject/suspend/unsuspend) — Sprint B2', () => {
  afterEach(() => jest.clearAllMocks());

  const submitted = (overrides = {}) => ({
    _id: HOTEL_ID,
    publicationStatus: 'soumis',
    name: 'Hôtel Test',
    description: 'Un bel hôtel confortable',
    phone: '+242060000000',
    gallery: [{ url: 'a.jpg' }],
    hotelServices: { restaurant: true, bar: false, piscine: false, spa: false, salleSport: false, salleConference: false, navette: false, parking: false, reception24h: false, wifi: false },
    property: { _id: PROPERTY_ID, title: 'Hôtel Test', owner: OWNER_ID, address: { city: 'Brazzaville' }, images: ['a.jpg', 'b.jpg', 'c.jpg'] },
    save: jest.fn().mockResolvedValue(),
    ...overrides,
  });

  test('403 — un propriétaire (non staff) ne peut pas valider', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const res = await request(app)
      .patch(`/api/hotels/${HOTEL_ID}/validate`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({});
    expect(res.statusCode).toBe(403);
  });

  test('422 — un hôtel incomplet (aucune catégorie) ne peut pas être validé', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const hotel = submitted();
    Hotel.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(hotel) });
    RoomCategory.find = jest.fn().mockResolvedValue([]);
    const res = await request(app)
      .patch(`/api/hotels/${HOTEL_ID}/validate`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({});
    expect(res.statusCode).toBe(422);
    expect(res.body.completion.complete).toBe(false);
    expect(hotel.publicationStatus).toBe('soumis');
  });

  test('200 — un hôtel complet (avec catégorie + tarif actif) est validé, publicationStatus="publie"', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const hotel = submitted();
    Hotel.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(hotel) });
    RoomCategory.find = jest.fn().mockResolvedValue([{ _id: CATEGORY_ID }]);
    RatePlan.countDocuments = jest.fn().mockResolvedValue(1);
    Accommodation.updateMany = jest.fn().mockResolvedValue({});

    const res = await request(app)
      .patch(`/api/hotels/${HOTEL_ID}/validate`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({});
    expect(res.statusCode).toBe(200);
    expect(hotel.publicationStatus).toBe('publie');
    expect(hotel.publishedAt).not.toBeNull();
    expect(Accommodation.updateMany).toHaveBeenCalledWith({ hotel: HOTEL_ID }, { $set: { publicationStatus: 'publie' } });
  });

  test('200 — suspendre un hôtel publié (motif requis) puis le réactiver', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const hotel = submitted({ publicationStatus: 'publie' });
    Hotel.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(hotel) });
    Accommodation.updateMany = jest.fn().mockResolvedValue({});

    const noReason = await request(app)
      .patch(`/api/hotels/${HOTEL_ID}/suspend`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({});
    expect(noReason.statusCode).toBe(422);

    const res = await request(app)
      .patch(`/api/hotels/${HOTEL_ID}/suspend`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ reason: 'Signalement client' });
    expect(res.statusCode).toBe(200);
    expect(hotel.publicationStatus).toBe('suspendu');

    const unsuspend = await request(app)
      .patch(`/api/hotels/${HOTEL_ID}/unsuspend`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({});
    expect(unsuspend.statusCode).toBe(200);
    expect(hotel.publicationStatus).toBe('publie');
  });

  test('409 — impossible de suspendre un hôtel non publié', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Hotel.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(submitted({ publicationStatus: 'brouillon' })) });
    const res = await request(app)
      .patch(`/api/hotels/${HOTEL_ID}/suspend`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ reason: 'x' });
    expect(res.statusCode).toBe(409);
  });

  test('200 — validation normale : la synchronisation Accommodation réussit et aucun incident n\'est journalisé', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const hotel = submitted();
    Hotel.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(hotel) });
    RoomCategory.find = jest.fn().mockResolvedValue([{ _id: CATEGORY_ID }]);
    RatePlan.countDocuments = jest.fn().mockResolvedValue(1);
    Accommodation.updateMany = jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

    const res = await request(app)
      .patch(`/api/hotels/${HOTEL_ID}/validate`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({});
    expect(res.statusCode).toBe(200);
    expect(hotel.publicationStatus).toBe('publie');
  });

  test("200 — la décision reste actée même si la synchronisation Accommodation échoue (Hotel jamais bloqué par un incident de propagation)", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const hotel = submitted({ publicationStatus: 'publie' });
    Hotel.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(hotel) });
    // Simule une panne de synchronisation (ex : DB indisponible côté Accommodation).
    Accommodation.updateMany = jest.fn().mockRejectedValue(new Error('connection lost'));

    const res = await request(app)
      .patch(`/api/hotels/${HOTEL_ID}/suspend`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ reason: 'Signalement client' });
    // Hotel reste la source de vérité : la suspension est actée même si la
    // propagation vers Accommodation a échoué (divergence temporaire,
    // récupérable — voir le test de resynchronisation ci-dessous).
    expect(res.statusCode).toBe(200);
    expect(hotel.publicationStatus).toBe('suspendu');
  });
});

describe('POST /api/hotels/:id/resync — réconciliation manuelle après incident (Sprint B2)', () => {
  afterEach(() => jest.clearAllMocks());

  test('403 — un propriétaire ne peut pas déclencher une resynchronisation (réservé au staff)', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const res = await request(app)
      .post(`/api/hotels/${HOTEL_ID}/resync`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test("200 — reprise après erreur : un admin resynchronise un hôtel publié dont l'Accommodation était restée en divergence", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, publicationStatus: 'publie', active: true });
    Accommodation.updateMany = jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    const res = await request(app)
      .post(`/api/hotels/${HOTEL_ID}/resync`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(Accommodation.updateMany).toHaveBeenCalledWith(
      { hotel: HOTEL_ID },
      { $set: { active: true, publicationStatus: 'publie' } },
    );
    expect(res.body.data.modifiedCount).toBe(1);
  });

  test('500 — une resynchronisation qui échoue à son tour est rapportée explicitement (pas de faux succès)', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, publicationStatus: 'publie', active: true });
    Accommodation.updateMany = jest.fn().mockRejectedValue(new Error('still down'));
    const res = await request(app)
      .post(`/api/hotels/${HOTEL_ID}/resync`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(500);
  });
});

describe('Sprint B2 — cycle de vie propriétaire (deactivate/reactivate/duplicate/delete)', () => {
  afterEach(() => jest.clearAllMocks());

  const owned = (overrides = {}) => ({
    _id: HOTEL_ID, manager: OWNER_ID, active: true,
    save: jest.fn().mockResolvedValue(),
    ...overrides,
  });

  test('403 — un autre propriétaire ne peut pas désactiver', async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue(owned());
    const res = await request(app)
      .patch(`/api/hotels/${HOTEL_ID}/deactivate`)
      .set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('200 — le propriétaire désactive puis réactive son hôtel', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const hotel = owned();
    Hotel.findById = jest.fn().mockResolvedValue(hotel);
    Accommodation.updateMany = jest.fn().mockResolvedValue({});
    const res = await request(app)
      .patch(`/api/hotels/${HOTEL_ID}/deactivate`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(hotel.active).toBe(false);

    const res2 = await request(app)
      .patch(`/api/hotels/${HOTEL_ID}/reactivate`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res2.statusCode).toBe(200);
    expect(hotel.active).toBe(true);
  });

  test('200 — le propriétaire supprime définitivement son hôtel', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const property = { _id: PROPERTY_ID, images: [] };
    const hotelDoc = owned({ property });
    // F2.6.2 : le contrôleur appelle `.populate('property')` et le scope central appelle
    // `Hotel.findById` directement (sans populate) — le mock doit satisfaire les deux usages.
    Hotel.findById = jest.fn().mockReturnValue(Object.assign(Promise.resolve(hotelDoc), { populate: jest.fn().mockResolvedValue(hotelDoc) }));
    RoomCategory.find = jest.fn().mockResolvedValue([]);
    RatePlan.deleteMany = jest.fn().mockResolvedValue({});
    RoomCategory.deleteMany = jest.fn().mockResolvedValue({});
    Accommodation.deleteMany = jest.fn().mockResolvedValue({});
    Hotel.findByIdAndDelete = jest.fn().mockResolvedValue({});
    Property.findByIdAndDelete = jest.fn().mockResolvedValue({});

    const res = await request(app)
      .delete(`/api/hotels/${HOTEL_ID}`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(Hotel.findByIdAndDelete).toHaveBeenCalledWith(HOTEL_ID);
    expect(Property.findByIdAndDelete).toHaveBeenCalledWith(PROPERTY_ID);
  });
});

describe('GET /api/hotels/admin/list — Sprint B2 (dashboard admin, tous statuts)', () => {
  afterEach(() => jest.clearAllMocks());

  test('403 — un propriétaire ne peut pas lister tous les établissements', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const res = await request(app)
      .get('/api/hotels/admin/list')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('200 — un admin liste les établissements filtrés par statut', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const hotel = { _id: HOTEL_ID, publicationStatus: 'publie', property: { title: 'Hôtel Test' }, toObject() { return { ...this, toObject: undefined }; } };
    Hotel.find = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([hotel]) }) });
    RoomCategory.find = jest.fn().mockResolvedValue([]);
    const res = await request(app)
      .get('/api/hotels/admin/list?status=publie')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.hotels).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });
});

describe('RoomCategory — sécurité de lecture (contrôle final Sprint B2)', () => {
  afterEach(() => jest.clearAllMocks());

  test("403 — un utilisateur tiers ne peut pas lister les catégories d'un hôtel qui n'est pas le sien", async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app)
      .get(`/api/hotels/${HOTEL_ID}/room-categories`)
      .set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('200 — le propriétaire peut lister les catégories de son propre hôtel', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    RoomCategory.find = jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    const res = await request(app)
      .get(`/api/hotels/${HOTEL_ID}/room-categories`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
  });

  test("403 — un utilisateur tiers ne peut pas lister les tarifs d'une catégorie qui n'est pas la sienne", async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    RoomCategory.findById = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app)
      .get(`/api/hotels/room-categories/${CATEGORY_ID}/rate-plans`)
      .set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });
});

describe('RoomCategory CRUD — Sprint B2', () => {
  afterEach(() => jest.clearAllMocks());

  test("403 — un utilisateur non propriétaire de l'hôtel ne peut pas créer de catégorie", async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app)
      .post(`/api/hotels/${HOTEL_ID}/room-categories`)
      .set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`)
      .send({ name: 'Standard' });
    expect(res.statusCode).toBe(403);
  });

  test('201 — le propriétaire crée une catégorie', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    RoomCategory.create = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, name: 'Standard' });
    const res = await request(app)
      .post(`/api/hotels/${HOTEL_ID}/room-categories`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ name: 'Standard' });
    expect(res.statusCode).toBe(201);
  });

  test('422 — création sans nom refusée', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app)
      .post(`/api/hotels/${HOTEL_ID}/room-categories`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({});
    expect(res.statusCode).toBe(422);
    expect(RoomCategory.create).not.toHaveBeenCalled();
  });

  test('200 — suppression déclenche aussi la suppression des tarifs liés', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    RoomCategory.findById = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    RatePlan.deleteMany = jest.fn().mockResolvedValue({});
    RoomCategory.findByIdAndDelete = jest.fn().mockResolvedValue({});
    const res = await request(app)
      .delete(`/api/hotels/room-categories/${CATEGORY_ID}`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(RatePlan.deleteMany).toHaveBeenCalledWith({ roomCategory: CATEGORY_ID });
  });
});

describe('Tarifs par catégorie — un seul actif par type (Sprint B2)', () => {
  afterEach(() => jest.clearAllMocks());

  test('422 — rateType invalide refusé', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    RoomCategory.findById = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app)
      .post(`/api/hotels/room-categories/${CATEGORY_ID}/rate-plans`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ rateType: 'noel', amount: 1000 });
    expect(res.statusCode).toBe(422);
  });

  test("201 — un nouveau tarif 'public' désactive l'ancien tarif actif du même type avant de le créer", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    RoomCategory.findById = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    RatePlan.updateMany = jest.fn().mockResolvedValue({});
    RatePlan.create = jest.fn().mockResolvedValue({ _id: '907f1f77bcf86cd799439088', rateType: 'public', amount: 45000 });

    const res = await request(app)
      .post(`/api/hotels/room-categories/${CATEGORY_ID}/rate-plans`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ rateType: 'public', amount: 45000 });
    expect(res.statusCode).toBe(201);
    expect(RatePlan.updateMany).toHaveBeenCalledWith(
      { roomCategory: CATEGORY_ID, rateType: 'public', active: true },
      { $set: { active: false } },
    );
  });

  test('201 — C29 transmet les périodes datées et leur priorité au RatePlan', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    RoomCategory.findById = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    RatePlan.updateMany = jest.fn().mockResolvedValue({}); RatePlan.create = jest.fn().mockResolvedValue({ _id: 'rate-seasonal' });
    const seasonalPeriods = [{ label: 'Réveillon', startDate: '2026-12-31', endDate: '2027-01-02', amount: 85000, priority: 20 }];
    const res = await request(app).post(`/api/hotels/room-categories/${CATEGORY_ID}/rate-plans`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`).send({ rateType: 'public', amount: 35000, seasonalPeriods });
    expect(res.statusCode).toBe(201);
    expect(RatePlan.create).toHaveBeenCalledWith(expect.objectContaining({ seasonalPeriods: [expect.objectContaining({ label: 'Réveillon', amount: 85000, priority: 20 })] }));
  });

  test('200 — archiver un tarif le désactive (historique conservé)', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    RoomCategory.findById = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    RatePlan.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: '907f1f77bcf86cd799439088', active: false });
    const res = await request(app)
      .delete(`/api/hotels/room-categories/${CATEGORY_ID}/rate-plans/907f1f77bcf86cd799439088`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(RatePlan.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: '907f1f77bcf86cd799439088', roomCategory: CATEGORY_ID },
      { $set: { active: false } },
      { new: true },
    );
  });
});
