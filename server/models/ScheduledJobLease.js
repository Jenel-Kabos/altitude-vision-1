const mongoose = require('mongoose');

const scheduledJobLeaseSchema = new mongoose.Schema({
  jobName: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
  ownerToken: { type: String, default: null, select: false, maxlength: 200 },
  leaseUntil: { type: Date, required: true, default: () => new Date(0), index: true },
  heartbeatAt: { type: Date, default: null },
  lastStartedAt: { type: Date, default: null },
  lastCompletedAt: { type: Date, default: null },
  lastStatus: { type: String, enum: ['idle', 'running', 'success', 'failed'], default: 'idle' },
  lastError: { type: String, default: '', maxlength: 1000 },
  lastDurationMs: { type: Number, default: null, min: 0 },
  lastRunId: { type: String, default: null, maxlength: 100 },
}, { timestamps: true });

module.exports = mongoose.model('ScheduledJobLease', scheduledJobLeaseSchema);

