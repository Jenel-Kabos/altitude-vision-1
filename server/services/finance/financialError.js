class FinancialError extends Error {
  constructor(code, message, statusCode = 422) {
    super(message);
    this.name = 'FinancialError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const fail = (code, message, statusCode) => { throw new FinancialError(code, message, statusCode); };

module.exports = { FinancialError, fail };
