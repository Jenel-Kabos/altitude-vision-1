const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/financialController');
const dashboardCtrl = require('../controllers/hotelFinancialDashboardController');
const mtnCtrl = require('../controllers/mtnMomoPaymentController');
const { STAFF_IMMO } = require('../utils/roles');
const router = express.Router();
const { attachTenantScopeIfResolvable } = require('../middleware/tenantContext');
// TENANT-SCOPE-HOTFIX-3 — même correctif que hotelRoutes.js : `requireTenantScope`
// bloquait, avant même d'atteindre `financialAuthorizationService.assertFinancialScope`,
// tout exploitant/Proprietaire public-signup sans OrgMembership sur des
// routes en lecture seule pourtant explicitement ouvertes à `ownerCapabilities`
// (DOCUMENT_VIEW, PAYMENT_VIEW, LEDGER_VIEW, DASHBOARD_VIEW…) — voir
// server/docs/TENANT_SCOPE_AUDIT2B_REPORT.md. `assertFinancialScope` contient
// déjà le contournement ownership nécessaire (`!user.platformTenant &&
// hotel.manager===user`). `attachTenantScopeIfResolvable` enrichit
// `req.user` À L'IDENTIQUE de `requireTenantScope` quand un tenant EXISTE
// (aucun changement pour le staff finance), mais ne bloque plus quand aucun
// tenant ne se résout. Chaque route strictement staff-only (émission,
// confirmation, allocation, reverse…) reste protégée indépendamment par
// `assertFinancialCapability` (RBAC par rôle/capacité, jamais par la seule
// présence d'un tenant — `Proprietaire` n'a jamais ces capacités dans
// `FINANCIAL_CAPABILITIES`) — voir TENANT_SCOPE_HOTFIX3_ROUTE_MATRIX.md.
router.use(auth.protect, attachTenantScopeIfResolvable);
// DOC-ARCH-2 — lecture seule, gardée au niveau route (pas d'établissement
// précis à vérifier ici, contrairement aux routes /hotel/:hotelId/*).
router.get('/accommodations/documents', auth.restrictTo(...STAFF_IMMO), ctrl.listAccommodationDocuments);
router.get('/hotel/dashboard/summary', dashboardCtrl.getSummary);
router.get('/hotel/dashboard/trends', dashboardCtrl.getTrends);
router.get('/hotel/dashboard/breakdown', dashboardCtrl.getBreakdown);
router.get('/hotel/dashboard/aging', dashboardCtrl.getAging);
router.get('/hotel/dashboard/alerts', dashboardCtrl.getAlerts);
router.post('/hotel/reservations/:reservationId/invoice-draft', ctrl.createHotelDraft);
router.get('/hotel/reservations/:reservationId/document', ctrl.getReservationDocument);
router.get('/hotel/:hotelId/documents', ctrl.listHotelDocuments);
router.get('/documents/:documentId', ctrl.getDocument);
router.patch('/documents/:documentId/draft', ctrl.updateDraft);
router.post('/documents/:documentId/finalize-lines', ctrl.finalizeLines);
router.post('/documents/:documentId/refresh-from-reservation', ctrl.refreshFromReservation);
router.post('/documents/:documentId/issue', ctrl.issue);
router.post('/documents/:documentId/pdf', ctrl.generateOfficialPdf);
router.get('/documents/:documentId/pdf', ctrl.getOfficialPdfStatus);
router.get('/documents/:documentId/pdf/download', ctrl.downloadOfficialPdf);
router.post('/documents/:documentId/email', ctrl.sendOfficialInvoiceEmail);
router.get('/documents/:documentId/deliveries', ctrl.listDocumentDeliveries);
router.post('/payments/manual', ctrl.createManualPayment);
router.post('/hotel/payments', ctrl.createHotelPayment);
// PAY-4 — MTN MoMo Direct : client (sa propre réservation) ou staff autorisé
// (au comptoir). Authentifiées comme le reste du routeur (auth.protect déjà
// appliqué ci-dessus) — jamais publiques, contrairement au callback MTN
// (server/routes/paymentProviderRoutes.js, monté séparément, sans JWT).
router.post('/hotel/payments/mtn/initiate', mtnCtrl.initiate);
router.post('/hotel/payments/:paymentId/mtn/check-status', mtnCtrl.checkStatus);
router.get('/hotel/:hotelId/payments', ctrl.listHotelPayments);
router.get('/hotel/reservations/:reservationId/payments', ctrl.listReservationPayments);
router.get('/documents/:documentId/payments', ctrl.listDocumentPayments);
router.get('/payments/:paymentId', ctrl.getPayment);
router.post('/payments/:paymentId/confirm', ctrl.confirmPayment);
router.post('/payments/:paymentId/allocations', ctrl.allocateHotelPayment);
router.post('/allocations', ctrl.allocate);
router.post('/allocations/:allocationId/reverse', ctrl.reverseAllocation);
router.post('/hotel/allocations/:allocationId/reverse', ctrl.reverseHotelAllocation);
router.get('/documents/:documentId/ledger', ctrl.getLedger);
module.exports = router;
