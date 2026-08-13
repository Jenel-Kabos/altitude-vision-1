#!/usr/bin/env node
// PLATFORM-ADMIN-BOOTSTRAP-EXEC-1 — provisioning CONTRÔLÉ du tout premier
// PlatformTenant réel. AUCUN nouveau mécanisme de création n'est introduit
// ici : ce script orchestre uniquement les services canoniques déjà
// certifiés — `platformTenantService.createTenant` (TENANT-CORE-1, crée le
// PlatformTenant ET sa racine OrgUnit ensemble, jamais séparément — voir ce
// fichier) et `organizationService.grantMembership` (ORGANIZATION-1).
//
// Pourquoi un script et pas la route HTTP `POST /api/platform-tenants` :
// `routes/platformTenantRoutes.js` documente explicitement (voir son
// en-tête, TENANT-CERT-3-FINAL) que la création globale d'un tenant via
// HTTP échoue fermée tant qu'aucune capacité opérateur plateforme
// vérifiable n'existe — exactement le même problème d'œuf-et-poule que
// PLATFORM-ADMIN-BOOTSTRAP-1 pour le PlatformOperator lui-même. Le
// commentaire de ce routeur anticipe explicitement la solution : « Le
// service interne de bootstrap demeure disponible aux processus contrôlés
// et aux fixtures. » — ce script EST ce processus contrôlé.
//
// Mêmes garanties que bootstrapPlatformOperator.js (même patron, jamais
// dupliqué différemment) :
//   - dry-run par défaut, AUCUNE écriture sans --apply explicite ;
//   - garde de production double : NODE_ENV==='production' nécessite
//     ALLOW_PLATFORM_TENANT_BOOTSTRAP_APPLY=true, ET --confirm-database=
//     <nom réellement résolu par mongoose.connection.name> est requis pour
//     TOUT --apply, quel que soit NODE_ENV (jamais une garde qui repose
//     uniquement sur une variable déclarative potentiellement incorrecte) ;
//   - acteur explicite obligatoire (--actorEmail, compte Admin existant qui
//     endosse la décision — peut être le même compte que --memberUserId
//     UNIQUEMENT si aucun autre Admin n'existe, voir --allow-self-actor
//     ci-dessous, jamais implicite) ;
//   - idempotent : si le tenant nommé existe déjà, NOOP explicite, jamais
//     un doublon (le service génère un slug alternatif sinon) ;
//   - dépendances minimales, ne charge jamais server.js.
//
// --allow-self-actor : `organizationService.createOrgUnit`/`grantMembership`
// n'imposent eux-mêmes AUCUNE restriction d'auto-attribution (contrairement
// à `platformOperatorService.grantOperator`, qui interdit structurellement
// tout self-grant). Pour le tout premier tenant d'une base sans aucun
// second Admin, l'acteur qui approuve la création ET le membre rattaché
// peuvent légitimement être la même personne (il n'existe personne d'autre
// pour endosser la décision) — mais ce script ne le permet jamais
// silencieusement : le flag doit être fourni explicitement, en plus de
// --actorEmail et --memberUserId identiques, pour rendre ce choix visible
// dans la commande elle-même.
//
// Usage (dry-run) :
//   node scripts/bootstrapPlatformTenant.js --tenantName="Altitude Vision" \
//     --memberUserId=<id> --roleInUnit=owner --actorEmail=admin@example.com \
//     --reason="..." [--allow-self-actor]
//
// Usage (apply, après vérification de la base affichée par le dry-run) :
//   node scripts/bootstrapPlatformTenant.js --tenantName="Altitude Vision" \
//     --memberUserId=<id> --roleInUnit=owner --actorEmail=admin@example.com \
//     --reason="..." [--allow-self-actor] \
//     --confirm-database=<nom_exact_affiché_par_le_dry-run> --apply
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const PlatformTenant = require('../models/PlatformTenant');
const OrgMembership = require('../models/OrgMembership');
const platformTenantService = require('../services/platformTenant/platformTenantService');
const organizationService = require('../services/organizationService');
const { ROLE_IN_UNIT } = require('../constants/organizationConstants');
const { PLATFORM_TENANT_PLANS } = require('../constants/platformTenantConstants');

const args = new Set(process.argv.slice(2));
const valueOf = (name) => process.argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);

