// API-PUBLIC-1 — plateforme d'API publiques : clés API (création/rotation/
// révocation), routes /api/public/v1 (auth, scope, quota, projection sûre —
// vérifie explicitement l'ABSENCE de champs internes), webhooks (diffusion
// via le même choke point notify() que CRM-AUTOMATION-1), administration
// /api/dev-portal.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Hotel = require('../models/Hotel');
const ApiKey = require('../models/ApiKey');
const ApiCallLog = require('../models/ApiCallLog');
const WebhookSubscription = require('../models/WebhookSubscription');
const { createApiKey, verifyApiKey, rotateApiKey, revokeApiKey } = require('../services/publicApi/apiKeyService');
const { listPublicProperties, getPublicPropertyById } = require('../services/publicApi/publicPropertyService');
const { dispatch, signPayload } = require('../services/publicApi/webhookDispatchService');
const { notify } = require('../services/notificationService');
const publicApiV1Routes = require('../routes/publicApi/v1');
const publicApiDocsRoutes = require('../routes/publicApi/docs');
const devPortalRoutes = require('../routes/apiPlatformAdminRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/public/v1', publicApiDocsRoutes);
app.use('/api/public/v1', publicApiV1Routes);
app.use('/api/dev-portal', devPortalRoutes);
app.use(errorHandler);

const signToken = (userId) => jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Test User', email: `pubapi${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

const makeValidatedProperty = (owner, overrides = {}) => Property.create({
  title: 'Villa Public API', description: 'Description suffisamment longue pour la validation du modèle Property ici présent.',
  pole: 'Altimmo', type: 'Villa', status: 'vente', price: 50000000,
  address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
  images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
  statusAdmin: 'Validée', availability: 'Disponible', owner,
  commissionRate: 7.5, internalManagedOnly: true, // champs internes — jamais exposés publiquement (voir test dédié)
  ...overrides,
});

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('apiKeyService — Phase 4 (émission, jamais le JWT interne)', () => {
  test('createApiKey ne stocke jamais le secret en clair, seulement son hash', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const { apiKey, rawKey } = await createApiKey({ name: 'Partenaire Test', actor: admin });
    expect(apiKey.hashedKey).not.toBe(rawKey);
    const stored = await ApiKey.findById(apiKey._id);
    expect(stored.hashedKey).toBe(crypto.createHash('sha256').update(rawKey).digest('hex'));
  });

  test('verifyApiKey retrouve la clé active correspondante, jamais une clé révoquée', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const { apiKey, rawKey } = await createApiKey({ name: 'X', actor: admin });
    expect((await verifyApiKey(rawKey))._id.toString()).toBe(apiKey._id.toString());
    await revokeApiKey(apiKey._id, { actor: admin, reason: 'Test' });
    expect(await verifyApiKey(rawKey)).toBeNull();
  });

  test('rotateApiKey révoque l\'ancienne et crée une nouvelle liée par rotatedFrom, jamais le même secret', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const { apiKey: oldKey, rawKey: oldRaw } = await createApiKey({ name: 'X', actor: admin });
    const { apiKey: newKey, rawKey: newRaw } = await rotateApiKey(oldKey._id, { actor: admin });
    expect(newRaw).not.toBe(oldRaw);
    expect(String(newKey.rotatedFrom)).toBe(String(oldKey._id));
    expect((await ApiKey.findById(oldKey._id)).status).toBe('revoked');
    expect(await verifyApiKey(oldRaw)).toBeNull();
    expect((await verifyApiKey(newRaw))._id.toString()).toBe(newKey._id.toString());
  });
});

