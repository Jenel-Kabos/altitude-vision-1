#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { scanFinancialConsistency, planFinancialReconciliation, applyFinancialReconciliation, verifyFinancialReconciliation } = require('../services/finance/financialReconciliationService');

const args = new Set(process.argv.slice(2));
const valueOf = (name) => process.argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);

async function main() {
  const apply = args.has('--apply');
  if (apply && process.env.NODE_ENV === 'production' && process.env.FINANCIAL_RECONCILIATION_ALLOW_PRODUCTION !== 'true') throw new Error('FINANCIAL_RECONCILIATION_PRODUCTION_GUARD');
  await connectDB();
  const scope = {
    domain: valueOf('--domain'),
    establishmentId: valueOf('--establishmentId') || valueOf('--establishment'),
    document: valueOf('--document'),
    payment: valueOf('--payment'),
    limit: valueOf('--limit'),
  };
  const report = await scanFinancialConsistency(scope);
  const plan = planFinancialReconciliation(report);
  const output = { mode: apply ? 'apply' : 'dry-run', report, plan };
  if (apply) {
    output.result = await applyFinancialReconciliation({ report, transactionMode: args.has('--transactional') ? 'transactional' : 'fallback' });
    output.verification = await verifyFinancialReconciliation(scope);
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!apply && report.issues.length) process.exitCode = 2;
}

main().catch((error) => { process.stderr.write(`${error.code || error.message}\n`); process.exitCode = 1; }).finally(() => mongoose.disconnect());
