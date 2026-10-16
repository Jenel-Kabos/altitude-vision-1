// F-U1.G — Routes v1 de la finance contractuelle (montées sous
// /api/v1/contractual-finance).
//
// Résolution du contexte ≠ autorisation : le middleware attache le contexte
// tenant s'il se résout, l'autorisation est entièrement décidée par les
// services (capacités contractuelles dérivées ou autorité du propriétaire).
//
// VOLONTAIREMENT NON ROUTÉ :
//   - bootstrap des gouverneurs et attestation d'identité (procédures hors API) ;
//   - approbation, consentement, mise en attente d'exécution, blocage et levée
//     des remboursements ; activation des politiques (aucun seuil validé) ;
//   - toute exécution de reversement ou de remboursement (interdite).

const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/contractualFinanceController');
const { attachTenantScopeIfResolvable } = require('../middleware/tenantContext');

const router = express.Router();
router.use(auth.protect, attachTenantScopeIfResolvable);

router.post('/mandates', ctrl.createMandate);
router.get('/mandates/:mandateId', ctrl.getMandate);
router.post('/mandates/:mandateId/amendments', ctrl.amendMandate);
router.post('/mandates/:mandateId/activate', ctrl.activateMandate);
router.post('/mandates/:mandateId/suspend', ctrl.suspendMandate);
router.post('/mandates/:mandateId/revoke', ctrl.revokeMandate);

router.get('/mandates/:mandateId/expenses', ctrl.listExpenses);
router.post('/mandates/:mandateId/expenses', ctrl.requestExpense);
router.post('/expenses/:expenseId/owner-decision', ctrl.ownerExpenseDecision);
router.post('/expenses/:expenseId/justify', ctrl.justifyExpense);
router.post('/expenses/:expenseId/cancel', ctrl.cancelExpense);

router.post('/mandates/:mandateId/owner-direct-declarations', ctrl.declareOwnerDirect);
router.post('/collections/:collectionId/owner-confirmation', ctrl.ownerConfirmCollection);
router.get('/mandates/:mandateId/obligations', ctrl.listObligations);

router.post('/beneficiaries', ctrl.registerBeneficiary);
router.post('/mandates/:mandateId/beneficiaries/self', ctrl.registerOwnBeneficiary);

router.post('/representations', ctrl.designateRepresentative);
router.post('/representations/:representationId/revoke', ctrl.revokeRepresentation);

// F-U1.H — gouvernance des habilitations sensibles (double contrôle).
router.get('/grants', ctrl.listGrants);
router.post('/grants', ctrl.proposeGrant);
router.post('/grants/:grantId/approve', ctrl.approveGrant);
router.post('/grants/:grantId/reevaluate-independence', ctrl.reevaluateGrantIndependence);
router.post('/grants/:grantId/refuse', ctrl.refuseGrant);
router.post('/grants/:grantId/suspend', ctrl.suspendGrant);
router.post('/grants/:grantId/reinstate', ctrl.reinstateGrant);
router.post('/grants/:grantId/revoke', ctrl.revokeGrant);

// F-U1.H — opérations sensibles sous habilitation nominative.
router.post('/expenses/:expenseId/written-authorizations', ctrl.submitWrittenAuthorization);
router.post('/written-authorizations/:submissionId/authenticate', ctrl.authenticateWrittenAuthorization);
router.post('/representations/written-proxies', ctrl.registerWrittenProxy);
router.post('/representations/:representationId/verify', ctrl.verifyWrittenProxy);
router.post('/beneficiaries/:beneficiaryId/verify', ctrl.verifyBeneficiary);
router.post('/collections/:collectionId/reconcile', ctrl.reconcileCollection);
router.post('/mandates/:mandateId/agency-collections', ctrl.recognizeAgencyCollection);
router.post('/refunds', ctrl.prepareRefund);
router.get('/refunds/:refundId', ctrl.getRefund);
router.post('/refund-policies', ctrl.draftRefundPolicy);
router.post('/issuer-identities', ctrl.registerIssuerIdentity);
router.post('/issuer-identities/:identityId/verify', ctrl.verifyIssuerIdentity);

module.exports = router;
