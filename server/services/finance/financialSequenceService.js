const FinancialSequence = require('../../models/FinancialSequence');
const { fail, translateMongoDuplicate } = require('./financialError');

const DEFAULT_PREFIXES = { invoice: 'FAC', credit_note: 'AVO', proforma: 'PRO', receipt: 'REC' };
const sanitizeCode = (value) => String(value || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(-8);

async function getNextFinancialDocumentNumber({ domain, establishmentType, establishmentId, documentType, year = new Date().getUTCFullYear(), prefix, establishmentCode, session }) {
  const effectivePrefix = sanitizeCode(prefix || DEFAULT_PREFIXES[documentType]);
  const code = sanitizeCode(establishmentCode || establishmentId);
  if (!effectivePrefix || !code) fail('FINANCIAL_SEQUENCE_ERROR', 'Configuration de séquence invalide.');
  let sequence;
  try {
    sequence = await FinancialSequence.findOneAndUpdate(
      { domain, establishmentType, establishmentId, documentType, year },
      { $inc: { currentValue: 1 }, $setOnInsert: { prefix: effectivePrefix } },
      { new: true, upsert: true, setDefaultsOnInsert: true, session },
    );
  } catch (error) { throw translateMongoDuplicate(error, 'FINANCIAL_SEQUENCE_CONFLICT'); }
  const sequenceValue = sequence.currentValue;
  return { sequenceValue, formattedNumber: `${sequence.prefix}-${code}-${year}-${String(sequenceValue).padStart(6, '0')}` };
}
module.exports = { getNextFinancialDocumentNumber };
