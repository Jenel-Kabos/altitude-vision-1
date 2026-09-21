#!/usr/bin/env node
// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X — CAPABILITY-DATA-MIGRATION
// Grant TARGETED PlatformOperator capability `platform.commercial.manage`
// à un opérateur DÉJÀ EXISTANT et actif, sans jamais remplacer ses
// capacités existantes. Deux modes :
//   - dry-run (par défaut) : lecture seule, aucun write.
//   - --apply : mutation atomique `$addToSet` + audit via ActionLog.
//
// Conventions CLI reprises verbatim de `bootstrapPlatformOperator.js` :
//   - garde production `ALLOW_...=true`
//   - garde `--confirm-database` (nom réel résolu par Mongoose)
//   - `--reason` + `--grantedBy` obligatoires en apply
//   - jamais de dépendance à server.js (cron/IMAP/HTTP)
//
// Invariants sécurité :
//   1. Refus si opérateur inconnu, inactif, suspendu ou révoqué.
//   2. Refus si User associé n'a pas `role='Admin'`.
//   3. Refus si capacité déjà présente (NO_CHANGE_ALREADY_GRANTED).
//   4. `$addToSet` atomique — jamais de replace de tableau.
//   5. `commercial.manage` n'est jamais accordé implicitement depuis
//      `finance.manage` ni depuis un rôle tenant.
//   6. Selection scope UNIQUE : `--operator-id` OU `--user-email`, jamais
//      une prédicat large (§5 : no `--all`, no `--all-active`).
//
// Usage (dry-run) :
//   node scripts/grantPlatformCommercialCapability.js \
//     --user-email=operateur@example.com \
//     --grantedBy=admin@example.com \
//     --reason="Post-migration platform.commercial.manage"
//
// Usage (apply, après vérification dry-run) :
//   node scripts/grantPlatformCommercialCapability.js \
//     --user-email=operateur@example.com \
//     --grantedBy=admin@example.com \
//     --reason="Post-migration platform.commercial.manage" \
//     --confirm-database=<nom_exact> --apply
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const { PLATFORM_OPERATOR_CAPABILITIES } = require('../constants/platformOperatorConstants');

const TARGET_CAPABILITY = 'platform.commercial.manage';

const args = new Set(process.argv.slice(2));
const valueOf = (name) => process.argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);

class CliError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function parseArgs() {
  const apply = args.has('--apply');
  const operatorId = valueOf('--operator-id');
  const userId = valueOf('--user-id');
  const userEmail = valueOf('--user-email');
  const grantedByEmail = valueOf('--grantedBy') || valueOf('--granted-by-email');
  const grantedByUserId = valueOf('--grantedByUserId') || valueOf('--granted-by-user-id');
  const reason = valueOf('--reason');
  const confirmDatabase = valueOf('--confirm-database');
  const selectionFlags = [operatorId, userId, userEmail].filter(Boolean).length;
  if (selectionFlags === 0) throw new CliError('MISSING_TARGET', 'Selection requise : --operator-id OU --user-id OU --user-email.');
  if (selectionFlags > 1) throw new CliError('AMBIGUOUS_TARGET', 'Selection unique requise : fournir un seul de --operator-id/--user-id/--user-email.');
  if (apply) {
    if (!grantedByEmail && !grantedByUserId) throw new CliError('MISSING_ACTOR', '--grantedBy=<email> ou --grantedByUserId=<id> requis pour --apply.');
    if (!reason || !reason.trim()) throw new CliError('MISSING_REASON', '--reason="motif opérationnel" requis pour --apply.');
    if (!confirmDatabase) throw new CliError('MISSING_CONFIRM_DATABASE', '--confirm-database=<nom_exact> requis pour --apply (vérification post-connexion Mongoose).');
  }
  return { apply, operatorId, userId, userEmail, grantedByEmail, grantedByUserId, reason, confirmDatabase };
}

