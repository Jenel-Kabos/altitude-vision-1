// F-U2.13 — Politique contractuelle applicable à un bail pour une période.
//
// Résolution (jamais par type de compte, rôle, organisation, `tenant:null`,
// valeur globale ou moteur actif) :
//   1. mode de gestion couvrant le DÉBUT de la période (`delegatedCoverageAt`) :
//      mandat de gestion déléguée dont une version est en vigueur à cette date,
//      activé, non résilié avant cette date ;
//   2. type attendu : ALTITUDE_DELEGATED si mandataire PLATFORM, sinon
//      OWNER_AUTONOMOUS (conditions propres au bail) ;
//   3. version de politique du bail en vigueur au début de la période ;
//   4. absence ou incohérence → POLICY_UNRESOLVED (aucun choix silencieux).
// Les conditions Altitude Vision ne deviennent opposables au locataire
// qu'avec son acceptation explicite, antérieure à l'événement concerné.

const crypto = require('crypto');
const mongoose = require('mongoose');
const Contrat = require('../../../models/Contrat');
const Property = require('../../../models/Property');
const Locataire = require('../../../models/Locataire');
const ManagementMandate = require('../../../models/ManagementMandate');
const ManagementMandateVersion = require('../../../models/ManagementMandateVersion');
const Policy = require('../../../models/LeaseContractualPolicy');
const Consent = require('../../../models/LeasePolicyConsent');
const C = require('../../../constants/contractualFinanceConstants');
const { POLICY_TYPES, ALTITUDE_DELEGATED_POLICY, SUPPORTED, PRESENTATION_TTL_MS } = require('../../../constants/leasePolicyConstants');
const { fail } = require('../financialError');
const authz = require('../contractual/contractualFinanceAuthorizationService');
const calendar = require('./rentCalendarService');
const { authorizeOnProperty } = require('./rentPropertyAuthorityService');

const { CONTRACTUAL_CAPABILITIES: CAP, idOf } = authz;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const canonical = (value) => JSON.stringify(value, Object.keys(value).sort());
const ENDED = [C.MANDATE_STATUSES.REVOKED, C.MANDATE_STATUSES.EXPIRED];

// ─── Mode de gestion à une date (source unique : politiques, 1 %, 10 %) ──

async function delegatedCoverageAt(propertyId, at) {
  const when = new Date(at);
  const mandates = await ManagementMandate.find({ property: propertyId }).sort({ createdAt: -1 }).lean();
  for (const mandate of mandates) {
    const history = mandate.statusHistory || [];
    if (!history.some((entry) => entry.to === C.MANDATE_STATUSES.ACTIVE)) continue; // jamais activé
    const ended = history.find((entry) => ENDED.includes(entry.to));
    if (ended && new Date(ended.at) <= when) continue;
    const version = await ManagementMandateVersion.findOne({ mandate: mandate._id, effectiveFrom: { $lte: when } }).sort({ versionNumber: -1 }).lean();
    if (version?.terms?.offer !== C.MANAGEMENT_OFFERS.DELEGATED_MANAGEMENT) continue;
    return { mode: 'DELEGATED', mandate, version, mandataryType: mandate.mandataryType };
  }
  return { mode: 'AUTONOMOUS', mandate: null, version: null, mandataryType: null };
}

// ─── Résolution ──────────────────────────────────────────────────────

async function resolvePolicyForPeriod({ lease, propertyId, periodLabel }) {
  const cal = calendar.rentCalendar(periodLabel);
  const coverage = await delegatedCoverageAt(propertyId, cal.start);
  const expectedType = coverage.mode === 'DELEGATED' && coverage.mandataryType === C.MANDATARY_TYPES.PLATFORM ? POLICY_TYPES.ALTITUDE_DELEGATED : POLICY_TYPES.OWNER_AUTONOMOUS;
  const base = { period: periodLabel, expectedType, managementMode: coverage.mode, mandate: coverage.mandate?._id || null };
  const policy = await Policy.findOne({ lease: lease._id || lease, effectiveFrom: { $lte: cal.start }, $or: [{ effectiveTo: null }, { effectiveTo: { $gt: cal.start } }] }).sort({ version: -1 }).lean();
  if (!policy) return { ...base, status: 'POLICY_UNRESOLVED', reason: 'NO_POLICY', policy: null, terms: null };
  if (policy.type !== expectedType) return { ...base, status: 'POLICY_UNRESOLVED', reason: 'MANAGEMENT_MODE_MISMATCH', policy, terms: null };
  if (expectedType === POLICY_TYPES.ALTITUDE_DELEGATED && String(policy.mandate) !== String(coverage.mandate._id)) return { ...base, status: 'POLICY_UNRESOLVED', reason: 'MANDATE_MISMATCH', policy, terms: null };
  return { ...base, status: 'RESOLVED', reason: null, policy, terms: policy.terms };
}

