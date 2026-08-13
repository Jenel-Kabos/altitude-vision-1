const crypto = require('crypto');
const mongoose = require('mongoose');
const ActionLog = require('../../models/ActionLog');
const PlatformOperator = require('../../models/PlatformOperator');
const User = require('../../models/User');
const { resolveResourceTenant } = require('./tenantResourceAttributionService');
const { REGISTRY, classify, verifyNoTenantEntitiesExist } = require('../../scripts/auditTenantLegacyData');

const REASON = 'TENANT_DATA_REGULARIZATION_EXEC_1';
const EXECUTABLE = new Set(['Property', 'RentalManagement', 'Visite', 'Conversation', 'Message', 'Document', 'Hotel', 'Accommodation']);
const MODEL_BY_TYPE = new Map(REGISTRY.map(({ resourceType, Model, tenantField = 'tenant' }) => [resourceType, { Model, tenantField }]));
const FINGERPRINT_FIELDS = {
  Property: ['_id', 'tenant', 'owner'], RentalManagement: ['_id', 'tenant', 'property', 'owner', 'manager'],
  Visite: ['_id', 'tenant', 'property', 'owner'], Conversation: ['_id', 'tenant', 'participants', 'relatedProperty'],
  Message: ['_id', 'tenant', 'conversation', 'sender', 'receiver'], Document: ['_id', 'tenant', 'createdBy', 'client', 'relatedProperty', 'entityType', 'entityId'],
  Hotel: ['_id', 'tenant', 'property', 'owner'], Accommodation: ['_id', 'tenant', 'property', 'hotel'],
};