async function resolveTargetOperator({ operatorId, userId, userEmail }) {
  let target = null;
  if (operatorId) {
    if (!mongoose.isValidObjectId(operatorId)) throw new CliError('INVALID_OPERATOR_ID', 'Identifiant PlatformOperator invalide.');
    target = await PlatformOperator.findById(operatorId);
  } else if (userId) {
    if (!mongoose.isValidObjectId(userId)) throw new CliError('INVALID_USER_ID', 'Identifiant User invalide.');
    target = await PlatformOperator.findOne({ user: userId });
  } else if (userEmail) {
    const user = await User.findOne({ email: userEmail.toLowerCase().trim() }).select('_id role');
    if (!user) throw new CliError('USER_NOT_FOUND', `Aucun utilisateur avec email=${userEmail}.`);
    target = await PlatformOperator.findOne({ user: user._id });
  }
  if (!target) throw new CliError('OPERATOR_NOT_FOUND', 'Aucun PlatformOperator résolu pour la selection.');
  return target;
}

async function resolveActor({ grantedByEmail, grantedByUserId }) {
  if (grantedByUserId) {
    if (!mongoose.isValidObjectId(grantedByUserId)) throw new CliError('INVALID_ACTOR_ID', 'Identifiant --grantedByUserId invalide.');
    const u = await User.findById(grantedByUserId).select('_id role email');
    if (!u) throw new CliError('ACTOR_NOT_FOUND', 'Acteur --grantedByUserId introuvable.');
    return u;
  }
  const u = await User.findOne({ email: grantedByEmail.toLowerCase().trim() }).select('_id role email');
  if (!u) throw new CliError('ACTOR_NOT_FOUND', `Acteur --grantedBy=${grantedByEmail} introuvable.`);
  return u;
}

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-CAPABILITY-DATA-MIGRATION —
// primitive extraite pour être testable en isolation (fixture Mongo)
// sans passer par le CLI complet.
async function planCommercialManageGrant({ operator, expectedCapability = TARGET_CAPABILITY }) {
  if (!PLATFORM_OPERATOR_CAPABILITIES.includes(expectedCapability)) {
    throw new CliError('UNKNOWN_CAPABILITY', `Capacité inconnue dans le registre canonique : ${expectedCapability}.`);
  }
  if (operator.status !== 'active') {
    return { operator, wouldChange: false, blockingReason: `OPERATOR_STATUS_${operator.status.toUpperCase()}`, before: operator.capabilities.slice(), after: operator.capabilities.slice() };
  }
  const user = await User.findById(operator.user).select('_id role isActive isTechnical');
  if (!user) {
    return { operator, user: null, wouldChange: false, blockingReason: 'ASSOCIATED_USER_MISSING', before: operator.capabilities.slice(), after: operator.capabilities.slice() };
  }
  if (user.role !== 'Admin') {
    return { operator, user, wouldChange: false, blockingReason: 'TARGET_GLOBAL_ADMIN_PREREQUISITE_MISSING', before: operator.capabilities.slice(), after: operator.capabilities.slice() };
  }
  const already = operator.capabilities.includes(expectedCapability);
  const after = already ? operator.capabilities.slice() : [...operator.capabilities, expectedCapability];
  return {
    operator, user,
    wouldChange: !already,
    blockingReason: already ? 'NO_CHANGE_ALREADY_GRANTED' : null,
    before: operator.capabilities.slice(),
    after,
  };
}

