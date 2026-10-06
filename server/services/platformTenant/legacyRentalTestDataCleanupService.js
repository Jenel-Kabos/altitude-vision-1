const crypto = require('crypto');
const mongoose = require('mongoose');

const CLASSIFICATION = Object.freeze({
  SAFE_TEST_ORPHAN: 'SAFE_TEST_ORPHAN',
  TEST_WITH_TEST_DEPENDENCIES: 'TEST_WITH_TEST_DEPENDENCIES',
  BLOCKED_POSSIBLE_REAL_DATA: 'BLOCKED_POSSIBLE_REAL_DATA',
});
const PARTY_COLLECTIONS = Object.freeze({ Locataire: 'locataires', Proprietaire: 'proprietaires' });
const id = (value) => String(value?._id || value);
const oid = (value) => (value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(String(value)));
const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
};
const stable = (value) => JSON.stringify(canonicalize(value));

class LegacyRentalCleanupError extends Error {
  constructor(code, message, details) { super(message); this.name = 'LegacyRentalCleanupError'; this.code = code; this.details = details; }
}
const fail = (code, message, details) => { throw new LegacyRentalCleanupError(code, message, details); };
const read = (db, collection, filter, projection, session) => db.collection(collection)
  .find(filter, { projection, ...(session ? { session } : {}) }).toArray();

const dependency = (collection, row, reason) => ({ collection, id: id(row._id), reason });

async function inspectParty(db, type, party, session) {
  const field = type === 'Locataire' ? 'locataire' : 'proprietaire';
  const contracts = await read(db, 'contrats', { [field]: party._id }, { _id: 1, bien: 1 }, session);
  const contractIds = contracts.map(({ _id }) => _id);
  const payments = contractIds.length
    ? await read(db, 'paiements', { contrat: { $in: contractIds } }, { _id: 1, contrat: 1 }, session) : [];
  const documents = await read(db, 'documents', {
    $or: [{ refType: type, refId: party._id }, { entityType: type, entityId: party._id }],
  }, { _id: 1, tenant: 1 }, session);
  const [rentals, maintenance, links] = type === 'Locataire' ? await Promise.all([
    read(db, 'rentalmanagements', { currentTenant: party._id }, { _id: 1, property: 1 }, session),
    read(db, 'rentalmaintenancetickets', { tenant: party._id }, { _id: 1, property: 1 }, session),
    read(db, 'tenantlinkrequests', { locataire: party._id }, { _id: 1, user: 1, requestedBy: 1 }, session),
  ]) : [[], [], []];

  const blockers = [
    ...contracts.filter(({ bien }) => bien).map((row) => dependency('contrats', row, 'CONTRACT_HAS_PROPERTY')),
    ...rentals.map((row) => dependency('rentalmanagements', row, 'RENTAL_MANAGEMENT_HAS_PROPERTY')),
    ...maintenance.map((row) => dependency('rentalmaintenancetickets', row, 'MAINTENANCE_HAS_PROPERTY')),
    ...links.map((row) => dependency('tenantlinkrequests', row, 'TENANT_LINK_TOUCHES_USER_DOMAIN')),
    ...documents.filter(({ tenant }) => tenant).map((row) => dependency('documents', row, 'DOCUMENT_HAS_TENANT')),
  ];
  const safeContractIds = new Set(contracts.filter(({ bien }) => !bien).map(({ _id }) => id(_id)));
  const dependencies = [
    ...contracts.filter(({ bien }) => !bien).map((row) => dependency('contrats', row, 'LEGACY_CONTRACT_WITHOUT_PROPERTY')),
    ...payments.filter(({ contrat }) => safeContractIds.has(id(contrat))).map((row) => dependency('paiements', row, 'PAYMENT_OF_LEGACY_CONTRACT')),
    ...documents.filter(({ tenant }) => !tenant).map((row) => dependency('documents', row, 'UNTENANTED_LEGACY_PARTY_DOCUMENT')),
  ];
  const classification = blockers.length
    ? CLASSIFICATION.BLOCKED_POSSIBLE_REAL_DATA
    : dependencies.length ? CLASSIFICATION.TEST_WITH_TEST_DEPENDENCIES : CLASSIFICATION.SAFE_TEST_ORPHAN;
  return { type, collection: PARTY_COLLECTIONS[type], id: id(party._id), classification, dependencies, blockers };
}

