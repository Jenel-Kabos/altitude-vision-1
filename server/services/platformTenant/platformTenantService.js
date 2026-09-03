// TENANT-CORE-1 — Service central SaaS. Un PlatformTenant est une fine
// enveloppe autour d'UNE racine `OrgUnit` (voir models/PlatformTenant.js) —
// ce fichier délègue toute la mécanique organisationnelle à
// organizationService (ORGANIZATION-1), jamais une seconde implémentation.
// Même patron d'audit qu'OrgMembership/HotelStaffAssignment/UserBusinessProfile
// (grantedBy/At, suspendedBy/At/Reason…) pour les transitions de statut.
const PlatformTenant = require('../../models/PlatformTenant');
const crypto = require('crypto');
const PlatformTenantSettings = require('../../models/PlatformTenantSettings');
const PlatformTenantTheme = require('../../models/PlatformTenantTheme');
const PlatformTenantDomain = require('../../models/PlatformTenantDomain');
const PlatformTenantFeature = require('../../models/PlatformTenantFeature');
const PlatformTenantSubscription = require('../../models/PlatformTenantSubscription');
const { TENANT_FEATURE_MODULES, PLATFORM_TENANT_PLANS } = require('../../constants/platformTenantConstants');
const { DEFAULT_QUOTAS_BY_PLAN } = require('../../models/PlatformTenantSubscription');
const organizationService = require('../organizationService');
const { getScopeUserIds } = require('../organizationService');
const OrgUnit = require('../../models/OrgUnit');
const { logAction, buildAuteur } = require('../actionLogService');

class PlatformTenantError extends Error {
  constructor(code, message, statusCode = 400) { super(message); this.name = 'PlatformTenantError'; this.code = code; this.statusCode = statusCode; }
}
const fail = (code, message, statusCode) => { throw new PlatformTenantError(code, message, statusCode); };

async function audit(event, { actor, tenant, req, session }) {
  const write = logAction({
    action: `platform_tenant.${event}`,
    description: `PlatformTenant ${tenant.name} (${tenant._id}) — ${event}`,
    module: 'Organisation', // même module que ORGANIZATION-1, dont ce service est une extension directe
    typeAction: event.includes('archived') || event.includes('cancelled') ? 'SUPPRESSION' : event.includes('created') ? 'CRÉATION' : 'MODIFICATION',
    auteur: buildAuteur(actor),
    cible: { id: String(tenant._id), type: 'PlatformTenant', nom: tenant.name },
    metadata: { platformTenantId: tenant._id, orgUnitId: tenant.rootOrgUnit },
    req, session,
  });
  if (session) await write;
  else await write.catch(() => {});
}

