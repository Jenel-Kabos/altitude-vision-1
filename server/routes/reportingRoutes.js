// REPORTING-1 — Routes du Centre de Pilotage. Réservé à la Direction
// (Admin/GestionnaireImmobilier), même périmètre que REPORTING_EXECUTIVE
// dans shared/navigation/registry.json.
const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/reportingController');
// PLATFORM-ADMIN-1 — seul module de reporting exécutif : un PlatformOperator
// sans tenant sélectionné obtient un rapport consolidé plateforme entière
// (déjà supporté nativement par reportingService.js, jamais un KPI
// fabriqué pour ce sprint — voir scopeParams dans reportingController.js).
const { requireTenantScopeAllowPlatformWide } = require('../middleware/tenantContext');

const DIRECTION = ['Admin', 'GestionnaireImmobilier'];
router.use(auth.protect, auth.restrictTo(...DIRECTION), requireTenantScopeAllowPlatformWide);

router.get('/executive', controller.getExecutive);
router.get('/domains/:domain', controller.getDomain);
router.get('/export/pdf', controller.exportPdf);
router.get('/export/csv', controller.exportCsv);

module.exports = router;
