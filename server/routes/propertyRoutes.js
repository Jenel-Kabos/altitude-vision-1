// server/routes/propertyRoutes.js
//
// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-G — final authority split:
//   PUBLIC        : /latest, /recommended, /:id (optionalAuth), /:id/share
//   PUBLIC-AUTH   : /:id/like, /:id/reviews
//   OWNERSHIP     : /my-properties (protect + controller-level owner filter)
//                   POST /  and POST /mobile (restrictTo('Proprietaire') —
//                                             personal listing; tenant=null
//                                             ALWAYS by controller design)
//                   PUT /:id, DELETE /:id (MIXED owner-OR-tenant-staff,
//                                          dual-branch in controller,
//                                          canonical tenantBusinessRole
//                                          via `resolveTenantMembershipIfPresent`)
//   TENANT        : /portfolio                     (Lot E)
//                   POST /portfolio                (NEW — Decision 1)
//                   GET /status/pending            (Decision 3 — tenant mod)
//                   GET /status/pending-count      (Decision 3)
//                   PATCH /admin/:id/:action       (Decision 3)
//                   DELETE /admin/:id              (Decision 3)
//   PLATFORM      : PATCH /:id/recommande          (Decision 3 — cross-tenant
//                                                   marketplace moderation,
//                                                   requires
//                                                   `platform.properties.manage`)
//
// Zero `req.user.role === 'Admin'` bypass remains on the mutation surfaces
// migrated in Lot G. `capabilityMiddleware.requireCapability` is not used
// on this router.

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { upload } = require('../config/cloudinary');
const propertyController = require('../controllers/propertyController');
const propertyPortfolioController = require('../controllers/propertyPortfolioController');
const { createPropertyMobile } = require('../controllers/propertyMobileController');

const { requireTenantScope, requireTenantScopeForStaffAllowPlatformWide } = require('../middleware/tenantContext');
const { requireTenantModule } = require('../middleware/tenantModuleGate');
const { requireTenantMembershipRole } = require('../middleware/tenantMembershipRole');
const { requireTenantMembershipRoleOrPlatformCapability } = require('../middleware/tenantMembershipRoleOrPlatformCapability');
const { resolveTenantMembershipIfPresent } = require('../middleware/resolveTenantMembershipIfPresent');
const { requirePlatformOperatorCapability } = require('../middleware/platformAuthority');

// PLATFORM-SUPER-ADMIN OPTION-3 SLICE-2 (2026-09-22) — helpers réutilisables
// pour composer autorité tenant OU capability plateforme sur le domaine
// properties. tenantRoles varie selon l'endpoint ; platformCapabilities suit
// la convention read (portfolio, moderation queue) vs manage (create, edit,
// moderation transitions). Le core requireTenantMembershipRole demeure
// disponible pour les routes qui doivent rester strictement tenant-only.
const propertyPortfolioReadAuthority = requireTenantMembershipRoleOrPlatformCapability({
  tenantRoles: ['Admin', 'GestionnaireImmobilier', 'Collaborateur'],
  platformCapabilities: ['platform.properties.read', 'platform.properties.manage'],
});
const propertyPortfolioManageAuthority = requireTenantMembershipRoleOrPlatformCapability({
  tenantRoles: ['Admin', 'GestionnaireImmobilier', 'Collaborateur'],
  platformCapabilities: ['platform.properties.manage'],
});
const propertyModerationReadAuthority = requireTenantMembershipRoleOrPlatformCapability({
  tenantRoles: ['Admin'],
  platformCapabilities: ['platform.properties.read', 'platform.properties.manage'],
});
const propertyModerationManageAuthority = requireTenantMembershipRoleOrPlatformCapability({
  tenantRoles: ['Admin'],
  platformCapabilities: ['platform.properties.manage'],
});

// ── Lot E portfolio (unchanged) ─────────────────────────────────────────────
const GL_PORTFOLIO_READ = ['Admin', 'GestionnaireImmobilier', 'Collaborateur'];
router.get(
  '/portfolio',
  authController.protect,
  requireTenantScope,
  requireTenantModule('immobilier'),
  propertyPortfolioReadAuthority,
  propertyPortfolioController.list,
);

// ── Lot G TENANT CREATE (Decision 1) ────────────────────────────────────────
// Contract: staff of a tenant creates a Property attributed to that tenant.
// `Property.tenant = req.platformTenant._id` is set by the controller because
// this middleware chain populates `req.platformTenant`. `Property.owner`
// remains the calling staff user by schema constraint (Property.owner is
// `required: true, ref: 'User'`). A future `createdBy` refinement is
// intentionally not introduced here — the caller identity is preserved via
// the ActionLog on creation, and reassignment tooling belongs to a later
// dedicated phase.
const GL_PORTFOLIO_CREATE = ['Admin', 'GestionnaireImmobilier', 'Collaborateur'];
router.post(
  '/portfolio',
  authController.protect,
  requireTenantScope,
  requireTenantModule('immobilier'),
  propertyPortfolioManageAuthority,
  upload.array('images', 10),
  propertyController.createProperty,
);

