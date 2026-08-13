#!/usr/bin/env node
// PLATFORM-ADMIN-1 — bootstrap CONTRÔLÉ du tout premier PlatformOperator.
// PLATFORM-ADMIN-BOOTSTRAP-1 — durci : la garde de production reposait
// uniquement sur `NODE_ENV`, une variable que rien n'empêche d'être
// incorrecte ou absente pendant qu'un `MONGO_URI` réel (Atlas) est chargé
// (`config/db.js` se connecte inconditionnellement à `process.env.MONGO_URI`,
// voir CLAUDE.md : « MONGO_URI n'a pas de DB path → Mongoose se connecte à
// `test` », donc le nom de base réellement résolu peut différer de ce qu'on
// suppose). La garde fiable ne peut reposer que sur ce que Mongoose résout
// RÉELLEMENT après connexion, jamais sur une étiquette d'environnement
// déclarée. `--confirm-database=<nom exact>` est donc désormais requis pour
// `--apply`, en plus (jamais à la place) de la garde `NODE_ENV` existante.
//
// Jamais de promotion automatique (mission §12-13) : ce script ne fait
// RIEN sans `--apply` explicite (dry-run par défaut, comme
// reconcile-finance.js/migrateLegacyAssetsBatch.js), exige un `--reason`
// et un `--grantedBy` (compte Admin existant qui endosse la responsabilité
// de cette décision — jamais l'utilisateur promu lui-même, jamais un
// acteur système anonyme), et refuse de s'exécuter en production sauf
// garde explicite (même patron que FINANCIAL_RECONCILIATION_ALLOW_PRODUCTION).
//
// Idempotent : si l'opérateur cible est déjà `active`, le script ne fait
// rien et le signale. S'il est `suspended`/`revoked`, il NE le réactive PAS
// automatiquement (`--apply` seul ne suffit pas) — il faut le flag distinct
// `--reactivate` pour rendre cette décision explicite dans la commande
// elle-même, jamais implicite dans le comportement par défaut.
//
// PLATFORM-ADMIN-BOOTSTRAP-EXEC-1 — `--allow-self-grant` : `grantOperator`
// interdit structurellement tout self-grant (`String(userId) === actor._id`)
// pour empêcher un opérateur DÉJÀ ACTIF de s'octroyer davantage de
// capacités à lui-même en silence. Ce garde-fou runtime reste INCHANGÉ et
// s'applique toujours. Mais sur une base où AUCUN PlatformOperator
// n'existe encore et où AUCUN second compte Admin n'existe pour endosser
// `--grantedBy`, exiger un acteur distinct rendrait le tout premier
// bootstrap structurellement impossible — le même raisonnement que
// `--allow-self-actor` dans `bootstrapPlatformTenant.js`, jamais implicite :
// ce script refuse `--email === --grantedBy` par défaut, sauf si
// `--allow-self-grant` est fourni explicitement en plus, ET seulement pour
// endosser la commande elle-même (l'interdiction runtime dans
// `grantOperator` n'est jamais contournée : c'est CE script, jamais le
// service, qui autorise le cas d'usage bootstrap initial).
//
// Dépendances volontairement minimales (mission §29-30) : ce script ne
// charge JAMAIS server.js (cron, sync Facebook, IMAP, Socket.IO, listener
// HTTP) — uniquement Mongo, User, PlatformOperator et l'audit.
//
// Usage (dry-run — montre la base réellement résolue, aucune écriture) :
//   node scripts/bootstrapPlatformOperator.js --email=operateur@example.com \
//     --grantedBy=admin@example.com --reason="Mise en place PLATFORM-ADMIN-1" \
//     --capabilities=platform.tenants.read,platform.tenants.manage
//
// Usage (application réelle, après avoir vérifié la base dans le dry-run) :
//   node scripts/bootstrapPlatformOperator.js --email=operateur@example.com \
//     --grantedBy=admin@example.com --reason="Mise en place PLATFORM-ADMIN-1" \
//     --capabilities=platform.tenants.read,platform.tenants.manage \
//     --confirm-database=<nom_exact_affiché_par_le_dry-run> --apply
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const { grantOperator, getOperatorByUserId } = require('../services/platformOperator/platformOperatorService');
const { PLATFORM_OPERATOR_CAPABILITIES } = require('../constants/platformOperatorConstants');

const args = new Set(process.argv.slice(2));
const valueOf = (name) => process.argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);