// Politique figée sur l'échéance à sa création (période rattachée à la
// politique réellement applicable) ; à défaut, résolution.
async function policyForDocument(document) {
  const snapshot = document.metadata?.policy;
  if (snapshot?.status === 'RESOLVED' && snapshot.id) {
    const policy = await Policy.findById(snapshot.id).lean();
    if (policy) return { status: 'RESOLVED', reason: null, policy, terms: policy.terms, expectedType: policy.type, period: document.metadata.period };
  }
  if (snapshot && snapshot.status !== 'RESOLVED') return { status: 'POLICY_UNRESOLVED', reason: snapshot.reason || 'NO_POLICY', policy: null, terms: null, period: document.metadata.period };
  if (document.subjectType !== 'Contrat') return { status: 'POLICY_UNRESOLVED', reason: 'NO_LEASE', policy: null, terms: null, period: document.metadata?.period };
  return resolvePolicyForPeriod({ lease: document.subjectId, propertyId: document.establishmentId, periodLabel: document.metadata.period });
}

// Opposabilité au locataire : conditions Altitude Vision acceptées par le
// locataire du bail AVANT `at` ; conditions autonomes : relation propre au
// bailleur (aucun consentement Altitude Vision exigé).
async function consentStatusAt(resolution, at) {
  if (resolution.status !== 'RESOLVED') return { valid: false, reason: resolution.reason || 'POLICY_UNRESOLVED' };
  if (!resolution.policy.consentRequired) return { valid: true, reason: null, signatureStatus: null };
  const lease = await Contrat.findById(resolution.policy.lease).select('locataire').lean();
  const locataire = lease?.locataire ? await Locataire.findById(lease.locataire).select('user').lean() : null;
  if (!locataire?.user) return { valid: false, reason: 'TENANT_ACCOUNT_MISSING' };
  const consent = await Consent.findOne({ policy: resolution.policy._id, signer: locataire.user, status: 'ACCEPTED', acceptedAt: { $lte: new Date(at) } }).lean();
  return consent ? { valid: true, reason: null, consentId: consent._id, signatureStatus: consent.signatureStatus } : { valid: false, reason: 'CONSENT_MISSING' };
}

// ─── Création de versions ────────────────────────────────────────────

function validateDay(spec, name) {
  if (spec == null) return null;
  const ok = spec && (spec.day === 'END' || (Number.isInteger(spec.day) && spec.day >= 1 && spec.day <= 30)) && [0, 1].includes(spec.monthOffset ?? 0);
  if (!ok) fail('LEASE_POLICY_TERMS_INVALID', `Date « ${name} » invalide (jour 1–30 ou END, mois 0 ou 1).`, 422);
  return { day: spec.day, monthOffset: spec.monthOffset ?? 0 };
}