describe('publicPropertyService — Phase 5 (projection sûre, allow-list explicite)', () => {
  test('aucun champ interne (owner, commissionRate, internalManagedOnly, statusAdmin) n\'est exposé', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    const property = await makeValidatedProperty(owner._id);
    const publicProperty = await getPublicPropertyById(property._id);
    expect(publicProperty.title).toBe('Villa Public API');
    expect(publicProperty.owner).toBeUndefined();
    expect(publicProperty.commissionRate).toBeUndefined();
    expect(publicProperty.internalManagedOnly).toBeUndefined();
    expect(publicProperty.statusAdmin).toBeUndefined();
    expect(publicProperty.agent).toBeUndefined();
  });

  test('seules les annonces statusAdmin:Validée apparaissent dans la liste publique', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    await makeValidatedProperty(owner._id, { title: 'Publiée' });
    await makeValidatedProperty(owner._id, { title: 'En attente', statusAdmin: 'En attente' });
    const { properties, total } = await listPublicProperties({});
    expect(total).toBe(1);
    expect(properties[0].title).toBe('Publiée');
  });
});

describe('HTTP /api/public/v1 — authentification, scope, quota (Phase 4/6)', () => {
  test('401 sans clé API', async () => {
    const res = await request(app).get('/api/public/v1/properties');
    expect(res.status).toBe(401);
  });

  test('401 avec une clé invalide ou révoquée', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const { apiKey, rawKey } = await createApiKey({ name: 'X', actor: admin });
    await revokeApiKey(apiKey._id, { actor: admin });
    const res = await request(app).get('/api/public/v1/properties').set('X-API-Key', rawKey);
    expect(res.status).toBe(401);
  });

  test('200 avec une clé active et le bon scope, aucune fuite de champ interne via HTTP', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const owner = await makeUser({ role: 'Proprietaire' });
    await makeValidatedProperty(owner._id);
    const { rawKey } = await createApiKey({ name: 'X', scopes: ['properties:read'], actor: admin });
    const res = await request(app).get('/api/public/v1/properties').set('X-API-Key', rawKey);
    expect(res.status).toBe(200);
    expect(res.body.data.properties[0].owner).toBeUndefined();
    expect(res.body.data.properties[0].commissionRate).toBeUndefined();
  });

  test('403 si le scope requis est absent de la clé', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const { rawKey } = await createApiKey({ name: 'X', scopes: ['hotels:read'], actor: admin }); // pas properties:read
    const res = await request(app).get('/api/public/v1/properties').set('X-API-Key', rawKey);
    expect(res.status).toBe(403);
  });

  test('429 lorsque le quota par minute de la clé est dépassé', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const { apiKey, rawKey } = await createApiKey({ name: 'X', scopes: ['properties:read'], rateLimitPerMinute: 2, actor: admin });
    // Simule des appels déjà journalisés dans la dernière minute — évite
    // d'attendre/dépendre du rate-limiter IP (max 300/min) pour ce test.
    await ApiCallLog.create([
      { apiKey: apiKey._id, method: 'GET', path: '/properties', statusCode: 200 },
      { apiKey: apiKey._id, method: 'GET', path: '/properties', statusCode: 200 },
    ]);
    const res = await request(app).get('/api/public/v1/properties').set('X-API-Key', rawKey);
    expect(res.status).toBe(429);
  });

  test('chaque appel authentifié est journalisé dans ApiCallLog', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const { rawKey, apiKey } = await createApiKey({ name: 'X', scopes: ['properties:read'], actor: admin });
    await request(app).get('/api/public/v1/properties').set('X-API-Key', rawKey);
    await new Promise((resolve) => setTimeout(resolve, 50)); // res.on('finish') est asynchrone
    expect(await ApiCallLog.countDocuments({ apiKey: apiKey._id })).toBe(1);
  });

  test('/openapi.json et /docs sont accessibles sans clé API', async () => {
    const jsonRes = await request(app).get('/api/public/v1/openapi.json');
    expect(jsonRes.status).toBe(200);
    expect(jsonRes.body.paths).toHaveProperty('/properties');
    const docsRes = await request(app).get('/api/public/v1/docs/');
    expect(docsRes.status).toBe(200);
  });
});

