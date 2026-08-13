const Hotel = require('../../models/Hotel');
const { fail } = require('./financialError');
const { resolveHotelAccessScope } = require('../hotel/hotelAccessScopeService');
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

// PLATFORM-ADMIN-1 — mission §26 : "ne jamais transformer PlatformOperator
// en permission financière implicite non auditée". Un opérateur ne reçoit
// donc PAS automatiquement les capacités `Admin` : il doit détenir
// explicitement `platform.finance.manage` (équivalent complet des capacités
// Admin) ou `platform.finance.read` (lecture seule, sous-ensemble) — les
// deux SEULES capacités PlatformOperator qui influencent ce module. Chaque
// action reste par ailleurs journalisée par `financialController`/`actionLogService`
// exactement comme pour tout autre acteur, aucune exception d'audit créée ici.
const readOnlyFinanceCapabilities = [
  CAPABILITIES.DOCUMENT_VIEW, CAPABILITIES.PAYMENT_VIEW, CAPABILITIES.LEDGER_VIEW,
  CAPABILITIES.RECONCILIATION_VIEW, CAPABILITIES.HOTEL_CHECKOUT_VIEW,
  CAPABILITIES.DOCUMENT_PDF_DOWNLOAD, CAPABILITIES.DOCUMENT_DELIVERY_VIEW,
  CAPABILITIES.DASHBOARD_VIEW, CAPABILITIES.DASHBOARD_ALERTS_VIEW,
];

function hasPlatformOperatorFinanceCapability(user, capability) {
  if (!user?.isPlatformOperatorContext) return false;
  const capabilities = user.platformOperatorCapabilities || [];
  // `.manage` = équivalent complet des capacités Admin (émission, override,
  // reconciliation.run inclus). `.read` = strictement les capacités de
  // consultation, jamais une action qui modifie/émet/override.
  if (capabilities.includes('platform.finance.manage')) return adminCapabilities.includes(capability);
  if (capabilities.includes('platform.finance.read')) return readOnlyFinanceCapabilities.includes(capability);
  return false;
}

function hasFinancialCapability(user, capability) {
  if (hasPlatformOperatorFinanceCapability(user, capability)) return true;
  return Boolean(user && FINANCIAL_CAPABILITIES[user.role]?.includes(capability));
}

function assertFinancialCapability(user, capability) {
  if (!user) fail('FINANCIAL_UNAUTHORIZED', 'Authentification requise.', 401);
  if (!hasFinancialCapability(user, capability)) fail('FINANCIAL_UNAUTHORIZED', 'Capacite financiere requise.', 403);
  return true;
}

// F2.6 : la portee accepte, dans l'ordre, Admin (bypass), le legacy Hotel.manager (compatibilite
// F0-F2.5, aucune migration n'est un prealable bloquant), puis un rattachement HotelStaffAssignment
// actif portant la capacite requise (quand elle est precisee par l'appelant).
async function assertFinancialScope(user, hotelId, capability) {
  if (!user) fail('FINANCIAL_UNAUTHORIZED', 'Authentification requise.', 401);
  const hotel = await Hotel.findById(hotelId).select('tenant manager name brand email phone property createdBy');
  if (!hotel) fail('FINANCIAL_UNAUTHORIZED', 'Etablissement inaccessible.', 404);
  if (!user.platformTenant) {
    if (id(hotel.manager) === id(user)) return hotel;
    fail('FINANCIAL_UNAUTHORIZED', 'Contexte tenant requis.', 403);
  }
  await assertResourceTenant({ resourceType: 'Hotel', resource: hotel, tenantId: user.platformTenant._id || user.platformTenant })
    .catch(() => fail('FINANCIAL_UNAUTHORIZED', 'Etablissement inaccessible.', 404));
  // PLATFORM-ADMIN-1 — additif : un opérateur n'atteint cette ligne QUE s'il
  // a explicitement sélectionné le tenant du présent hôtel (sinon
  // `user.platformTenant` serait `null`, branche ci-dessus) ET détient la
  // capacité finance requise — jamais un bypass tenant, jamais implicite.
  if (user.role === 'Admin' || id(hotel.manager) === id(user) || hasPlatformOperatorFinanceCapability(user, capability)) return hotel;
  const scope = await resolveHotelAccessScope({ actor: user, requiredCapability: capability, requestedHotelId: hotelId }).catch(() => null);
  if (!scope) fail('FINANCIAL_UNAUTHORIZED', 'Acces financier refuse.', 403);
  return hotel;
}

async function authorizeFinancialAction({ user, capability, establishmentId }) {
  assertFinancialCapability(user, capability);
  return assertFinancialScope(user, establishmentId, capability);
}

// F2.6 : delegue la resolution reelle multi-hotels a hotelAccessScopeService (Admin -> global ;
// un seul hotel accessible -> auto-selectionne ; plusieurs -> selection explicite requise ;
// aucun -> refuse). Les codes d'erreur historiques F2.5 sont preserves pour ne pas regresser.
async function assertFinancialDashboardScope(user, capability, hotelId) {
  assertFinancialCapability(user, capability);
  let scope;
  try {
    scope = await resolveHotelAccessScope({ actor: user, requiredCapability: capability, requestedHotelId: hotelId });
  } catch (error) {
    if (error.code === 'HOTEL_SCOPE_REQUIRED') fail('FINANCIAL_DASHBOARD_ACCESS_DENIED', error.message, 403);
    if (error.code === 'HOTEL_ACCESS_DENIED') fail('FINANCIAL_UNAUTHORIZED', 'Acces financier refuse.', error.statusCode || 403);
    throw error;
  }
  if (scope.globalAccess) return { hotel: null, global: true, hotelId: hotelId || null, accessibleHotelIds: null };
  const resolvedHotelId = hotelId || scope.hotelIds[0];
  return { hotel: { _id: resolvedHotelId }, global: false, hotelId: resolvedHotelId, accessibleHotelIds: scope.hotelIds };
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