// Conditions autonomes : uniquement ce qui est stipulé ; rien n'est présumé.
function validateAutonomousTerms(terms = {}) {
  const allowed = ['due', 'grace', 'penalty', 'formalNotice', 'prorata', 'imputation'];
  const unknown = Object.keys(terms || {}).filter((key) => !allowed.includes(key));
  if (unknown.length) fail('LEASE_POLICY_TERMS_INVALID', `Conditions non prises en charge : ${unknown.join(', ')}.`, 422);
  const out = { due: validateDay(terms.due, 'échéance'), grace: validateDay(terms.grace, 'tolérance'), penalty: null, formalNotice: null, prorata: null, imputation: null };
  if (terms.penalty != null) {
    const { rateBasisPoints, base = 'UNPAID_RENT_PRINCIPAL' } = terms.penalty;
    if (!Number.isInteger(rateBasisPoints) || rateBasisPoints <= 0 || rateBasisPoints > 10000 || !SUPPORTED.penaltyBases.includes(base)) fail('LEASE_POLICY_TERMS_INVALID', 'Pénalité : taux en points de base (1–10 000) sur le loyer principal impayé.', 422);
    if (!out.due) fail('LEASE_POLICY_TERMS_INVALID', 'Une pénalité suppose une date d’échéance stipulée.', 422);
    out.penalty = { rateBasisPoints, base };
  }
  if (terms.formalNotice != null) {
    const spec = validateDay(terms.formalNotice, 'relance formelle');
    if (!out.due) fail('LEASE_POLICY_TERMS_INVALID', 'Une relance formelle suppose une date d’échéance stipulée.', 422);
    out.formalNotice = { ...spec, suspendOnDifficultyReport: terms.formalNotice.suspendOnDifficultyReport === true, suspendOnApprovedDeferral: terms.formalNotice.suspendOnApprovedDeferral === true };
  }
  if (terms.prorata != null) {
    if (!SUPPORTED.prorataMethods.includes(terms.prorata.method)) fail('LEASE_POLICY_TERMS_INVALID', 'Méthode de prorata non prise en charge.', 422);
    out.prorata = { method: terms.prorata.method };
  }
  if (terms.imputation != null) {
    if (!SUPPORTED.imputations.includes(terms.imputation)) fail('LEASE_POLICY_TERMS_INVALID', 'Ordre d’imputation non pris en charge.', 422);
    out.imputation = terms.imputation;
  }
  return out;
}

