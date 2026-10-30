const mongoose = require('mongoose');
const Property = require('../models/Property');
const CommercialPublicationRevision = require('../models/CommercialPublicationRevision');
const { publicSnapshot, classifySubstantiveChanges } = require('./commercialPublicationService');

const PUBLICATION_STATES = Object.freeze({
  DRAFT: 'draft',
  PENDING: 'pending',
  PUBLISHED: 'published',
  CHANGE_PENDING: 'change_pending',
  OWNER_WITHDRAWN: 'owner_withdrawn',
  ADMIN_SUSPENDED: 'admin_suspended',
  REJECTED: 'rejected',
});

const OWNER_WITHDRAWAL_AVAILABILITIES = new Set(['Retiré', 'Loué', 'Vendu', 'Indisponible']);

class PropertyPublicationLifecycleError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = 'PropertyPublicationLifecycleError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const fail = (code, message, statusCode) => {
  throw new PropertyPublicationLifecycleError(code, message, statusCode);
};
const actorId = (actor) => actor?._id || actor?.id || actor;
const sameId = (left, right) => String(left || '') === String(right || '');

function derivePublicationState(property = {}) {
  if (property.publicationLifecycleState) return property.publicationLifecycleState;
  if (property.statusAdmin === 'Rejetée') return PUBLICATION_STATES.REJECTED;
  if (property.statusAdmin === 'En attente') return PUBLICATION_STATES.PENDING;
  if (property.statusAdmin === 'Validée' && property.isPublished) return PUBLICATION_STATES.PUBLISHED;
  if (property.statusAdmin === 'Validée') return PUBLICATION_STATES.OWNER_WITHDRAWN;
  return PUBLICATION_STATES.DRAFT;
}

function isPropertyCommerciallyAvailable(property = {}) {
  return derivePublicationState(property) === PUBLICATION_STATES.PUBLISHED
    && property.statusAdmin === 'Validée'
    && property.isPublished === true
    && property.availability === 'Disponible';
}

