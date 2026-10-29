const mongoose = require('mongoose');
const { isDeepStrictEqual } = require('node:util');
const CommercialPublicationRevision = require('../models/CommercialPublicationRevision');
const PlatformOperator = require('../models/PlatformOperator');

// Jeu fermé et partagé : tout champ public substantiel doit être ajouté ici
// avant de pouvoir entrer dans un snapshot approuvé.
const SUBSTANTIVE_PUBLIC_FIELDS = Object.freeze([
  'title', 'description', 'price', 'status', 'type', 'address', 'latitude', 'longitude',
  'location', 'images', 'bedrooms', 'bathrooms', 'surface', 'livingRooms', 'kitchens',
  'constructionType', 'amenities', 'availability', 'honoraires', 'fraisVisite',
  'cautionMultiplicateur', 'profilsLocataireRecherches', 'documentsRequis',
  'name', 'category', 'stars', 'publicContact', 'policies', 'facilities', 'roomTypes',
  'includedServices', 'cancellationPolicy', 'maximumGuests', 'minimumStay',
  'accommodationType', 'furnished', 'capacity', 'beds', 'checkInTime', 'checkOutTime',
  'maximumStay', 'houseRules', 'securityDeposit', 'cleaningFee', 'currency', 'rules',
  'brand', 'starRating', 'hotelType', 'phone', 'email', 'website', 'contact', 'services',
  'hotelServices', 'hasRestaurant', 'hasReception', 'gallery',
]);

class CommercialPublicationError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message); this.name = 'CommercialPublicationError'; this.code = code; this.statusCode = statusCode;
  }
}
const fail = (code, message, statusCode) => { throw new CommercialPublicationError(code, message, statusCode); };
const actorId = (actor) => actor?._id || actor?.id || actor;
const plain = (value) => value?.toObject ? value.toObject() : { ...value };

function publicSnapshot(value = {}) {
  const source = plain(value);
  return Object.fromEntries(SUBSTANTIVE_PUBLIC_FIELDS
    .filter((field) => source[field] !== undefined)
    .map((field) => [field, source[field]]));
}

function classifySubstantiveChanges(current = {}, proposed = {}) {
  const before = publicSnapshot(current);
  const after = publicSnapshot(proposed);
  return SUBSTANTIVE_PUBLIC_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(after, field) && !isDeepStrictEqual(before[field], after[field]));
}

function projectApprovedPublicResource(value) {
  const source = plain(value);
  const approved = source.approvedPublicSnapshot;
  if (!approved || typeof approved !== 'object') return source;
  return { ...source, ...approved, approvedPublicSnapshot: undefined };
}

