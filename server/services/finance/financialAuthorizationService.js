const Hotel = require('../../models/Hotel');
const { ALL_STAFF } = require('../../utils/roles');
const { fail } = require('./financialError');

const ACCOUNTING_ROLES = ['Admin', 'Collaborateur', 'Secretaire'];
const HOTEL_FINANCE_ROLES = [...new Set([...ALL_STAFF, 'Proprietaire'])];
const id = (value) => String(value?._id || value?.id || value || '');

async function assertCanManageHotelFinance(user, hotelId) {
  if (!user) fail('FINANCIAL_UNAUTHORIZED', 'Authentification requise.', 401);
  const hotel = await Hotel.findById(hotelId).select('manager name brand email phone property');
  if (!hotel) fail('FINANCIAL_UNAUTHORIZED', 'Établissement inaccessible.', 404);
  if (!ALL_STAFF.includes(user.role) && id(hotel.manager) !== id(user)) fail('FINANCIAL_UNAUTHORIZED', 'Accès financier refusé.', 403);
  return hotel;
}
async function assertAccountingRole(user) {
  if (!user || !ACCOUNTING_ROLES.includes(user.role)) fail('FINANCIAL_UNAUTHORIZED', 'Permission comptable requise.', 403);
  return true;
}
const assertCanCreateFinancialDraft = assertCanManageHotelFinance;
const assertCanEditFinancialDraft = assertCanManageHotelFinance;
async function assertCanIssueFinancialDocument(user, hotelId) { await assertAccountingRole(user); return assertCanManageHotelFinance(user, hotelId); }
const assertCanViewFinancialDocument = assertCanManageHotelFinance;
async function assertCanManageFinancialPayment(user, hotelId) { await assertAccountingRole(user); return assertCanManageHotelFinance(user, hotelId); }
const assertCanAllocatePayment = assertCanManageFinancialPayment;
const assertCanReverseAllocation = assertCanManageFinancialPayment;
const assertCanViewFinancialLedger = assertCanManageFinancialPayment;
module.exports = { ACCOUNTING_ROLES, HOTEL_FINANCE_ROLES, assertAccountingRole, assertCanManageHotelFinance, assertCanCreateFinancialDraft, assertCanEditFinancialDraft, assertCanIssueFinancialDocument, assertCanViewFinancialDocument, assertCanManageFinancialPayment, assertCanAllocatePayment, assertCanReverseAllocation, assertCanViewFinancialLedger };