function buildManifest(rows) {
  const allowed = rows.filter(({ classification }) => classification !== CLASSIFICATION.BLOCKED_POSSIBLE_REAL_DATA);
  const deps = new Map();
  allowed.flatMap(({ dependencies }) => dependencies).forEach((item) => deps.set(`${item.collection}:${item.id}`, item));
  return {
    version: 1,
    expectedState: { tenant: null, individualOwner: null },
    candidates: allowed.map(({ type, collection, id: partyId }) => ({ type, collection, id: partyId })),
    dependencies: [...deps.values()].sort((a, b) => `${a.collection}:${a.id}`.localeCompare(`${b.collection}:${b.id}`)),
  };
}

async function discoverLegacyRentalTestData(db, { session } = {}) {
  const rows = [];
  for (const [type, collection] of Object.entries(PARTY_COLLECTIONS)) {
    const parties = await read(db, collection, { tenant: null, individualOwner: null }, { _id: 1 }, session);
    for (const party of parties) rows.push(await inspectParty(db, type, party, session));
  }
  const counts = {
    locataires: rows.filter(({ type }) => type === 'Locataire').length,
    proprietaires: rows.filter(({ type }) => type === 'Proprietaire').length,
    total: rows.length,
  };
  const classificationCounts = Object.fromEntries(Object.values(CLASSIFICATION)
    .map((name) => [name, rows.filter(({ classification }) => classification === name).length]));
  return { mode: 'read-only', counts, classificationCounts, rows, manifest: buildManifest(rows), writes: 0 };
}

function computeCleanupManifestHash(manifest) {
  return crypto.createHash('sha256').update(stable(manifest)).digest('hex');
}

async function applyLegacyRentalTestDataCleanup({ db, manifest, manifestHash }) {
  if (!manifest || computeCleanupManifestHash(manifest) !== manifestHash) fail('LEGACY_CLEANUP_MANIFEST_HASH_MISMATCH', 'Manifest non confirmé.');
  const session = db.client.startSession();
  try {
    return await session.withTransaction(async () => {
      const current = await discoverLegacyRentalTestData(db, { session });
      if (current.classificationCounts[CLASSIFICATION.BLOCKED_POSSIBLE_REAL_DATA] > 0) {
        fail('LEGACY_CLEANUP_BLOCKED_RECORDS', 'Des fiches possèdent des dépendances potentiellement réelles.', current.rows.filter(({ blockers }) => blockers.length));
      }
      if (computeCleanupManifestHash(current.manifest) !== manifestHash) {
        fail('LEGACY_CLEANUP_STATE_CHANGED', 'La population legacy ou ses dépendances ont changé.');
      }

      const dependenciesByCollection = Object.groupBy(manifest.dependencies || [], ({ collection }) => collection);
      let dependenciesDeleted = 0;
      for (const [collection, items] of Object.entries(dependenciesByCollection)) {
        const ids = items.map(({ id: itemId }) => oid(itemId));
        const filter = { _id: { $in: ids } };
        if (collection === 'contrats') filter.bien = null;
        if (collection === 'documents') filter.tenant = null;
        if (collection === 'paiements') {
          const contractIds = (dependenciesByCollection.contrats || []).map(({ id: itemId }) => oid(itemId));
          filter.contrat = { $in: contractIds };
        }
        const result = await db.collection(collection).deleteMany(filter, { session });
        if (result.deletedCount !== ids.length) fail('LEGACY_CLEANUP_STATE_CHANGED', `Dépendances ${collection} modifiées pendant la purge.`);
        dependenciesDeleted += result.deletedCount;
      }

      const candidateGroups = Object.groupBy(manifest.candidates || [], ({ collection }) => collection);
      const deleted = {};
      for (const [collection, items] of Object.entries(candidateGroups)) {
        const result = await db.collection(collection).deleteMany({
          _id: { $in: items.map(({ id: itemId }) => oid(itemId)) }, tenant: null, individualOwner: null,
        }, { session });
        if (result.deletedCount !== items.length) fail('LEGACY_CLEANUP_STATE_CHANGED', `Population ${collection} modifiée pendant la purge.`);
        deleted[collection] = result.deletedCount;
      }
      return {
        locatairesDeleted: deleted.locataires || 0,
        proprietairesDeleted: deleted.proprietaires || 0,
        dependenciesDeleted,
      };
    });
  } finally { await session.endSession(); }
}

module.exports = {
  CLASSIFICATION,
  LegacyRentalCleanupError,
  discoverLegacyRentalTestData,
  computeCleanupManifestHash,
  applyLegacyRentalTestDataCleanup,
};
