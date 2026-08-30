const ScheduledJobLease = require('../../models/ScheduledJobLease');

const safeError = (error) => String(error?.code || error?.message || error || '').slice(0, 1000);

async function acquireScheduledJobLease({ jobName, ownerToken, runId = null, now = new Date(), leaseDurationMs }) {
  const leaseUntil = new Date(now.getTime() + leaseDurationMs);
  try {
    return await ScheduledJobLease.findOneAndUpdate(
      { jobName, $or: [{ leaseUntil: { $lte: now } }, { ownerToken }] },
      {
        $set: { ownerToken, leaseUntil, heartbeatAt: now, lastStartedAt: now, lastStatus: 'running', lastError: '', lastRunId: runId },
        $setOnInsert: { jobName },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).select('+ownerToken');
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
}

async function renewScheduledJobLease({ jobName, ownerToken, now = new Date(), leaseDurationMs }) {
  return ScheduledJobLease.findOneAndUpdate(
    { jobName, ownerToken, leaseUntil: { $gt: now } },
    { $set: { heartbeatAt: now, leaseUntil: new Date(now.getTime() + leaseDurationMs) } },
    { new: true },
  ).select('+ownerToken');
}

async function releaseScheduledJobLease({ jobName, ownerToken, now = new Date(), status, error = null, durationMs = null }) {
  return ScheduledJobLease.findOneAndUpdate(
    { jobName, ownerToken },
    {
      $set: {
        ownerToken: null,
        leaseUntil: now,
        heartbeatAt: now,
        lastCompletedAt: now,
        lastStatus: status,
        lastError: safeError(error),
        lastDurationMs: Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : null,
      },
    },
    { new: true },
  ).select('+ownerToken');
}

module.exports = { acquireScheduledJobLease, renewScheduledJobLease, releaseScheduledJobLease, safeError };

