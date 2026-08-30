const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const ScheduledJobLease = require('../models/ScheduledJobLease');
const {
  acquireScheduledJobLease, renewScheduledJobLease, releaseScheduledJobLease,
} = require('../services/scheduledJobs/scheduledJobLeaseService');
const { runScheduledJob } = require('../services/scheduledJobs/schedulerService');

jest.setTimeout(120000);

beforeAll(async () => {
  await startFinancialMongo();
  await ScheduledJobLease.syncIndexes();
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('deux contenders sur le même tick produisent exactement un owner', async () => {
  const now = new Date('2030-01-01T00:00:00.000Z');
  const results = await Promise.all([
    acquireScheduledJobLease({ jobName: 'test-job', ownerToken: 'owner-a', now, leaseDurationMs: 60000 }),
    acquireScheduledJobLease({ jobName: 'test-job', ownerToken: 'owner-b', now, leaseDurationMs: 60000 }),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
});

test('dix contenders produisent exactement un owner', async () => {
  const now = new Date('2030-01-01T00:00:00.000Z');
  const results = await Promise.all(Array.from({ length: 10 }, (_, index) =>
    acquireScheduledJobLease({ jobName: 'ten-contenders', ownerToken: `owner-${index}`, now, leaseDurationMs: 60000 })));
  expect(results.filter(Boolean)).toHaveLength(1);
});

test('un lease non expiré bloque, puis un autre owner reprend après expiration', async () => {
  const start = new Date('2030-01-01T00:00:00.000Z');
  expect(await acquireScheduledJobLease({ jobName: 'expiry', ownerToken: 'owner-a', now: start, leaseDurationMs: 1000 })).toBeTruthy();
  expect(await acquireScheduledJobLease({ jobName: 'expiry', ownerToken: 'owner-b', now: new Date(start.getTime() + 999), leaseDurationMs: 1000 })).toBeNull();
  expect(await acquireScheduledJobLease({ jobName: 'expiry', ownerToken: 'owner-b', now: new Date(start.getTime() + 1001), leaseDurationMs: 1000 })).toBeTruthy();
});

test('renew et release vérifient toujours le bon owner', async () => {
  const now = new Date('2030-01-01T00:00:00.000Z');
  await acquireScheduledJobLease({ jobName: 'ownership', ownerToken: 'owner-a', now, leaseDurationMs: 1000 });
  expect(await renewScheduledJobLease({ jobName: 'ownership', ownerToken: 'owner-b', now, leaseDurationMs: 1000 })).toBeNull();
  expect(await releaseScheduledJobLease({ jobName: 'ownership', ownerToken: 'owner-b', now, status: 'success' })).toBeNull();
  expect(await renewScheduledJobLease({ jobName: 'ownership', ownerToken: 'owner-a', now, leaseDurationMs: 1000 })).toBeTruthy();
  expect(await releaseScheduledJobLease({ jobName: 'ownership', ownerToken: 'owner-a', now, status: 'success' })).toBeTruthy();
});

test('deux schedulers concurrents exécutent le handler exactement une fois', async () => {
  const handler = jest.fn(async () => new Promise((resolve) => setTimeout(() => resolve({ processed: 1 }), 50)));
  const job = { name: 'scheduler-contention', leaseDurationMs: 5000, heartbeatMs: 1000, handler };
  const results = await Promise.all([
    runScheduledJob(job, { ownerToken: 'scheduler-a', runId: 'run-a' }),
    runScheduledJob(job, { ownerToken: 'scheduler-b', runId: 'run-b' }),
  ]);
  expect(handler).toHaveBeenCalledTimes(1);
  expect(results.map((result) => result.status).sort()).toEqual(['SKIPPED_NOT_OWNER', 'SUCCESS']);
});
