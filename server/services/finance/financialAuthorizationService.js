const Hotel = require('../../models/Hotel');
const { fail } = require('./financialError');

const CAPABILITIES = Object.freeze({
  DOCUMENT_VIEW: 'financial.document.view',
  DOCUMENT_CREATE_DRAFT: 'financial.document.draft.create',
  DOCUMENT_EDIT_DRAFT: 'financial.document.draft.edit',
  DOCUMENT_ISSUE: 'financial.document.issue',
  PAYMENT_VIEW: 'financial.payment.view',
  PAYMENT_CREATE: 'financial.payment.create',
  PAYMENT_CONFIRM: 'financial.payment.confirm',
  PAYMENT_ALLOCATE: 'financial.payment.allocate',
  ALLOCATION_REVERSE: 'financial.allocation.reverse',
  LEDGER_VIEW: 'financial.ledger.view',
  RECONCILIATION_VIEW: 'financial.reconciliation.view',
  RECONCILIATION_RUN: 'financial.reconciliation.run',
  HOTEL_CHECKOUT_VIEW: 'hotel.checkout.financial.view',
  HOTEL_CHECKOUT_OVERRIDE: 'hotel.checkout.financial.override',
  DOCUMENT_PDF_GENERATE: 'financial.document.pdf.generate',
  DOCUMENT_PDF_DOWNLOAD: 'financial.document.pdf.download',
  DOCUMENT_EMAIL_SEND: 'financial.document.email.send',
  DOCUMENT_DELIVERY_VIEW: 'financial.document.delivery.view',
  DASHBOARD_VIEW: 'financial.hotel.dashboard.view',
  DASHBOARD_ALERTS_VIEW: 'financial.hotel.dashboard.alerts.view',
  DASHBOARD_OVERRIDE_AUDIT_VIEW: 'financial.hotel.dashboard.override_audit.view',
});

const managerCapabilities = [
  CAPABILITIES.DOCUMENT_VIEW, CAPABILITIES.DOCUMENT_CREATE_DRAFT,
  CAPABILITIES.DOCUMENT_EDIT_DRAFT, CAPABILITIES.DOCUMENT_ISSUE,
  CAPABILITIES.PAYMENT_VIEW, CAPABILITIES.PAYMENT_CREATE,
  CAPABILITIES.PAYMENT_CONFIRM, CAPABILITIES.PAYMENT_ALLOCATE,
  CAPABILITIES.ALLOCATION_REVERSE, CAPABILITIES.LEDGER_VIEW,
  CAPABILITIES.RECONCILIATION_VIEW, CAPABILITIES.HOTEL_CHECKOUT_VIEW,
  CAPABILITIES.DOCUMENT_PDF_GENERATE, CAPABILITIES.DOCUMENT_PDF_DOWNLOAD,
  CAPABILITIES.DOCUMENT_EMAIL_SEND, CAPABILITIES.DOCUMENT_DELIVERY_VIEW,
  CAPABILITIES.DASHBOARD_VIEW, CAPABILITIES.DASHBOARD_ALERTS_VIEW,
];
const adminCapabilities = [...managerCapabilities, CAPABILITIES.RECONCILIATION_RUN, CAPABILITIES.HOTEL_CHECKOUT_OVERRIDE, CAPABILITIES.DASHBOARD_OVERRIDE_AUDIT_VIEW];
const ownerCapabilities = [
  CAPABILITIES.DOCUMENT_VIEW, CAPABILITIES.PAYMENT_VIEW,
  CAPABILITIES.LEDGER_VIEW, CAPABILITIES.RECONCILIATION_VIEW,
  CAPABILITIES.HOTEL_CHECKOUT_VIEW,
  CAPABILITIES.DOCUMENT_PDF_DOWNLOAD, CAPABILITIES.DOCUMENT_DELIVERY_VIEW,
  CAPABILITIES.DASHBOARD_VIEW, CAPABILITIES.DASHBOARD_ALERTS_VIEW,
];

const FINANCIAL_CAPABILITIES = Object.freeze({
  Admin: Object.freeze(adminCapabilities),
  Collaborateur: Object.freeze(managerCapabilities),
  Secretaire: Object.freeze(managerCapabilities),
  Proprietaire: Object.freeze(ownerCapabilities),
});
const ACCOUNTING_ROLES = ['Admin', 'Collaborateur', 'Secretaire'];
const HOTEL_FINANCE_ROLES = Object.keys(FINANCIAL_CAPABILITIES);
const id = (value) => String(value?._id || value?.id || value || '');

function hasFinancialCapability(user, capability) {
  return Boolean(user && FINANCIAL_CAPABILITIES[user.role]?.includes(capability));
}

function assertFinancialCapability(user, capability) {
  if (!user) fail('FINANCIAL_UNAUTHORIZED', 'Authentification requise.', 401);
  if (!hasFinancialCapability(user, capability)) fail('FINANCIAL_UNAUTHORIZED', 'Capacite financiere requise.', 403);
  return true;
}

