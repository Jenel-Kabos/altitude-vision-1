const mongoose = require('mongoose'); const C = require('../constants/financialConstants'); const ObjectId = mongoose.Schema.Types.ObjectId;
const schema = new mongoose.Schema({ eventType: { type: String, required: true }, eventVersion: { type: Number, default: 1 }, domain: { type: String, enum: C.FINANCIAL_DOMAINS, required: true }, establishmentType: { type: String, enum: C.FINANCIAL_ESTABLISHMENT_TYPES, required: true }, establishmentId: { type: ObjectId, required: true }, entityType: { type: String, required: true }, entityId: { type: ObjectId, required: true }, relatedEntities: [{ entityType: String, entityId: ObjectId }], actorType: { type: String, enum: ['user', 'guest', 'provider', 'system'], required: true }, actorId: ObjectId, amountMinor: Number, currency: { type: String, enum: C.FINANCIAL_CURRENCIES }, idempotencyKey: String, businessOperationKey: { type: String, required: true }, previousState: mongoose.Schema.Types.Mixed, newState: mongoose.Schema.Types.Mixed, metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, occurredAt: { type: Date, default: Date.now } }, { timestamps: { createdAt: true, updatedAt: false } });
schema.path('amountMinor').validate((value) => value == null || Number.isSafeInteger(value), 'amountMinor doit être un entier sûr.');
schema.index({ establishmentId: 1, occurredAt: -1 }); schema.index({ entityType: 1, entityId: 1, occurredAt: -1 }); schema.index({ businessOperationKey: 1, eventType: 1 }, { unique: true });
schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete'], function blockLedgerMutation() {
  throw new Error('FINANCIAL_LEDGER_APPEND_ONLY');
});
schema.pre('bulkWrite', function blockLedgerBulkMutation() { throw new Error('FINANCIAL_LEDGER_APPEND_ONLY'); });
schema.pre('save', function blockPersistedLedgerMutation() {
  if (!this.isNew) throw new Error('FINANCIAL_LEDGER_APPEND_ONLY');
});
module.exports = mongoose.model('FinancialLedgerEntry', schema);
