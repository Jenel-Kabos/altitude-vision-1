// __tests__/visiteRoutes.test.js
// Tests d'intégration des routes de visites (modèles mockés)

jest.mock('../models/Visite');
jest.mock('../models/Property');
jest.mock('../models/User');
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../scripts/sync-facebook', () => ({ syncFacebook: jest.fn() }));
jest.mock('../services/zohoImapService', () => ({ pollZohoInbox: jest.fn() }));
jest.mock('../services/alerteService', () => ({ verifierPaiementsEnRetard: jest.fn() }));
jest.mock('../utils/generateSitemap', () => jest.fn().mockResolvedValue('<xml/>'));
jest.mock('../services/notificationService', () => ({
  notify: jest.fn().mockResolvedValue(),
  notifyStaff: jest.fn().mockResolvedValue(),
}));
// SECURITY-CLOSURE-P1-WAVE-1 (P1-B) — `requireTenantScopeForStaffOrPlatformOperator`
// est désormais sur ces routes ; sans ce mock, la résolution tenant réelle
// (OrgMembership/PlatformTenant, non mockés dans ce test unitaire) attend
// indéfiniment une connexion Mongo absente ici (timeout Jest), même
// convention que rentalDossiersRoutes.test.js.
jest.mock('../services/platformTenant/tenantContextService', () => ({
  resolveAvailableTenantsForUser: jest.fn().mockResolvedValue([{ _id: '607f1f77bcf86cd799439001' }]),
  resolveEffectiveTenantContext: jest.fn().mockResolvedValue({ tenant: { _id: '607f1f77bcf86cd799439001' }, source: 'membership' }),
  resolveTenantScope: jest.fn().mockResolvedValue({ scopeUserIds: new Set(['507f1f77bcf86cd799439011']) }),
}));

const request  = require('supertest');
const jwt      = require('jsonwebtoken');
const { app }  = require('../server');
const Visite   = require('../models/Visite');
const Property = require('../models/Property');
const User     = require('../models/User');

Property.find = jest.fn().mockReturnValue({ distinct: jest.fn().mockResolvedValue([]) });

const OWNER_ID  = '507f1f77bcf86cd799439011';
const CLIENT_ID = '507f1f77bcf86cd799439012';

const makeToken = (id) =>
  jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });

const fakeUser = (id, role = 'Client') => ({
  _id: id, id, name: 'Test User', email: 'test@altitude.com',
  role, isActive: true, status: 'Actif', tokenVersion: 0,
});

const formatFR = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// Prochain mercredi à au moins 7 jours — jour ouvré garanti (Lun-Ven 8h-18h),
// pour ne jamais dépendre du jour de la semaine où les tests s'exécutent.
const nextWeekday = (daysAhead, targetDow) => {
  const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  while (d.getDay() !== targetDow) d.setDate(d.getDate() + 1);
  return d;
};

const futureDateBody = () => {
  const d = nextWeekday(7, 3); // mercredi
  return {
    propertyId: '507f191e810c19729de860ea',
    datePreferee: formatFR(d),
    heurePreferee: '10:00',
    telephone: '+242060000000',
    clientContactConsent: true,
  };
};

const availableProperty = () => ({
  _id: '507f191e810c19729de860ea',
  title: 'Villa test',
  owner: { _id: OWNER_ID, name: 'Proprio', phone: '' },
  availability: 'Disponible',
  statusAdmin: 'Validée',
  isPublished: true,
  address: {},
});

