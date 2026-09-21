const Hotel = require('../../models/Hotel');
const { fail } = require('./financialError');
const { resolveTenantMembership } = require('../tenantMembershipService');
const { resolveActiveOperator } = require('../platformOperator/platformOperatorService');
const { DEFAULT_CAPABILITIES } = require('../../utils/iamArchitecture');
const { assertResourceTenant } = require('../platformTenant/tenantResourceAttributionService');

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
// Financial capabilities remain operation-specific. The tenant plane consumes
// the canonical membership resolver and named IAM capabilities, never User.role
// or the legacy.full wildcard. Hotel.manager is relationship data only.
const readOnlyFinanceCapabilities = [
  CAPABILITIES.DOCUMENT_VIEW, CAPABILITIES.PAYMENT_VIEW, CAPABILITIES.LEDGER_VIEW,
  CAPABILITIES.RECONCILIATION_VIEW, CAPABILITIES.HOTEL_CHECKOUT_VIEW,
  CAPABILITIES.DOCUMENT_PDF_DOWNLOAD, CAPABILITIES.DOCUMENT_DELIVERY_VIEW,
  CAPABILITIES.DASHBOARD_VIEW, CAPABILITIES.DASHBOARD_ALERTS_VIEW,
];
const operationalPaymentCapabilities = [CAPABILITIES.PAYMENT_CREATE, CAPABILITIES.PAYMENT_CONFIRM, CAPABILITIES.PAYMENT_ALLOCATE];
const tenantCapabilities = (businessRole) => {
  const named = DEFAULT_CAPABILITIES[businessRole] || [];
  if (businessRole === 'Admin' && named.includes('*')) return adminCapabilities;
  return [
    ...(named.includes('payments.read') || named.includes('payment.status') ? readOnlyFinanceCapabilities : []),
    ...(named.includes('payments.manage') ? operationalPaymentCapabilities : []),
  ];
};
const FINANCIAL_CAPABILITIES = Object.freeze(Object.fromEntries(
  Object.keys(DEFAULT_CAPABILITIES).map((role) => [role, Object.freeze(tenantCapabilities(role))]),
));
const ACCOUNTING_ROLES = Object.keys(FINANCIAL_CAPABILITIES).filter((role) => FINANCIAL_CAPABILITIES[role].includes(CAPABILITIES.PAYMENT_CONFIRM));
const HOTEL_FINANCE_ROLES = Object.keys(FINANCIAL_CAPABILITIES).filter((role) => FINANCIAL_CAPABILITIES[role].length);
const id = (value) => value?._id || value?.id || value;

async function hasFinancialCapability(user, capability) {
  if (!user || !Object.values(CAPABILITIES).includes(capability)) return false;
  const userId = id(user);
  if (!userId) return false;
  const operator = await resolveActiveOperator(userId);
  if (operator?.status === 'active') {
    if (operator.capabilities?.includes('platform.finance.manage')) return adminCapabilities.includes(capability);
    if (operator.capabilities?.includes('platform.finance.read') && readOnlyFinanceCapabilities.includes(capability)) return true;
  }
  const tenantId = id(user.platformTenant);
  if (!tenantId) return false;
  const resolved = await resolveTenantMembership(userId, tenantId);
  if (!resolved || resolved.ambiguous || resolved.status !== 'active'
    || ['suspended', 'archived'].includes(resolved.tenant?.status)) return false;
  return tenantCapabilities(resolved.businessRole).includes(capability);
}

async function assertFinancialCapability(user, capability) {
  if (!user) fail('FINANCIAL_UNAUTHORIZED', 'Authentification requise.', 401);
  if (!await hasFinancialCapability(user, capability)) fail('FINANCIAL_UNAUTHORIZED', 'Capacite financiere requise.', 403);
  return true;
}

async function assertFinancialScope(user, hotelId, capability = CAPABILITIES.DOCUMENT_VIEW) {
  await assertFinancialCapability(user, capability);
  const tenantId = id(user.platformTenant);
  if (!tenantId) fail('FINANCIAL_UNAUTHORIZED', 'Contexte tenant requis.', 403);
  const hotel = await Hotel.findById(hotelId).select('tenant manager name brand email phone property createdBy');
  if (!hotel) fail('FINANCIAL_UNAUTHORIZED', 'Etablissement inaccessible.', 404);
  await assertResourceTenant({ resourceType: 'Hotel', resource: hotel, tenantId })
    .catch(() => fail('FINANCIAL_UNAUTHORIZED', 'Etablissement inaccessible.', 404));
  return hotel;
}

async function authorizeFinancialAction({ user, capability, establishmentId }) {
  return assertFinancialScope(user, establishmentId, capability);
}

async function assertFinancialDashboardScope(user, capability, hotelId) {
  await assertFinancialCapability(user, capability);
  if (!id(user.platformTenant)) fail('FINANCIAL_UNAUTHORIZED', 'Contexte tenant requis.', 403);
  if (!hotelId) {
    const hotels = await Hotel.find({ tenant: id(user.platformTenant) }).select('_id').lean();
    if (hotels.length !== 1) fail('FINANCIAL_DASHBOARD_ACCESS_DENIED', 'Sélectionnez un établissement accessible.', 403);
    hotelId = hotels[0]._id;
  }
  const hotel = await assertFinancialScope(user, hotelId, capability);
  return { hotel, global: false, hotelId, accessibleHotelIds: [hotelId] };
}

async function assertAccountingRole(user) {
  return assertFinancialCapability(user, CAPABILITIES.PAYMENT_CONFIRM);
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