class RegularizationError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, message) => { throw new RegularizationError(code, message); };
const normalize = (value) => {
  if (value == null) return null;
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (Array.isArray(value)) return value.map(normalize);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => ({ ...out, [key]: normalize(value[key]) }), {});
  return value;
};
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
function fingerprint(resourceType, resource) {
  const fields = FINGERPRINT_FIELDS[resourceType];
  if (!fields) fail('RESOURCE_TYPE_NOT_EXECUTABLE', `Type non exécutable : ${resourceType}`);
  return hash(fields.reduce((out, field) => ({ ...out, [field]: resource?.[field] ?? null }), {}));
}
function dependencies(resourceType, resource, candidateIds) {
  const refs = [];
  const add = (type, id) => { if (id && candidateIds.has(`${type}:${id}`)) refs.push({ resourceType: type, resourceId: String(id) }); };
  if (resourceType === 'RentalManagement' || resourceType === 'Visite' || resourceType === 'Accommodation') add('Property', resource.property);
  if (resourceType === 'Accommodation') add('Hotel', resource.hotel);
  if (resourceType === 'Message') add('Conversation', resource.conversation);
  if (resourceType === 'Document') {
    add('Property', resource.relatedProperty);
    if (resource.entityType && resource.entityId) add(resource.entityType, resource.entityId);
  }
  return refs;
}
async function assertActor(actorId) {
  const [operator, user] = await Promise.all([
    PlatformOperator.findOne({ user: actorId, status: 'active' }).lean(),
    User.findById(actorId).select('_id isActive status isTechnical').lean(),
  ]);
  if (!operator || !user || !user.isActive || user.status !== 'Actif' || user.isTechnical) fail('ACTOR_NOT_AUTHORIZED', 'Acteur PlatformOperator actif et non suspendu requis.');
  return { operator, user };
}
async function buildManifest({ audit, tenantId, actorId, database, batchId }) {
  if (mongoose.connection.name !== database) fail('DATABASE_MISMATCH', 'La base connectée ne correspond pas à la base confirmée.');
  await assertActor(actorId);
  const source = audit.manifest.filter((entry) => entry.classification === 'A');
  if (source.some((entry) => !EXECUTABLE.has(entry.resourceType))) fail('UNSUPPORTED_A_CANDIDATE', 'Un candidat A utilise un type non exécutable.');
  const ids = new Set(source.map((entry) => `${entry.resourceType}:${entry.resourceId}`));
  const entries = [];
  for (const sourceEntry of source) {
    const { Model, tenantField } = MODEL_BY_TYPE.get(sourceEntry.resourceType);
    const resource = await Model.findById(sourceEntry.resourceId).lean();
    if (!resource) fail('RESOURCE_DIVERGED', 'Une ressource candidate a disparu.');
    const attribution = await resolveResourceTenant({ resourceType: sourceEntry.resourceType, resource });
    let currentClass = classify(attribution);
    if (currentClass === 'B' && await verifyNoTenantEntitiesExist(attribution.proof || []) === false) currentClass = 'D';
    if (currentClass !== 'A' || String(attribution.tenantId) !== String(tenantId)) fail('RESOURCE_DIVERGED', 'Classification ou tenant cible divergent du recalcul.');
    entries.push({ batchId, resourceType: sourceEntry.resourceType, resourceId: String(resource._id), currentTenant: resource[tenantField] ? String(resource[tenantField]) : null,
      targetTenant: String(tenantId), classification: 'A', proofs: attribution.proof || [], dependencies: [],
      expectedBefore: { tenant: resource[tenantField] ? String(resource[tenantField]) : null }, intendedAfter: { tenant: String(tenantId) },
      attributionFingerprint: fingerprint(sourceEntry.resourceType, resource),
      attributionFingerprintAfter: fingerprint(sourceEntry.resourceType, { ...resource, [tenantField]: new mongoose.Types.ObjectId(tenantId) }) });
  }
  for (const entry of entries) {
    const { Model } = MODEL_BY_TYPE.get(entry.resourceType);
    const resource = await Model.findById(entry.resourceId).lean();
    entry.dependencies = dependencies(entry.resourceType, resource, ids);
  }
  const order = topologicalOrder(entries);
  const manifestHash = hash(order);
  return { version: 1, reason: REASON, database, tenantId: String(tenantId), actorId: String(actorId), batchId, generatedAt: new Date().toISOString(), manifestHash, entries: order };
}
function topologicalOrder(entries) {
  const byKey = new Map(entries.map((e) => [`${e.resourceType}:${e.resourceId}`, e]));
  const result = []; const visiting = new Set(); const visited = new Set();
  const visit = (entry) => {
    const key = `${entry.resourceType}:${entry.resourceId}`;
    if (visiting.has(key)) fail('DEPENDENCY_CYCLE', 'Cycle détecté dans le manifeste.');
    if (visited.has(key)) return;
    visiting.add(key);
    for (const dep of entry.dependencies) visit(byKey.get(`${dep.resourceType}:${dep.resourceId}`));
    visiting.delete(key); visited.add(key); result.push(entry);
  };
  entries.forEach(visit); return result;
}
async function applyEntry(entry, manifest, { simulateCrashAfter, index } = {}) {
  if (entry.classification !== 'A') fail('CLASSIFICATION_REFUSED', 'Seule la classification A est exécutable.');
  const { Model, tenantField } = MODEL_BY_TYPE.get(entry.resourceType) || {};
  if (!Model) fail('RESOURCE_TYPE_NOT_EXECUTABLE', 'Type non exécutable.');
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const resource = await Model.findById(entry.resourceId).session(session).lean();
      if (!resource) fail('RESOURCE_DIVERGED', 'Ressource absente.');
      if (String(resource[tenantField] || '') === String(entry.targetTenant)) { result = 'ALREADY_APPLIED'; return; }
      if (fingerprint(entry.resourceType, resource) !== entry.attributionFingerprint) fail('FINGERPRINT_DIVERGED', 'Fingerprint divergent.');
      for (const dep of entry.dependencies) {
        const depEntry = manifest.entries.find((e) => e.resourceType === dep.resourceType && e.resourceId === dep.resourceId);
        const depModel = MODEL_BY_TYPE.get(dep.resourceType);
        const parent = await depModel.Model.findById(dep.resourceId).session(session).lean();
        if (!parent || String(parent[depModel.tenantField] || '') !== String(entry.targetTenant)) fail('PARENT_DIVERGED', 'Dépendance parent non attribuée.');
        if (!depEntry) fail('PARENT_NOT_IN_MANIFEST', 'Dépendance absente du manifeste.');
      }
      const update = await Model.updateOne({ _id: entry.resourceId, [tenantField]: entry.currentTenant }, { $set: { [tenantField]: entry.targetTenant } }, { session });
      if (update.modifiedCount !== 1) fail('CONCURRENT_DIVERGENCE', 'La ressource a changé pendant l\'apply.');
      await ActionLog.create([{ tenant: entry.targetTenant, action: 'tenant_data_regularization.applied', description: `${REASON} ${entry.resourceType}`, module: 'PlatformAdmin', scopeMode: 'tenant',
        auteur: { id: manifest.actorId, role: 'PlatformOperator' }, cible: { id: entry.resourceId, type: entry.resourceType, nom: entry.resourceType }, typeAction: 'MODIFICATION', metadata: { regularization: {
          batchId: manifest.batchId, resourceType: entry.resourceType, resourceId: entry.resourceId, classification: 'A', proofs: entry.proofs,
          before: entry.expectedBefore, after: entry.intendedAfter, fingerprintBefore: entry.attributionFingerprint, manifestHash: manifest.manifestHash, reason: REASON, operation: 'apply',
        } } }], { session });
      result = 'APPLIED';
    });
    if (simulateCrashAfter && index + 1 === simulateCrashAfter) fail('SIMULATED_CRASH', 'Crash simulé après checkpoint.');
    return result;
  } catch (error) {
    if (error?.code === 11000) return 'ALREADY_APPLIED';
    throw error;
  } finally { await session.endSession(); }
}
async function applyManifest(manifest, options = {}) {
  await assertActor(manifest.actorId);
  if (mongoose.connection.name !== manifest.database || hash(manifest.entries) !== manifest.manifestHash) fail('MANIFEST_INVALID', 'Base ou hash du manifeste invalide.');
  const results = [];
  for (let index = 0; index < manifest.entries.length; index += 1) results.push(await applyEntry(manifest.entries[index], manifest, { ...options, index }));
  return results;
}

