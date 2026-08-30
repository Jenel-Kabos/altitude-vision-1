// HOTFIX-SCALABILITY-P1-SOCKETIO-DISTRIBUTED-ADAPTER-1
//
// Preuve RED→GREEN avec DEUX VRAIS SERVEURS SOCKET.IO (deux process Node
// distincts via child_process.fork(), chacun avec son propre singleton
// socket.js/`_io`), connectés au même MongoDB réel (mongodb-memory-server,
// déjà utilisé partout dans ce projet) et au même Redis réel
// (redis-memory-server — un vrai binaire redis-server téléchargé et lancé,
// jamais un mock : voir server/docs/HOTFIX_SCALABILITY_P1_SOCKETIO_DISTRIBUTED_ADAPTER1_REPORT.md).
//
// RED = les deux serveurs démarrent SANS REDIS_URL (reproduit exactement le
// comportement pré-hotfix : adaptateur mémoire, aucune coordination inter-
// process — comportement certifié par l'audit précédent, Verdict B, score
// 54/100). GREEN = les deux mêmes serveurs démarrent AVEC REDIS_URL.
const path = require('path');
const { fork } = require('child_process');
const jwt = require('jsonwebtoken');
const { io: clientIo } = require('../../altimmo-app/node_modules/socket.io-client');
const { RedisMemoryServer } = require('redis-memory-server');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, createTenantHotel } = require('./helpers/tenantAwareFixture');
const Conversation = require('../models/Conversation');

jest.setTimeout(180000);

let mongoUri;
let redisServer;
let redisUrl;
let children = [];
let clients = [];
let requestSeq = 0;

async function startChild({ withRedis }) {
  const child = fork(path.join(__dirname, 'helpers/socketServerChild.js'), [], {
    env: {
      ...process.env,
      MONGO_URI: mongoUri,
      REDIS_URL: withRedis ? redisUrl : '',
      JWT_SECRET: process.env.JWT_SECRET || 'test-secret-key-for-jest-socket-distributed',
    },
    silent: true,
  });
  children.push(child);
  child.stderr.on('data', (d) => process.stderr.write(`[child ${child.pid} stderr] ${d}`));
  const port = await new Promise((resolve, reject) => {
    child.once('message', (msg) => (msg?.type === 'ready' ? resolve(msg.port) : reject(new Error(`boot_error: ${msg?.error}`))));
    child.once('exit', (code) => reject(new Error(`child exited before ready, code=${code}`)));
  });
  return { child, port };
}

function send(child, message) {
  return new Promise((resolve) => {
    requestSeq += 1;
    const requestId = requestSeq;
    const handler = (msg) => {
      if (msg?.type === 'result' && msg.requestId === requestId) {
        child.off('message', handler);
        resolve(msg);
      }
    };
    child.on('message', handler);
    child.send({ ...message, requestId });
  });
}

function stopAllChildren() {
  children.splice(0).forEach((c) => { try { c.kill('SIGTERM'); } catch { /* déjà mort */ } });
}

const connect = (port, user, tenant) => new Promise((resolve, reject) => {
  const token = jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
  const client = clientIo(`http://127.0.0.1:${port}`, {
    transports: ['websocket'], auth: { token, platformTenantId: String(tenant._id) }, forceNew: true,
  });
  clients.push(client);
  client.once('connect', () => resolve(client));
  client.once('connect_error', reject);
});

const join = (client, conversationId) => new Promise((resolve) => client.emit('join-room', String(conversationId), resolve));
const joinHotel = (client, hotelId) => new Promise((resolve) => client.emit('establishment:join', { type: 'hotel', id: String(hotelId) }, resolve));

const waitForEvent = (client, event, ms = 1500) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), ms);
  client.once(event, (payload) => { clearTimeout(timer); resolve(payload); });
});

