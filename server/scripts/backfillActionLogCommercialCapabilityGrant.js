#!/usr/bin/env node
// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X
// CAPABILITY-DATA-MIGRATION-AUDIT-TRAIL-REMEDIATION
//
// Cible : reconstruire l'ActionLog historique manquant pour un grant
// `platform.commercial.manage` déjà persisté sur un PlatformOperator
// existant. Ce script ne PEUT PAS modifier le PlatformOperator, le User,
// ni aucune autre ressource — sa seule mutation possible est
// **UNE insertion ActionLog canonique** après vérification que :
//   1. le PlatformOperator cible existe et est actif ;
//   2. l'User associé existe et a role='Admin' ;
//   3. la capacité `platform.commercial.manage` est DÉJÀ PRÉSENTE sur
//      l'opérateur (le grant a déjà eu lieu — il ne s'agit pas d'un
//      re-grant) ;
//   4. aucun ActionLog équivalent n'existe déjà (dédup canonique).
//
// Contrat sécurité :
//   - Dry-run par défaut, aucun write.
//   - `--apply` requis pour toute écriture + `--confirm-database=<nom>`.
//   - Aucun `$addToSet`, `$set capabilities`, `$pull capabilities`,
//     `save()`, `findOneAndUpdate` ni `updateOne`/`updateMany` sur
//     PlatformOperator/User/OrgMembership.
//   - Insert-only sur ActionLog, jamais update.
//
// Usage (dry-run) :
//   node scripts/backfillActionLogCommercialCapabilityGrant.js \
//     --operator-id=<id> \
//     --user-id=<id> \
//     --grantedBy=<email-ou-userId> \
//     --reason="Remédiation historique ..." \
//     --historical-date=2026-09-17
//
// Usage (apply) :
//   node scripts/backfillActionLogCommercialCapabilityGrant.js \
//     --operator-id=<id> \
//     --user-id=<id> \
//     --grantedBy=<email> \
//     --reason="..." \
//     --historical-date=2026-09-17 \
//     --confirm-database=<nom_exact> --apply
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const ActionLog = require('../models/ActionLog');

const TARGET_CAPABILITY = 'platform.commercial.manage';
const AUDIT_MODULE = 'PlatformAdmin';
const AUDIT_SCOPE_MODE = 'platform';
const AUDIT_ACTION = 'platform_operator.capability_granted';
const AUDIT_TYPE_ACTION = 'MODIFICATION';
const REMEDIATION_MARKER = 'HISTORICAL_ACTIONLOG_REMEDIATION';

class CliError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const args = new Set(process.argv.slice(2));
const valueOf = (name) => process.argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);

function parseArgs() {
  const apply = args.has('--apply');
  const operatorId = valueOf('--operator-id');
  const userId = valueOf('--user-id');
  const grantedBy = valueOf('--grantedBy');
  const reason = valueOf('--reason');
  const historicalDate = valueOf('--historical-date');
  const confirmDatabase = valueOf('--confirm-database');
  if (!operatorId) throw new CliError('MISSING_OPERATOR_ID', '--operator-id=<PlatformOperator._id> requis.');
  if (!mongoose.isValidObjectId(operatorId)) throw new CliError('INVALID_OPERATOR_ID', '--operator-id doit être un ObjectId valide.');
  if (!userId) throw new CliError('MISSING_USER_ID', '--user-id=<User._id attendu> requis pour vérifier l\'association User↔Operator.');
  if (!mongoose.isValidObjectId(userId)) throw new CliError('INVALID_USER_ID', '--user-id doit être un ObjectId valide.');
  if (apply) {
    if (!grantedBy || !grantedBy.trim()) throw new CliError('MISSING_GRANTED_BY', '--grantedBy=<email> requis pour --apply.');
    if (!reason || !reason.trim()) throw new CliError('MISSING_REASON', '--reason requis pour --apply.');
    if (!confirmDatabase) throw new CliError('MISSING_CONFIRM_DATABASE', '--confirm-database=<nom exact> requis pour --apply.');
  }
  return { apply, operatorId, userId, grantedBy, reason, historicalDate, confirmDatabase };
}

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-CAPABILITY-DATA-MIGRATION-
// AUDIT-TRAIL-REMEDIATION — Read-only plan. Never mutates.
async function planRemediation({ operatorId, userId, grantedBy, reason, historicalDate }) {
  const operator = await PlatformOperator.findById(operatorId).lean();
  if (!operator) return { wouldInsert: false, blockingReason: 'TARGET_OPERATOR_NOT_FOUND' };
  if (String(operator.user) !== String(userId)) {
    return { wouldInsert: false, blockingReason: 'TARGET_USER_MISMATCH', operator };
  }
  if (operator.status !== 'active') {
    return { wouldInsert: false, blockingReason: `TARGET_OPERATOR_STATUS_${operator.status.toUpperCase()}`, operator };
  }
  const user = await User.findById(userId).select('_id role email name').lean();
  if (!user) return { wouldInsert: false, blockingReason: 'ASSOCIATED_USER_MISSING', operator };
  if (user.role !== 'Admin') return { wouldInsert: false, blockingReason: 'TARGET_GLOBAL_ADMIN_PREREQUISITE_MISSING', operator, user };
  if (!operator.capabilities.includes(TARGET_CAPABILITY)) {
    return { wouldInsert: false, blockingReason: 'CAPABILITY_NOT_PRESENT_REMEDIATION_FORBIDDEN', operator, user };
  }
  const equivalent = await ActionLog.findOne({
    module: AUDIT_MODULE,
    scopeMode: AUDIT_SCOPE_MODE,
    action: AUDIT_ACTION,
    'cible.id': String(operator._id),
    'cible.type': 'PlatformOperator',
    // Deux critères combinés pour ne dédupliquer QUE des remédiations
    // portant sur la capacité `platform.commercial.manage`.
    'metadata.nouvelleValeur': { $regex: TARGET_CAPABILITY },
  }).lean();
  if (equivalent) {
    return { wouldInsert: false, blockingReason: 'NO_CHANGE_AUDIT_ALREADY_PRESENT', operator, user, equivalent };
  }
  return {
    wouldInsert: true,
    blockingReason: null,
    operator, user,
    plannedDoc: buildActionLogDoc({ operator, grantedBy, reason, historicalDate }),
  };
}