// ── PUBLIC marketplace reads ────────────────────────────────────────────────
router.get('/latest', propertyController.getLatestProperties, propertyController.getAllProperties);
router.get('/recommended', propertyController.getRecommendedProperties);

// ── OWNERSHIP self-listing ──────────────────────────────────────────────────
router.get('/my-properties', authController.protect, propertyController.getMyProperties);

// ── TENANT MODERATION (Decision 3) ──────────────────────────────────────────
// Previously `restrictTo('Admin')` — a legacy User.role gate. Post-Lot-G the
// authority chain is canonical:
router.get(
  '/status/pending',
  authController.protect,
  requireTenantScope,
  requireTenantModule('immobilier'),
  propertyModerationReadAuthority,
  propertyController.getPendingProperties,
);
router.get(
  '/status/pending-count',
  authController.protect,
  requireTenantScope,
  requireTenantModule('immobilier'),
  propertyModerationReadAuthority,
  propertyController.getPendingPropertiesCount,
);

// ── PUBLIC list (with staff-aware filter) ──────────────────────────────────
router.get(
  '/',
  authController.optionalAuth,
  requireTenantScopeForStaffAllowPlatformWide,
  propertyController.getAllProperties,
);

// ── OWNERSHIP personal create (Decision 1) ─────────────────────────────────
// `restrictTo('Proprietaire')` narrows the personal-listing contract. Staff
// who wish to create a Property on behalf of their tenant use POST /portfolio.
// Global Admin creating personal listings via this route is intentionally
// removed — that operation belongs to admin tooling with a documented
// contract, not a silent bypass here.
router.post(
  '/mobile',
  authController.protect,
  authController.restrictTo('Proprietaire'),
  createPropertyMobile,
);
router.post(
  '/',
  authController.protect,
  authController.restrictTo('Proprietaire'),
  upload.array('images', 10),
  propertyController.createProperty,
);

// ── TENANT MODERATION on individual :id (Decision 3) ────────────────────────
router.patch(
  '/admin/:id/:action',
  authController.protect,
  requireTenantScope,
  requireTenantModule('immobilier'),
  propertyModerationManageAuthority,
  propertyController.updatePropertyStatus,
);
router.delete(
  '/admin/:id',
  authController.protect,
  requireTenantScope,
  requireTenantModule('immobilier'),
  propertyModerationManageAuthority,
  propertyController.adminDeleteProperty,
);

// ── PLATFORM MARKETPLACE MODERATION (Decision 3) ────────────────────────────
// `recommande` is a global-marketplace flag consumed by GET /recommended
// (a PUBLIC endpoint that spans tenants). Tenant Admin authority is not
// sufficient — the operation is platform-scoped and requires an active
// PlatformOperator with `platform.properties.manage`.
router.patch(
  '/:id/recommande',
  authController.protect,
  requirePlatformOperatorCapability('platform.properties.manage'),
  propertyController.setRecommande,
);

// ── PUBLIC/AUTH interactions ────────────────────────────────────────────────
router.post('/:id/like', authController.protect, propertyController.toggleLike);
router.post('/:id/share', propertyController.incrementShare);
router.post('/:id/reviews', authController.protect, propertyController.addPropertyReview);

// ── MIXED owner-or-tenant-staff mutations (Decision 2) ──────────────────────
// The controller resolves the authority dually:
//  • OWNER: `Property.owner === req.user.id` → allowed without any tenant
//    context.
//  • TENANT STAFF: `req.tenantBusinessRole ∈ {Admin, GestionnaireImmobilier}`
//    AND `Property.tenant === req.platformTenant._id` (strict). A
//    tenant=null property is intentionally OUT of the tenant staff branch.
// Route-level `restrictTo(...)` is retired here: it filtered by User.role
// (a legacy tenant-authority proxy). The narrower controller-level dual
// branch is authoritative and canonical.
router.put(
  '/:id',
  authController.protect,
  resolveTenantMembershipIfPresent,
  upload.array('images', 10),
  propertyController.updateProperty,
);
router.delete(
  '/:id',
  authController.protect,
  resolveTenantMembershipIfPresent,
  propertyController.deleteProperty,
);

// ── PUBLIC catch-all detail ─────────────────────────────────────────────────
router.get('/:id', authController.optionalAuth, propertyController.getProperty);

module.exports = router;