async function withTransaction(work) {
  const session = await mongoose.connection.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

async function createPendingRevision({ resourceType, resource, proposedSnapshot, actor }) {
  if (!['Property', 'Hotel', 'Accommodation'].includes(resourceType)) fail('PUBLICATION_RESOURCE_TYPE_INVALID', 'Type de ressource commercial invalide.', 422);
  const source = plain(resource);
  const resourceId = source._id;
  const owner = source.owner || source.manager || source.createdBy;
  if (!resourceId || !owner) fail('PUBLICATION_RESOURCE_INVALID', 'Ressource commerciale invalide.', 422);
  const proposed = publicSnapshot(proposedSnapshot);
  const baseVersion = Number(source.commercialPublicationVersion || 0);
  const baseline = source.approvedPublicSnapshot || (baseVersion > 0 ? publicSnapshot(source) : {});
  const changedFields = classifySubstantiveChanges(baseline, proposed);
  if (!changedFields.length) fail('PUBLICATION_REVISION_EMPTY', 'Aucune modification substantielle à soumettre.', 409);
  const submitter = actorId(actor);
  try {
    return await withTransaction(async (session) => {
      await CommercialPublicationRevision.updateMany(
        { resourceType, resource: resourceId, status: 'pending' },
        { $set: { status: 'superseded' }, $push: { history: { event: 'superseded', actor: submitter, reason: 'Remplacée par une révision plus récente.' } } },
        { session },
      );
      const [revision] = await CommercialPublicationRevision.create([{
        resourceType, resource: resourceId, tenant: source.tenant || null, owner,
        baseVersion, proposedSnapshot: proposed, changedFields, submittedBy: submitter,
        history: [{ event: 'submitted', actor: submitter }],
      }], { session });
      return revision;
    });
  } catch (error) {
    if (error?.code === 11000 || error?.hasErrorLabel?.('TransientTransactionError')) {
      fail('PUBLICATION_REVISION_CONFLICT', 'Une autre révision a été soumise simultanément.', 409);
    }
    throw error;
  }
}

async function assertCommercialAuthority(actor, session) {
  const query = PlatformOperator.findOne({ user: actorId(actor), status: 'active', capabilities: 'platform.commercial.manage' });
  if (session) query.session(session);
  if (!(await query.lean())) fail('COMMERCIAL_PUBLICATION_AUTHORITY_REQUIRED', 'Autorité commerciale plateforme requise.', 403);
}

async function decideRevision({ revisionId, decision, actor, reason, adapter }) {
  if (!['approve', 'reject'].includes(decision)) fail('PUBLICATION_DECISION_INVALID', 'Décision de publication invalide.', 422);
  const cleanReason = String(reason || '').trim();
  if (cleanReason.length < 2) fail('PUBLICATION_DECISION_REASON_REQUIRED', 'Le motif de décision est requis.', 422);
  if (!adapter?.model) fail('PUBLICATION_ADAPTER_REQUIRED', 'Adaptateur de publication manquant.', 500);
  try {
    return await withTransaction(async (session) => {
      // Lecture fraîche à chaque décision, immédiatement avant la mutation.
      await assertCommercialAuthority(actor, session);
      const revision = await CommercialPublicationRevision.findOneAndUpdate(
        { _id: revisionId, status: 'pending' },
        { $set: { status: decision === 'approve' ? 'approved' : 'rejected', decidedBy: actorId(actor), decidedAt: new Date(), decisionReason: cleanReason }, $push: { history: { event: decision === 'approve' ? 'approved' : 'rejected', actor: actorId(actor), reason: cleanReason } } },
        { new: true, session },
      );
      if (!revision) fail('PUBLICATION_REVISION_STALE', 'Cette révision a déjà été décidée ou remplacée.', 409);
      if (decision === 'approve') {
        const versionFilter = revision.baseVersion === 0
          ? { $or: [{ commercialPublicationVersion: 0 }, { commercialPublicationVersion: { $exists: false } }] }
          : { commercialPublicationVersion: revision.baseVersion };
        const promotion = adapter.buildPromotionUpdate
          ? adapter.buildPromotionUpdate(revision.proposedSnapshot, revision)
          : { $set: { approvedPublicSnapshot: revision.proposedSnapshot, currentPublicationRevision: revision._id }, $inc: { commercialPublicationVersion: 1 } };
        const result = await adapter.model.updateOne({ _id: revision.resource, ...versionFilter }, promotion, { session });
        if (result.modifiedCount !== 1) fail('PUBLICATION_REVISION_STALE', 'La version publique a changé pendant la décision.', 409);
      }
      return revision;
    });
  } catch (error) {
    if (error instanceof CommercialPublicationError) throw error;
    if (error?.code === 112 || error?.hasErrorLabel?.('TransientTransactionError')) {
      fail('PUBLICATION_REVISION_STALE', 'Une décision concurrente a déjà gagné.', 409);
    }
    throw error;
  }
}

module.exports = {
  SUBSTANTIVE_PUBLIC_FIELDS,
  CommercialPublicationError,
  publicSnapshot,
  projectApprovedPublicResource,
  classifySubstantiveChanges,
  createPendingRevision,
  decideRevision,
};