beforeAll(async () => {
  const financial = await startFinancialMongo();
  mongoUri = financial.uri;
  redisServer = new RedisMemoryServer();
  const host = await redisServer.getHost();
  const port = await redisServer.getPort();
  redisUrl = `redis://${host}:${port}`;
});

afterEach(async () => {
  clients.splice(0).forEach((c) => c.disconnect());
  stopAllChildren();
  await clearFinancialMongo();
});

afterAll(async () => {
  stopAllChildren();
  await stopFinancialMongo();
  await redisServer.stop();
});

// ─────────────────────────────────────────────────────────────────────────
// R1 — User cross-instance emit (getIO().to(userId).emit(...))
// ─────────────────────────────────────────────────────────────────────────
test('R1 — user cross-instance : RED sans Redis, GREEN avec Redis', async () => {
  const bootstrap = await require('../models/User').create({
    name: 'R1 Bootstrap', email: `r1-bootstrap-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin',
  });
  const { tenant } = await createTenantFixture({ label: 'R1', bootstrap });
  const { user: userB } = await createTenantUser({ tenant, bootstrap, overrides: { role: 'Client', email: `r1-b-${Date.now()}@example.test` } });

  // ── RED : sans Redis ──
  const { child: childARed } = await startChild({ withRedis: false });
  const { port: portBRed } = await startChild({ withRedis: false });
  const clientBRed = await connect(portBRed, userB, tenant);
  const redPromise = waitForEvent(clientBRed, 'cross-instance-test');
  await send(childARed, { type: 'emitToUser', userId: String(userB._id), event: 'cross-instance-test', payload: { ok: true } });
  const redResult = await redPromise;
  expect(redResult).toBeNull(); // RED confirmé : B ne reçoit rien depuis A sans adaptateur distribué
  stopAllChildren();
  clients.splice(0).forEach((c) => c.disconnect());

  // ── GREEN : avec Redis ──
  const { child: childAGreen } = await startChild({ withRedis: true });
  const { port: portBGreen } = await startChild({ withRedis: true });
  const clientBGreen = await connect(portBGreen, userB, tenant);
  const greenPromise = waitForEvent(clientBGreen, 'cross-instance-test');
  await send(childAGreen, { type: 'emitToUser', userId: String(userB._id), event: 'cross-instance-test', payload: { ok: true } });
  const greenResult = await greenPromise;
  expect(greenResult).toEqual({ ok: true }); // GREEN confirmé : B reçoit l'émission déclenchée sur A
});

// ─────────────────────────────────────────────────────────────────────────
// R2 — Conversation cross-instance
// ─────────────────────────────────────────────────────────────────────────
test('R2 — conversation cross-instance : RED sans Redis, GREEN avec Redis', async () => {
  const bootstrap = await require('../models/User').create({
    name: 'R2 Bootstrap', email: `r2-bootstrap-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin',
  });
  const { tenant } = await createTenantFixture({ label: 'R2', bootstrap });
  const { user: client } = await createTenantUser({ tenant, bootstrap, overrides: { role: 'Client', email: `r2-c-${Date.now()}@example.test` } });
  const { user: staff } = await createTenantUser({ tenant, bootstrap, overrides: { role: 'Collaborateur', email: `r2-s-${Date.now()}@example.test` } });
  const conversation = await Conversation.create({ tenant: tenant._id, participants: [client._id, staff._id] });

  const { child: childARed, port: portARed } = await startChild({ withRedis: false });
  const { port: portBRed } = await startChild({ withRedis: false });
  const clientARed = await connect(portARed, client, tenant);
  const staffBRed = await connect(portBRed, staff, tenant);
  expect(await join(clientARed, conversation._id)).toEqual({ ok: true });
  expect(await join(staffBRed, conversation._id)).toEqual({ ok: true });
  const redPromise = waitForEvent(staffBRed, 'new-message');
  await send(childARed, { type: 'emitToRoom', room: `conv:${conversation._id}`, event: 'new-message', payload: { conversationId: String(conversation._id), text: 'hello' } });
  expect(await redPromise).toBeNull();
  stopAllChildren();
  clients.splice(0).forEach((c) => c.disconnect());

  const { child: childAGreen, port: portAGreen } = await startChild({ withRedis: true });
  const { port: portBGreen } = await startChild({ withRedis: true });
  const clientAGreen = await connect(portAGreen, client, tenant);
  const staffBGreen = await connect(portBGreen, staff, tenant);
  expect(await join(clientAGreen, conversation._id)).toEqual({ ok: true });
  expect(await join(staffBGreen, conversation._id)).toEqual({ ok: true });
  const greenPromise = waitForEvent(staffBGreen, 'new-message');
  await send(childAGreen, { type: 'emitToRoom', room: `conv:${conversation._id}`, event: 'new-message', payload: { conversationId: String(conversation._id), text: 'hello' } });
  expect(await greenPromise).toMatchObject({ text: 'hello' });
});