describe('POST /api/visites', () => {
  afterEach(() => jest.clearAllMocks());

  test('401 sans token', async () => {
    const res = await request(app).post('/api/visites').send(futureDateBody());
    expect(res.statusCode).toBe(401);
  });

  test("403 — un propriétaire ne peut pas planifier une visite sur son propre bien", async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(OWNER_ID, 'Proprietaire')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: '507f191e810c19729de860ea',
        owner: { _id: OWNER_ID, name: 'Proprio', phone: '' },
        availability: 'Disponible',
        statusAdmin: 'Validée',
        isPublished: true,
      }),
    });

    const res = await request(app)
      .post('/api/visites')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send(futureDateBody());

    expect(res.statusCode).toBe(403);
    expect(Visite.create).not.toHaveBeenCalled();
  });

  test('409 — bien indisponible pour un client tiers', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: '507f191e810c19729de860ea',
        owner: { _id: OWNER_ID, name: 'Proprio', phone: '' },
        availability: 'Loué',
        statusAdmin: 'Validée',
        isPublished: true,
      }),
    });

    const res = await request(app)
      .post('/api/visites')
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send(futureDateBody());

    expect(res.statusCode).toBe(409);
    expect(Visite.create).not.toHaveBeenCalled();
  });

  test('404 — bien introuvable', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });

    const res = await request(app)
      .post('/api/visites')
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send(futureDateBody());

    expect(res.statusCode).toBe(404);
  });

  test('400 — date/heure passées refusées', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(availableProperty()) });

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const res = await request(app)
      .post('/api/visites')
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send({ ...futureDateBody(), datePreferee: formatFR(yesterday) });

    expect(res.statusCode).toBe(400);
    expect(Visite.create).not.toHaveBeenCalled();
  });

  test("409 — une visite active existante propose la reprogrammation plutôt qu'une nouvelle réservation", async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(availableProperty()) });
    Visite.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'existing-visite-1', status: 'demandee' }),
    });

    const res = await request(app)
      .post('/api/visites')
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send(futureDateBody());

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe('Vous avez déjà une visite active pour ce bien. Souhaitez-vous la reprogrammer ?');
    expect(res.body.data).toEqual({ existingVisiteId: 'existing-visite-1', action: 'reschedule' });
    expect(Visite.create).not.toHaveBeenCalled();
  });

  test('un client sans visite active existante peut réserver (Visite.findOne ne trouve rien)', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(availableProperty()) });
    Visite.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    Visite.exists = jest.fn().mockResolvedValue(false);
    const createdVisite = {
      _id: 'visite-ok',
      property: { _id: '507f191e810c19729de860ea', title: 'Villa test', owner: OWNER_ID },
      client: CLIENT_ID,
      status: 'demandee',
      createdAt: new Date(),
      populate: jest.fn().mockImplementation(function populate() { return Promise.resolve(this); }),
      toObject: jest.fn().mockImplementation(function toObject() {
        const { populate: _p, toObject: _t, ...rest } = this;
        return rest;
      }),
    };
    Visite.create = jest.fn().mockResolvedValue(createdVisite);

    const res = await request(app)
      .post('/api/visites')
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send(futureDateBody());

    expect(res.statusCode).toBe(201);
  });

  test('201 — création réussie, liée au bien et au client, notifie le propriétaire et le staff', async () => {
    const { notify, notifyStaff } = require('../services/notificationService');
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(availableProperty()) });
    Visite.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    Visite.exists = jest.fn().mockResolvedValue(false);

    const createdVisite = {
      _id: 'visite-1',
      property: { _id: '507f191e810c19729de860ea', title: 'Villa test', owner: OWNER_ID },
      client: CLIENT_ID,
      status: 'demandee',
      statut: 'En attente',
      populate: jest.fn().mockImplementation(function populate() { return Promise.resolve(this); }),
      toObject: jest.fn().mockImplementation(function toObject() {
        const { populate: _p, toObject: _t, ...rest } = this;
        return rest;
      }),
    };
    Visite.create = jest.fn().mockResolvedValue(createdVisite);

    const res = await request(app)
      .post('/api/visites')
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send(futureDateBody());

    expect(res.statusCode).toBe(201);
    expect(Visite.create).toHaveBeenCalledWith(expect.objectContaining({
      property: '507f191e810c19729de860ea',
      client: CLIENT_ID,
      status: 'demandee',
    }));
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipient: OWNER_ID, type: 'visite_sur_mon_bien' }));
    expect(notifyStaff).toHaveBeenCalledWith(expect.objectContaining({ type: 'visite_new' }));
  });
});

// ─── GET /api/visites (dashboard staff) — visibilité des visites mobiles ────

