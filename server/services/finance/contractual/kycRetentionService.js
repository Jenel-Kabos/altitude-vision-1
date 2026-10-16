// F-U1.J — Conservation, gel légal, demandes d'effacement et purge des
// justificatifs KYC.
//
// Principes :
//   - aucune durée légale supposée : sans politique ACTIVE (durée + référence
//     de décision), aucun dossier n'est éligible ;
//   - la purge réelle exige en plus KYC_PURGE_ENABLED=true et `apply: true` ;
//     par défaut, seul un plan (simulation) est produit ;
//   - un dossier sous gel légal ou dont l'attestation est vivante n'est jamais
//     purgé ;
//   - la référence Mongo n'est retirée qu'APRÈS preuve de suppression
//     prestataire ; un échec reste tracé et rejouable ;
//   - une demande d'effacement est enregistrée pour examen juridique, jamais
//     exécutée automatiquement.

const crypto = require('crypto');
const mongoose = require('mongoose');
const KycCase = require('../../../models/FinancialIdentityKycCase');
const KycDocumentDisposal = require('../../../models/KycDocumentDisposal');
const K = require('../../../constants/financialKycConstants');
const { fail } = require('../financialError');
const storage = require('../../storage/kycDocumentStorageService');
const authz = require('./contractualFinanceAuthorizationService');

const { CONTRACTUAL_CAPABILITIES: CAP, idOf } = authz;
const DAY = 86400000;
const assetKeyOf = (asset) => crypto.createHash('sha256').update(String(asset?.publicId || '')).digest('hex');

async function assertReviewer(actor) {
  const authority = await authz.resolveContractualAuthority(actor);
  if (authority.plane !== 'PLATFORM' || !authority.capabilities.has(CAP.KYC_ATTEST)) fail('FINANCIAL_UNAUTHORIZED', 'Habilitation de vérification KYC requise.', 403);
  return authority.userId;
}

// Gel légal (contentieux, réquisition) : suspend toute purge du dossier.
async function setLegalHold({ actor, caseId, active, reason }) {
  const reviewerId = await assertReviewer(actor);
  if (!String(reason || '').trim()) fail('KYC_REASON_REQUIRED', 'Motif requis.', 422);
  const updated = mongoose.isValidObjectId(caseId) ? await KycCase.findOneAndUpdate(
    { _id: caseId },
    {
      $set: { 'retention.legalHold': { active: Boolean(active), reason, setBy: reviewerId, setAt: new Date() } },
      $inc: { revision: 1 }, $push: { history: { action: active ? 'legal_hold_set' : 'legal_hold_released', actor: reviewerId, reason, at: new Date() } },
    },
    { new: true },
  ) : null;
  if (!updated) fail('KYC_CASE_NOT_FOUND', 'Dossier inaccessible.', 404);
  return { caseId: updated._id, legalHold: updated.retention.legalHold.active };
}

// Demande d'effacement par la personne concernée : enregistrée pour examen
// juridique (obligations de conservation, contentieux), jamais exécutée ici.
async function requestErasure({ actor, caseId, reason }) {
  const kycCase = mongoose.isValidObjectId(caseId) ? await KycCase.findById(caseId) : null;
  if (!kycCase || String(kycCase.subject) !== idOf(actor)) fail('KYC_CASE_NOT_FOUND', 'Dossier inaccessible.', 404);
  await KycCase.updateOne({ _id: kycCase._id }, {
    $push: {
      erasureRequests: { requestedBy: idOf(actor), requestedAt: new Date(), reason, status: 'pending_legal_review' },
      history: { action: 'erasure_requested', actor: idOf(actor), reason, at: new Date() },
    },
  });
  return { status: 'pending_legal_review' };
}

async function planPurge({ now = new Date() } = {}) {
  const policy = K.kycRetentionPolicy();
  const orphans = await KycDocumentDisposal.countDocuments({ reason: 'ORPHAN_UPLOAD', status: { $in: ['pending', 'failed'] } });
  if (policy.status !== 'ACTIVE') return { policy, eligible: [], excluded: [], orphans };
  const cutoff = new Date(now.getTime() - policy.durationDays * DAY);
  const closed = await KycCase.find({ status: { $in: K.KYC_CLOSED_STATUSES }, 'retention.closedAt': { $ne: null, $lte: cutoff } }).lean();
  const eligible = []; const excluded = [];
  for (const c of closed) {
    if (c.retention?.legalHold?.active) { excluded.push({ caseId: c._id, reason: 'LEGAL_HOLD' }); continue; }
    const docIds = (c.documents || []).filter((doc) => !doc.purgedAt).map((doc) => doc.docId);
    if (docIds.length) eligible.push({ caseId: c._id, docIds, closedAt: c.retention.closedAt });
  }
  return { policy, eligible, excluded, orphans };
}