async function applyGrant({ operator, actor, reason, expectedCapability = TARGET_CAPABILITY }) {
  // §21 CAP-MIG-09 : la capacité proposée doit exister dans le registre
  // canonique, JAMAIS injectée via un chemin CLI. Vérification explicite
  // AVANT la mutation atomique (`$addToSet` de Mongo n'applique pas les
  // validators Mongoose).
  if (!PLATFORM_OPERATOR_CAPABILITIES.includes(expectedCapability)) {
    throw new CliError('UNKNOWN_CAPABILITY', `Capacité inconnue dans le registre canonique : ${expectedCapability}.`);
  }
  // §16-§17 : mutation atomique additive `$addToSet`, jamais un replace
  // du tableau construit à partir d'une lecture stale.
  const result = await PlatformOperator.findByIdAndUpdate(
    operator._id,
    { $addToSet: { capabilities: expectedCapability } },
    { new: true },
  );
  // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-CAPABILITY-DATA-MIGRATION-
  // AUDIT-TRAIL-FIX — reuse the canonical audit shape used by
  // `platformOperatorService.audit` (module='PlatformAdmin',
  // scopeMode='platform', metadata.{ancienneValeur, nouvelleValeur,
  // reason}). Previously used module='PlatformAuthority' which is not
  // a valid `ActionLog.module` enum value — Mongoose validation
  // rejected the write silently (swallowed by `.catch`). The persistence
  // of the capability grant still succeeded because the audit call
  // runs AFTER the atomic `$addToSet` — this is the intentional
  // ordering (audit is a best-effort log, never a business gate).
  try {
    const { logAction, buildAuteur } = require('../services/actionLogService');
    const before = { capabilities: operator.capabilities.slice() };
    const after = { capabilities: result.capabilities.slice() };
    await logAction({
      action: 'platform_operator.capability_granted',
      description: `PlatformOperator ${operator._id} — capability_granted (${reason || 'grantPlatformCommercialCapability CLI'})`,
      module: 'PlatformAdmin',
      scopeMode: 'platform',
      typeAction: 'MODIFICATION',
      auteur: buildAuteur(actor),
      cible: { id: String(operator._id), type: 'PlatformOperator', nom: String(operator._id) },
      metadata: {
        ancienneValeur: JSON.stringify(before),
        nouvelleValeur: JSON.stringify(after),
        reason,
      },
    }).catch(() => {});
  } catch { /* audit optional — the capability persistence is authoritative */ }
  return result;
}

async function main() {
  let opts;
  try { opts = parseArgs(); } catch (e) {
    console.error(JSON.stringify({ status: 'error', code: e.code || 'CLI_ARGS', message: e.message }));
    process.exit(2);
  }
  const { apply, reason, confirmDatabase } = opts;

  if (apply && process.env.NODE_ENV === 'production' && process.env.ALLOW_PLATFORM_COMMERCIAL_CAPABILITY_GRANT !== 'true') {
    console.error(JSON.stringify({ status: 'error', code: 'PRODUCTION_GUARD', message: 'ALLOW_PLATFORM_COMMERCIAL_CAPABILITY_GRANT=true requis pour --apply en production.' }));
    process.exit(3);
  }

  await connectDB();
  const dbName = mongoose.connection.name;
  if (apply && confirmDatabase !== dbName) {
    console.error(JSON.stringify({ status: 'error', code: 'DATABASE_CONFIRMATION_MISMATCH', message: `--confirm-database=${confirmDatabase} ne correspond pas à la base réellement résolue (${dbName}).`, resolvedDatabase: dbName }));
    await mongoose.disconnect();
    process.exit(4);
  }

  try {
    const operator = await resolveTargetOperator(opts);
    const plan = await planCommercialManageGrant({ operator });
    const result = {
      status: 'success',
      mode: apply ? 'APPLY' : 'DRY_RUN',
      capability: TARGET_CAPABILITY,
      operatorId: String(operator._id),
      userId: String(operator.user),
      userRole: plan.user ? plan.user.role : null,
      operatorStatus: operator.status,
      before: plan.before,
      after: plan.after,
      wouldChange: plan.wouldChange,
      blockingReason: plan.blockingReason,
      resolvedDatabase: dbName,
    };
    if (!apply) { console.log(JSON.stringify(result, null, 2)); await mongoose.disconnect(); process.exit(0); }
    if (!plan.wouldChange) {
      result.appliedChange = false;
      console.log(JSON.stringify(result, null, 2));
      await mongoose.disconnect();
      process.exit(0);
    }
    const actor = await resolveActor(opts);
    const updated = await applyGrant({ operator, actor, reason });
    result.appliedChange = true;
    result.after = updated.capabilities;
    console.log(JSON.stringify(result, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error(JSON.stringify({ status: 'error', code: e.code || 'UNEXPECTED', message: e.message }));
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Export the primitive for tests to consume without spawning the CLI.
module.exports = { planCommercialManageGrant, applyGrant, TARGET_CAPABILITY };

if (require.main === module) { main(); }