function buildActionLogDoc({ operator, grantedBy, reason, historicalDate }) {
  const before = { capabilities: (operator.capabilities || []).filter((c) => c !== TARGET_CAPABILITY) };
  const after = { capabilities: operator.capabilities || [] };
  const grantedByStr = grantedBy || 'unknown';
  const remediationReason = reason || `${REMEDIATION_MARKER}: reconstruction de l'ActionLog manquant pour un grant réussi de ${TARGET_CAPABILITY}. Aucun nouveau grant de capacité.`;
  return {
    action: AUDIT_ACTION,
    description: `${REMEDIATION_MARKER} — PlatformOperator ${operator._id} — ${TARGET_CAPABILITY}${historicalDate ? ` (historical=${historicalDate})` : ''}. NO NEW CAPABILITY GRANT.`,
    module: AUDIT_MODULE,
    scopeMode: AUDIT_SCOPE_MODE,
    typeAction: AUDIT_TYPE_ACTION,
    auteur: { email: /@/.test(grantedByStr) ? grantedByStr : undefined, nom: grantedByStr, role: 'Admin' },
    cible: { id: String(operator._id), type: 'PlatformOperator', nom: String(operator._id) },
    metadata: {
      ancienneValeur: JSON.stringify(before),
      nouvelleValeur: JSON.stringify(after),
      reason: `${REMEDIATION_MARKER} | historical=${historicalDate || 'unknown'} | ${remediationReason}`,
    },
  };
}

async function applyRemediation(plan) {
  if (!plan.wouldInsert) return { inserted: false, blockingReason: plan.blockingReason };
  const doc = plan.plannedDoc;
  const created = await ActionLog.create(doc);
  return { inserted: true, actionLogId: created._id };
}

async function main() {
  let opts;
  try { opts = parseArgs(); } catch (e) {
    console.error(JSON.stringify({ status: 'error', code: e.code, message: e.message }));
    process.exit(2);
  }
  const { apply, confirmDatabase } = opts;
  if (apply && process.env.NODE_ENV === 'production' && process.env.ALLOW_HISTORICAL_ACTIONLOG_REMEDIATION !== 'true') {
    console.error(JSON.stringify({ status: 'error', code: 'PRODUCTION_GUARD', message: 'ALLOW_HISTORICAL_ACTIONLOG_REMEDIATION=true requis pour --apply en production.' }));
    process.exit(3);
  }
  await connectDB();
  const dbName = mongoose.connection.name;
  if (apply && confirmDatabase !== dbName) {
    console.error(JSON.stringify({ status: 'error', code: 'DATABASE_CONFIRMATION_MISMATCH', message: `--confirm-database=${confirmDatabase} ≠ ${dbName}.`, resolvedDatabase: dbName }));
    await mongoose.disconnect();
    process.exit(4);
  }
  try {
    const plan = await planRemediation(opts);
    const result = {
      status: 'success',
      mode: apply ? 'APPLY' : 'DRY_RUN',
      resolvedDatabase: dbName,
      operatorId: opts.operatorId,
      userId: opts.userId,
      wouldInsert: plan.wouldInsert,
      blockingReason: plan.blockingReason,
      platformOperatorWouldChange: false,
    };
    if (!apply) {
      if (plan.plannedDoc) result.plannedDoc = plan.plannedDoc;
      console.log(JSON.stringify(result, null, 2));
      await mongoose.disconnect();
      process.exit(0);
    }
    const applyResult = await applyRemediation(plan);
    result.inserted = applyResult.inserted;
    if (applyResult.actionLogId) result.actionLogId = String(applyResult.actionLogId);
    console.log(JSON.stringify(result, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error(JSON.stringify({ status: 'error', code: e.code || 'UNEXPECTED', message: e.message }));
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

module.exports = {
  planRemediation, applyRemediation, buildActionLogDoc,
  TARGET_CAPABILITY, AUDIT_MODULE, AUDIT_SCOPE_MODE, AUDIT_ACTION, AUDIT_TYPE_ACTION, REMEDIATION_MARKER,
};

if (require.main === module) { main(); }
