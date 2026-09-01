#!/usr/bin/env node
const mongoose = require('mongoose');
const { resyncValidatedHotelPublication } = require('../services/validatedHotelPublicationResyncService');

const URI_ENV = 'HOTEL_PUBLICATION_RESYNC_MONGODB_URI';
const APPLY_ENV = 'HOTEL_PUBLICATION_RESYNC_ALLOW_APPLY';
const SUCCESS_RESULTS = new Set(['ELIGIBLE', 'UPDATED', 'ALREADY_SYNCED']);

function parseArgs(argv) {
  const allowed = new Set(['--dry-run', '--apply']);
  const values = {};
  for (const arg of argv) {
    if (allowed.has(arg)) values[arg.slice(2)] = true;
    else if (arg.startsWith('--hotel-id=')) values.hotelId = arg.slice('--hotel-id='.length);
    else if (arg.startsWith('--confirm-hotel-id=')) values.confirmHotelId = arg.slice('--confirm-hotel-id='.length);
    else if (arg.startsWith('--confirm-database=')) values.confirmDatabase = arg.slice('--confirm-database='.length);
    else throw new Error(`INVALID_ARGUMENT: ${arg}`);
  }
  if (values.apply && values['dry-run']) throw new Error('MODE_CONFLICT');
  if (!values.hotelId || !mongoose.isValidObjectId(values.hotelId)) throw new Error('VALID_HOTEL_ID_REQUIRED');
  values.apply = values.apply === true;
  return values;
}

function validateExecution(args, env) {
  const uri = env[URI_ENV];
  if (!uri) throw new Error(`${URI_ENV}_REQUIRED`);
  if (args.apply) {
    if (env[APPLY_ENV] !== 'YES') throw new Error(`${APPLY_ENV}_REQUIRED`);
    if (args.confirmHotelId !== args.hotelId) throw new Error('HOTEL_ID_CONFIRMATION_MISMATCH');
    if (!args.confirmDatabase) throw new Error('DATABASE_CONFIRMATION_REQUIRED');
  }
  return uri;
}

async function run(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const uri = validateExecution(args, env);

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000, autoIndex: false, autoCreate: false });
  try {
    const database = mongoose.connection.name;
    if (args.apply && args.confirmDatabase !== database) throw new Error('DATABASE_CONFIRMATION_MISMATCH');
    const result = await resyncValidatedHotelPublication({ hotelId: args.hotelId, apply: args.apply });
    return { mode: args.apply ? 'apply' : 'dry-run', database, ...result };
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) run().then((result) => {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!SUCCESS_RESULTS.has(result.result)) process.exitCode = 2;
}).catch(async (error) => {
  try { await mongoose.disconnect(); } catch { /* noop */ }
  process.stderr.write(`${JSON.stringify({ result: 'ERROR', error: error.message })}\n`);
  process.exitCode = 1;
});

module.exports = { URI_ENV, APPLY_ENV, SUCCESS_RESULTS, parseArgs, validateExecution, run };