// ─────────────────────────────────────────────────────────────────────────
// R3 — Hotel cross-instance (emitHotelEvent réel)
// ─────────────────────────────────────────────────────────────────────────
test('R3 — emitHotelEvent cross-instance : RED sans Redis, GREEN avec Redis', async () => {
  const bootstrap = await require('../models/User').create({
    name: 'R3 Bootstrap', email: `r3-bootstrap-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin',
  });
  const { tenant } = await createTenantFixture({ label: 'R3', bootstrap });
  const { user: owner } = await createTenantUser({ tenant, bootstrap, overrides: { role: 'Proprietaire', email: `r3-o-${Date.now()}@example.test` } });
  const hotel = await createTenantHotel({ tenant, manager: owner, createdBy: owner, overrides: { name: 'R3 Hotel' } });

  const { child: childARed } = await startChild({ withRedis: false });
  const { port: portBRed } = await startChild({ withRedis: false });
  const staffBRed = await connect(portBRed, owner, tenant);
  expect(await joinHotel(staffBRed, hotel._id)).toMatchObject({ ok: true });
  const redPromise = waitForEvent(staffBRed, 'hospitality:updated');
  const redEmit = await send(childARed, { type: 'emitHotelEvent', hotelId: String(hotel._id), payload: { eventType: 'housekeeping.completed' } });
  expect(redEmit.result.delivered).toBe(0); // RED confirmé : emitHotelEvent sur A ne voit aucun socket local pour la room hôtel
  expect(await redPromise).toBeNull();
  stopAllChildren();
  clients.splice(0).forEach((c) => c.disconnect());

  const { child: childAGreen } = await startChild({ withRedis: true });
  const { port: portBGreen } = await startChild({ withRedis: true });
  const staffBGreen = await connect(portBGreen, owner, tenant);
  expect(await joinHotel(staffBGreen, hotel._id)).toMatchObject({ ok: true });
  const greenPromise = waitForEvent(staffBGreen, 'hospitality:updated');
  const greenEmit = await send(childAGreen, { type: 'emitHotelEvent', hotelId: String(hotel._id), payload: { eventType: 'housekeeping.completed' } });
  expect(greenEmit.result.delivered).toBe(1); // GREEN confirmé : fetchSockets() voit le socket distant via Redis
  expect(await greenPromise).toMatchObject({ hotelId: String(hotel._id), eventType: 'housekeeping.completed' });
});

// ─────────────────────────────────────────────────────────────────────────
// R4 — Présence multi-instance (isUserOnline)
// ─────────────────────────────────────────────────────────────────────────
test('R4 — presence multi-instance : RED sans Redis, GREEN avec Redis', async () => {
  const bootstrap = await require('../models/User').create({
    name: 'R4 Bootstrap', email: `r4-bootstrap-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin',
  });
  const { tenant } = await createTenantFixture({ label: 'R4', bootstrap });
  const { user } = await createTenantUser({ tenant, bootstrap, overrides: { role: 'Client', email: `r4-u-${Date.now()}@example.test` } });

  const { child: childARed } = await startChild({ withRedis: false });
  const { port: portBRed } = await startChild({ withRedis: false });
  await connect(portBRed, user, tenant); // socket UNIQUEMENT sur B
  const redStatus = await send(childARed, { type: 'isUserOnline', userId: String(user._id) });
  expect(redStatus.result).toBe(false); // RED confirmé : A ne voit pas le socket de l'utilisateur sur B
  stopAllChildren();
  clients.splice(0).forEach((c) => c.disconnect());

  const { child: childAGreen } = await startChild({ withRedis: true });
  const { port: portBGreen } = await startChild({ withRedis: true });
  await connect(portBGreen, user, tenant);
  const greenStatus = await send(childAGreen, { type: 'isUserOnline', userId: String(user._id) });
  expect(greenStatus.result).toBe(true); // GREEN confirmé : présence correcte via fetchSockets() cluster-wide
});

