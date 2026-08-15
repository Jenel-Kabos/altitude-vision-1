const http = require('http');
const jwt = require('jsonwebtoken');
const { io: clientIo } = require('../../altimmo-app/node_modules/socket.io-client');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, createTenantHotel } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { initSocket, emitHotelEvent } = require('../socket');

jest.setTimeout(120000);
let server;
let io;
let baseUrl;
const clients = [];

beforeAll(async () => {
  await startFinancialMongo();
  server = http.createServer();
  io = initSocket(server, { origin: '*' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  clients.splice(0).forEach((client) => client.disconnect());
  await clearFinancialMongo();
});
afterAll(async () => {
  await new Promise((resolve) => io.close(resolve));
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  await stopFinancialMongo();
});

const connect = (user, tenant) => new Promise((resolve, reject) => {
  const token = jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
  const client = clientIo(baseUrl, { transports: ['websocket'], auth: { token, platformTenantId: String(tenant._id) }, forceNew: true });
  clients.push(client);
  client.once('connect', () => resolve(client));
  client.once('connect_error', reject);
});
const join = (client, conversationId) => new Promise((resolve) => client.emit('join-room', String(conversationId), resolve));
const joinHotel = (client, hotelId) => new Promise((resolve) => client.emit('establishment:join', { type: 'hotel', id: String(hotelId) }, resolve));

test('B rejoint/reçoit B ; staff A connaissant l’ObjectId ne rejoint et ne reçoit jamais B', async () => {
  const bootstrap = await User.create({ name: 'Bootstrap Socket', email: `socket-bootstrap-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin' });
  const { tenant: tenantA } = await createTenantFixture({ label: 'Socket A', bootstrap });
  const { tenant: tenantB } = await createTenantFixture({ label: 'Socket B', bootstrap });
  const { user: staffA } = await createTenantUser({ tenant: tenantA, bootstrap, overrides: { role: 'Collaborateur', email: `socket-a-${Date.now()}@example.test` } });
  const { user: userB } = await createTenantUser({ tenant: tenantB, bootstrap, overrides: { role: 'Client', email: `socket-b-${Date.now()}@example.test` } });
  const conversationB = await Conversation.create({ tenant: tenantB._id, participants: [userB._id], isStaffInbox: true });

  const socketA = await connect(staffA, tenantA);
  const socketB1 = await connect(userB, tenantB);
  const socketB2 = await connect(userB, tenantB);
  expect(await join(socketB1, conversationB._id)).toEqual({ ok: true });
  expect(await join(socketB2, conversationB._id)).toEqual({ ok: true });
  expect(await join(socketA, conversationB._id)).toEqual({ ok: false, error: 'Accès refusé' });

  let receivedByA = false;
  socketA.on('typing', () => { receivedByA = true; });
  const receivedByB = new Promise((resolve) => socketB2.once('typing', resolve));
  socketB1.emit('typing', { conversationId: String(conversationB._id) });
  await expect(receivedByB).resolves.toMatchObject({ userId: String(userB._id) });
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(receivedByA).toBe(false);
});

test('utilisateur AB : contexte A refuse room B, contexte B autorise room B', async () => {
  const bootstrap = await User.create({ name: 'Bootstrap AB', email: `socket-ab-bootstrap-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin' });
  const { tenant: tenantA } = await createTenantFixture({ label: 'Socket AB A', bootstrap });
  const { tenant: tenantB } = await createTenantFixture({ label: 'Socket AB B', bootstrap });
  const { user: userAB } = await createTenantUser({ tenant: tenantA, bootstrap, overrides: { role: 'Client', email: `socket-ab-${Date.now()}@example.test` } });
  await require('../services/organizationService').grantMembership({ userId: userAB._id, orgUnitId: tenantB.rootOrgUnit, actor: bootstrap });
  const conversationB = await Conversation.create({ tenant: tenantB._id, participants: [userAB._id] });
  const contextA = await connect(userAB, tenantA);
  const contextB = await connect(userAB, tenantB);
  expect(await join(contextA, conversationB._id)).toEqual({ ok: false, error: 'Accès refusé' });
  expect(await join(contextB, conversationB._id)).toEqual({ ok: true });
});

test('rooms hôtel : ownership, isolation, switch, reconnexion et session révoquée', async () => {
  const bootstrap = await User.create({ name: 'Bootstrap Hotel Socket', email: `socket-hotel-bootstrap-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin' });
  const { tenant } = await createTenantFixture({ label: 'Socket Hotels', bootstrap });
  const { user: ownerA } = await createTenantUser({ tenant, bootstrap, overrides: { role: 'Proprietaire', email: `socket-owner-a-${Date.now()}@example.test` } });
  const { user: ownerB } = await createTenantUser({ tenant, bootstrap, overrides: { role: 'Proprietaire', email: `socket-owner-b-${Date.now()}@example.test` } });
  const hotelA = await createTenantHotel({ tenant, manager: ownerA, createdBy: ownerA, overrides: { name: 'Socket Hotel A' } });
  const hotelA2 = await createTenantHotel({ tenant, manager: ownerA, createdBy: ownerA, overrides: { name: 'Socket Hotel A2' } });
  const hotelB = await createTenantHotel({ tenant, manager: ownerB, createdBy: ownerB, overrides: { name: 'Socket Hotel B' } });
  const socketA = await connect(ownerA, tenant);
  const socketB = await connect(ownerB, tenant);

  expect(await joinHotel(socketA, hotelA._id)).toMatchObject({ ok: true, hotelId: String(hotelA._id) });
  expect(await joinHotel(socketB, hotelB._id)).toMatchObject({ ok: true });
  expect(await joinHotel(socketA, hotelB._id)).toEqual({ ok: false, error: 'Accès refusé' });

  let leakedToB = false;
  socketB.on('hospitality:updated', () => { leakedToB = true; });
  const eventA = new Promise((resolve) => socketA.once('hospitality:updated', resolve));
  await emitHotelEvent(hotelA._id, { eventType: 'housekeeping.completed', entityType: 'HousekeepingTask', entityId: new (require('mongoose').Types.ObjectId)(), status: 'completed' });
  await expect(eventA).resolves.toMatchObject({ hotelId: String(hotelA._id), eventType: 'housekeeping.completed' });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(leakedToB).toBe(false);

  expect(await joinHotel(socketA, hotelA2._id)).toMatchObject({ ok: true });
  let staleA = false;
  socketA.once('hospitality:updated', () => { staleA = true; });
  expect((await emitHotelEvent(hotelA._id, { eventType: 'room.updated' })).delivered).toBe(0);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(staleA).toBe(false);

  await User.updateOne({ _id: ownerA._id }, { $inc: { tokenVersion: 1 } });
  expect((await emitHotelEvent(hotelA2._id, { eventType: 'maintenance.created' })).delivered).toBe(0);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(socketA.connected).toBe(false);
});

test('un manager multi-tenant ne rejoint un hôtel que dans son tenant socket actif', async () => {
  const bootstrap = await User.create({ name: 'Bootstrap Hotel AB', email: `socket-hotel-ab-bootstrap-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin' });
  const { tenant: tenantA } = await createTenantFixture({ label: 'Hotel Socket A', bootstrap });
  const { tenant: tenantB } = await createTenantFixture({ label: 'Hotel Socket B', bootstrap });
  const { user } = await createTenantUser({ tenant: tenantA, bootstrap, overrides: { role: 'Proprietaire', email: `socket-hotel-ab-${Date.now()}@example.test` } });
  await require('../services/organizationService').grantMembership({ userId: user._id, orgUnitId: tenantB.rootOrgUnit, actor: bootstrap });
  const hotelB = await createTenantHotel({ tenant: tenantB, manager: user, createdBy: user });
  const contextA = await connect(user, tenantA);
  const contextB = await connect(user, tenantB);
  expect(await joinHotel(contextA, hotelB._id)).toEqual({ ok: false, error: 'Accès refusé' });
  expect(await joinHotel(contextB, hotelB._id)).toMatchObject({ ok: true });
});
