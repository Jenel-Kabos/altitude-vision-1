const APPLICANT_PRIVATE_FIELDS = new Set([
  'password', 'passwordConfirm', 'token', 'refreshToken', 'tokenVersion', 'googleId',
]);
const DIRECT_CONTACT_FIELDS = new Set(['email', 'phone', 'address']);
const PlatformOperator = require('../models/PlatformOperator');
const ApplicationDisclosureEvent = require('../models/ApplicationDisclosureEvent');
const { assertActiveScope } = require('./contactAuthorizationService');

const plain = (value) => value?.toObject ? value.toObject() : { ...value };
const isBsonId = (value) => value && typeof value === 'object' && (value._bsontype === 'ObjectId' || value.constructor?.name === 'ObjectId');

function safeApplicant(value, { contact = false } = {}) {
  if (!value || typeof value !== 'object' || isBsonId(value)) return value;
  return Object.fromEntries(Object.entries(plain(value)).filter(([key]) =>
    !APPLICANT_PRIVATE_FIELDS.has(key) && (contact || !DIRECT_CONTACT_FIELDS.has(key))));
}

const safeAttachments = (attachments = []) => attachments.map((value) => {
  const { storageKey, url, publicId, provider, ...safe } = plain(value);
  return safe;
});

function base(value, audience) {
  const data = plain(value);
  data.applicant = safeApplicant(data.applicant, { contact: audience === 'applicant_self' });
  data.projection = {
    audience,
    contactDetailsVisible: audience === 'applicant_self',
    contactDisclosureAvailable: audience === 'owner_decision' || audience === 'platform_mediator',
    evidenceDownloadAuthorized: audience === 'applicant_self' || audience === 'platform_mediator',
  };
  return data;
}

function serializeDecisionView(value) {
  const data = base(value, 'owner_decision');
  delete data.attachments;
  if (data.rentalApplication) {
    delete data.rentalApplication.monthlyIncome;
    delete data.rentalApplication.incomeCurrency;
  }
  return data;
}

function serializeApplicantView(value) {
  const data = base(value, 'applicant_self');
  data.attachments = safeAttachments(data.attachments);
  return data;
}

function serializePlatformView(value) {
  const data = base(value, 'platform_mediator');
  delete data.attachments;
  if (data.rentalApplication) {
    delete data.rentalApplication.monthlyIncome;
    delete data.rentalApplication.incomeCurrency;
  }
  return data;
}

const actorId = (actor) => actor?._id || actor?.id;
const resourceId = (value) => value?._id || value;
const denied = (code, message) => Object.assign(new Error(message), { name: 'ContactAuthorizationError', code, statusCode: 403 });

async function isCommercialMediator(actor) {
  return Boolean(await PlatformOperator.exists({ user: actorId(actor), status: 'active', capabilities: 'platform.commercial.manage' }));
}

async function authorizeContactDisclosure({ application, actor, tenantId }) {
  if (await isCommercialMediator(actor)) return { mode: 'platform_mediator', authorizationId: null };
  if (String(actorId(actor)) !== String(resourceId(application.owner))) throw denied('APPLICATION_CONTACT_DISCLOSURE_FORBIDDEN', 'Accès aux coordonnées refusé.');
  const authorization = await assertActiveScope({
    clientId: resourceId(application.applicant), representativeId: resourceId(application.owner),
    propertyId: resourceId(application.property), dossierType: 'RealEstateApplication',
    dossierId: resourceId(application), tenantId: tenantId || null, scope: 'contact_details_disclosure',
  });
  return { mode: 'authorized_contact', authorizationId: String(authorization._id) };
}

async function authorizeEvidenceAccess({ application, actor }) {
  if (String(actorId(actor)) === String(resourceId(application.applicant))) return { mode: 'applicant_self' };
  if (await isCommercialMediator(actor)) return { mode: 'platform_mediator' };
  throw denied('APPLICATION_EVIDENCE_ACCESS_REQUIRED', 'Autorité distincte requise pour ce justificatif.');
}

async function recordApplicationDisclosure({ application, actor, tenantId, category, fields, reason, recipient, authority = {} }) {
  return ApplicationDisclosureEvent.create({
    application: resourceId(application), subject: resourceId(application.applicant), actor: actorId(actor),
    tenant: tenantId || null, category, fields: [...new Set(fields || [])], reason,
    recipient: recipient || actorId(actor), authorityMode: authority.mode,
    contactAuthorization: authority.authorizationId || null,
  });
}

module.exports = {
  serializeDecisionView, serializeApplicantView, serializePlatformView,
  authorizeContactDisclosure, authorizeEvidenceAccess, recordApplicationDisclosure,
};
