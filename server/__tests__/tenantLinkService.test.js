// __tests__/tenantLinkService.test.js — Dette technique GL-B2 (Missions 1 & 3)
// Locataire/TenantLinkRequest mockés. `TenantLinkRequest.create` reproduit
// la contrainte d'unicité partielle réelle ({locataire, status:'pending'})
// — même méthodologie que RoomAssignment/HousekeepingTask (Sprints D/E).

jest.mock('../models/Locataire');
jest.mock('../models/TenantLinkRequest');
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../services/notificationService', () => ({ notify: jest.fn().mockResolvedValue(), notifyStaff: jest.fn().mockResolvedValue() }));

const Locataire = require('../models/Locataire');
const TenantLinkRequest = require('../models/TenantLinkRequest');
const {
  resolveLocataireForUser, inviteTenant, activateInvitation, cancelInvitation,
  requestLink, reviewLinkRequest,
} = require('../services/tenantLinkService');

const LOCATAIRE_ID = 'a07f1f77bcf86cd799439088';
const USER_ID = '507f1f77bcf86cd799439012';
const OTHER_USER_ID = '507f1f77bcf86cd799439099';

function makeRequestStore() {
  const pendingByLocataire = new Map();
  let seq = 0;
  TenantLinkRequest.create = jest.fn(async (data) => {
    const key = String(data.locataire);
    if (pendingByLocataire.has(key)) { const e = new Error('duplicate'); e.code = 11000; throw e; }
    seq += 1;
    const doc = { _id: `REQ-${seq}`, status: 'pending', ...data, save: jest.fn().mockResolvedValue() };
    pendingByLocataire.set(key, doc);
    return doc;
  });
  return { pendingByLocataire };
}

describe('tenantLinkService.resolveLocataireForUser — TEST DATA', () => {
  test('résout le dossier via {user: userId} — jamais un locataireId fourni par le client', async () => {
    Locataire.findOne = jest.fn().mockResolvedValue({ _id: LOCATAIRE_ID, user: USER_ID });
    const result = await resolveLocataireForUser(USER_ID);
    expect(Locataire.findOne).toHaveBeenCalledWith({ user: USER_ID });
    expect(result._id).toBe(LOCATAIRE_ID);
  });

  test('renvoie null si aucun dossier rattaché', async () => {
    Locataire.findOne = jest.fn().mockResolvedValue(null);
    expect(await resolveLocataireForUser(USER_ID)).toBeNull();
  });
});

