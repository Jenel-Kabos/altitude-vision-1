class FinancialError extends Error {
  constructor(code, message, statusCode = 422) {
    super(message);
    this.name = 'FinancialError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const fail = (code, message, statusCode) => { throw new FinancialError(code, message, statusCode); };

function translateMongoDuplicate(error, fallbackCode = 'FINANCIAL_IDEMPOTENCY_CONFLICT') {
  if (error?.code !== 11000) return error;
  const index = `${error.message || ''} ${Object.keys(error.keyPattern || {}).join(' ')}`;
  let code = fallbackCode;
  if (/providerEventId/i.test(index)) code = 'FINANCIAL_IDEMPOTENCY_CONFLICT';
  else if (/businessOperationKey/i.test(index) && /allocation/i.test(fallbackCode)) code = 'FINANCIAL_DUPLICATE_ALLOCATION';
  else if (/documentNumber|businessOperationKey/i.test(index)) code = 'FINANCIAL_DUPLICATE_DOCUMENT';
  else if (/currentValue|documentType.*year/i.test(index)) code = 'FINANCIAL_SEQUENCE_CONFLICT';
  return new FinancialError(code, 'Conflit d’unicité sur une opération financière.', 409);
}

module.exports = { FinancialError, fail, translateMongoDuplicate };
