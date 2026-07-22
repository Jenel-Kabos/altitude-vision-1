const mongoose = require('mongoose');
const logger = require('../../utils/logger');
const { fail, translateMongoDuplicate } = require('./financialError');

const TRANSACTION_UNAVAILABLE_CODES = new Set([20, 251, 263]);

function isTransactionUnavailable(error) {
  return TRANSACTION_UNAVAILABLE_CODES.has(error?.code)
    || /Transaction numbers are only allowed|replica set|does not support transactions/i.test(error?.message || '');
}

async function runFinancialOperation({ operationName, transactionMode = 'fallback' }, operation) {
  if (transactionMode === 'fallback') {
    logger.info('financial.operation.fallback', { operationName, transactionMode });
    return operation({ session: null, transactional: false });
  }
  if (!['transactional', 'auto'].includes(transactionMode)) {
    fail('FINANCIAL_TRANSACTION_MODE_INVALID', 'Stratégie transactionnelle financière invalide.');
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await operation({ session, transactional: true });
    });
    logger.info('financial.operation.committed', { operationName, transactionMode: 'transactional' });
    return result;
  } catch (error) {
    if (transactionMode === 'auto' && isTransactionUnavailable(error)) {
      logger.warn('financial.operation.transaction_unavailable', { operationName, errorCode: error.code });
      return operation({ session: null, transactional: false });
    }
    logger.error('financial.operation.rolled_back', { operationName, errorCode: error.code, error: error.message });
    const duplicateCode = operationName.includes('allocate') ? 'FINANCIAL_DUPLICATE_ALLOCATION' : operationName.includes('issue') ? 'FINANCIAL_DUPLICATE_DOCUMENT' : 'FINANCIAL_IDEMPOTENCY_CONFLICT';
    throw translateMongoDuplicate(error, duplicateCode);
  } finally {
    await session.endSession();
  }
}

module.exports = { runFinancialOperation, isTransactionUnavailable };
