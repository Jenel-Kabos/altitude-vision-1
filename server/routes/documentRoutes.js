const express = require('express');
const documentController = require('../controllers/documentController');
const authController = require('../controllers/authController');
const writeWindowMiddleware = require('../middleware/writeWindowMiddleware');
const { requireTenantMembershipRoleOrPlatformCapability } = require('../middleware/tenantMembershipRoleOrPlatformCapability');

const router = express.Router();
const { requireTenantScope } = require('../middleware/tenantContext');

// PLATFORM-SUPER-ADMIN OPTION-3 SLICE-8 (2026-09-24) — full generic Document
// authority under Pattern 1 compositional Option 3.
//
//   PATH A — tenant staff: OrgMembership.businessRole ∈ tenantRoles.
//   PATH B — PlatformOperator actif + selected tenant + platform capability.
//
// READ  (list + detail)  — tenant staff ∈ {Admin, Collaborateur, Secretaire}
//                          OR platform.documents.read / .manage.
// WRITE (POST + PATCH)   — same tenant roles OR platform.documents.manage.
//                          writeWindowMiddleware conservé pour préserver la
//                          fenêtre d'écriture Collaborateur PATH A (§18) —
//                          transparent pour Admin/Secretaire (PATH A) et
//                          pour PlatformOperator (User.role hors COLLAB_ROLES).
// DELETE                 — Admin tenant business role OR platform.documents.manage.
//                          Aucun bypass User.role='Admin' global — l'ancien
//                          restrictTo('Admin') est retiré (§20). Immutability
//                          Financial Core (businessOperationKey / Transaction.
//                          linkedInvoice) préservée par le controller (409
//                          DOCUMENT_IMMUTABLE); cross-tenant fail-closed via
//                          assertResourceTenant existant.
const DOC_STAFF_READ = ['Admin', 'Collaborateur', 'Secretaire'];
const DOC_STAFF_MANAGE = ['Admin', 'Collaborateur', 'Secretaire'];
const DOC_STAFF_DELETE = ['Admin'];
const documentReadAuthority = requireTenantMembershipRoleOrPlatformCapability({
  tenantRoles: DOC_STAFF_READ,
  platformCapabilities: ['platform.documents.read', 'platform.documents.manage'],
});
const documentManageAuthority = requireTenantMembershipRoleOrPlatformCapability({
  tenantRoles: DOC_STAFF_MANAGE,
  platformCapabilities: ['platform.documents.manage'],
});
const documentDeleteAuthority = requireTenantMembershipRoleOrPlatformCapability({
  tenantRoles: DOC_STAFF_DELETE,
  platformCapabilities: ['platform.documents.manage'],
});

router.use(authController.protect, requireTenantScope);
router.get('/', documentReadAuthority, documentController.getAllDocuments);
router.get('/:id', documentReadAuthority, documentController.getDocument);
router.post('/', documentManageAuthority, writeWindowMiddleware, documentController.createDocument);
router.patch('/:id', documentManageAuthority, writeWindowMiddleware, documentController.updateDocument);
router.delete('/:id', documentDeleteAuthority, documentController.deleteDocument);

module.exports = router;
