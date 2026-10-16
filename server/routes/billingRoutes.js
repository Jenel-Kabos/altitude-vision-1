// F-U2 — Routes v1 de la facturation unifiée (montées sous /api/v1/billing).
// Non routés : gestion des tarifs d'abonnement (décision commerciale, service
// uniquement), encaissements, remboursements et reversements réels.
const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/billingController');
const { attachTenantScopeIfResolvable } = require('../middleware/tenantContext');
const { kycNoStore: noStore } = require('../middleware/kycSecurity');

const router = express.Router();
router.use(noStore, auth.protect, attachTenantScopeIfResolvable);

router.get('/owner/dashboard', ctrl.ownerDashboard);
router.get('/dashboard', ctrl.administrationDashboard);
router.get('/issuer-readiness', ctrl.issuerReadiness);
router.get('/documents/:documentId', ctrl.getDocument);
router.post('/rent-invoices', ctrl.generateRentInvoice);
router.post('/lease-exits', ctrl.recordLeaseExit);
router.post('/lease-policies', ctrl.createLeasePolicy);
router.get('/leases/:leaseId/policies', ctrl.listLeasePolicies);
router.post('/commission-invoices', ctrl.generateCommissionInvoice);
router.post('/subscription-invoices', ctrl.generateSubscriptionInvoice);
router.get('/collection', ctrl.collectionOverview);
router.get('/owner/collection', ctrl.ownerCollection);
router.post('/owner/tracking-dues', ctrl.generateOwnerTrackingDue);
router.post('/owner/tracking-dues/:documentId/receipts', ctrl.recordOwnerRentReceipt);
router.post('/direct-receipts/:receiptId/evidence', ctrl.submitDirectReceiptEvidence);
router.post('/direct-receipts/:receiptId/cancel', ctrl.cancelDirectReceipt);
router.post('/direct-receipts/:receiptId/review', ctrl.reviewDirectReceipt);
router.get('/direct-receipts/review-queue', ctrl.listDirectReceiptsForReview);
router.post('/difficulty-reports/:reportId/decision', ctrl.decideDifficultyReport);
router.post('/collection-cases/:caseId/send', ctrl.sendFormalNotice);
router.get('/autonomous/pricing', ctrl.autonomousPricing);
router.get('/autonomous/summary', ctrl.autonomousSummary);
router.post('/autonomous-invoices', ctrl.generateAutonomousInvoice);
router.post('/portfolio-quotes', ctrl.preparePortfolioQuote);
router.post('/portfolio-quotes/:quoteId/accept', ctrl.acceptPortfolioQuote);
router.post('/portfolio-quotes/:quoteId/reject', ctrl.rejectPortfolioQuote);
router.post('/documents/:documentId/issue', ctrl.issueDocument);
router.post('/documents/:documentId/cancel', ctrl.cancelDraft);
router.post('/documents/:documentId/credit-notes', ctrl.creditDocument);

module.exports = router;
