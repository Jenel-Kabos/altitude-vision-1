// __tests__/locataireUserLinkModel.test.js — Dette technique GL-B2 (Mission 1)
// Schémas réels (non mockés) pour Locataire.user et TenantLinkRequest.

const Locataire = require('../models/Locataire');
const TenantLinkRequest = require('../models/TenantLinkRequest');

const USER_ID = '507f1f77bcf86cd799439012';
const LOCATAIRE_ID = 'a07f1f77bcf86cd799439088';

describe('Locataire.user — liaison optionnelle (Mission 1)', () => {
  test('user est null par défaut — un Locataire n\'est jamais automatiquement lié', async () => {
    const l = new Locataire({ nom: 'Dupont', prenom: 'Jean', telephone: '0600000000' });
    await expect(l.validate()).resolves.toBeUndefined();
    expect(l.user).toBeNull();
  });

  test('accepte un ObjectId User valide', async () => {
    const l = new Locataire({ nom: 'Dupont', prenom: 'Jean', telephone: '0600000000', user: USER_ID });
    await expect(l.validate()).resolves.toBeUndefined();
    expect(String(l.user)).toBe(USER_ID);
  });

  test('un index unique partiel {user} est déclaré (un compte ↔ un seul dossier)', () => {
    const indexes = Locataire.schema.indexes();
    const idx = indexes.find(([keys]) => Object.keys(keys).length === 1 && keys.user === 1);
    expect(idx).toBeDefined();
    expect(idx[1].unique).toBe(true);
    expect(idx[1].partialFilterExpression).toEqual({ user: { $type: 'objectId' } });
  });
});

describe('TenantLinkRequest — invitation/rattachement (Mission 3)', () => {
  const base = (overrides = {}) => new TenantLinkRequest({
    locataire: LOCATAIRE_ID, type: 'invitation',
    ...overrides,
  });

  test('status par défaut = pending, user par défaut = null', async () => {
    const r = base();
    await expect(r.validate()).resolves.toBeUndefined();
    expect(r.status).toBe('pending');
    expect(r.user).toBeNull();
  });

  test('locataire et type sont requis', () => {
    const r = new TenantLinkRequest({});
    const errors = r.validateSync()?.errors || {};
    expect(errors.locataire).toBeDefined();
    expect(errors.type).toBeDefined();
  });

  test('type accepte uniquement invitation/self_request', () => {
    expect(TenantLinkRequest.TENANT_LINK_TYPES).toEqual(['invitation', 'self_request']);
    const r = base({ type: 'autre' });
    const errors = r.validateSync()?.errors || {};
    expect(errors.type).toBeDefined();
  });

  test('status accepte pending/accepted/approved/rejected/expired/cancelled', () => {
    expect(TenantLinkRequest.TENANT_LINK_STATUSES).toEqual(['pending', 'accepted', 'approved', 'rejected', 'expired', 'cancelled']);
    const r = base({ status: 'inconnu' });
    const errors = r.validateSync()?.errors || {};
    expect(errors.status).toBeDefined();
  });

  test('un index unique partiel {locataire, status:pending} est déclaré (anti double-demande)', () => {
    const indexes = TenantLinkRequest.schema.indexes();
    const idx = indexes.find(([keys]) => Object.keys(keys).length === 1 && keys.locataire === 1);
    expect(idx).toBeDefined();
    expect(idx[1].unique).toBe(true);
    expect(idx[1].partialFilterExpression).toEqual({ status: 'pending' });
  });

  test('un index {user} et {status} sont déclarés', () => {
    const indexes = TenantLinkRequest.schema.indexes();
    expect(indexes.find(([keys]) => Object.keys(keys).length === 1 && keys.user === 1)).toBeDefined();
    expect(indexes.find(([keys]) => Object.keys(keys).length === 1 && keys.status === 1)).toBeDefined();
  });
});
