// F-U1.H — Trace unique de l'initialisation des premiers gouverneurs
// d'habilitations d'un périmètre. Un seul bootstrap par périmètre (index
// unique) : toute réinitialisation exige une nouvelle décision et une
// intervention technique explicite, jamais une simple ré-exécution.

const mongoose = require('mongoose');
const C = require('../constants/contractualFinanceConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  scopeType: { type: String, enum: Object.values(C.GRANT_SCOPE_TYPES), required: true },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null },
  authorizedBy: { type: ObjectId, ref: 'User', required: true },
  decisionReference: { type: String, required: true, trim: true, maxlength: 300 },
  governors: [{ type: ObjectId, ref: 'User', required: true }],
  grants: [{ type: ObjectId, ref: 'ContractualFinanceGrant' }],
  executedAt: { type: Date, required: true },
}, { timestamps: true });

schema.index({ scopeType: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('ContractualGrantBootstrap', schema);