async function createPolicy({ actor, leaseId, type, terms = null, effectiveFrom, documentReference, ownerRecordedAcceptance = null, now = new Date() }) {
  const lease = mongoose.isValidObjectId(leaseId) ? await Contrat.findById(leaseId).lean() : null;
  if (!lease || lease.type !== 'location') fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Bail inaccessible.', 404);
  const property = await Property.findById(lease.bien).select('owner tenant').lean();
  if (!property) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Bail inaccessible.', 404);
  if (!Object.values(POLICY_TYPES).includes(type)) fail('LEASE_POLICY_TYPE_INVALID', 'Type de politique invalide.', 422);
  if (!String(documentReference || '').trim()) fail('LEASE_POLICY_DOCUMENT_REQUIRED', 'Référence du document contractuel requise.', 422);
  const from = new Date(effectiveFrom);
  if (Number.isNaN(from.getTime())) fail('LEASE_POLICY_DATE_INVALID', 'Date d’effet invalide.', 422);
  // Aucune rétroactivité : au plus tôt le début du mois courant (Brazzaville).
  const today = calendar.localDay(now);
  const monthStart = calendar.watMidnight(today.year, today.month, 1);
  if (from < monthStart) fail('LEASE_POLICY_RETROACTIVE', 'Une politique ne peut pas régir une période passée.', 409);
  const coverage = await delegatedCoverageAt(property._id, from);
  const actorId = idOf(actor);
  let plane; let mandate = null; let policyTerms; let consentRequired; let validation;
  if (type === POLICY_TYPES.ALTITUDE_DELEGATED) {
    const authority = await authz.assertContractualCapability(actor, CAP.BILLING_MANAGE);
    if (authority.plane !== 'PLATFORM') fail('FINANCIAL_UNAUTHORIZED', 'Les conditions Altitude Vision sont établies par la plateforme.', 403);
    if (coverage.mode !== 'DELEGATED' || coverage.mandataryType !== C.MANDATARY_TYPES.PLATFORM) fail('LEASE_POLICY_MODE_MISMATCH', 'Aucun mandat de gestion déléguée à Altitude Vision à cette date : conditions Altitude Vision inapplicables.', 409);
    plane = 'PLATFORM'; mandate = coverage.mandate._id; policyTerms = ALTITUDE_DELEGATED_POLICY.terms; consentRequired = true;
    validation = { status: 'COMMERCIALLY_VALIDATED', legalStatus: 'NOT_VALIDATED' };
  } else {
    if (coverage.mode === 'DELEGATED' && coverage.mandataryType === C.MANDATARY_TYPES.PLATFORM) fail('LEASE_POLICY_MODE_MISMATCH', 'Bien en gestion déléguée à Altitude Vision à cette date.', 409);
    const live = await ManagementMandate.findOne({ property: property._id, status: { $in: C.LIVE_MANDATE_STATUSES } }).lean();
    if (!property.tenant && !live && actorId && String(property.owner) === actorId) plane = 'OWNER_SELF';
    else {
      plane = (await authorizeOnProperty(actor, CAP.BILLING_MANAGE, property, live)).plane;
    }
    policyTerms = validateAutonomousTerms(terms || {}); consentRequired = false;
    validation = { status: 'DECLARED_BY_OWNER', legalStatus: 'NOT_VALIDATED' };
  }
  const previous = await Policy.findOne({ lease: lease._id }).sort({ version: -1 }).lean();
  if (previous && from <= new Date(previous.effectiveFrom)) fail('LEASE_POLICY_RETROACTIVE', 'Une nouvelle version doit prendre effet après la précédente.', 409);
  const version = (previous?.version || 0) + 1;
  const termsHash = sha256(canonical({ terms: JSON.stringify(policyTerms) }));
  const documentHash = sha256(canonical({ lease: String(lease._id), type, version: String(version), terms: JSON.stringify(policyTerms), documentReference: String(documentReference).trim(), effectiveFrom: from.toISOString() }));
  let created;
  try {
    [created] = await Policy.create([{
      lease: lease._id, property: property._id, owner: property.owner, tenant: property.tenant || null, mandate, type, version, effectiveFrom: from,
      terms: policyTerms, termsHash, policyLabel: type === POLICY_TYPES.ALTITUDE_DELEGATED ? ALTITUDE_DELEGATED_POLICY.version : null,
      documentReference: String(documentReference).trim(), documentHash, consentRequired, validation, createdBy: actorId, authorityPlane: plane,
      ownerRecordedAcceptance: type === POLICY_TYPES.OWNER_AUTONOMOUS && ownerRecordedAcceptance ? { reference: String(ownerRecordedAcceptance.reference || '').slice(0, 300) || null, date: ownerRecordedAcceptance.date ? new Date(ownerRecordedAcceptance.date) : null, recordedBy: actorId } : undefined,
      history: [{ action: 'created', actor: actorId, at: new Date(now) }],
    }]);
  } catch (error) {
    if (error?.code === 11000) fail('LEASE_POLICY_CONCURRENT_VERSION', 'Une autre version vient d’être créée.', 409);
    throw error;
  }
  if (previous) await Policy.updateOne({ _id: previous._id }, { $set: { effectiveTo: from, status: 'superseded' }, $push: { history: { action: 'superseded', actor: actorId, at: new Date(now), reason: `v${version}` } } });
  return created.toObject();
}

// ─── Consentement électronique (locataire) ───────────────────────────

function renderPolicyDocument(policy) {
  const t = policy.terms || {};
  const day = (spec) => (spec ? `${spec.day === 'END' ? 'fin de mois (le 30 ; février : dernier jour)' : `le ${spec.day}`}${spec.monthOffset ? ' du mois suivant' : ''}` : 'non stipulé');
  return {
    title: policy.type === POLICY_TYPES.ALTITUDE_DELEGATED ? 'Conditions de paiement et de recouvrement — gestion déléguée Altitude Vision' : 'Conditions du bail (gestion autonome)',
    lease: policy.lease, version: policy.version, effectiveFrom: policy.effectiveFrom, documentReference: policy.documentReference, policyLabel: policy.policyLabel,
    clauses: [
      `Échéance : ${day(t.due)}.`,
      `Tolérance : ${t.grace ? `jusqu’au ${day(t.grace)} inclus` : 'aucune'}.`,
      `Pénalité de retard : ${t.penalty ? `${t.penalty.rateBasisPoints / 100} % du loyer principal restant impayé à la fin de la tolérance, appliquée une seule fois` : 'aucune'}.`,
      `Mise en demeure : ${t.formalNotice ? `évaluée ${day(t.formalNotice)} ; suspendue en cas de signalement de difficulté avant cette date ou de report approuvé` : 'aucune procédure stipulée'}.`,
      `Prorata : ${t.prorata ? 'base conventionnelle de 30 jours (aucun supplément pour le 31)' : 'non stipulé'}.`,
      `Imputation des paiements : ${t.imputation === 'CHARGES_FIRST' ? 'charges avant le loyer' : t.imputation === 'RENT_FIRST' ? 'loyer principal avant les charges' : 'non stipulée'}.`,
    ],
    legalNotice: 'Acceptation électronique authentifiée : ne constitue pas une signature électronique qualifiée ; elle ne remplace pas les formalités légales éventuellement exigées.',
  };
}

