const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const InventoryOperationLock = require('../models/InventoryOperationLock');
const { acquireInventoryOperationLock, heartbeatInventoryOperationLock, releaseInventoryOperationLock } = require('../services/inventoryOperationLockService');

jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();
const period = { from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-10-08T00:00:00Z') };

beforeAll(async () => { await startFinancialMongo(); await InventoryOperationLock.syncIndexes(); });
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('deux instances logiques concurrentes : une seule acquiert le même périmètre', async () => {
  const args = { hotelId: id(), roomCategoryId: id(), ...period, acquiredBy: id() };
  const results = await Promise.allSettled([acquireInventoryOperationLock(args), acquireInventoryOperationLock(args)]);
  expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((item) => item.status === 'rejected').reason).toMatchObject({ code: 'INVENTORY_REBUILD_IN_PROGRESS', statusCode: 409 });
  expect(await InventoryOperationLock.countDocuments()).toBe(1);
});

test('des hôtels différents peuvent reconstruire en parallèle', async () => {
  const category = id();
  const locks = await Promise.all([id(), id()].map((hotelId) => acquireInventoryOperationLock({ hotelId, roomCategoryId: category, ...period })));
  expect(locks).toHaveLength(2); expect(await InventoryOperationLock.countDocuments()).toBe(2);
});

test('un verrou expiré est récupérable et son ancien propriétaire ne peut pas libérer le nouveau', async () => {
  const args = { hotelId: id(), roomCategoryId: id(), ...period };
  const old = await acquireInventoryOperationLock({ ...args, now: new Date('2026-09-01T00:00:00Z'), ttlMs: 1000 });
  const replacement = await acquireInventoryOperationLock({ ...args, now: new Date('2026-09-01T00:00:02Z'), ttlMs: 60000 });
  expect(replacement.ownerToken).not.toBe(old.ownerToken);
  await expect(releaseInventoryOperationLock({ key: old.lock.key, ownerToken: old.ownerToken })).rejects.toMatchObject({ code: 'INVENTORY_LOCK_OWNER_MISMATCH' });
  expect(await InventoryOperationLock.countDocuments()).toBe(1);
});

test('heartbeat prolonge uniquement le verrou du propriétaire', async () => {
  const lock = await acquireInventoryOperationLock({ hotelId: id(), roomCategoryId: id(), ...period });
  const now = new Date('2026-09-01T00:00:00Z');
  await heartbeatInventoryOperationLock({ key: lock.lock.key, ownerToken: lock.ownerToken, now, ttlMs: 60000 });
  const stored = await InventoryOperationLock.findOne({ key: lock.lock.key }).select('+ownerToken');
  expect(stored.expiresAt.toISOString()).toBe('2026-09-01T00:01:00.000Z');
  await expect(heartbeatInventoryOperationLock({ key: lock.lock.key, ownerToken: 'wrong', now })).rejects.toMatchObject({ code: 'INVENTORY_LOCK_OWNER_MISMATCH' });
});