describe('GET /api/visites — visibilité dashboard', () => {
  afterEach(() => jest.clearAllMocks());

  test('ne filtre pas par source (mobile/web) — Visite.find() appelé sans condition', async () => {
    const ADMIN_ID = '507f1f77bcf86cd799439099';
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(ADMIN_ID, 'Admin')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Visite.updateMany = jest.fn().mockResolvedValue({});
    const chain = {};
    ['populate', 'sort'].forEach((m) => { chain[m] = jest.fn().mockReturnValue(chain); });
    chain.then = (resolve) => Promise.resolve([]).then(resolve);
    Visite.find = jest.fn().mockReturnValue(chain);

    const res = await request(app)
      .get('/api/visites')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);

    expect(res.statusCode).toBe(200);
    // SECURITY-CLOSURE-P1-WAVE-1 (P1-B) — `Visite.find` reçoit désormais un
    // filtre de scope tenant (légitime, RA-06) ; l'intention historique de
    // ce test (documentée par son titre) est seulement l'ABSENCE d'un
    // filtre par source mobile/web, jamais l'absence de tout argument.
    expect(Visite.find).toHaveBeenCalled();
    const calledWithFilter = Visite.find.mock.calls[0][0] || {};
    expect(calledWithFilter).not.toHaveProperty('source');
    expect(calledWithFilter).not.toHaveProperty('platform');
  });
});

// ─── POST /api/visites — une seule visite active par client ET par bien ─────
// (Phase 8 : la règle est scoped par bien, pas globale sur le client)

describe('POST /api/visites — blocage scoped par bien, pas global', () => {
  afterEach(() => jest.clearAllMocks());

  test("un client ayant une visite active sur un AUTRE bien peut réserver sur celui-ci (Visite.findOne filtré par property)", async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(availableProperty()) });
    // Visite.findOne ne renvoie rien : aucune visite active pour CE bien
    // précis (peu importe que le client ait une visite active ailleurs).
    Visite.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    Visite.exists = jest.fn().mockResolvedValue(false);
    const createdVisite = {
      _id: 'visite-2',
      property: { _id: '507f191e810c19729de860ea', title: 'Villa test', owner: OWNER_ID },
      client: CLIENT_ID,
      status: 'demandee',
      createdAt: new Date(),
      populate: jest.fn().mockImplementation(function populate() { return Promise.resolve(this); }),
      toObject: jest.fn().mockImplementation(function toObject() {
        const { populate: _p, toObject: _t, ...rest } = this;
        return rest;
      }),
    };
    Visite.create = jest.fn().mockResolvedValue(createdVisite);

    const res = await request(app)
      .post('/api/visites')
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send(futureDateBody());

    expect(res.statusCode).toBe(201);
    expect(Visite.findOne).toHaveBeenCalledWith(expect.objectContaining({
      property: '507f191e810c19729de860ea',
      client: CLIENT_ID,
    }));
  });

  test('bloque même si la visite active existante est à un créneau totalement différent', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(availableProperty()) });
    Visite.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'far-away-visite', status: 'confirmee' }),
    });

    const res = await request(app)
      .post('/api/visites')
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send(futureDateBody());

    expect(res.statusCode).toBe(409);
    expect(Visite.create).not.toHaveBeenCalled();
  });
});

// ─── POST /api/visites — protection anti-concurrence (Phase 4) ──────────────
// ⚠️ Protection OPTIMISTE, pas atomique : pas de transaction Mongo dans ce
// projet. Jest ne peut pas simuler une vraie exécution parallèle avec des
// modèles mockés ; ce test reproduit le SCÉNARIO (le contrôle de créneau à la
// soumission passe, mais un concurrent a créé une visite conflictuelle avant
// la re-vérification post-création) pour prouver que la requête perdante est
// bien compensée (visite supprimée, 409 renvoyé), sans prétendre à une
// garantie d'atomicité réelle.

describe('POST /api/visites — protection anti-concurrence (optimiste)', () => {
  afterEach(() => jest.clearAllMocks());

  test("la requête perdante d'une course est compensée : visite créée puis supprimée, 409 renvoyé, aucune notification orpheline", async () => {
    const { notify, notifyStaff } = require('../services/notificationService');
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(availableProperty()) });
    Visite.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    // 1er appel Visite.exists (conflit de créneau à la soumission) : aucun conflit.
    // 2e appel Visite.exists (re-vérification post-création) : un concurrent
    // a créé une visite conflictuelle entre-temps → course perdue.
    Visite.exists = jest.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const createdVisite = {
      _id: 'visite-perdante',
      createdAt: new Date(),
      property: { _id: '507f191e810c19729de860ea', title: 'Villa test', owner: OWNER_ID },
      client: CLIENT_ID,
      status: 'demandee',
      populate: jest.fn().mockImplementation(function populate() { return Promise.resolve(this); }),
      toObject: jest.fn().mockImplementation(function toObject() {
        const { populate: _p, toObject: _t, ...rest } = this;
        return rest;
      }),
    };
    Visite.create = jest.fn().mockResolvedValue(createdVisite);
    Visite.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });

    const res = await request(app)
      .post('/api/visites')
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send(futureDateBody());

    expect(res.statusCode).toBe(409);
    // La visite créée par la requête perdante est bien supprimée (compensation).
    expect(Visite.deleteOne).toHaveBeenCalledWith({ _id: 'visite-perdante' });
    // Aucune notification n'a été envoyée pour cette visite compensée
    // (le re-check anti-course a lieu AVANT les appels notify/notifyStaff).
    expect(notify).not.toHaveBeenCalled();
    expect(notifyStaff).not.toHaveBeenCalled();
  });
});