async function assertFinancialScope(user, hotelId) {
  if (!user) fail('FINANCIAL_UNAUTHORIZED', 'Authentification requise.', 401);
  const hotel = await Hotel.findById(hotelId).select('manager name brand email phone property');
  if (!hotel) fail('FINANCIAL_UNAUTHORIZED', 'Etablissement inaccessible.', 404);
  if (user.role !== 'Admin' && id(hotel.manager) !== id(user)) {
    fail('FINANCIAL_UNAUTHORIZED', 'Acces financier refuse.', 403);
  }
  return hotel;
}

async function authorizeFinancialAction({ user, capability, establishmentId }) {
  assertFinancialCapability(user, capability);
  return assertFinancialScope(user, establishmentId);
}

// Portee dediee au dashboard : un hotelId est obligatoire pour tout role sauf Admin,
// qui peut consulter une consolidation globale (hotelId omis) sans scanner tous les hotels un par un.
async function assertFinancialDashboardScope(user, capability, hotelId) {
  assertFinancialCapability(user, capability);
  if (hotelId) return { hotel: await assertFinancialScope(user, hotelId), global: false };
  if (user.role !== 'Admin') fail('FINANCIAL_DASHBOARD_ACCESS_DENIED', 'Un hotelId est requis pour ce role.', 403);
  return { hotel: null, global: true };
}

async function assertAccountingRole(user) {
  if (!user || !ACCOUNTING_ROLES.includes(user.role)) fail('FINANCIAL_UNAUTHORIZED', 'Permission comptable requise.', 403);
  return true;
}

const withCapability = (capability) => (user, hotelId) => authorizeFinancialAction({ user, capability, establishmentId: hotelId });
const assertCanCreateFinancialDraft = withCapability(CAPABILITIES.DOCUMENT_CREATE_DRAFT);
const assertCanEditFinancialDraft = withCapability(CAPABILITIES.DOCUMENT_EDIT_DRAFT);
const assertCanIssueFinancialDocument = withCapability(CAPABILITIES.DOCUMENT_ISSUE);
const assertCanViewFinancialDocument = withCapability(CAPABILITIES.DOCUMENT_VIEW);
const assertCanViewFinancialPayment = withCapability(CAPABILITIES.PAYMENT_VIEW);
const assertCanCreateFinancialPayment = withCapability(CAPABILITIES.PAYMENT_CREATE);
const assertCanConfirmFinancialPayment = withCapability(CAPABILITIES.PAYMENT_CONFIRM);
const assertCanAllocatePayment = withCapability(CAPABILITIES.PAYMENT_ALLOCATE);
const assertCanReverseAllocation = withCapability(CAPABILITIES.ALLOCATION_REVERSE);
const assertCanViewFinancialLedger = withCapability(CAPABILITIES.LEDGER_VIEW);
const assertCanViewHotelCheckoutFinancials = withCapability(CAPABILITIES.HOTEL_CHECKOUT_VIEW);
const assertCanGenerateFinancialDocumentPdf = withCapability(CAPABILITIES.DOCUMENT_PDF_GENERATE);
const assertCanDownloadFinancialDocumentPdf = withCapability(CAPABILITIES.DOCUMENT_PDF_DOWNLOAD);
const assertCanSendFinancialDocumentEmail = withCapability(CAPABILITIES.DOCUMENT_EMAIL_SEND);
const assertCanViewFinancialDocumentDeliveries = withCapability(CAPABILITIES.DOCUMENT_DELIVERY_VIEW);
const assertCanViewFinancialDashboard = (user, hotelId) => assertFinancialDashboardScope(user, CAPABILITIES.DASHBOARD_VIEW, hotelId);
const assertCanViewFinancialDashboardAlerts = (user, hotelId) => assertFinancialDashboardScope(user, CAPABILITIES.DASHBOARD_ALERTS_VIEW, hotelId);
const assertCanViewFinancialDashboardOverrideAudit = (user, hotelId) => assertFinancialDashboardScope(user, CAPABILITIES.DASHBOARD_OVERRIDE_AUDIT_VIEW, hotelId);

// Compatibilite interne F1.1 : cette fonction signifie desormais "creer un paiement".
const assertCanManageFinancialPayment = assertCanCreateFinancialPayment;
const assertCanManageHotelFinance = assertFinancialScope;

module.exports = {
  CAPABILITIES, ACCOUNTING_ROLES, HOTEL_FINANCE_ROLES, FINANCIAL_CAPABILITIES,
  hasFinancialCapability, assertFinancialCapability, assertFinancialScope,
  authorizeFinancialAction, assertFinancialDashboardScope, assertAccountingRole, assertCanManageHotelFinance,
  assertCanViewFinancialDashboard, assertCanViewFinancialDashboardAlerts, assertCanViewFinancialDashboardOverrideAudit,
  assertCanCreateFinancialDraft, assertCanEditFinancialDraft,
  assertCanIssueFinancialDocument, assertCanViewFinancialDocument,
  assertCanViewFinancialPayment, assertCanCreateFinancialPayment,
  assertCanConfirmFinancialPayment, assertCanManageFinancialPayment,
  assertCanAllocatePayment, assertCanReverseAllocation,
  assertCanViewFinancialLedger, assertCanViewHotelCheckoutFinancials,
  assertCanGenerateFinancialDocumentPdf, assertCanDownloadFinancialDocumentPdf,
  assertCanSendFinancialDocumentEmail, assertCanViewFinancialDocumentDeliveries,
};
