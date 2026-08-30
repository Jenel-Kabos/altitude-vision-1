const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const ImapSyncCheckpoint = require('../models/ImapSyncCheckpoint');
const ImapMessageClaim = require('../models/ImapMessageClaim');
const { checkpointAdvanceUpdate, claimMessage, buildStableMessageIdentity } = require('../services/zohoImapService');

jest.setTimeout(120000);

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([ImapSyncCheckpoint.syncIndexes(), ImapMessageClaim.syncIndexes()]);
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('deux checkpoints concurrents ne peuvent jamais faire régresser le dernier UID', async () => {
  const filter = { account: 'inbox@example.test', mailbox: 'INBOX' };
  await ImapSyncCheckpoint.create({ ...filter, uidValidity: '100', lastProcessedUid: 10 });
  await Promise.all([
    ImapSyncCheckpoint.findOneAndUpdate(filter, checkpointAdvanceUpdate({ uidValidity: '100', lastProcessedUid: 30 })),
    ImapSyncCheckpoint.findOneAndUpdate(filter, checkpointAdvanceUpdate({ uidValidity: '100', lastProcessedUid: 20 })),
  ]);
  expect((await ImapSyncCheckpoint.findOne(filter)).lastProcessedUid).toBe(30);
});

test('dix workers ne revendiquent qu’une fois un UID sans Message-ID', async () => {
  const input = { account: 'inbox@example.test', mailbox: 'INBOX', uidValidity: '100', uid: 42 };
  const identity = buildStableMessageIdentity(input);
  const results = await Promise.all(Array.from({ length: 10 }, (_, index) => claimMessage({
    identity, ...input, ownerToken: `worker-${index}`, now: new Date('2030-01-01T00:00:00Z'),
  })));
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(await ImapMessageClaim.countDocuments({ identity })).toBe(1);
});
