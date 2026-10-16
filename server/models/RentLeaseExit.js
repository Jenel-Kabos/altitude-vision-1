// F-U2.12 — Sortie de bail : dates distinctes et fondement du prorata de
// sortie. Le départ physique ne réduit jamais à lui seul la dette locative :
// seule la date de FIN D'OBLIGATION, fondée sur une clause du bail, un accord
// de sortie validé ou une disposition légale, permet un prorata. Sans
// fondement (`NONE`), le dernier mois reste dû en entier. Une décision par
// bail ; jamais modifiée silencieusement (historique, ajustements à décider).

const mongoose = require('mongoose');

const ObjectId = mongoose.Schema.Types.ObjectId;
const PRORATA_BASES = ['LEASE_CLAUSE', 'EXIT_AGREEMENT', 'LEGAL_PROVISION', 'NONE'];

const schema = new mongoose.Schema({
  lease: { type: ObjectId, ref: 'Contrat', required: true },
  property: { type: ObjectId, ref: 'Property', required: true },
  owner: { type: ObjectId, ref: 'User', default: null },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null, index: true },
  physicalDepartureDate: { type: Date, default: null },
  keysReturnedDate: { type: Date, default: null },
  contractualEndDate: { type: Date, default: null },
  agreementEffectiveDate: { type: Date, default: null },
  obligationEndDate: { type: Date, required: true },
  prorataBasis: { type: String, enum: PRORATA_BASES, required: true },
  basisReference: { type: String, trim: true, maxlength: 500, default: null },
  status: { type: String, enum: ['validated'], default: 'validated' },
  recordedBy: { type: ObjectId, ref: 'User', required: true },
  authorityPlane: { type: String, required: true },
  // Factures déjà émises dont le montant diffère du calcul de sortie :
  // ajustement (avoir) à décider — jamais de modification ni de remboursement automatique.
  adjustments: [{
    _id: false, document: { type: ObjectId, ref: 'FinancialDocument' }, period: String,
    billedRentMinor: Number, recomputedRentMinor: Number, deltaMinor: Number, status: { type: String, default: 'PENDING_DECISION' },
  }],
  history: [{ _id: false, action: String, actor: { type: ObjectId, ref: 'User' }, at: { type: Date, default: Date.now }, reason: String }],
}, { timestamps: true });

schema.index({ lease: 1 }, { unique: true });

module.exports = mongoose.model('RentLeaseExit', schema);
module.exports.PRORATA_BASES = PRORATA_BASES;
