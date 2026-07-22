const Hotel = require('../../models/Hotel');
const { fail } = require('./financialError');

const ACCOUNTING_ROLES = ['Admin', 'Collaborateur', 'Secretaire'];
const HOTEL_FINANCE_ROLES = ['Admin', 'Collaborateur', 'Secretaire', 'Proprietaire'];
const FINANCIAL_CAPABILITIES = Object.freeze({
  Admin: ['financial.document.view', 'financial.document.draft.manage', 'financial.document.issue', 'financial.payment.create', 'financial.payment.confirm', 'financial.allocation.manage', 'financial.ledger.view', 'financial.reconciliation.run'],
  Collaborateur: ['financial.document.view', 'financial.document.draft.manage', 'financial.document.issue', 'financial.payment.create', 'financial.payment.confirm', 'financial.allocation.manage', 'financial.ledger.view'],
  Secretaire: ['financial.document.view', 'financial.document.draft.manage', 'financial.document.issue', 'financial.payment.create', 'financial.payment.confirm', 'financial.allocation.manage', 'financial.ledger.view'],
  Proprietaire: ['financial.document.view', 'financial.document.draft.manage'],
});
const id = (value) => String(value?._id || value?.id || value || '');

async function assertCanManageHotelFinance(user, hotelId) {
  if (!user) fail('FINANCIAL_UNAUTHORIZED', 'Authentification requise.', 401);
  const hotel = await Hotel.findById(hotelId).select('manager name brand email phone property');
  if (!hotel) fail('FINANCIAL_UNAUTHORIZED', 'Établissement inaccessible.', 404);
  // Sans modèle d’affectation staff→hôtel, seul Admin conserve une portée
  // globale. Tous les autres rôles doivent être le manager explicite.
  if (user.role !== 'Admin' && id(hotel.manager) !== id(user)) fail('FINANCIAL_UNAUTHORIZED', 'Accès financier refusé.', 403);
  return hotel;
}
async function assertAccountingRole(user) {
  if (!user || !ACCOUNTING_ROLES.includes(user.role)) fail('FINANCIAL_UNAUTHORIZED', 'Permission comptable requise.', 403);
  return true;
}
function hasFinancialCapability(user, capability) { return Boolean(user && FINANCIAL_CAPABILITIES[user.role]?.includes(capability)); }
function assertFinancialCapability(user, capability) { if (!hasFinancialCapability(user, capability)) fail('FINANCIAL_UNAUTHORIZED', 'Capacité financière requise.', 403); return true; }
const assertCanCreateFinancialDraft = assertCanManageHotelFinance;
const assertCanEditFinancialDraft = assertCanManageHotelFinance;
async function assertCanIssueFinancialDocument(user, hotelId) { await assertAccountingRole(user); return assertCanManageHotelFinance(user, hotelId); }
const assertCanViewFinancialDocument = assertCanManageHotelFinance;
async function assertCanManageFinancialPayment(user, hotelId) { await assertAccountingRole(user); return assertCanManageHotelFinance(user, hotelId); }
const assertCanAllocatePayment = assertCanManageFinancialPayment;
const assertCanReverseAllocation = assertCanManageFinancialPayment;
const assertCanViewFinancialLedger = assertCanManageFinancialPayment;
module.exports = { ACCOUNTING_ROLES, HOTEL_FINANCE_ROLES, FINANCIAL_CAPABILITIES, hasFinancialCapability, assertFinancialCapability, assertAccountingRole, assertCanManageHotelFinance, assertCanCreateFinancialDraft, assertCanEditFinancialDraft, assertCanIssueFinancialDocument, assertCanViewFinancialDocument, assertCanManageFinancialPayment, assertCanAllocatePayment, assertCanReverseAllocation, assertCanViewFinancialLedger };