// ─────────────────────────────────────────────────────────────────────────
// R5 — Déconnexion partielle : un utilisateur avec un socket sur A et un
// socket sur B reste ONLINE après la déconnexion de celui de A.
// ─────────────────────────────────────────────────────────────────────────
test('R5 — déconnexion partielle : un socket restant sur une autre instance maintient online (avec Redis)', async () => {
  const bootstrap = await require('../models/User').create({
    name: 'R5 Bootstrap', email: `r5-bootstrap-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin',
  });
  const { tenant } = await createTenantFixture({ label: 'R5', bootstrap });
  const { user } = await createTenantUser({ tenant, bootstrap, overrides: { role: 'Client', email: `r5-u-${Date.now()}@example.test` } });

  const { child: childA, port: portA } = await startChild({ withRedis: true });
  const { port: portB } = await startChild({ withRedis: true });
  const clientA = await connect(portA, user, tenant);
  await connect(portB, user, tenant);

  expect((await send(childA, { type: 'isUserOnline', userId: String(user._id) })).result).toBe(true);

  clientA.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 300));

  expect((await send(childA, { type: 'isUserOnline', userId: String(user._id) })).result).toBe(true); // B a toujours son socket

  clients.splice(0).forEach((c) => c.disconnect());
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect((await send(childA, { type: 'isUserOnline', userId: String(user._id) })).result).toBe(false); // dernier socket parti → offline
});

// ─────────────────────────────────────────────────────────────────────────
// R6 — Panne Redis : le realtime se dégrade explicitement, aucun crash,
// aucune prétention "cross-instance safe" pendant la dégradation.
// ─────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────
// Sécurité — l'adaptateur distribué ne doit JAMAIS devenir un bypass
// d'autorisation (mandat §26-§28, §59). Reprend exactement le contrat déjà
// prouvé mono-instance par socketTenantIsolation.mongo.integration.test.js,
// mais à travers deux VRAIS serveurs distincts avec Redis actif.
// ─────────────────────────────────────────────────────────────────────────
test('sécurité — conversation cross-tenant toujours bloquée avec adaptateur distribué actif', async () => {
  const bootstrap = await require('../models/User').create({
    name: 'Sec Bootstrap', email: `sec-bootstrap-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin',
  });
  const { tenant: tenantA } = await createTenantFixture({ label: 'Sec A', bootstrap });
  const { tenant: tenantB } = await createTenantFixture({ label: 'Sec B', bootstrap });
  const { user: staffA } = await createTenantUser({ tenant: tenantA, bootstrap, overrides: { role: 'Collaborateur', email: `sec-a-${Date.now()}@example.test` } });
  const { user: staffB } = await createTenantUser({ tenant: tenantB, bootstrap, overrides: { role: 'Collaborateur', email: `sec-sb-${Date.now()}@example.test` } });
  const { user: userB } = await createTenantUser({ tenant: tenantB, bootstrap, overrides: { role: 'Client', email: `sec-b-${Date.now()}@example.test` } });
  const conversationB = await Conversation.create({ tenant: tenantB._id, participants: [userB._id], isStaffInbox: true });

  const { port: portA } = await startChild({ withRedis: true });
  const { port: portB } = await startChild({ withRedis: true });
  // staffB (tenant B, autorisé via boîte partagée) connecté sur A : prouve la
  // livraison cross-instance à un destinataire LÉGITIME dans le même passage
  // que le refus d'un destinataire illégitime (staffA, tenant A) sur B.
  const staffBOnA = await connect(portA, staffB, tenantB);
  const staffAOnB = await connect(portB, staffA, tenantA);
  const userBOnB = await connect(portB, userB, tenantB);

  expect(await join(staffBOnA, conversationB._id)).toEqual({ ok: true });
  expect(await join(staffAOnB, conversationB._id)).toEqual({ ok: false, error: 'Accès refusé' });
  expect(await join(userBOnB, conversationB._id)).toEqual({ ok: true });

  let leaked = false;
  staffAOnB.on('typing', () => { leaked = true; });
  const receivedByStaffBOnA = waitForEvent(staffBOnA, 'typing');
  userBOnB.emit('typing', { conversationId: String(conversationB._id) });
  expect(await receivedByStaffBOnA).toMatchObject({ userId: String(userB._id) }); // livraison cross-instance à un destinataire autorisé
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(leaked).toBe(false); // staff A (tenant A, refusé) ne reçoit jamais l'événement de la conversation B, même avec Redis
});

