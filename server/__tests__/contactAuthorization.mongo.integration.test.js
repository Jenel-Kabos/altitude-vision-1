const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');

const {
  CONTACT_AUTHORIZATION_SCOPES,
  ContactAuthorizationError,
  assertActiveScope,
  findActiveAuthorization,
  grantAuthorization,
  revokeAuthorization,
  serializeContactAuthorization,
} = require('../services/contactAuthorizationService');

jest.setTimeout(180000);

let sequence = 0;
const makeUser = async (role = 'Client') => {
  sequence += 1;
  return User.create({
    name: `Contact authorization ${sequence}`,
    email: `contact-authorization-${sequence}-${Date.now()}@example.test`,
    password: 'Password123!',
    passwordConfirm: 'Password123!',
    role,
    isEmailVerified: true,
  });
};

const context = (overrides = {}) => ({
  clientId: overrides.clientId,
  representativeId: overrides.representativeId,
  propertyId: overrides.propertyId,
  dossierType: Object.prototype.hasOwnProperty.call(overrides, 'dossierType') ? overrides.dossierType : 'RealEstateApplication',
  dossierId: overrides.dossierId,
  tenantId: Object.prototype.hasOwnProperty.call(overrides, 'tenantId') ? overrides.tenantId : null,
});

let actor;
let client;
let representative;
let propertyId;
let dossierId;
let tenantId;

beforeAll(async () => {
  await startFinancialMongo();
  actor = await makeUser('Client');
  client = await makeUser('Client');
  representative = await makeUser('Proprietaire');
  propertyId = new mongoose.Types.ObjectId();
  dossierId = new mongoose.Types.ObjectId();
  tenantId = new mongoose.Types.ObjectId();
});

afterEach(async () => {
  const ContactAuthorization = mongoose.models.ContactAuthorization;
  if (ContactAuthorization) await ContactAuthorization.deleteMany({});
  await PlatformOperator.deleteMany({});
});

afterAll(async () => stopFinancialMongo());

async function makeCommercialOperator(user = actor, status = 'active') {
  return PlatformOperator.create({
    user: user._id,
    status,
    capabilities: ['platform.commercial.manage'],
    grantedBy: user._id,
    grantReason: 'Test commercial authority',
  });
}

const grantInput = (overrides = {}) => ({
  ...context({ clientId: client._id, representativeId: representative._id, propertyId, dossierId, tenantId, ...overrides }),
  scopes: overrides.scopes || [CONTACT_AUTHORIZATION_SCOPES.DIRECT_TRANSACTIONAL_MESSAGING],
  actor: overrides.actor || actor,
  reason: overrides.reason || 'Médiation Altitude Vision validée',
});

