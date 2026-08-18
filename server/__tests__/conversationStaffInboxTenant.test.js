// __tests__/conversationStaffInboxTenant.test.js
// HOTFIX-MSG-STAFF-INBOX-1 — non-régression : une conversation client→staff
// créée sans `propertyId` (chemin « Contacter l'agence » générique,
// `resolveConversationTenantId` retourne `null` faute de ressource à
// attribuer) doit rester visible et ouvrable dans la staff-inbox pour un
// staff dont le tenant EST résolu (`activeTenantId(req)` truthy) — bug réel
// reproduit et corrigé (voir HOTFIX_MSG_STAFF_INBOX1_ETAT_INITIAL.md /
// HOTFIX_MSG_STAFF_INBOX1_REPORT.md). Isolation cross-tenant pour les
// conversations RÉELLEMENT attribuées (bien fourni) doit rester intacte.

jest.mock('../models/User');
jest.mock('../models/Conversation');
jest.mock('../models/Message');
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../scripts/sync-facebook', () => ({ syncFacebook: jest.fn() }));
jest.mock('../services/zohoImapService', () => ({ pollZohoInbox: jest.fn() }));
jest.mock('../services/alerteService', () => ({ verifierPaiementsEnRetard: jest.fn() }));
jest.mock('../utils/generateSitemap', () => jest.fn().mockResolvedValue('<xml/>'));
const mockMiddleware = () => (req, res, next) => next();
jest.mock('../config/cloudinary', () => ({
  uploadToCloudinary:    jest.fn(),
  destroyFromCloudinary: jest.fn(),
  upload: { single: mockMiddleware, array: mockMiddleware },
}));

const STAFF_ID   = '507f1f77bcf86cd799439011';
const CLIENT_ID  = '507f1f77bcf86cd799439022'; // client ordinaire, jamais d'OrgMembership
const TENANT_ID  = '607f1f77bcf86cd799439033'; // tenant résolu du staff
const OTHER_TENANT_ID = '607f1f77bcf86cd799439044'; // tenant distinct, jamais celui du staff

// Le staff a un tenant résolu (`activeTenantId(req)` truthy) ; le client
// ordinaire n'appartient structurellement à AUCUNE OrgMembership — donc
// `resolveAvailableTenantsForUser` retourne toujours `[]` pour lui, exactement
// comme documenté POST_E2E1_REPORT.md §9/§12.
jest.mock('../services/platformTenant/tenantContextService', () => ({
  resolveAvailableTenantsForUser: jest.fn().mockResolvedValue([]),
  resolveEffectiveTenantContext: jest.fn().mockResolvedValue({
    tenant: { _id: TENANT_ID, status: 'active' },
    source: 'single_membership',
  }),
  resolveTenantScope: jest.fn().mockResolvedValue({ scopeUserIds: new Set() }),
}));

const request      = require('supertest');
const jwt          = require('jsonwebtoken');
const { app }      = require('../server');
const User         = require('../models/User');
const Conversation = require('../models/Conversation');

const makeToken = (id) => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });

const staffUser = {
  _id: STAFF_ID, name: 'Staff Test', email: 'staff@altitude.com',
  role: 'Admin', isActive: true, status: 'Actif', tokenVersion: 0,
};

// Conversation générique client→staff, créée sans `propertyId` :
// `tenant: null` par construction de `resolveConversationTenantId`.
const genericConversation = () => {
  const unreadMap = new Map([['staff', 1]]);
  return {
    _id: 'conv-generic-1',
    tenant: null,
    isStaffInbox: true,
    isArchived: false,
    relatedProperty: null,
    participants: [{ _id: CLIENT_ID }],
    lastMessage: 'Salut Altimmo, besoin de vos services',
    unreadCount: unreadMap,
    populate: jest.fn().mockReturnThis(),
    toObject: jest.fn(function toObject() {
      return { ...this, populate: undefined, toObject: undefined, lean: undefined };
    }),
  };
};