test('sécurité — hôtel cross-tenant toujours bloqué avec adaptateur distribué actif', async () => {
  const bootstrap = await require('../models/User').create({
    name: 'Sec Hotel Bootstrap', email: `sec-hotel-bootstrap-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin',
  });
  const { tenant: tenantA } = await createTenantFixture({ label: 'Sec Hotel A', bootstrap });
  const { tenant: tenantB } = await createTenantFixture({ label: 'Sec Hotel B', bootstrap });
  const { user: ownerA } = await createTenantUser({ tenant: tenantA, bootstrap, overrides: { role: 'Proprietaire', email: `sec-oa-${Date.now()}@example.test` } });
  const { user: ownerB } = await createTenantUser({ tenant: tenantB, bootstrap, overrides: { role: 'Proprietaire', email: `sec-ob-${Date.now()}@example.test` } });
  const hotelB = await createTenantHotel({ tenant: tenantB, manager: ownerB, createdBy: ownerB, overrides: { name: 'Sec Hotel B' } });

  const { child: childA, port: portA } = await startChild({ withRedis: true });
  const { port: portB } = await startChild({ withRedis: true });
  const ownerAOnA = await connect(portA, ownerA, tenantA);
  const ownerBOnB = await connect(portB, ownerB, tenantB);

  expect(await joinHotel(ownerAOnA, hotelB._id)).toEqual({ ok: false, error: 'Accès refusé' });
  expect(await joinHotel(ownerBOnB, hotelB._id)).toMatchObject({ ok: true });

  const emitResult = await send(childA, { type: 'emitHotelEvent', hotelId: String(hotelB._id), payload: { eventType: 'room.updated' } });
  expect(emitResult.result.delivered).toBe(1); // seul owner B (autorisé) reçoit, même déclenché depuis l'instance de A
});

// ─────────────────────────────────────────────────────────────────────────
// Multi-client correctness (mandat §56-§57) — PAS un test de charge 10×,
// juste une vérification qu'aucune hypothèse "un seul client par room" ne
// s'est glissée dans l'implémentation avec plusieurs clients répartis sur
// deux serveurs réels.
// ─────────────────────────────────────────────────────────────────────────
test('multi-client correctness — plusieurs clients répartis sur 2 serveurs reçoivent tous un événement hôtel', async () => {
  const bootstrap = await require('../models/User').create({
    name: 'Multi Bootstrap', email: `multi-bootstrap-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin',
  });
  const { tenant } = await createTenantFixture({ label: 'Multi', bootstrap });
  const { user: owner } = await createTenantUser({ tenant, bootstrap, overrides: { role: 'Proprietaire', email: `multi-o-${Date.now()}@example.test` } });
  const hotel = await createTenantHotel({ tenant, manager: owner, createdBy: owner, overrides: { name: 'Multi Hotel' } });

  const { child: childA, port: portA } = await startChild({ withRedis: true });
  const { port: portB } = await startChild({ withRedis: true });

  const staffMembers = [];
  for (let i = 0; i < 3; i += 1) {
    // Admin bypass l'assignation hôtel fine (assertOperationalHotelAccess) —
    // suffisant et volontaire ici : ce test vérifie le fan-out de
    // l'adaptateur à N clients, pas la matrice RBAC hôtel (déjà couverte par
    // les tests de sécurité ci-dessus et par socketTenantIsolation).
    staffMembers.push(await createTenantUser({ tenant, bootstrap, overrides: { role: 'Admin', email: `multi-s${i}-${Date.now()}@example.test` } }));
  }
  const connections = await Promise.all([
    connect(portA, staffMembers[0].user, tenant),
    connect(portB, staffMembers[1].user, tenant),
    connect(portB, staffMembers[2].user, tenant),
    connect(portA, owner, tenant), // pas dans la room hôtel — ne doit rien recevoir
  ]);
  const [socketOnA, socket1OnB, socket2OnB, unrelatedOnA] = connections;

  await Promise.all([joinHotel(socketOnA, hotel._id), joinHotel(socket1OnB, hotel._id), joinHotel(socket2OnB, hotel._id)]);

  let unrelatedReceived = false;
  unrelatedOnA.on('hospitality:updated', () => { unrelatedReceived = true; });
  const waiters = Promise.all([
    waitForEvent(socketOnA, 'hospitality:updated'),
    waitForEvent(socket1OnB, 'hospitality:updated'),
    waitForEvent(socket2OnB, 'hospitality:updated'),
  ]);
  const emitResult = await send(childA, { type: 'emitHotelEvent', hotelId: String(hotel._id), payload: { eventType: 'maintenance.created' } });
  expect(emitResult.result.delivered).toBe(3); // les 3 membres de la room, répartis sur A et B
  const results = await waiters;
  results.forEach((r) => expect(r).toMatchObject({ eventType: 'maintenance.created' }));
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(unrelatedReceived).toBe(false);
});

test('R6 — panne Redis au démarrage : dégradation explicite, pas de crash, pas de faux GREEN', async () => {
  const badRedisUrl = 'redis://127.0.0.1:1'; // port fermé — connexion impossible
  const child = fork(path.join(__dirname, 'helpers/socketServerChild.js'), [], {
    env: { ...process.env, MONGO_URI: mongoUri, REDIS_URL: badRedisUrl, JWT_SECRET: process.env.JWT_SECRET || 'test-secret-key-for-jest-socket-distributed' },
    silent: true,
  });
  children.push(child);
  const port = await new Promise((resolve, reject) => {
    child.once('message', (msg) => (msg?.type === 'ready' ? resolve(msg.port) : reject(new Error(msg?.error))));
    child.once('exit', (code) => reject(new Error(`child exited, code=${code}`)));
  });
  expect(port).toBeGreaterThan(0); // le serveur démarre quand même — pas de fail-startup (§14 du mandat)
  const status = await send(child, { type: 'getRealtimeStatus' });
  expect(status.result.adapter).toBe('memory');
  expect(status.result.degraded).toBe(true);
  expect(status.result.reason).toBeTruthy();
});
