#!/usr/bin/env node
// GL-ARCH-1.1 — voir server/services/rentalManagementReconciliationService.js
// pour le détail de la logique. Dry-run par défaut (aucune écriture) ;
// `--apply` exécute réellement les corrections. `--actor=<userId>` doit être
// l'ObjectId du membre du staff (Admin/GestionnaireImmobilier) qui lance la
// réconciliation (traçabilité dans RentalManagement.workflowHistory).
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const {
  scanRentalManagementConsistency,
  planRentalManagementReconciliation,
  applyRentalManagementReconciliation,
} = require('../services/rentalManagementReconciliationService');

const args = new Set(process.argv.slice(2));
const valueOf = (name) => process.argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);

async function main() {
  const apply = args.has('--apply');
  const actor = valueOf('--actor');
  if (apply && !actor) throw new Error('RECONCILIATION_ACTOR_REQUIRED — passez --actor=<userId Admin/GestionnaireImmobilier>');
  if (apply && process.env.NODE_ENV === 'production' && process.env.RENTAL_RECONCILIATION_ALLOW_PRODUCTION !== 'true') {
    throw new Error('RENTAL_RECONCILIATION_PRODUCTION_GUARD — cette mission interdit toute exécution en production sans confirmation explicite.');
  }
  await connectDB();
  const report = await scanRentalManagementConsistency();
  const plan = planRentalManagementReconciliation(report);
  const output = { mode: apply ? 'apply' : 'dry-run', report, plan };
  if (apply) {
    output.result = await applyRentalManagementReconciliation({ plan, actor });
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!apply && plan.actionCount > 0) process.exitCode = 2;
}

main()
  .catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
