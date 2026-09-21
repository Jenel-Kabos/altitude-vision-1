const mongoose = require('mongoose');

// `pending` remains accepted for historical documents. New booking requests
// use the explicit payment state and are never confirmed by a user action.
const STATUSES = ['draft', 'pending', 'pending_payment', 'confirmed', 'expired', 'cancelled', 'checked_in', 'checked_out', 'no_show'];
const PAYMENT_STATUSES = ['unpaid', 'partially_paid', 'paid', 'partially_refunded', 'refunded'];

const schema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', default: null, index: true },
  accommodation: { type: mongoose.Schema.Types.ObjectId, ref: 'Accommodation', required: true, index: true },
  guest: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  checkInDate: { type: Date, required: true }, checkOutDate: { type: Date, required: true },
  nights: { type: Number, required: true, min: 1 }, guestCount: { type: Number, required: true, min: 1 },
  adults: { type: Number, required: true, min: 1 }, children: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: STATUSES, default: 'pending', index: true },
  paymentExpiresAt: { type: Date, default: null, index: true },
  pricingSnapshot: {
    nightlyRate: Number, nights: Number, checkInDate: Date, checkOutDate: Date,
    cleaningFee: Number, serviceFee: Number, discount: Number, taxes: Number,
    total: Number, requiredToConfirm: Number,
    currency: { type: String, default: 'XAF' }, quotedAt: Date, confirmedAt: Date,
  },
  subtotal: { type: Number, min: 0, default: 0 }, fees: { type: Number, min: 0, default: 0 }, discount: { type: Number, min: 0, default: 0 },
  taxes: { type: Number, min: 0, default: 0 }, total: { type: Number, min: 0, default: 0 }, currency: { type: String, default: 'XAF' },
  paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'unpaid' }, amountPaid: { type: Number, min: 0, default: 0 },
  grossAmountPaid: { type: Number, min: 0, default: 0 }, refundedAmount: { type: Number, min: 0, default: 0 },
  remainingAmount: { type: Number, min: 0, default: 0 }, financialDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialDocument', default: null },
  source: { type: String, enum: ['public_web', 'mobile', 'owner_dashboard', 'admin_dashboard'], default: 'public_web' },
  specialRequests: { type: String, trim: true, maxlength: 2000, default: '' }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cancelledAt: Date, cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, cancellationReason: { type: String, trim: true, maxlength: 1000 },
  cancellationActor: { type: String, enum: ['client', 'owner', 'platform'], default: null },
  cancellationResponsibility: { type: String, enum: ['client', 'non_client', 'undetermined'], default: null },
  refundPolicyApplied: { type: String, enum: ['none', 'client_guarantee_retained', 'client_consumed_stay_retained', 'client_fault_validated_deductions', 'non_client_consumed_stay_retained', 'full_refund'], default: null },
  nonRefundableAmount: { type: Number, min: 0, default: 0 }, refundableAmount: { type: Number, min: 0, default: 0 },
  refundCalculationSnapshot: { futurePaidRefundable: { type: Number, min: 0 }, validatedDeductions: { type: Number, min: 0 }, appliedDeductions: { type: Number, min: 0 }, finalRefund: { type: Number, min: 0 } },
  expirationNotifiedAt: Date, confirmationNotifiedAt: Date, cancellationNotifiedAt: Date,
  checkedInAt: Date, checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, checkedOutAt: Date, checkedOutBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reminders: {
    arrival24h: { guestSentAt: Date, ownerSentAt: Date },
    arrivalToday: { guestSentAt: Date, ownerSentAt: Date },
    checkoutToday: { guestSentAt: Date, ownerSentAt: Date },
  },
  workflowHistory: [{ from: String, to: String, at: { type: Date, default: Date.now }, actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, reason: String }],
}, { timestamps: true });

schema.index({ accommodation: 1, checkInDate: 1, checkOutDate: 1 });
schema.index({ owner: 1, status: 1, createdAt: -1 });
schema.index({ guest: 1, createdAt: -1 });
schema.index({ status: 1, checkInDate: 1 });
schema.index({ status: 1, checkOutDate: 1 });
schema.pre('validate', function validateDates(next) {
  if (this.checkInDate && this.checkOutDate) {
    const nights = Math.round((this.checkOutDate - this.checkInDate) / 86400000);
    if (nights < 1) this.invalidate('checkOutDate', 'Le départ doit être postérieur à l’arrivée.');
    else this.nights = nights;
  }
  next();
});

schema.statics.STATUSES = STATUSES;
module.exports = mongoose.model('AccommodationReservation', schema);
