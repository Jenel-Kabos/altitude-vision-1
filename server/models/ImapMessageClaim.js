const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  identity: { type: String, required: true, unique: true, maxlength: 500 },
  account: { type: String, required: true, maxlength: 320 },
  mailbox: { type: String, required: true, maxlength: 120 },
  uidValidity: { type: String, required: true },
  uid: { type: Number, required: true },
  ownerToken: { type: String, default: null, select: false },
  status: { type: String, enum: ['processing', 'imported', 'failed'], required: true },
  claimUntil: { type: Date, required: true, index: true },
  claimedAt: { type: Date, required: true },
  completedAt: { type: Date, default: null },
  lastError: { type: String, default: '', maxlength: 500 },
}, { timestamps: true });

module.exports = mongoose.model('ImapMessageClaim', schema);