async function main() {
  const apply = args.has('--apply');
  if (apply && process.env.NODE_ENV === 'production' && process.env.ALLOW_PLATFORM_OPERATOR_BOOTSTRAP_APPLY !== 'true') {
    throw new Error('PLATFORM_OPERATOR_BOOTSTRAP_PRODUCTION_GUARD — définir ALLOW_PLATFORM_OPERATOR_BOOTSTRAP_APPLY=true pour confirmer explicitement une exécution en production.');
  }

  const email = valueOf('--email');
  const userId = valueOf('--userId');
  const grantedByEmail = valueOf('--grantedBy');
  const grantedByUserId = valueOf('--grantedByUserId');
  const reason = valueOf('--reason');
  const capabilities = (valueOf('--capabilities') || '').split(',').map((c) => c.trim()).filter(Boolean);
  const reactivate = args.has('--reactivate');
  const allowSelfGrant = args.has('--allow-self-grant');
  const maskEmail = (value) => {
    const [local, domain] = String(value).split('@');
    if (!domain) return '***';
    return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
  };

  if (!email && !userId) throw new Error('PLATFORM_OPERATOR_BOOTSTRAP_EMAIL_REQUIRED — --email=<compte à promouvoir> ou --userId=<ObjectId> est requis.');
  if (!grantedByEmail && !grantedByUserId) throw new Error('PLATFORM_OPERATOR_BOOTSTRAP_GRANTED_BY_REQUIRED — --grantedBy=<...> ou --grantedByUserId=<ObjectId> (compte Admin responsable de cette décision) est requis.');
  if (!reason) throw new Error('PLATFORM_OPERATOR_BOOTSTRAP_REASON_REQUIRED — --reason="..." est requis.');
  if (!capabilities.length) throw new Error('PLATFORM_OPERATOR_BOOTSTRAP_CAPABILITIES_REQUIRED — --capabilities=platform.xxx,platform.yyy est requis (jamais une attribution "tout" implicite).');
  const invalid = capabilities.filter((c) => !PLATFORM_OPERATOR_CAPABILITIES.includes(c));
  if (invalid.length) throw new Error(`PLATFORM_OPERATOR_BOOTSTRAP_INVALID_CAPABILITY — inconnue(s) : ${invalid.join(', ')}`);

  await connectDB();

  // PLATFORM-ADMIN-BOOTSTRAP-1 — sécurité d'environnement fondée sur la
  // RÉALITÉ de la connexion établie, jamais sur une variable déclarative.
  // `mongoose.connection.name` est le nom de base effectivement résolu par
  // le driver à partir de `MONGO_URI` — c'est la seule source de vérité.
  const resolvedDatabase = mongoose.connection.name;
  const confirmDatabase = valueOf('--confirm-database');
  if (apply && confirmDatabase !== resolvedDatabase) {
    throw new Error(`PLATFORM_OPERATOR_BOOTSTRAP_DATABASE_NOT_CONFIRMED — cette exécution est connectée à la base "${resolvedDatabase}". Relancer avec --confirm-database=${resolvedDatabase} pour confirmer explicitement que c'est la cible voulue avant --apply. Sans confirmation, aucune écriture n'est jamais effectuée, quelle que soit la valeur de NODE_ENV.`);
  }

  const targetUser = userId
    ? await User.findOne({ _id: userId, isTechnical: { $ne: true } }).select('_id email role isActive status')
    : await User.findOne({ email: email.toLowerCase().trim(), isTechnical: { $ne: true } }).select('_id email role isActive status');
  if (!targetUser) throw new Error(`PLATFORM_OPERATOR_BOOTSTRAP_USER_NOT_FOUND — aucun compte non-technique pour ${userId ? `l'ID ${userId}` : email}.`);

  const grantedByUser = grantedByUserId
    ? await User.findOne({ _id: grantedByUserId, role: 'Admin' }).select('_id email role')
    : await User.findOne({ email: grantedByEmail.toLowerCase().trim(), role: 'Admin' }).select('_id email role');
  if (!grantedByUser) throw new Error(`PLATFORM_OPERATOR_BOOTSTRAP_GRANTED_BY_NOT_FOUND — aucun compte Admin pour ${grantedByUserId ? `l'ID ${grantedByUserId}` : grantedByEmail}.`);
  const selfGrant = String(grantedByUser._id) === String(targetUser._id);
  if (selfGrant && !allowSelfGrant) throw new Error('PLATFORM_OPERATOR_BOOTSTRAP_SELF_GRANT_FORBIDDEN — --grantedBy doit être un compte Admin DISTINCT du compte promu, sauf --allow-self-grant explicite (réservé au tout premier bootstrap, voir en-tête de fichier).');

  const existing = await getOperatorByUserId(targetUser._id);
  const output = {
    mode: apply ? 'apply' : 'dry-run',
    database: resolvedDatabase,
    target: { email: maskEmail(targetUser.email), id: String(targetUser._id) },
    grantedBy: { email: maskEmail(grantedByUser.email), id: String(grantedByUser._id) },
    capabilities,
    selfGrant,
    existing: existing ? { status: existing.status, capabilities: existing.capabilities } : null,
  };

  if (existing?.status === 'active') {
    output.result = 'NOOP — opérateur déjà actif, aucune action effectuée. Utiliser les routes de gestion (platform.operators.manage) pour modifier ses capacités.';
  } else if (existing && existing.status !== 'active' && !reactivate) {
    output.result = `NOOP — opérateur existant au statut "${existing.status}". Ajouter --reactivate pour une réattribution explicite.`;
  } else if (apply) {
    const doc = await grantOperator({ userId: targetUser._id, capabilities, actor: grantedByUser, reason, req: null, allowSelfGrant });
    output.result = { status: doc.status, capabilities: doc.capabilities, grantedAt: doc.grantedAt };
  } else {
    output.result = 'DRY-RUN — aucune écriture effectuée. Relancer avec --apply pour appliquer.';
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main()
  .catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
