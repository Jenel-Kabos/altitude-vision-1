const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { safeTestEnv } = require('../test-utils/safeTestEnv');

// BACKEND-CERT-OPTION3-RUNNER-01 — un seul processus Jest --runInBand pour
// ~200 suites accumulait la mémoire jusqu'à la limite du heap Node (~4.1 GB)
// puis s'effondrait en GC (débit ÷3, CPU ~95 %, hang observé à 4 h 34).
// Les suites sont désormais réparties en shards Jest natifs (`--shard=i/N`),
// exécutés SÉQUENTIELLEMENT : chaque shard est un nouveau processus Jest
// (mémoire rendue à l'OS en sortie) avec son propre replica set neuf (aucune
// base partagée entre shards). Flags inchangés par shard. Le runner échoue si
// un shard échoue, si un rapport manque, ou si l'agrégat ne contient aucune
// suite.
const DEFAULT_SHARDS = 8;
const shardCount = Number(process.env.MONGO_TEST_SHARDS || DEFAULT_SHARDS);

const startedAt = Date.now();
const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'altitude-mongo-shards-'));
let replSet;
let jestProcess;
let stopping = false;

async function stopShardInfra() {
  if (jestProcess && jestProcess.exitCode === null) jestProcess.kill('SIGTERM');
  if (replSet) await replSet.stop();
  replSet = null;
}

async function stop() {
  if (stopping) return;
  stopping = true;
  await stopShardInfra();
}

async function runShard(index) {
  const label = `${index}/${shardCount}`;
  const shardStartedAt = Date.now();
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const uri = replSet.getUri(`altitude_mongo_global_${process.pid}_${index}`);
  console.log(`[mongo-global] shard=${label} replica-set=ready count=1`);

  const reportFile = path.join(reportDir, `shard-${index}.json`);
  const jestBin = path.resolve(__dirname, '../node_modules/jest/bin/jest.js');
  const args = [
    jestBin,
    '--runInBand',
    '--detectOpenHandles',
    '--verbose',
    '--logHeapUsage',
    `--shard=${label}`,
    '--json',
    `--outputFile=${reportFile}`,
    "--testPathPatterns=\\.(mongo|replica)\\.integration\\.test\\.js$",
  ];
  jestProcess = spawn(process.execPath, args, {
    cwd: path.resolve(__dirname, '..'),
    env: safeTestEnv(process.env, { MONGODB_FINANCIAL_INTEGRATION_URI: uri }),
    stdio: 'inherit',
  });
  const exitCode = await new Promise((resolve, reject) => {
    jestProcess.once('error', reject);
    jestProcess.once('exit', (code, signal) => {
      if (signal) console.error(`[mongo-global] shard=${label} jest-signal=${signal}`);
      resolve(code ?? 1);
    });
  });
  await stopShardInfra();
  const durationMs = Date.now() - shardStartedAt;
  console.log(`[mongo-global] shard=${label} jest-exit=${exitCode} durationMs=${durationMs} replica-set=stopped`);

  let report = null;
  try {
    report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  } catch (error) {
    console.error(`[mongo-global] shard=${label} report-missing ${error.message}`);
  }
  return { label, exitCode, durationMs, report };
}

function aggregate(results) {
  const totals = { suites: 0, failedSuites: 0, runtimeErrorSuites: 0, tests: 0, passed: 0, failed: 0, pending: 0, todo: 0 };
  for (const { report } of results) {
    if (!report) continue;
    totals.suites += report.numTotalTestSuites;
    totals.failedSuites += report.numFailedTestSuites;
    totals.runtimeErrorSuites += report.numRuntimeErrorTestSuites;
    totals.tests += report.numTotalTests;
    totals.passed += report.numPassedTests;
    totals.failed += report.numFailedTests;
    totals.pending += report.numPendingTests;
    totals.todo += report.numTodoTests;
  }
  return totals;
}

async function main() {
  if (!Number.isInteger(shardCount) || shardCount < 1) {
    throw new Error(`MONGO_TEST_SHARDS invalide : "${process.env.MONGO_TEST_SHARDS}"`);
  }
  console.log(`[mongo-global] start=${new Date(startedAt).toISOString()} shards=${shardCount}`);

  const results = [];
  for (let index = 1; index <= shardCount && !stopping; index += 1) {
    results.push(await runShard(index));
  }

  const totals = aggregate(results);
  const failedShards = results.filter((r) => r.exitCode !== 0 || !r.report).map((r) => r.label);
  for (const r of results) {
    const rep = r.report;
    console.log(`[mongo-global] shard=${r.label} exit=${r.exitCode} durationMs=${r.durationMs}`
      + (rep ? ` suites=${rep.numTotalTestSuites} tests=${rep.numTotalTests} failed=${rep.numFailedTests}` : ' report=missing'));
  }
  console.log(`[mongo-global] total suites=${totals.suites} failedSuites=${totals.failedSuites} runtimeErrorSuites=${totals.runtimeErrorSuites}`
    + ` tests=${totals.tests} passed=${totals.passed} failed=${totals.failed} pending=${totals.pending} todo=${totals.todo}`);

  const ok = results.length === shardCount && failedShards.length === 0 && totals.suites > 0
    && totals.failedSuites === 0 && totals.runtimeErrorSuites === 0 && totals.failed === 0;
  if (failedShards.length) console.error(`[mongo-global] failed-shards=${failedShards.join(',')}`);
  console.log(`[mongo-global] exit=${ok ? 0 : 1} durationMs=${Date.now() - startedAt}`);
  process.exitCode = ok ? 0 : 1;
}

process.once('SIGINT', async () => { await stop(); process.exit(130); });
process.once('SIGTERM', async () => { await stop(); process.exit(143); });

main().catch(async (error) => {
  console.error('[mongo-global] fatal', error);
  await stop();
  process.exitCode = 1;
});