const slugify = (name) => name.trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '') // retire les accents
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Crée le PlatformTenant ET sa racine organisationnelle ensemble — les deux
// n'ont aucun sens l'un sans l'autre (voir contrainte `unique` sur
// `rootOrgUnit`). Réutilise organizationService.createOrgUnit tel quel.
async function createTenantDocuments({ name, plan = 'trial', actor, req, session, deterministicOwner = false } = {}) {
  if (!name || !name.trim()) fail('TENANT_NAME_REQUIRED', 'Le nom est requis.', 422);
  if (plan && !PLATFORM_TENANT_PLANS.includes(plan)) fail('TENANT_PLAN_INVALID', `Plan inconnu : ${plan}.`, 422);

  const actorId = actor?._id || actor?.id;
  let slug = deterministicOwner
    ? `first-owner-${crypto.createHash('sha256').update(String(actorId)).digest('hex').slice(0, 40)}`
    : slugify(name);
  if (!slug) fail('TENANT_NAME_INVALID', 'Nom invalide : aucun slug dérivable.', 422);
  if (!deterministicOwner && await PlatformTenant.findOne({ slug }).session(session || null)) slug = `${slug}-${Date.now().toString(36)}`;

  const rootOrgUnit = await organizationService.createOrgUnit({ name, type: 'organization', actor, req, session });
  const tenantData = { name: name.trim(), slug, rootOrgUnit: rootOrgUnit._id, createdBy: actorId || null };
  const tenant = session
    ? (await PlatformTenant.create([tenantData], { session }))[0]
    : await PlatformTenant.create(tenantData);

  const settingsData = { tenant: tenant._id };
  const themeData = { tenant: tenant._id };
  const subscriptionData = {
      tenant: tenant._id, plan, status: 'trialing',
      modulesIncluded: TENANT_FEATURE_MODULES, // trial complet par défaut — jamais restreint sans décision explicite
      quotas: DEFAULT_QUOTAS_BY_PLAN[plan] || DEFAULT_QUOTAS_BY_PLAN.trial,
      createdBy: actorId || null,
  };
  if (session) {
    await Promise.all([
      PlatformTenantSettings.create([settingsData], { session }),
      PlatformTenantTheme.create([themeData], { session }),
      PlatformTenantSubscription.create([subscriptionData], { session }),
    ]);
  } else {
    await Promise.all([
      PlatformTenantSettings.create(settingsData),
      PlatformTenantTheme.create(themeData),
      PlatformTenantSubscription.create(subscriptionData),
    ]);
  }

  await audit('created', { actor, tenant, req, session });
  return tenant;
}

async function createTenant({ name, plan = 'trial', actor, req } = {}) {
  return createTenantDocuments({ name, plan, actor, req });
}

async function createFirstOwnerTenant({ name, actor, req, session } = {}) {
  if (!session) fail('FIRST_TENANT_TRANSACTION_REQUIRED', 'Une transaction est requise.', 500);
  if (!actor?._id && !actor?.id) fail('FIRST_TENANT_ACTOR_REQUIRED', 'Utilisateur authentifié requis.', 401);
  return createTenantDocuments({ name, plan: 'trial', actor, req, session, deterministicOwner: true });
}

async function suspendTenant(id, { actor, reason, req } = {}) {
  const tenant = await PlatformTenant.findOne({ _id: id, status: { $ne: 'archived' } });
  if (!tenant) fail('TENANT_NOT_FOUND', 'Tenant introuvable.', 404);
  tenant.status = 'suspended';
  tenant.suspendedBy = actor?._id || actor?.id || null;
  tenant.suspendedAt = new Date();
  tenant.suspensionReason = reason || null;
  await tenant.save();
  await audit('suspended', { actor, tenant, req });
  return tenant;
}

async function reactivateTenant(id, { actor, req } = {}) {
  const tenant = await PlatformTenant.findOne({ _id: id, status: 'suspended' });
  if (!tenant) fail('TENANT_NOT_SUSPENDED', 'Seul un tenant suspendu peut être réactivé.', 404);
  tenant.status = 'active';
  tenant.suspendedBy = null;
  tenant.suspendedAt = null;
  tenant.suspensionReason = null;
  await tenant.save();
  await audit('reactivated', { actor, tenant, req });
  return tenant;
}

async function archiveTenant(id, { actor, req } = {}) {
  const tenant = await PlatformTenant.findOne({ _id: id, status: { $ne: 'archived' } });
  if (!tenant) fail('TENANT_NOT_FOUND', 'Tenant introuvable.', 404);
  tenant.status = 'archived';
  tenant.archivedBy = actor?._id || actor?.id || null;
  tenant.archivedAt = new Date();
  await tenant.save();
  // L'archivage du tenant tente d'archiver également sa racine
  // organisationnelle — réutilise organizationService.archiveOrgUnit,
  // jamais une suppression. Best-effort : archiveOrgUnit refuse
  // explicitement s'il reste des unités enfants actives (protection
  // ORGANIZATION-1 déjà en place) — dans ce cas le tenant reste marqué
  // 'archived' (accès coupé, voir tenantContextService) mais la racine
  // organisationnelle doit être nettoyée séparément par un Admin, jamais
  // une erreur silencieuse avalée sans trace : voir ActionLog.
  await organizationService.archiveOrgUnit(tenant.rootOrgUnit, { actor, req }).catch(() => {});
  await audit('archived', { actor, tenant, req });
  return tenant;
}