describe('ContactAuthorization — aggregate canonique', () => {
  test('un opérateur actif avec platform.commercial.manage octroie une autorisation exacte et sérialisée sans données privées', async () => {
    await makeCommercialOperator();

    const authorization = await grantAuthorization(grantInput());
    const safe = serializeContactAuthorization(authorization);

    expect(authorization.status).toBe('active');
    expect(authorization.events).toHaveLength(1);
    expect(authorization.events[0].type).toBe('granted');
    expect(safe).toMatchObject({
      id: String(authorization._id),
      clientId: String(client._id),
      representativeId: String(representative._id),
      propertyId: String(propertyId),
      dossierType: 'RealEstateApplication',
      dossierId: String(dossierId),
      tenantId: String(tenantId),
      status: 'active',
      scopes: [CONTACT_AUTHORIZATION_SCOPES.DIRECT_TRANSACTIONAL_MESSAGING],
    });
    expect(JSON.stringify(safe)).not.toMatch(/email|phone|password/i);
  });

  test.each([
    ['client', () => ({ clientId: new mongoose.Types.ObjectId() })],
    ['representative', () => ({ representativeId: new mongoose.Types.ObjectId() })],
    ['property', () => ({ propertyId: new mongoose.Types.ObjectId() })],
    ['dossier', () => ({ dossierId: new mongoose.Types.ObjectId() })],
    ['tenant', () => ({ tenantId: new mongoose.Types.ObjectId() })],
    ['scope', () => ({ scope: CONTACT_AUTHORIZATION_SCOPES.CONTACT_DETAILS_DISCLOSURE })],
  ])('ne correspond jamais à un autre %s', async (_label, mismatch) => {
    await makeCommercialOperator();
    await grantAuthorization(grantInput());

    const found = await findActiveAuthorization({
      ...context({ clientId: client._id, representativeId: representative._id, propertyId, dossierId, tenantId }),
      scope: CONTACT_AUTHORIZATION_SCOPES.DIRECT_TRANSACTIONAL_MESSAGING,
      ...mismatch(),
    });

    expect(found).toBeNull();
  });

  test('un octroi répété identique est idempotent et ne fragmente ni le document ni son historique', async () => {
    await makeCommercialOperator();
    const first = await grantAuthorization(grantInput());
    const second = await grantAuthorization(grantInput());

    expect(String(second._id)).toBe(String(first._id));
    expect(second.events).toHaveLength(1);
    expect(await mongoose.models.ContactAuthorization.countDocuments({})).toBe(1);
  });

  test('refuse un rôle Admin sans identité opérateur et un opérateur suspendu', async () => {
    const admin = await makeUser('Admin');
    await expect(grantAuthorization(grantInput({ actor: admin })))
      .rejects.toMatchObject({ code: 'PLATFORM_COMMERCIAL_AUTHORITY_REQUIRED', statusCode: 403 });

    await makeCommercialOperator(actor, 'suspended');
    await expect(grantAuthorization(grantInput()))
      .rejects.toMatchObject({ code: 'PLATFORM_COMMERCIAL_AUTHORITY_REQUIRED', statusCode: 403 });
  });

  test('la révocation est atomique, historisée et empêche immédiatement une nouvelle vérification de portée', async () => {
    await makeCommercialOperator();
    const granted = await grantAuthorization(grantInput());

    const previouslyLoaded = await findActiveAuthorization({
      ...context({ clientId: client._id, representativeId: representative._id, propertyId, dossierId, tenantId }),
      scope: CONTACT_AUTHORIZATION_SCOPES.DIRECT_TRANSACTIONAL_MESSAGING,
    });
    expect(previouslyLoaded).not.toBeNull();

    const revoked = await revokeAuthorization({
      authorizationId: granted._id,
      actor,
      reason: 'Mise en relation retirée',
    });
    expect(revoked.status).toBe('revoked');
    expect(revoked.events.map((event) => event.type)).toEqual(['granted', 'revoked']);

    await expect(assertActiveScope({
      ...context({ clientId: client._id, representativeId: representative._id, propertyId, dossierId, tenantId }),
      scope: CONTACT_AUTHORIZATION_SCOPES.DIRECT_TRANSACTIONAL_MESSAGING,
    })).rejects.toMatchObject({ code: 'CONTACT_AUTHORIZATION_REQUIRED', statusCode: 403 });
  });

  test('une révocation ne peut pas être répétée silencieusement et exige toujours une autorité commerciale active', async () => {
    await makeCommercialOperator();
    const granted = await grantAuthorization(grantInput());
    await revokeAuthorization({ authorizationId: granted._id, actor, reason: 'Première révocation' });

    await expect(revokeAuthorization({ authorizationId: granted._id, actor, reason: 'Deuxième révocation' }))
      .rejects.toMatchObject({ code: 'CONTACT_AUTHORIZATION_NOT_ACTIVE', statusCode: 409 });

    await PlatformOperator.updateOne({ user: actor._id }, { $set: { status: 'revoked' } });
    await expect(grantAuthorization(grantInput({ scopes: [CONTACT_AUTHORIZATION_SCOPES.CONTACT_DETAILS_DISCLOSURE] })))
      .rejects.toBeInstanceOf(ContactAuthorizationError);
  });

  test('un ré-octroi plus étroit ne réactive jamais une portée précédemment révoquée', async () => {
    await makeCommercialOperator();
    const granted = await grantAuthorization(grantInput({ scopes: [
      CONTACT_AUTHORIZATION_SCOPES.DIRECT_TRANSACTIONAL_MESSAGING,
      CONTACT_AUTHORIZATION_SCOPES.CONTACT_DETAILS_DISCLOSURE,
    ] }));
    await revokeAuthorization({ authorizationId: granted._id, actor, reason: 'Retrait complet' });

    const regranted = await grantAuthorization(grantInput({ scopes: [CONTACT_AUTHORIZATION_SCOPES.DIRECT_TRANSACTIONAL_MESSAGING] }));

    expect(regranted.scopes).toEqual([CONTACT_AUTHORIZATION_SCOPES.DIRECT_TRANSACTIONAL_MESSAGING]);
    await expect(findActiveAuthorization({
      ...context({ clientId: client._id, representativeId: representative._id, propertyId, dossierId, tenantId }),
      scope: CONTACT_AUTHORIZATION_SCOPES.CONTACT_DETAILS_DISCLOSURE,
    })).resolves.toBeNull();
  });

  test('accepte un contexte exact bien-seul sans transformer les champs absents en jokers', async () => {
    await makeCommercialOperator();
    const granted = await grantAuthorization(grantInput({ dossierType: null, dossierId: null }));
    expect(granted.property.toString()).toBe(propertyId.toString());
    expect(granted.dossier).toBeNull();
    expect(granted.dossierType).toBeNull();
    await expect(findActiveAuthorization({
      clientId: client._id, representativeId: representative._id, propertyId,
      dossierType: null, dossierId: null, tenantId,
      scope: CONTACT_AUTHORIZATION_SCOPES.DIRECT_TRANSACTIONAL_MESSAGING,
    })).resolves.toMatchObject({ _id: granted._id });
  });
});

