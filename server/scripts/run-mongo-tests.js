const { spawn } = require('child_process');
const path = require('path');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const startedAt = Date.now();
let replSet;
let jestProcess;
let stopping = false;

async function stop() {
  if (stopping) return;
  stopping = true;
  if (jestProcess && jestProcess.exitCode === null) jestProcess.kill('SIGTERM');
  if (replSet) await replSet.stop();
}

async function main() {
  console.log(`[mongo-global] start=${new Date(startedAt).toISOString()}`);
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const uri = replSet.getUri(`altitude_mongo_global_${process.pid}`);
  console.log('[mongo-global] replica-set=ready count=1');

  const jestBin = path.resolve(__dirname, '../node_modules/jest/bin/jest.js');
  const args = [
    jestBin,
    '--runInBand',
    '--detectOpenHandles',
    '--verbose',
    "--testPathPatterns=\\.(mongo|replica)\\.integration\\.test\\.js$",
  ];
  jestProcess = spawn(process.execPath, args, {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, MONGODB_FINANCIAL_INTEGRATION_URI: uri },
    stdio: 'inherit',
  });
  const exitCode = await new Promise((resolve, reject) => {
    jestProcess.once('error', reject);
    jestProcess.once('exit', (code, signal) => {
      if (signal) console.error(`[mongo-global] jest-signal=${signal}`);
      resolve(code ?? 1);
    });
  });
  const durationMs = Date.now() - startedAt;
  console.log(`[mongo-global] jest-exit=${exitCode} durationMs=${durationMs}`);
  await stop();
  console.log('[mongo-global] replica-set=stopped');
  process.exitCode = exitCode;
}

process.once('SIGINT', async () => { await stop(); process.exit(130); });
process.once('SIGTERM', async () => { await stop(); process.exit(143); });

main().catch(async (error) => {
  console.error('[mongo-global] fatal', error);
  await stop();
  process.exitCode = 1;
});