async function listTenants({ status } = {}) {
  const filter = {};
  if (status) filter.status = status;
  return PlatformTenant.find(filter).sort({ createdAt: -1 }).lean();
}

// Vue d'ensemble d'un tenant : réutilise getScopeUserIds (déjà agrégé) et
// listOrgUnits — aucun nouveau comptage métier.
async function getTenantOverview(id) {
  const tenant = await PlatformTenant.findById(id).lean();
  if (!tenant) fail('TENANT_NOT_FOUND', 'Tenant introuvable.', 404);
  const [scopeUserIds, orgUnits, settings, theme, domains, features, subscription] = await Promise.all([
    getScopeUserIds(tenant.rootOrgUnit),
    OrgUnit.find({ $or: [{ _id: tenant.rootOrgUnit }, { path: { $regex: `.*${tenant.rootOrgUnit}.*` } }] }).select('_id name type status').lean(),
    PlatformTenantSettings.findOne({ tenant: tenant._id }).lean(),
    PlatformTenantTheme.findOne({ tenant: tenant._id }).lean(),
    PlatformTenantDomain.find({ tenant: tenant._id }).lean(),
    PlatformTenantFeature.find({ tenant: tenant._id }).lean(),
    PlatformTenantSubscription.findOne({ tenant: tenant._id, status: { $in: ['trialing', 'active'] } }).lean(),
  ]);
  return { tenant, userCount: scopeUserIds.size, orgUnits, settings, theme, domains, features, subscription };
}

// ── Configuration (Phase 5) ─────────────────────────────────────────────
async function updateSettings(tenantId, { currency, language, timezone, contactEmail, actor } = {}) {
  const update = { updatedBy: actor?._id || actor?.id || null };
  if (currency !== undefined) update.currency = currency;
  if (language !== undefined) update.language = language;
  if (timezone !== undefined) update.timezone = timezone;
  if (contactEmail !== undefined) update.contactEmail = contactEmail;
  const settings = await PlatformTenantSettings.findOneAndUpdate({ tenant: tenantId }, update, { new: true, upsert: true });
  return settings;
}

async function updateTheme(tenantId, { logoUrl, brandName, primaryColor, secondaryColor, actor } = {}) {
  const update = { updatedBy: actor?._id || actor?.id || null };
  if (logoUrl !== undefined) update.logoUrl = logoUrl;
  if (brandName !== undefined) update.brandName = brandName;
  if (primaryColor !== undefined) update.primaryColor = primaryColor;
  if (secondaryColor !== undefined) update.secondaryColor = secondaryColor;
  return PlatformTenantTheme.findOneAndUpdate({ tenant: tenantId }, update, { new: true, upsert: true });
}

async function addDomain(tenantId, { domain, isPrimary = false } = {}) {
  if (!domain || !domain.trim()) fail('TENANT_DOMAIN_REQUIRED', 'Domaine requis.', 422);
  if (isPrimary) await PlatformTenantDomain.updateMany({ tenant: tenantId }, { isPrimary: false });
  return PlatformTenantDomain.create({ tenant: tenantId, domain: domain.trim().toLowerCase(), isPrimary });
}

// AUCUNE vérification DNS/SSL réelle (hors périmètre) — un statut
// 'verified' n'est posé qu'à la demande explicite d'un Admin, jamais
// automatiquement, pour ne jamais prétendre à une vérification qui n'a pas
// eu lieu.
async function verifyDomain(domainId, { actor } = {}) {
  const domain = await PlatformTenantDomain.findById(domainId);
  if (!domain) fail('TENANT_DOMAIN_NOT_FOUND', 'Domaine introuvable.', 404);
  domain.status = 'verified';
  domain.verifiedAt = new Date();
  domain.verifiedBy = actor?._id || actor?.id || null;
  await domain.save();
  return domain;
}