describe('HTTP /api/public/v1/hotels — projection PUBLIC_HOTEL_FIELDS déjà validée (Phase 5)', () => {
  test('un hôtel non publié n\'apparaît jamais', async () => {
    const admin = await makeUser({ role: 'Admin' });
    await Hotel.create({ name: 'Hotel Brouillon', manager: admin._id, createdBy: admin._id, publicationStatus: 'brouillon' });
    const { rawKey } = await createApiKey({ name: 'X', scopes: ['hotels:read'], actor: admin });
    const res = await request(app).get('/api/public/v1/hotels').set('X-API-Key', rawKey);
    expect(res.status).toBe(200);
    expect(res.body.data.hotels).toHaveLength(0);
  });
});

describe('webhookDispatchService — Phase 8 (diffusion, jamais un second moteur d\'événements)', () => {
  test('dispatch() ignore silencieusement un type hors ALLOWED_WEBHOOK_EVENTS', async () => {
    await expect(dispatch({ type: 'crm_activity_assigned' })).resolves.toBeUndefined();
  });

  test('un abonnement actif reçoit un POST signé HMAC pour un événement autorisé', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const { apiKey } = await createApiKey({ name: 'X', scopes: ['webhooks:manage'], actor: admin });
    let receivedPayload = null; let receivedSignature = null;
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url, opts) => {
      receivedPayload = JSON.parse(opts.body);
      receivedSignature = opts.headers['X-Altitude-Signature'];
      return { ok: true };
    });
    const subscription = await WebhookSubscription.create({ apiKey: apiKey._id, url: 'https://partner.test/hook', events: ['bien_valide'], secret: 'test-secret' });

    await dispatch({ type: 'bien_valide', entityType: 'property', entityId: 'abc' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(receivedPayload.event).toBe('bien_valide');
    expect(receivedSignature).toBe(signPayload('test-secret', receivedPayload));
    expect((await WebhookSubscription.findById(subscription._id)).lastStatus).toBe('success');
    global.fetch = originalFetch;
  });

  test('le hook notify() déclenche réellement la diffusion webhook, sans modifier le domaine producteur', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const { apiKey } = await createApiKey({ name: 'X', scopes: ['webhooks:manage'], actor: admin });
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ ok: true }));
    await WebhookSubscription.create({ apiKey: apiKey._id, url: 'https://partner.test/hook', events: ['bien_valide'], secret: 'test-secret' });

    // Simule exactement ce qu'un domaine Immobilier ferait — un simple appel
    // à notify(), déjà existant, sans connaissance du webhook.
    await notify({ recipient: admin._id, sender: admin._id, type: 'bien_valide', title: 'Bien validé', body: 'Test', audience: 'user' });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(global.fetch).toHaveBeenCalled();
    global.fetch = originalFetch;
  });
});

describe('HTTP /api/dev-portal — administration (Phase 9)', () => {
  test('401 sans authentification, 403 pour un non-Admin', async () => {
    const secretaire = await makeUser({ role: 'Secretaire' });
    const noAuth = await request(app).get('/api/dev-portal/keys');
    expect(noAuth.status).toBe(401);
    const nonAdmin = await request(app).get('/api/dev-portal/keys').set('Authorization', `Bearer ${signToken(secretaire._id)}`);
    expect(nonAdmin.status).toBe(403);
  });

  test('un Admin peut créer, tourner puis révoquer une clé via le portail', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const token = `Bearer ${signToken(admin._id)}`;
    const createRes = await request(app).post('/api/dev-portal/keys').set('Authorization', token).send({ name: 'Partenaire HTTP', scopes: ['properties:read'] });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.rawKey).toMatch(/^pk_live_/);
    const keyId = createRes.body.data.apiKey._id;

    const rotateRes = await request(app).post(`/api/dev-portal/keys/${keyId}/rotate`).set('Authorization', token).send({});
    expect(rotateRes.status).toBe(200);
    const newKeyId = rotateRes.body.data.apiKey._id;

    const revokeRes = await request(app).post(`/api/dev-portal/keys/${newKeyId}/revoke`).set('Authorization', token).send({ reason: 'Test' });
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.apiKey.status).toBe('revoked');
  });
});