async function tenantSignerFor(policy, userId) {
  const lease = await Contrat.findById(policy.lease).select('locataire').lean();
  const locataire = lease?.locataire ? await Locataire.findById(lease.locataire).select('user').lean() : null;
  if (!locataire?.user || String(locataire.user) !== String(userId)) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Conditions inaccessibles.', 404);
  return locataire;
}

async function presentPolicy({ userId, policyId, now = new Date() }) {
  const policy = mongoose.isValidObjectId(policyId) ? await Policy.findById(policyId).lean() : null;
  if (!policy) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Conditions inaccessibles.', 404);
  const locataire = await tenantSignerFor(policy, userId);
  const document = renderPolicyDocument(policy);
  const existing = await Consent.findOne({ policy: policy._id, signer: userId }).lean();
  if (existing?.status === 'ACCEPTED') return { document, documentHash: policy.documentHash, consent: { status: 'ACCEPTED', acceptedAt: existing.acceptedAt, signatureStatus: existing.signatureStatus } };
  if (!policy.consentRequired) return { document, documentHash: policy.documentHash, consent: { status: 'NOT_REQUIRED' } };
  const token = crypto.randomBytes(32).toString('hex');
  const presentation = { tokenHash: sha256(token), presentedAt: new Date(now), expiresAt: new Date(new Date(now).getTime() + PRESENTATION_TTL_MS) };
  if (existing) await Consent.updateOne({ _id: existing._id, status: 'PRESENTED' }, { $set: { presentation, documentHash: policy.documentHash }, $push: { history: { action: 'presented', actor: userId, at: new Date(now) } } });
  else {
    await Consent.create({ policy: policy._id, lease: policy.lease, policyVersion: policy.version, signer: userId, signerRole: 'LOCATAIRE', locataire: locataire._id, documentHash: policy.documentHash, status: 'PRESENTED', presentation, history: [{ action: 'presented', actor: userId, at: new Date(now) }] })
      .catch((error) => { if (error?.code !== 11000) throw error; });
  }
  return { document, documentHash: policy.documentHash, presentationToken: token, expiresAt: presentation.expiresAt, consent: { status: 'PRESENTED' } };
}