async function rollbackManifest(manifest) {
  await assertActor(manifest.actorId);
  if (mongoose.connection.name !== manifest.database || hash(manifest.entries) !== manifest.manifestHash) fail('MANIFEST_INVALID', 'Base ou hash du manifeste invalide.');
  const results = [];
  for (const entry of [...manifest.entries].reverse()) {
    const { Model, tenantField } = MODEL_BY_TYPE.get(entry.resourceType);
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const resource = await Model.findById(entry.resourceId).session(session).lean();
        if (!resource) fail('ROLLBACK_DIVERGED', 'Ressource absente au rollback.');
        if (String(resource[tenantField] || '') === String(entry.currentTenant || '')) { result = 'ALREADY_ROLLED_BACK'; return; }
        if (String(resource[tenantField] || '') !== String(entry.targetTenant) || fingerprint(entry.resourceType, resource) !== entry.attributionFingerprintAfter) fail('ROLLBACK_DIVERGED', 'Ressource modifiée depuis l\'apply.');
        const update = await Model.updateOne({ _id: entry.resourceId, [tenantField]: entry.targetTenant }, { $set: { [tenantField]: entry.currentTenant } }, { session });
        if (update.modifiedCount !== 1) fail('ROLLBACK_DIVERGED', 'Concurrence détectée au rollback.');
        await ActionLog.create([{ tenant: entry.targetTenant, action: 'tenant_data_regularization.rolled_back', description: `${REASON} rollback ${entry.resourceType}`, module: 'PlatformAdmin', scopeMode: 'tenant',
          auteur: { id: manifest.actorId, role: 'PlatformOperator' }, cible: { id: entry.resourceId, type: entry.resourceType, nom: entry.resourceType }, typeAction: 'MODIFICATION', metadata: { regularization: {
            batchId: manifest.batchId, resourceType: entry.resourceType, resourceId: entry.resourceId, classification: 'A', proofs: entry.proofs,
            before: entry.intendedAfter, after: entry.expectedBefore, fingerprintBefore: entry.attributionFingerprintAfter, manifestHash: manifest.manifestHash, reason: REASON, operation: 'rollback',
          } } }], { session });
        result = 'ROLLED_BACK';
      });
      results.push(result);
    } finally { await session.endSession(); }
  }
  return results;
}

module.exports = { REASON, RegularizationError, fingerprint, buildManifest, topologicalOrder, applyManifest, applyEntry, rollbackManifest };
