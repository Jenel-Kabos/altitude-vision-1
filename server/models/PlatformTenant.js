// TENANT-CORE-1 — Racine de l'architecture SaaS multi-tenant.
//
// NOMMAGE (audit Phase 1) : le mot « tenant » désigne déjà, partout dans ce
// codebase, un LOCATAIRE (voir `TenantLinkRequest`, `tenantLinkService`,
// la destination NAV-CORE `TENANT_PORTAL`, les types `Notification`
// `tenant_invitation_*`/`tenant_link_*`/`tenant_document_*`, le champ
// `RentalManagement.tenant`). Réutiliser « Tenant » nu pour la racine SaaS
// aurait créé une ambiguïté dangereuse (ex. `Tenant.findById` pourrait
// désigner un locataire OU une entreprise cliente de la plateforme). Ce
// sprint introduit donc systématiquement le préfixe `PlatformTenant` —
// jamais `Tenant` seul — pour toute nouvelle entité SaaS.
//
// ARCHITECTURE : un PlatformTenant est une fine enveloppe autour d'UNE
// unité organisationnelle racine déjà modélisée par ORGANIZATION-1
// (`OrgUnit.type === 'organization'`). « Organisation devient un
// sous-ensemble du Tenant » (Phase 2 du brief) est satisfait ainsi : aucune
// hiérarchie parallèle n'est créée, `OrgUnit`/`OrgMembership` restent
// l'unique mécanisme de scoping (voir `organizationService.getScopeUserIds`,
// déjà réutilisé tel quel par CRM/Reporting/ERP/ActionLog) — un Tenant ne
// fait qu'identifier QUELLE racine `OrgUnit` scoper.
const mongoose = require('mongoose');

const PLATFORM_TENANT_STATUSES = ['trial', 'active', 'suspended', 'archived'];

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 100 },
  // Unique et requis : un PlatformTenant ne préexiste jamais sans sa racine
  // organisationnelle — créés ensemble par platformTenantService.createTenant.
  rootOrgUnit: { type: mongoose.Schema.Types.ObjectId, ref: 'OrgUnit', required: true, unique: true },
  status: { type: String, enum: PLATFORM_TENANT_STATUSES, default: 'trial', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  suspendedAt: { type: Date, default: null },
  suspensionReason: { type: String, maxlength: 1000, default: null },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  archivedAt: { type: Date, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('PlatformTenant', schema);
module.exports.PLATFORM_TENANT_STATUSES = PLATFORM_TENANT_STATUSES;
