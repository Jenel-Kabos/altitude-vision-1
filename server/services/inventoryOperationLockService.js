const crypto = require('crypto');
const InventoryOperationLock = require('../models/InventoryOperationLock');
const logger = require('../utils/logger');

const LOCK_TTL_MS = 5 * 60 * 1000;
const scopeKey = ({ hotelId, roomCategoryId, from, to }) => `inventory_rebuild:${hotelId}:${roomCategoryId || 'all'}:${new Date(from).toISOString()}:${new Date(to).toISOString()}`;

function inProgress(lock) {
  const error = new Error('Une reconstruction identique est déjà en cours.');
  error.code = 'INVENTORY_REBUILD_IN_PROGRESS'; error.statusCode = 409;
  error.lock = lock ? { startedAt: lock.acquiredAt, expiresAt: lock.expiresAt, scope: lock.key } : undefined;
  return error;
}

async function acquireInventoryOperationLock({ hotelId, roomCategoryId, from, to, acquiredBy, now = new Date(), ttlMs = LOCK_TTL_MS }) {
  const key = scopeKey({ hotelId, roomCategoryId, from, to });
  const ownerToken = crypto.randomUUID();
  await InventoryOperationLock.deleteOne({ key, expiresAt: { $lte: now } });
  try {
    const lock = await InventoryOperationLock.create({ key, hotel: hotelId, roomCategory: roomCategoryId || null, dateFrom: from, dateTo: to, operation: 'inventory_rebuild', ownerToken, acquiredAt: now, heartbeatAt: now, expiresAt: new Date(now.getTime() + ttlMs), acquiredBy: acquiredBy || null });
    logger.info('hotel.inventory.lock_acquired', { hotelId: String(hotelId), roomCategoryId: String(roomCategoryId || ''), operationId: ownerToken, strategy: 'mongodb_unique_ttl' });
    return { lock, ownerToken };
  } catch (error) {
    if (error.code !== 11000) throw error;
    const lock = await InventoryOperationLock.findOne({ key });
    logger.warn('hotel.inventory.lock_refused', { hotelId: String(hotelId), roomCategoryId: String(roomCategoryId || ''), strategy: 'mongodb_unique_ttl' });
    throw inProgress(lock);
  }
}

async function heartbeatInventoryOperationLock({ key, ownerToken, ttlMs = LOCK_TTL_MS, now = new Date() }) {
  const result = await InventoryOperationLock.updateOne({ key, ownerToken }, { $set: { heartbeatAt: now, expiresAt: new Date(now.getTime() + ttlMs) } });
  if (!result.modifiedCount) { const error = new Error('Le verrou de reconstruction n’appartient plus à cette opération.'); error.code = 'INVENTORY_LOCK_OWNER_MISMATCH'; error.statusCode = 409; throw error; }
  return result;
}

async function releaseInventoryOperationLock({ key, ownerToken }) {
  const result = await InventoryOperationLock.deleteOne({ key, ownerToken });
  if (!result.deletedCount) { const error = new Error('Le verrou de reconstruction n’appartient plus à cette opération.'); error.code = 'INVENTORY_LOCK_OWNER_MISMATCH'; error.statusCode = 409; throw error; }
  return result;
}

module.exports = { LOCK_TTL_MS, scopeKey, acquireInventoryOperationLock, heartbeatInventoryOperationLock, releaseInventoryOperationLock };