async function main() {
  const apply = args.has('--apply');
  if (apply && process.env.NODE_ENV === 'production' && process.env.ALLOW_PLATFORM_TENANT_BOOTSTRAP_APPLY !== 'true') {
    throw new Error('PLATFORM_TENANT_BOOTSTRAP_PRODUCTION_GUARD — définir ALLOW_PLATFORM_TENANT_BOOTSTRAP_APPLY=true pour confirmer explicitement une exécution en production.');
  }

  const tenantName = valueOf('--tenantName');
  const plan = valueOf('--plan') || 'trial';
  const memberUserId = valueOf('--memberUserId');
  const roleInUnit = valueOf('--roleInUnit') || 'owner';
  const actorEmail = valueOf('--actorEmail');
  const actorUserId = valueOf('--actorUserId');
  const reason = valueOf('--reason');
  const allowSelfActor = args.has('--allow-self-actor');
  const maskEmail = (email) => {
    const [local, domain] = String(email).split('@');
    if (!domain) return '***';
    return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
  };

  if (!tenantName || !tenantName.trim()) throw new Error('PLATFORM_TENANT_BOOTSTRAP_NAME_REQUIRED — --tenantName="..." est requis.');
  if (!PLATFORM_TENANT_PLANS.includes(plan)) throw new Error(`PLATFORM_TENANT_BOOTSTRAP_PLAN_INVALID — plan inconnu : ${plan}.`);
  if (!memberUserId || !mongoose.isValidObjectId(memberUserId)) throw new Error('PLATFORM_TENANT_BOOTSTRAP_MEMBER_REQUIRED — --memberUserId=<ObjectId> est requis.');
  if (!ROLE_IN_UNIT.includes(roleInUnit)) throw new Error(`PLATFORM_TENANT_BOOTSTRAP_ROLE_INVALID — rôle inconnu : ${roleInUnit}.`);
  if (!actorEmail && !actorUserId) throw new Error('PLATFORM_TENANT_BOOTSTRAP_ACTOR_REQUIRED — --actorEmail=<...> ou --actorUserId=<ObjectId> (compte Admin responsable de cette décision) est requis.');
  if (actorUserId && !mongoose.isValidObjectId(actorUserId)) throw new Error('PLATFORM_TENANT_BOOTSTRAP_ACTOR_ID_INVALID — --actorUserId doit être un ObjectId valide.');
  if (!reason || !reason.trim()) throw new Error('PLATFORM_TENANT_BOOTSTRAP_REASON_REQUIRED — --reason="..." est requis.');

  await connectDB();

  const resolvedDatabase = mongoose.connection.name;
  const confirmDatabase = valueOf('--confirm-database');
  if (apply && confirmDatabase !== resolvedDatabase) {
    throw new Error(`PLATFORM_TENANT_BOOTSTRAP_DATABASE_NOT_CONFIRMED — cette exécution est connectée à la base "${resolvedDatabase}". Relancer avec --confirm-database=${resolvedDatabase} pour confirmer explicitement que c'est la cible voulue avant --apply. Sans confirmation, aucune écriture n'est jamais effectuée, quelle que soit la valeur de NODE_ENV.`);
  }

  const actorUser = actorUserId
    ? await User.findOne({ _id: actorUserId, role: 'Admin' }).select('_id email role')
    : await User.findOne({ email: actorEmail.toLowerCase().trim(), role: 'Admin' }).select('_id email role');
  if (!actorUser) throw new Error(`PLATFORM_TENANT_BOOTSTRAP_ACTOR_NOT_FOUND — aucun compte Admin pour ${actorUserId ? `l'ID ${actorUserId}` : actorEmail}.`);

  const memberUser = await User.findOne({ _id: memberUserId, isTechnical: { $ne: true } }).select('_id email role isActive status');
  if (!memberUser) throw new Error(`PLATFORM_TENANT_BOOTSTRAP_MEMBER_NOT_FOUND — aucun compte non-technique pour l'ID ${memberUserId}.`);

  if (String(actorUser._id) === String(memberUser._id) && !allowSelfActor) {
    throw new Error("PLATFORM_TENANT_BOOTSTRAP_SELF_ACTOR_REQUIRES_FLAG — --actorEmail et --memberUserId désignent le même compte ; ajouter --allow-self-actor explicitement pour confirmer que c'est voulu (légitime uniquement en l'absence d'un second Admin distinct).");
  }

  const existingTenant = await PlatformTenant.findOne({ name: tenantName.trim() }).lean();
  const existingMembership = existingTenant
    ? await OrgMembership.findOne({ user: memberUser._id, orgUnit: existingTenant.rootOrgUnit, status: 'active' }).lean()
    : null;

  const output = {
    mode: apply ? 'apply' : 'dry-run',
    database: resolvedDatabase,
    tenantName: tenantName.trim(),
    plan,
    actor: { email: maskEmail(actorUser.email), id: String(actorUser._id) },
    member: { email: maskEmail(memberUser.email), id: String(memberUser._id), role: memberUser.role },
    roleInUnit,
    selfActor: String(actorUser._id) === String(memberUser._id),
    existingTenant: existingTenant ? { id: String(existingTenant._id), rootOrgUnit: String(existingTenant.rootOrgUnit), status: existingTenant.status } : null,
    existingMembership: existingMembership ? { status: existingMembership.status, roleInUnit: existingMembership.roleInUnit } : null,
  };

  if (existingTenant && existingMembership) {
    output.result = 'NOOP — tenant et membership déjà en place, aucune action effectuée.';
  } else if (apply) {
    let tenant = existingTenant;
    if (!tenant) {
      tenant = await platformTenantService.createTenant({ name: tenantName.trim(), plan, actor: actorUser, req: null });
    }
    const membership = await organizationService.grantMembership({
      userId: memberUser._id, orgUnitId: tenant.rootOrgUnit, roleInUnit, actor: actorUser, metadata: { reason }, req: null,
    });
    output.result = {
      tenant: { id: String(tenant._id), name: tenant.name, rootOrgUnit: String(tenant.rootOrgUnit) },
      membership: { id: String(membership._id), status: membership.status, roleInUnit: membership.roleInUnit },
    };
  } else {
    output.result = 'DRY-RUN — aucune écriture effectuée. Relancer avec --apply pour appliquer.';
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main()
  .catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