// ─── GET /api/visites/availability (Phase 7 / Phase 11 pts 9-12, 17-18) ──────

describe('GET /api/visites/availability', () => {
  afterEach(() => jest.clearAllMocks());

  test('400 — propertyId invalide', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    const res = await request(app)
      .get('/api/visites/availability?propertyId=not-an-id&date=2026-07-22')
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);
    expect(res.statusCode).toBe(400);
  });

  test('400 — date invalide', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    const res = await request(app)
      .get(`/api/visites/availability?propertyId=507f191e810c19729de860ea&date=22-07-2026`)
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);
    expect(res.statusCode).toBe(400);
  });

  test('404 — bien introuvable', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const res = await request(app)
      .get('/api/visites/availability?propertyId=507f191e810c19729de860ea&date=2026-07-22')
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);
    expect(res.statusCode).toBe(404);
  });

  test('200 — dimanche : aucun créneau (agence fermée)', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: '507f191e810c19729de860ea' }) });
    const res = await request(app)
      .get('/api/visites/availability?propertyId=507f191e810c19729de860ea&date=2026-07-26') // dimanche
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.availableSlots).toEqual([]);
    expect(res.body.data.openingTime).toBeNull();
  });

  test('200 — mercredi sans visite existante : tous les créneaux 08:00-16:00 disponibles (fermeture 18h)', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: '507f191e810c19729de860ea' }) });
    Visite.find = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue([]) });

    const res = await request(app)
      .get('/api/visites/availability?propertyId=507f191e810c19729de860ea&date=2026-07-22') // mercredi
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.durationMinutes).toBe(120);
    expect(res.body.data.openingTime).toBe('08:00');
    expect(res.body.data.closingTime).toBe('18:00');
    expect(res.body.data.availableSlots).toEqual(['08:00', '10:00', '12:00', '14:00', '16:00']);
    expect(res.body.data.unavailableSlots).toEqual([]);
  });

  test('200 — un créneau 10:00 occupé (statut confirmée) devient indisponible, les autres restent libres', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: '507f191e810c19729de860ea' }) });
    Visite.find = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue([
        { requestedDate: new Date('2026-07-22T10:00:00+01:00') }, // 10:00 local
      ]),
    });

    const res = await request(app)
      .get('/api/visites/availability?propertyId=507f191e810c19729de860ea&date=2026-07-22')
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.unavailableSlots).toEqual(['10:00']);
    expect(res.body.data.availableSlots).toEqual(['08:00', '12:00', '14:00', '16:00']);
  });

  test('200 — une visite annulée existante ne bloque pas le créneau (statuts qui libèrent)', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: '507f191e810c19729de860ea' }) });
    // Le contrôleur ne demande que les statuts bloquants : une visite
    // annulée/refusée/terminée n'est jamais renvoyée par cette requête —
    // on simule ici Visite.find() tel qu'il se comporterait réellement
    // (filtre déjà appliqué côté requête Mongo).
    Visite.find = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue([]) });

    const res = await request(app)
      .get('/api/visites/availability?propertyId=507f191e810c19729de860ea&date=2026-07-22')
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.availableSlots).toContain('10:00');
    // Vérifie que la requête Mongo elle-même filtre bien par statuts bloquants.
    expect(Visite.find).toHaveBeenCalledWith(expect.objectContaining({
      $or: [
        { status: { $in: ['demandee', 'en_attente_confirmation', 'confirmee', 'reprogrammee'] } },
        { status: null, statut: { $in: ['En attente', 'Confirmée', 'Replanifiée'] } },
      ],
    }));
  });
});