async function inTransaction(work) {
  const session = await mongoose.connection.startSession();
  try {
    let value;
    await session.withTransaction(async () => { value = await work(session); });
    return value;
  } catch (error) {
    if (error instanceof PropertyPublicationLifecycleError) throw error;
    if (error?.code === 11000 || error?.code === 112 || error?.hasErrorLabel?.('TransientTransactionError')) {
      fail('PROPERTY_LIFECYCLE_CONFLICT', 'Le cycle de publication a été modifié simultanément.', 409);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

async function loadProperty(propertyId, session) {
  const property = await Property.findById(propertyId).session(session);
  if (!property) fail('PROPERTY_NOT_FOUND', 'Propriété introuvable.', 404);
  return property;
}

function assertOwner(property, actor) {
  if (!sameId(property.owner, actorId(actor))) {
    fail('PROPERTY_OWNER_REQUIRED', 'Seul le propriétaire peut effectuer cette action.', 403);
  }
}

async function supersedePending(property, actor, reason, session) {
  await CommercialPublicationRevision.updateMany(
    { resourceType: 'Property', resource: property._id, status: 'pending' },
    {
      $set: { status: 'superseded' },
      $push: { history: { event: 'superseded', actor: actorId(actor), reason } },
    },
    { session },
  );
}

function appendTransition(property, { to, action, actor, reason }) {
  const from = derivePublicationState(property);
  property.publicationLifecycleHistory.push({ from, to, action, actor: actorId(actor), reason });
  property.publicationLifecycleState = to;
}

async function createLifecycleRevision(property, { actor, reason, submissionType }, session) {
  await supersedePending(property, actor, 'Remplacée par une demande de cycle plus récente.', session);
  const proposedSnapshot = publicSnapshot(property);
  const baseline = property.approvedPublicSnapshot || {};
  const changedFields = classifySubstantiveChanges(baseline, proposedSnapshot);
  const [revision] = await CommercialPublicationRevision.create([{
    resourceType: 'Property', resource: property._id, tenant: property.tenant || null,
    owner: property.owner, baseVersion: Number(property.commercialPublicationVersion || 0),
    proposedSnapshot, changedFields: changedFields.length ? changedFields : ['availability'],
    submissionType, status: 'pending', submittedBy: actorId(actor),
    history: [{ event: 'submitted', actor: actorId(actor), reason }],
  }], { session });
  property.currentPublicationRevision = revision._id;
  return revision;
}

async function ownerWithdrawProperty({ propertyId, actor, availability, reason = '' }) {
  return inTransaction(async (session) => {
    const property = await loadProperty(propertyId, session);
    assertOwner(property, actor);
    if (derivePublicationState(property) === PUBLICATION_STATES.ADMIN_SUSPENDED) {
      fail('PROPERTY_ADMIN_SUSPENDED', 'La suspension Altimmo ne peut être levée par le propriétaire.', 409);
    }
    if (!OWNER_WITHDRAWAL_AVAILABILITIES.has(availability)) {
      fail('PROPERTY_AVAILABILITY_INVALID', 'Disponibilité de retrait invalide.', 422);
    }
    if (derivePublicationState(property) === PUBLICATION_STATES.OWNER_WITHDRAWN) {
      fail('PROPERTY_LIFECYCLE_CONFLICT', 'Cette annonce est déjà retirée.', 409);
    }
    await supersedePending(property, actor, 'Annulée par le retrait propriétaire.', session);
    appendTransition(property, { to: PUBLICATION_STATES.OWNER_WITHDRAWN, action: 'owner_withdraw', actor, reason });
    property.availability = availability;
    property.isPublished = false;
    property.currentPublicationRevision = null;
    await property.save({ session });
    return property.toObject();
  });
}

async function ownerRequestReactivation({ propertyId, actor, reason = '' }) {
  return inTransaction(async (session) => {
    const property = await loadProperty(propertyId, session);
    assertOwner(property, actor);
    if (derivePublicationState(property) === PUBLICATION_STATES.ADMIN_SUSPENDED) {
      fail('PROPERTY_ADMIN_SUSPENDED', 'La suspension Altimmo ne peut être levée par le propriétaire.', 409);
    }
    property.availability = 'Disponible';
    property.isPublished = false;
    appendTransition(property, { to: PUBLICATION_STATES.PENDING, action: 'owner_reactivation_requested', actor, reason });
    const revision = await createLifecycleRevision(property, { actor, reason, submissionType: 'reactivation' }, session);
    await property.save({ session });
    return { property: property.toObject(), revision };
  });
}

async function adminSuspendProperty({ propertyId, actor, reason = '' }) {
  return inTransaction(async (session) => {
    const property = await loadProperty(propertyId, session);
    if (derivePublicationState(property) === PUBLICATION_STATES.ADMIN_SUSPENDED) {
      fail('PROPERTY_LIFECYCLE_CONFLICT', 'Cette annonce est déjà suspendue.', 409);
    }
    await supersedePending(property, actor, 'Annulée par la suspension Altimmo.', session);
    appendTransition(property, { to: PUBLICATION_STATES.ADMIN_SUSPENDED, action: 'admin_suspend', actor, reason });
    property.isPublished = false;
    property.currentPublicationRevision = null;
    await property.save({ session });
    return property.toObject();
  });
}

async function adminLiftSuspension({ propertyId, actor, reason = '' }) {
  return inTransaction(async (session) => {
    const property = await loadProperty(propertyId, session);
    if (derivePublicationState(property) !== PUBLICATION_STATES.ADMIN_SUSPENDED) {
      fail('PROPERTY_NOT_SUSPENDED', 'Cette annonce ne fait pas l’objet d’une suspension Altimmo.', 409);
    }
    property.availability = 'Disponible';
    property.isPublished = false;
    appendTransition(property, { to: PUBLICATION_STATES.PENDING, action: 'admin_lift_suspension', actor, reason });
    const revision = await createLifecycleRevision(property, { actor, reason, submissionType: 'suspension_review' }, session);
    await property.save({ session });
    return { property: property.toObject(), revision };
  });
}

module.exports = {
  PUBLICATION_STATES,
  PropertyPublicationLifecycleError,
  derivePublicationState,
  isPropertyCommerciallyAvailable,
  ownerWithdrawProperty,
  ownerRequestReactivation,
  adminSuspendProperty,
  adminLiftSuspension,
};
