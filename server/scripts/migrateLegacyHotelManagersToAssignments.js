#!/usr/bin/env node
// server/scripts/migrateLegacyHotelManagersToAssignments.js — F2.6.3 (volet B)
//
// Migration contrôlée et sûre par défaut : `--dry-run` (implicite) n'écrit jamais rien ;
// `--apply` doit être explicitement demandé. Toute la logique vit dans
// server/services/hotel/hotelStaffAssignmentMigration.js (testable sans lancer ce process).
//
// Usage :
//   node server/scripts/migrateLegacyHotelManagersToAssignments.js
//   node server/scripts/migrateLegacyHotelManagersToAssignments.js --dry-run
//   node server/scripts/migrateLegacyHotelManagersToAssignments.js --apply

require('dotenv').config();
const mongoose = require('mongoose');
const { runLegacyHotelManagerMigration } = require('../services/hotel/hotelStaffAssignmentMigration');

function parseArgs(argv) {
  const known = new Set(['--dry-run', '--apply']);
  const unknown = argv.filter((arg) => !known.has(arg));
  if (unknown.length) throw new Error(`Option(s) inconnue(s) : ${unknown.join(', ')}. Attendu : --dry-run | --apply.`);
  const apply = argv.includes('--apply');
  return { apply };
}

async function main(argv = process.argv.slice(2)) {
  const { apply } = parseArgs(argv);
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    const summary = await runLegacyHotelManagerMigration({ apply });
    console.log(JSON.stringify(summary, null, 2));
    console.log(apply
      ? `\n✅ Migration appliquée : ${summary.created.length} rattachement(s) créé(s).`
      : `\nℹ️  Dry-run (aucune écriture) : ${summary.created.length} rattachement(s) seraient créés. Relancer avec --apply pour appliquer.`);
    if (summary.conflicts.length) console.log(`⚠️  ${summary.conflicts.length} conflit(s) à revoir manuellement.`);
    if (summary.anomalies.length) console.log(`⚠️  ${summary.anomalies.length} anomalie(s) (manager introuvable).`);
    return summary;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => { console.error('[migrateLegacyHotelManagersToAssignments] Échec :', error.message); process.exit(1); });
}

module.exports = { main, parseArgs };
