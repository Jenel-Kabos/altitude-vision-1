const FINANCIAL_DOMAINS = ['hotel', 'real_estate', 'rental', 'visit', 'altcom', 'mila_events'];
const FINANCIAL_DOCUMENT_TYPES = ['invoice', 'credit_note', 'proforma', 'receipt'];
const FINANCIAL_DOCUMENT_STATUSES = ['draft', 'issued', 'cancelled', 'credited', 'void'];
const FINANCIAL_PAYMENT_STATUSES = ['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'partially_refunded', 'refunded'];
const FINANCIAL_PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'mobile_money', 'cheque', 'credit', 'other'];
const FINANCIAL_PAYMENT_STATUSES_DERIVED = ['unpaid', 'partially_paid', 'paid', 'overpaid'];
const FINANCIAL_ALLOCATION_STATUSES = ['active', 'reversed'];
const FINANCIAL_CURRENCIES = ['XAF', 'EUR', 'USD'];
const FINANCIAL_ESTABLISHMENT_TYPES = ['Hotel'];
const FINANCIAL_SUBJECT_TYPES = ['HotelReservation'];
const FINANCIAL_LINE_TYPES = ['accommodation', 'discount', 'tax', 'fee', 'extra', 'adjustment'];

module.exports = {
  FINANCIAL_DOMAINS, FINANCIAL_DOCUMENT_TYPES, FINANCIAL_DOCUMENT_STATUSES,
  FINANCIAL_PAYMENT_STATUSES, FINANCIAL_PAYMENT_METHODS, FINANCIAL_PAYMENT_STATUSES_DERIVED,
  FINANCIAL_ALLOCATION_STATUSES, FINANCIAL_CURRENCIES, FINANCIAL_ESTABLISHMENT_TYPES,
  FINANCIAL_SUBJECT_TYPES, FINANCIAL_LINE_TYPES,
};
