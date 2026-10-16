// __tests__/conversationStaffInboxTenant.test.js
// HOTFIX-MSG-STAFF-INBOX-1, révisé par le correctif P0 SUPPORT-INBOX.
//
// Ancienne règle (abrogée) : le staff d'une organisation cliente voyait les
// conversations de la boîte de support attribuées à son tenant ou sans tenant.
// Nouvelle règle : la boîte de support commerciale appartient exclusivement à
// Altitude Vision. Seul un PlatformOperator actif détenant
// `platform.support.read` (relu à chaque requête) la liste ou l'ouvre, quelle
// que soit la provenance (tenant X, autre tenant, `tenant: null`). Aucun rôle
// d'organisation (Admin, Collaborateur, CommunityManager) n'y donne accès,
// même pour un prospect portant sur un bien de sa propre organisation.

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
const PlatformOperator = require('../models/PlatformOperator');

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

const AGENT_ID = '507f1f77bcf86cd799439055';
const agentUser = {
  _id: AGENT_ID, name: 'Agent AV', email: 'agent@example.invalid',
  role: 'Client', isActive: true, status: 'Actif', tokenVersion: 0,
};
const orgMember = (role) => ({ ...staffUser, role });

// Capacité support : seul AGENT_ID en détient une (opérateur actif).
function grantSupportTo(userId) {
  jest.spyOn(PlatformOperator, 'exists').mockImplementation(async (query) =>
    (String(query?.user) === String(userId) && query?.status === 'active' ? { _id: 'op-1' } : null));
}

function asUser(user) {
  User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
  User.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
}

describe('GET /api/conversations/staff-inbox — boîte de support Altitude Vision (P0 SUPPORT-INBOX)', () => {
  beforeEach(() => grantSupportTo(AGENT_ID));
  afterEach(() => jest.restoreAllMocks());

  test.each(['Admin', 'Collaborateur', 'CommunityManager'])(
    '403 pour un membre d’organisation (%s), même si un prospect porte sur son tenant',
    async (role) => {
      asUser(orgMember(role));
      const sameTenant = otherTenantConversation();
      sameTenant.tenant = TENANT_ID;
      mockConversationFindChain([sameTenant, genericConversation()]);

      const res = await request(app)
        .get('/api/conversations/staff-inbox')
        .set('Authorization', `Bearer ${makeToken(STAFF_ID)}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('SUPPORT_CAPABILITY_REQUIRED');
      expect(Conversation.find).not.toHaveBeenCalled();
    },
  );

  test('un agent support liste toutes les conversations, quelle que soit la provenance (tenant X, autre tenant, tenant:null)', async () => {
    asUser(agentUser);
    const sameTenant = otherTenantConversation();
    sameTenant.tenant = TENANT_ID;
    sameTenant._id = 'conv-same-tenant-1';
    mockConversationFindChain([genericConversation(), otherTenantConversation(), sameTenant]);

    const res = await request(app)
      .get('/api/conversations/staff-inbox')
      .set('Authorization', `Bearer ${makeToken(AGENT_ID)}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.results).toBe(3);
    expect(Conversation.find).toHaveBeenCalledWith({ isStaffInbox: true, isArchived: { $ne: true } });
  });
});

describe('GET /api/conversations/:conversationId — conversation de la boîte de support', () => {
  beforeEach(() => grantSupportTo(AGENT_ID));
  afterEach(() => jest.restoreAllMocks());

  const mockFindById = (conv, tenant) => {
    conv.lean = jest.fn().mockResolvedValue({
      _id: conv._id, tenant, isStaffInbox: true, participants: conv.participants,
    });
    Conversation.findById = jest.fn().mockReturnValue(conv);
  };

  test('403 pour un membre d’organisation sur une conversation tenant:null', async () => {
    asUser(staffUser);
    const conv = genericConversation();
    mockFindById(conv, null);

    const res = await request(app)
      .get(`/api/conversations/${conv._id}`)
      .set('Authorization', `Bearer ${makeToken(STAFF_ID)}`);

    expect(res.statusCode).toBe(403);
  });

  test('403 pour un membre d’organisation sur une conversation attribuée à son propre tenant', async () => {
    asUser(staffUser);
    const conv = otherTenantConversation();
    conv.tenant = TENANT_ID;
    mockFindById(conv, TENANT_ID);

    const res = await request(app)
      .get(`/api/conversations/${conv._id}`)
      .set('Authorization', `Bearer ${makeToken(STAFF_ID)}`);

    expect(res.statusCode).toBe(403);
  });

  test('jamais 200 pour un membre d’organisation sur une conversation d’un AUTRE tenant', async () => {
    asUser(staffUser);
    const conv = otherTenantConversation();
    mockFindById(conv, OTHER_TENANT_ID);

    const res = await request(app)
      .get(`/api/conversations/${conv._id}`)
      .set('Authorization', `Bearer ${makeToken(STAFF_ID)}`);

    expect(res.statusCode).toBe(403);
  });

  test('200 pour un agent support sur une conversation tenant:null', async () => {
    asUser(agentUser);
    const conv = genericConversation();
    mockFindById(conv, null);

    const res = await request(app)
      .get(`/api/conversations/${conv._id}`)
      .set('Authorization', `Bearer ${makeToken(AGENT_ID)}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.conversation._id).toBe(conv._id);
  });
});