// ── Fonctionnalités (Phase 5/6) ─────────────────────────────────────────
async function setFeature(tenantId, moduleKey, { enabled = true, actor } = {}) {
  if (!TENANT_FEATURE_MODULES.includes(moduleKey)) fail('TENANT_MODULE_INVALID', `Module inconnu : ${moduleKey}.`, 422);
  return PlatformTenantFeature.findOneAndUpdate(
    { tenant: tenantId, module: moduleKey },
    { enabled, grantedBy: actor?._id || actor?.id || null, grantedAt: new Date() },
    { new: true, upsert: true },
  );
}

async function listFeatures(tenantId) {
  return PlatformTenantFeature.find({ tenant: tenantId }).lean();
}

// ── Abonnement (Phase 6) ────────────────────────────────────────────────
async function changeSubscription(tenantId, { plan, modulesIncluded, quotas, actor, req } = {}) {
  if (!PLATFORM_TENANT_PLANS.includes(plan)) fail('TENANT_PLAN_INVALID', `Plan inconnu : ${plan}.`, 422);
  const tenant = await PlatformTenant.findById(tenantId);
  if (!tenant) fail('TENANT_NOT_FOUND', 'Tenant introuvable.', 404);

  // Clôture l'abonnement en cours (jamais deux abonnements actifs en
  // parallèle — voir index unique du modèle) plutôt qu'une édition en
  // place, pour conserver l'historique des plans successifs.
  const previous = await PlatformTenantSubscription.findOne({ tenant: tenantId, status: { $in: ['trialing', 'active'] } });
  if (previous) {
    previous.status = 'cancelled';
    previous.cancelledAt = new Date();
    previous.cancelledBy = actor?._id || actor?.id || null;
    previous.cancellationReason = 'Changement de plan';
    previous.endDate = new Date();
    await previous.save();
  }

  const subscription = await PlatformTenantSubscription.create({
    tenant: tenantId, plan, status: 'active',
    modulesIncluded: modulesIncluded && modulesIncluded.length ? modulesIncluded : TENANT_FEATURE_MODULES,
    quotas: quotas || DEFAULT_QUOTAS_BY_PLAN[plan] || DEFAULT_QUOTAS_BY_PLAN.trial,
    createdBy: actor?._id || actor?.id || null,
  });
  await audit('subscription_changed', { actor, tenant, req });
  return subscription;
}

async function cancelSubscription(tenantId, { actor, reason, req } = {}) {
  const tenant = await PlatformTenant.findById(tenantId);
  if (!tenant) fail('TENANT_NOT_FOUND', 'Tenant introuvable.', 404);
  const subscription = await PlatformTenantSubscription.findOne({ tenant: tenantId, status: { $in: ['trialing', 'active'] } });
  if (!subscription) fail('TENANT_SUBSCRIPTION_NOT_FOUND', 'Aucun abonnement actif à annuler.', 404);
  subscription.status = 'cancelled';
  subscription.cancelledBy = actor?._id || actor?.id || null;
  subscription.cancelledAt = new Date();
  subscription.cancellationReason = reason || null;
  subscription.endDate = new Date();
  await subscription.save();
  await audit('subscription_cancelled', { actor, tenant, req });
  return subscription;
}

async function getActiveSubscription(tenantId) {
  return PlatformTenantSubscription.findOne({ tenant: tenantId, status: { $in: ['trialing', 'active'] } }).lean();
}

module.exports = {
  PlatformTenantError,
  createTenant, createFirstOwnerTenant, suspendTenant, reactivateTenant, archiveTenant, listTenants, getTenantOverview,
  updateSettings, updateTheme, addDomain, verifyDomain,
  setFeature, listFeatures,
  changeSubscription, cancelSubscription, getActiveSubscription,
};
