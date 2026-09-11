// MESSAGING-PLATFORM-INBOX-AGGREGATION-1D — harness E2E réel :
// http.createServer + initSocket + socket.io-client + Mongo réplique
// mémoire + fixtures multi-tenants. Vérifie l'isolation tenant et
// l'agrégation platform:support pour les événements émis via
// `emitConversationEvent`. Un socket.io-client est installé en devDep
// (--no-save) pour ces tests.

const http = require('http');
const jwt = require('jsonwebtoken');
const { io: ioClient } = require('socket.io-client');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const { initSocket, PLATFORM_SUPPORT_ROOM, tenantStaffRoom, emitConversationEvent, getIO } = require('../socket');

jest.setTimeout(120000);

let httpServer; let port;

const bearer = (userId) => jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });

const connect = (user, platformTenantId = undefined) => new Promise((resolve, reject) => {
  const socket = ioClient(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    auth: { token: bearer(user._id), platformTenantId },
    reconnection: false,
    forceNew: true,
  });
  const timeout = setTimeout(() => { socket.disconnect(); reject(new Error('handshake timeout')); }, 8000);
  socket.on('connect', () => { clearTimeout(timeout); resolve(socket); });
  socket.on('connect_error', (err) => { clearTimeout(timeout); reject(err); });
});

// Attend un event donné en collectant les receptions pendant `delayMs` puis
// résout avec le tableau des events reçus (0..n).
const collect = (socket, eventName, delayMs = 400) => new Promise((resolve) => {
  const received = [];
  const handler = (payload) => received.push(payload);
  socket.on(eventName, handler);
  setTimeout(() => { socket.off(eventName, handler); resolve(received); }, delayMs);
});

// Utilitaire : émet côté serveur puis attend un round-trip minime.
const emitAndWait = async (fn, waitMs = 500) => {
  fn();
  await new Promise((r) => setTimeout(r, waitMs));
};

let tenantA; let tenantB; let bootstrapA;
let staffMila; let staffAltitude; let adminOnly;
let opWithSupport; let opNoSupport; let dualMemberOp; let client;

beforeAll(async () => {
  await startFinancialMongo();
  httpServer = http.createServer();
  initSocket(httpServer, { origin: '*' });
  await new Promise((r) => httpServer.listen(0, r));
  port = httpServer.address().port;
});

afterAll(async () => {
  getIO()?.close();
  await new Promise((r) => httpServer.close(r));
  await stopFinancialMongo();
});

beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'Mila Events' });
  const fB = await createTenantFixture({ label: 'Altitude Vision' });
  tenantA = fA.tenant; tenantB = fB.tenant; bootstrapA = fA.bootstrap;

  staffMila = (await createTenantUser({ tenant: tenantA, bootstrap: bootstrapA, overrides: { role: 'Admin' } })).user;
  staffAltitude = (await createTenantUser({ tenant: tenantB, bootstrap: fB.bootstrap, overrides: { role: 'Admin' } })).user;

  adminOnly = await User.create({
    name: 'Admin bare', email: `admin-bare-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
  });

  const mkOperator = async (label, caps) => {
    const u = await User.create({
      name: label, email: `${label.replace(/\W+/g, '-').toLowerCase()}-${Date.now()}@example.test`,
      password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
    });
    await grantOperator({ userId: u._id, actor: bootstrapA, reason: label, capabilities: caps });
    return u;
  };
  opWithSupport = await mkOperator('OpSupport', ['platform.support.read']);
  opNoSupport   = await mkOperator('OpNoSupport', ['platform.tenants.read']);
  // Membre du tenant Mila ET opérateur avec support.read → doit recevoir 1× seulement.
  dualMemberOp = (await createTenantUser({ tenant: tenantA, bootstrap: bootstrapA, overrides: { role: 'Admin' } })).user;
  await grantOperator({ userId: dualMemberOp._id, actor: bootstrapA, reason: 'dual', capabilities: ['platform.support.read'] });

  client = await User.create({
    name: 'Client', email: `client-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true,
  });
});