// Conversation réellement attribuée à un AUTRE tenant (ex. via un
// `propertyId` dont le bien appartient à un propriétaire d'un autre tenant)
// — doit rester strictement exclue de la staff-inbox de ce staff.
const otherTenantConversation = () => {
  const unreadMap = new Map();
  return {
    _id: 'conv-other-tenant-1',
    tenant: OTHER_TENANT_ID,
    isStaffInbox: true,
    isArchived: false,
    relatedProperty: null,
    participants: [{ _id: 'some-other-client' }],
    lastMessage: 'Bonjour',
    unreadCount: unreadMap,
    populate: jest.fn().mockReturnThis(),
    toObject: jest.fn(function toObject() {
      return { ...this, populate: undefined, toObject: undefined, lean: undefined };
    }),
  };
};

function mockConversationFindChain(results) {
  const chain = {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue(results),
  };
  Conversation.find = jest.fn().mockReturnValue(chain);
  return chain;
}

describe('GET /api/conversations/staff-inbox — HOTFIX-MSG-STAFF-INBOX-1', () => {
  afterEach(() => jest.clearAllMocks());

  test('une conversation client→staff sans tenant attribué (propertyId absent) apparaît dans la staff-inbox', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(staffUser) });
    User.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    mockConversationFindChain([genericConversation()]);

    const res = await request(app)
      .get('/api/conversations/staff-inbox')
      .set('Authorization', `Bearer ${makeToken(STAFF_ID)}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.results).toBe(1);
    expect(res.body.data.conversations[0]._id).toBe('conv-generic-1');
  });

  test('une conversation réellement attribuée à un AUTRE tenant reste exclue (isolation cross-tenant intacte)', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(staffUser) });
    User.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    mockConversationFindChain([otherTenantConversation()]);

    const res = await request(app)
      .get('/api/conversations/staff-inbox')
      .set('Authorization', `Bearer ${makeToken(STAFF_ID)}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.results).toBe(0);
    expect(res.body.data.conversations).toEqual([]);
  });

  test('une conversation attribuée au MÊME tenant que le staff reste visible (non-régression)', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(staffUser) });
    User.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    const conv = otherTenantConversation();
    conv.tenant = TENANT_ID;
    conv._id = 'conv-same-tenant-1';
    mockConversationFindChain([conv]);

    const res = await request(app)
      .get('/api/conversations/staff-inbox')
      .set('Authorization', `Bearer ${makeToken(STAFF_ID)}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.results).toBe(1);
    expect(res.body.data.conversations[0]._id).toBe('conv-same-tenant-1');
  });
});

describe('GET /api/conversations/:conversationId — staff peut ouvrir une conversation sans tenant attribué', () => {
  afterEach(() => jest.clearAllMocks());

  test('200 (jamais 403/404) pour le staff sur une conversation générique tenant:null', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(staffUser) });
    User.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    const conv = genericConversation();
    conv.lean = jest.fn().mockResolvedValue({
      _id: conv._id, tenant: null, isStaffInbox: true, participants: conv.participants,
    });
    Conversation.findById = jest.fn().mockReturnValue(conv);

    const res = await request(app)
      .get(`/api/conversations/${conv._id}`)
      .set('Authorization', `Bearer ${makeToken(STAFF_ID)}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.conversation._id).toBe(conv._id);
  });

  test('jamais 200 pour le staff sur une conversation attribuée à un AUTRE tenant (isolation inchangée)', async () => {
    // Note : `assertResourceTenantOrUnattributed` (comme `assertResourceTenant`
    // avant elle, comportement PRÉ-EXISTANT et non touché par ce hotfix) lève
    // une erreur générique sans `.name` reconnu par errorMiddleware.js pour ce
    // cas précis — elle retombe donc sur le défaut 500 plutôt que 403/404. Ce
    // hotfix ne change rien à ce point (même écart présent avant et après,
    // vérifié par lecture directe : `assertResourceTenant` levait déjà une
    // erreur sans `.name`) — seule l'assertion pertinente ici est qu'un accès
    // cross-tenant reste refusé (jamais 200), pas le code HTTP exact du refus.
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(staffUser) });
    User.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    const conv = otherTenantConversation();
    conv.lean = jest.fn().mockResolvedValue({
      _id: conv._id, tenant: OTHER_TENANT_ID, isStaffInbox: true, participants: conv.participants,
    });
    Conversation.findById = jest.fn().mockReturnValue(conv);

    const res = await request(app)
      .get(`/api/conversations/${conv._id}`)
      .set('Authorization', `Bearer ${makeToken(STAFF_ID)}`);

    expect(res.statusCode).not.toBe(200);
    expect([403, 404, 500]).toContain(res.statusCode);
  });
});