async function disposeOne(disposal) {
  const record = await KycDocumentDisposal.findById(disposal._id).select(storage.fullAssetSelect('asset'));
  let proof;
  try {
    proof = await storage.remove(record.asset.toObject ? record.asset.toObject() : record.asset);
  } catch (error) {
    await KycDocumentDisposal.updateOne({ _id: record._id }, { $set: { status: 'failed', lastErrorCode: error.code || 'UNKNOWN' }, $inc: { attempts: 1 } });
    return { disposalId: record._id, status: 'failed' };
  }
  if (!proof.deleted) {
    await KycDocumentDisposal.updateOne({ _id: record._id }, { $set: { status: 'failed', lastErrorCode: `PROVIDER_${proof.providerResult || 'UNKNOWN'}` }, $inc: { attempts: 1 } });
    return { disposalId: record._id, status: 'failed' };
  }
  // Preuve obtenue : retrait de la référence applicative puis clôture.
  if (record.docId) {
    await KycCase.updateOne(
      { _id: record.kycCase },
      { $unset: { 'documents.$[doc].asset': '' }, $set: { 'documents.$[doc].purgedAt': proof.at }, $push: { history: { action: 'document_purged', reason: record.docId, at: proof.at } } },
      { arrayFilters: [{ 'doc.docId': record.docId }] },
    );
  }
  await KycDocumentDisposal.updateOne({ _id: record._id }, {
    $set: { status: 'done', lastErrorCode: null, proof: { providerResult: proof.providerResult, at: proof.at, cdnInvalidationRequested: true } },
    $unset: { asset: '' }, $inc: { attempts: 1 },
  });
  return { disposalId: record._id, status: 'done' };
}

// Exécution : simulation par défaut. Réelle seulement avec `apply: true` ET
// KYC_PURGE_ENABLED=true. Rejoue aussi les suppressions en échec.
async function executePurge({ now = new Date(), apply = false } = {}) {
  const plan = await planPurge({ now });
  if (!apply) return { mode: 'dry-run', plan };
  if (process.env.KYC_PURGE_ENABLED !== 'true') fail('KYC_PURGE_DISABLED', 'Purge KYC désactivée.', 403);
  for (const entry of plan.eligible) {
    const kycCase = await KycCase.findById(entry.caseId).select(storage.fullAssetSelect('documents.asset')).lean();
    if (!kycCase || kycCase.retention?.legalHold?.active) continue;
    for (const doc of kycCase.documents.filter((item) => item.asset && !item.purgedAt)) {
      await KycDocumentDisposal.updateOne(
        { assetKey: assetKeyOf(doc.asset) },
        { $setOnInsert: { kycCase: kycCase._id, docId: doc.docId, assetKey: assetKeyOf(doc.asset), asset: doc.asset, reason: 'RETENTION_EXPIRED', status: 'pending' } },
        { upsert: true },
      );
    }
  }
  const queue = await KycDocumentDisposal.find({ status: { $in: ['pending', 'failed'] } }).lean();
  const results = [];
  for (const disposal of queue) results.push(await disposeOne(disposal));
  return { mode: 'apply', plan, results };
}

// Objet stocké sans référence applicative (téléversement avorté) : suppression
// immédiate tentée ; en cas d'échec, tracé pour reprise.
async function disposeOrphan({ kycCase, asset }) {
  try {
    const proof = await storage.remove(asset);
    if (proof.deleted) return { status: 'done' };
  } catch { /* tracé ci-dessous */ }
  await KycDocumentDisposal.updateOne(
    { assetKey: assetKeyOf(asset) },
    { $setOnInsert: { kycCase, docId: null, assetKey: assetKeyOf(asset), asset, reason: 'ORPHAN_UPLOAD', status: 'pending' } },
    { upsert: true },
  );
  return { status: 'pending' };
}

module.exports = { setLegalHold, requestErasure, planPurge, executePurge, disposeOrphan };