describe('SOCK-E2E — live server + real io-client', () => {
  test('SOCK-E2E-01 · SOCK-E2E-07 · SOCK-E2E-09: Conv Mila → staff Mila reçoit, staff Altitude ne reçoit rien', async () => {
    const sMila = await connect(staffMila, String(tenantA._id));
    const sAlt = await connect(staffAltitude, String(tenantB._id));
    try {
      const pMila = collect(sMila, 'new-staff-message');
      const pAlt = collect(sAlt, 'new-staff-message');
      await emitAndWait(() => emitConversationEvent('new-staff-message', { conversationId: 'C-mila', tenant: 'mila' }, { conversationTenantId: tenantA._id }));
      const [rMila, rAlt] = await Promise.all([pMila, pAlt]);
      expect(rMila).toHaveLength(1);
      expect(rAlt).toHaveLength(0);
    } finally { sMila.disconnect(); sAlt.disconnect(); }
  });

  test('SOCK-E2E-08 · SOCK-E2E-11: platform:support reçoit Mila ET Altitude', async () => {
    const sOp = await connect(opWithSupport);
    try {
      const p1 = collect(sOp, 'new-staff-message');
      await emitAndWait(() => emitConversationEvent('new-staff-message', { c: 'mila' }, { conversationTenantId: tenantA._id }));
      const r1 = await p1;
      expect(r1).toHaveLength(1);

      const p2 = collect(sOp, 'new-staff-message');
      await emitAndWait(() => emitConversationEvent('new-staff-message', { c: 'altitude' }, { conversationTenantId: tenantB._id }));
      const r2 = await p2;
      expect(r2).toHaveLength(1);
    } finally { sOp.disconnect(); }
  });

  test('SOCK-E2E-04 · SOCK-E2E-05: opérateur sans capability + Admin nu ne reçoivent PAS les événements plateforme', async () => {
    let sOpNo; let sAdmin;
    try {
      sOpNo = await connect(opNoSupport).catch(() => null);
      sAdmin = await connect(adminOnly).catch(() => null);
    } catch { /* handshake refusé = acceptable */ }
    // Deux comportements acceptables :
    // (a) handshake refusé (rejeté par 'Contexte tenant requis' — leur `platform_operator_unscoped`
    //     ne s'applique pas car ils ne sont pas opérateurs actifs OU pas la bonne capacité) ;
    // (b) handshake réussi mais ne rejoint pas platform:support.
    // On vérifie qu'AUCUN événement plateforme ne leur parvient.
    if (sOpNo) {
      const p = collect(sOpNo, 'new-staff-message');
      await emitAndWait(() => emitConversationEvent('new-staff-message', { c: 'mila' }, { conversationTenantId: tenantA._id }));
      expect(await p).toHaveLength(0);
      sOpNo.disconnect();
    }
    if (sAdmin) {
      const p = collect(sAdmin, 'new-staff-message');
      await emitAndWait(() => emitConversationEvent('new-staff-message', { c: 'mila' }, { conversationTenantId: tenantA._id }));
      expect(await p).toHaveLength(0);
      sAdmin.disconnect();
    }
  });

  test('SOCK-E2E-06: un Client ne reçoit rien via les rooms staff/platform', async () => {
    let sClient;
    try {
      sClient = await connect(client).catch(() => null);
      if (!sClient) return; // handshake refusé (comportement fail-closed acceptable)
      const p = collect(sClient, 'new-staff-message');
      await emitAndWait(() => emitConversationEvent('new-staff-message', { c: 'mila' }, { conversationTenantId: tenantA._id }));
      expect(await p).toHaveLength(0);
    } finally { sClient?.disconnect(); }
  });

  test('SOCK-E2E-13 · SOCK-E2E-14: ConvGeneral (tenant:null) → seul platform:support reçoit', async () => {
    const sOp = await connect(opWithSupport);
    const sMila = await connect(staffMila, String(tenantA._id));
    const sAlt = await connect(staffAltitude, String(tenantB._id));
    try {
      const pOp = collect(sOp, 'new-staff-message');
      const pMila = collect(sMila, 'new-staff-message');
      const pAlt = collect(sAlt, 'new-staff-message');
      await emitAndWait(() => emitConversationEvent('new-staff-message', { c: 'general' }, { conversationTenantId: null }));
      const [rOp, rMila, rAlt] = await Promise.all([pOp, pMila, pAlt]);
      expect(rOp).toHaveLength(1);
      expect(rMila).toHaveLength(0);
      expect(rAlt).toHaveLength(0);
    } finally { sOp.disconnect(); sMila.disconnect(); sAlt.disconnect(); }
  });

  test('SOCK-E2E-19: membre tenant Mila + opérateur support → reçoit UNE seule fois', async () => {
    const sDual = await connect(dualMemberOp, String(tenantA._id));
    try {
      const p = collect(sDual, 'new-staff-message');
      await emitAndWait(() => emitConversationEvent('new-staff-message', { c: 'mila' }, { conversationTenantId: tenantA._id }));
      expect(await p).toHaveLength(1); // pas 2
    } finally { sDual.disconnect(); }
  });

  test('SOCK-E2E-17 · SOCK-E2E-18: switch contexte (disconnect/reconnect) applique les nouvelles rooms', async () => {
    let sMila = await connect(staffMila, String(tenantA._id));
    const p1 = collect(sMila, 'new-staff-message');
    await emitAndWait(() => emitConversationEvent('new-staff-message', { c: 'mila' }, { conversationTenantId: tenantA._id }));
    expect(await p1).toHaveLength(1);
    sMila.disconnect();

    // Reconnexion en tentant Altitude — refus (pas membre) ; on ne doit pas
    // rester dans l'ancienne room Mila.
    let sSwitch = await connect(staffMila, String(tenantB._id)).catch(() => null);
    if (sSwitch) {
      const p2 = collect(sSwitch, 'new-staff-message');
      await emitAndWait(() => emitConversationEvent('new-staff-message', { c: 'mila' }, { conversationTenantId: tenantA._id }));
      expect(await p2).toHaveLength(0);
      sSwitch.disconnect();
    }
  });

  test('SOCK-E2E-20: disconnect nettoie la présence (isUserOnline reflète l\'état)', async () => {
    const { isUserOnline } = require('../socket');
    const s = await connect(staffMila, String(tenantA._id));
    expect(await isUserOnline(String(staffMila._id))).toBe(true);
    s.disconnect();
    await new Promise((r) => setTimeout(r, 250));
    expect(await isUserOnline(String(staffMila._id))).toBe(false);
  });
});