// Acceptation : action explicite (`accept === true`), jeton de présentation
// valide et empreinte du document présenté ; horodatage serveur ; jamais
// pour un autre utilisateur ; jamais réécrite.
async function acceptPolicy({ userId, policyId, presentationToken, documentHash, accept, now = new Date() }) {
  if (accept !== true) fail('CONSENT_EXPLICIT_ACTION_REQUIRED', 'Acceptation explicite requise.', 422);
  const policy = mongoose.isValidObjectId(policyId) ? await Policy.findById(policyId).lean() : null;
  if (!policy) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Conditions inaccessibles.', 404);
  await tenantSignerFor(policy, userId);
  if (!policy.consentRequired) fail('CONSENT_NOT_REQUIRED', 'Ces conditions ne requièrent pas d’acceptation sur la plateforme.', 409);
  const consent = await Consent.findOne({ policy: policy._id, signer: userId }).select('+presentation.tokenHash').lean();
  if (!consent) fail('CONSENT_PRESENTATION_REQUIRED', 'Consultez d’abord le document complet.', 409);
  if (consent.status === 'ACCEPTED') fail('CONSENT_ALREADY_RECORDED', 'Acceptation déjà enregistrée.', 409);
  if (!presentationToken || sha256(String(presentationToken)) !== consent.presentation.tokenHash || new Date(now) > new Date(consent.presentation.expiresAt)) fail('CONSENT_PRESENTATION_INVALID', 'Présentation expirée ou invalide : consultez à nouveau le document.', 409);
  if (documentHash !== policy.documentHash) fail('CONSENT_DOCUMENT_MISMATCH', 'Le document accepté ne correspond pas au document en vigueur.', 409);
  const updated = await Consent.findOneAndUpdate(
    { _id: consent._id, status: 'PRESENTED' },
    { $set: { status: 'ACCEPTED', acceptedAt: new Date(now), explicitAction: 'EXPLICIT_ACCEPT', verificationStatus: 'AUTHENTICATED_ACCEPTANCE', signatureStatus: 'SIGNATURE_PENDING' }, $push: { history: { action: 'accepted', actor: userId, at: new Date(now) } } },
    { new: true },
  ).lean();
  if (!updated) fail('CONSENT_ALREADY_RECORDED', 'Acceptation déjà enregistrée.', 409);
  return updated;
}

const publicPolicy = (p) => ({ id: p._id, lease: p.lease, type: p.type, version: p.version, status: p.status, effectiveFrom: p.effectiveFrom, effectiveTo: p.effectiveTo, terms: p.terms, documentReference: p.documentReference, documentHash: p.documentHash, consentRequired: p.consentRequired, validation: p.validation, policyLabel: p.policyLabel });

// Liste des politiques d'un bail : bailleur, gestionnaire du périmètre, plateforme pour ses mandats, locataire du bail.
async function listLeasePolicies({ actor, leaseId }) {
  const lease = mongoose.isValidObjectId(leaseId) ? await Contrat.findById(leaseId).select('bien locataire').lean() : null;
  if (!lease) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Bail inaccessible.', 404);
  const property = await Property.findById(lease.bien).select('owner tenant').lean();
  const actorId = idOf(actor);
  const locataire = lease.locataire ? await Locataire.findById(lease.locataire).select('user').lean() : null;
  const isOwner = actorId && String(property?.owner) === actorId;
  const isTenant = actorId && locataire?.user && String(locataire.user) === actorId;
  if (!isOwner && !isTenant) {
    const live = await ManagementMandate.findOne({ property: property._id, status: { $in: C.LIVE_MANDATE_STATUSES } }).lean();
    await authorizeOnProperty(actor, CAP.CONTRACT_READ, property, live);
  }
  return (await Policy.find({ lease: lease._id }).sort({ version: 1 }).lean()).map(publicPolicy);
}

// Conditions des baux du locataire et état de son consentement.
async function tenantPolicies({ userId }) {
  const locataire = await Locataire.findOne({ user: userId }).select('_id').lean();
  if (!locataire) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Aucun dossier locataire rattaché à ce compte.', 404);
  const leases = await Contrat.find({ locataire: locataire._id, type: 'location' }).select('_id').lean();
  const policies = await Policy.find({ lease: { $in: leases.map((l) => l._id) } }).sort({ lease: 1, version: 1 }).lean();
  const consents = await Consent.find({ policy: { $in: policies.map((p) => p._id) }, signer: userId }).lean();
  return policies.map((policy) => {
    const consent = consents.find((c) => String(c.policy) === String(policy._id));
    return { ...publicPolicy(policy), consent: policy.consentRequired ? { status: consent?.status || 'NOT_PRESENTED', acceptedAt: consent?.acceptedAt || null, signatureStatus: consent?.signatureStatus || null } : { status: 'NOT_REQUIRED' } };
  });
}

module.exports = {
  tenantPolicies, delegatedCoverageAt, resolvePolicyForPeriod, policyForDocument, consentStatusAt, validateAutonomousTerms, createPolicy,
  renderPolicyDocument, presentPolicy, acceptPolicy, listLeasePolicies, publicPolicy,
};