describe('tenantLinkService.inviteTenant / activateInvitation — TEST DATA', () => {
  beforeEach(() => jest.clearAllMocks());

  test('crée une invitation pour un locataire non rattaché', async () => {
    makeRequestStore();
    Locataire.findById = jest.fn().mockResolvedValue({ _id: LOCATAIRE_ID, user: null, email: 't@test.com', prenom: 'Jean' });
    const { request, rawToken } = await inviteTenant({ locataireId: LOCATAIRE_ID, actingUser: { id: 'STAFF-1' } });
    expect(request.status).toBe('pending');
    expect(rawToken).toEqual(expect.any(String));
  });

  test('refuse d\'inviter un locataire déjà rattaché', async () => {
    Locataire.findById = jest.fn().mockResolvedValue({ _id: LOCATAIRE_ID, user: USER_ID });
    await expect(inviteTenant({ locataireId: LOCATAIRE_ID, actingUser: { id: 'STAFF-1' } })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('refuse une seconde invitation si une est déjà en attente (index unique partiel)', async () => {
    makeRequestStore();
    Locataire.findById = jest.fn().mockResolvedValue({ _id: LOCATAIRE_ID, user: null });
    await inviteTenant({ locataireId: LOCATAIRE_ID, actingUser: { id: 'STAFF-1' } });
    await expect(inviteTenant({ locataireId: LOCATAIRE_ID, actingUser: { id: 'STAFF-1' } })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('activateInvitation rattache le locataire au compte du bon token', async () => {
    const rawToken = 'raw-token-abc';
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    TenantLinkRequest.findOne = jest.fn().mockResolvedValue({
      _id: 'REQ-1', tokenHash, status: 'pending', locataire: LOCATAIRE_ID,
      tokenExpiresAt: new Date(Date.now() + 86400000), save: jest.fn().mockResolvedValue(),
    });
    Locataire.findOne = jest.fn().mockResolvedValue(null); // le compte n'est pas déjà lié
    Locataire.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: LOCATAIRE_ID, user: USER_ID });

    const result = await activateInvitation({ rawToken, userId: USER_ID });
    expect(Locataire.findOneAndUpdate).toHaveBeenCalledWith({ _id: LOCATAIRE_ID, user: null }, { $set: { user: USER_ID } }, { new: true });
    expect(result.locataire.user).toBe(USER_ID);
  });

  test('activateInvitation refuse un token invalide/inconnu', async () => {
    TenantLinkRequest.findOne = jest.fn().mockResolvedValue(null);
    await expect(activateInvitation({ rawToken: 'bad-token', userId: USER_ID })).rejects.toMatchObject({ statusCode: 404 });
  });

  test('activateInvitation refuse un token expiré', async () => {
    TenantLinkRequest.findOne = jest.fn().mockResolvedValue({
      _id: 'REQ-1', status: 'pending', tokenExpiresAt: new Date(Date.now() - 1000), save: jest.fn().mockResolvedValue(),
    });
    await expect(activateInvitation({ rawToken: 'expired-token', userId: USER_ID })).rejects.toMatchObject({ statusCode: 410 });
  });

  test('activateInvitation refuse si le compte est déjà rattaché à un autre dossier', async () => {
    TenantLinkRequest.findOne = jest.fn().mockResolvedValue({
      _id: 'REQ-1', status: 'pending', locataire: LOCATAIRE_ID, tokenExpiresAt: new Date(Date.now() + 86400000),
    });
    Locataire.findOne = jest.fn().mockResolvedValue({ _id: 'OTHER-LOCATAIRE', user: USER_ID });
    await expect(activateInvitation({ rawToken: 'x', userId: USER_ID })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('activateInvitation : course perdue (dossier déjà rattaché entre-temps) → 409', async () => {
    TenantLinkRequest.findOne = jest.fn().mockResolvedValue({
      _id: 'REQ-1', status: 'pending', locataire: LOCATAIRE_ID, tokenExpiresAt: new Date(Date.now() + 86400000),
    });
    Locataire.findOne = jest.fn().mockResolvedValue(null);
    Locataire.findOneAndUpdate = jest.fn().mockResolvedValue(null); // condition {user:null} non satisfaite
    await expect(activateInvitation({ rawToken: 'x', userId: USER_ID })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('cancelInvitation annule une invitation en attente', async () => {
    const request = { _id: 'REQ-1', status: 'pending', save: jest.fn().mockResolvedValue() };
    TenantLinkRequest.findById = jest.fn().mockResolvedValue(request);
    const result = await cancelInvitation({ requestId: 'REQ-1', actingUser: { id: 'STAFF-1' } });
    expect(result.status).toBe('cancelled');
  });

  test('cancelInvitation refuse une invitation déjà traitée', async () => {
    TenantLinkRequest.findById = jest.fn().mockResolvedValue({ _id: 'REQ-1', status: 'accepted' });
    await expect(cancelInvitation({ requestId: 'REQ-1', actingUser: { id: 'STAFF-1' } })).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('tenantLinkService.requestLink / reviewLinkRequest — TEST DATA (Cas 2)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('crée une demande de rattachement (self_request)', async () => {
    makeRequestStore();
    Locataire.findById = jest.fn().mockResolvedValue({ _id: LOCATAIRE_ID, user: null });
    Locataire.findOne = jest.fn().mockResolvedValue(null);
    const request = await requestLink({ locataireId: LOCATAIRE_ID, userId: USER_ID });
    expect(request.status).toBe('pending');
    expect(request.type).toBe('self_request');
  });

  test('refuse si le compte demandeur est déjà rattaché à un autre dossier', async () => {
    Locataire.findById = jest.fn().mockResolvedValue({ _id: LOCATAIRE_ID, user: null });
    Locataire.findOne = jest.fn().mockResolvedValue({ _id: 'OTHER', user: USER_ID });
    await expect(requestLink({ locataireId: LOCATAIRE_ID, userId: USER_ID })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('reviewLinkRequest approuvée : rattache le locataire (jamais automatique)', async () => {
    const request = { _id: 'REQ-1', type: 'self_request', status: 'pending', locataire: LOCATAIRE_ID, user: USER_ID, save: jest.fn().mockResolvedValue() };
    TenantLinkRequest.findById = jest.fn().mockResolvedValue(request);
    Locataire.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: LOCATAIRE_ID, user: USER_ID });
    const result = await reviewLinkRequest({ requestId: 'REQ-1', decision: 'approved', actingUser: { id: 'STAFF-1' } });
    expect(result.locataire.user).toBe(USER_ID);
    expect(result.request.status).toBe('approved');
  });

  test('reviewLinkRequest rejetée : ne rattache jamais le locataire', async () => {
    const request = { _id: 'REQ-1', type: 'self_request', status: 'pending', locataire: LOCATAIRE_ID, user: USER_ID, save: jest.fn().mockResolvedValue() };
    TenantLinkRequest.findById = jest.fn().mockResolvedValue(request);
    Locataire.findOneAndUpdate = jest.fn();
    const result = await reviewLinkRequest({ requestId: 'REQ-1', decision: 'rejected', actingUser: { id: 'STAFF-1' }, comment: 'Email non vérifié' });
    expect(result.locataire).toBeNull();
    expect(Locataire.findOneAndUpdate).not.toHaveBeenCalled();
    expect(result.request.status).toBe('rejected');
  });

  test('reviewLinkRequest refuse une décision invalide', async () => {
    TenantLinkRequest.findById = jest.fn().mockResolvedValue({ _id: 'REQ-1', type: 'self_request', status: 'pending' });
    await expect(reviewLinkRequest({ requestId: 'REQ-1', decision: 'maybe', actingUser: { id: 'STAFF-1' } })).rejects.toMatchObject({ statusCode: 422 });
  });

  test('reviewLinkRequest refuse un type invitation (traitée par activateInvitation, pas ici)', async () => {
    TenantLinkRequest.findById = jest.fn().mockResolvedValue({ _id: 'REQ-1', type: 'invitation', status: 'pending' });
    await expect(reviewLinkRequest({ requestId: 'REQ-1', decision: 'approved', actingUser: { id: 'STAFF-1' } })).rejects.toMatchObject({ statusCode: 409 });
  });
});
