const crypto = require('crypto');
const cron = require('node-cron');
const logger = require('../../utils/logger');
const { JOB_REGISTRY, getJob } = require('./jobRegistry');
const { acquireScheduledJobLease, renewScheduledJobLease, releaseScheduledJobLease } = require('./scheduledJobLeaseService');

const summarize = (result = {}) => ({
  processed: Number(result.processed ?? result.imported ?? result.checked ?? result.expired ?? result.sent ?? 0) || 0,
  skipped: Number(result.skipped ?? result.ignored ?? 0) || 0,
  failed: Number(result.failed ?? result.errors ?? 0) || 0,
});

async function runScheduledJob(job, { trigger = 'cron', ownerToken = crypto.randomUUID(), runId = crypto.randomUUID(), now = new Date() } = {}) {
  const startedAt = Date.now();
  const lease = await acquireScheduledJobLease({ jobName: job.name, ownerToken, runId, now, leaseDurationMs: job.leaseDurationMs });
  if (!lease) {
    logger.info('scheduled_job.skipped_not_owner', { jobName: job.name, runId, ownerToken, trigger, leaseAcquired: false });
    return { status: 'SKIPPED_NOT_OWNER', leaseAcquired: false, jobName: job.name, runId };
  }
  logger.info('scheduled_job.started', { jobName: job.name, runId, ownerToken, trigger, startedAt: new Date(startedAt), leaseAcquired: true });
  const heartbeat = setInterval(() => {
    renewScheduledJobLease({ jobName: job.name, ownerToken, leaseDurationMs: job.leaseDurationMs }).catch((error) =>
      logger.error('scheduled_job.heartbeat_failed', { jobName: job.name, runId, error: error.message }));
  }, job.heartbeatMs);
  heartbeat.unref?.();
  let status = 'success'; let failure = null; let result;
  try {
    result = await job.handler({ runId, ownerToken, trigger });
    return { status: 'SUCCESS', leaseAcquired: true, jobName: job.name, runId, result };
  } catch (error) {
    status = 'failed'; failure = error;
    logger.error('scheduled_job.failed', { jobName: job.name, runId, ownerToken, trigger, error: error.message });
    return { status: 'FAILED', leaseAcquired: true, jobName: job.name, runId, error };
  } finally {
    clearInterval(heartbeat);
    const completedAt = new Date(); const durationMs = Date.now() - startedAt;
    await releaseScheduledJobLease({ jobName: job.name, ownerToken, now: completedAt, status, error: failure, durationMs });
    logger.info('scheduled_job.completed', { jobName: job.name, runId, ownerToken, trigger, completedAt, durationMs, status, ...summarize(result) });
  }
}

const runJobByName = (name, options) => {
  const job = getJob(name);
  if (!job) throw new Error(`SCHEDULED_JOB_UNKNOWN:${name}`);
  return runScheduledJob(job, options);
};

function registerScheduledJobs({ disabled = process.env.DISABLE_SCHEDULED_JOBS === '1', cronImpl = cron } = {}) {
  if (disabled) { logger.info('scheduled_jobs.disabled'); return []; }
  return JOB_REGISTRY.map((job) => cronImpl.schedule(job.schedule, () => runScheduledJob(job), job.timezone ? { timezone: job.timezone } : undefined));
}

function registerStartupJobs({ disabled = process.env.DISABLE_SCHEDULED_JOBS === '1', connection } = {}) {
  if (disabled) return;
  connection.once('open', async () => {
    await runJobByName('facebook-sync', { trigger: 'startup' });
    const imap = getJob('zoho-imap-poll');
    setTimeout(() => runScheduledJob(imap, { trigger: 'startup' }), imap.bootDelayMs);
  });
}

module.exports = { summarize, runScheduledJob, runJobByName, registerScheduledJobs, registerStartupJobs };
