#!/usr/bin/env node
// server/scripts/auditHotelStaffAssignments.js — F2.6.3 (volet B)
//
// Diagnostic non destructif — lecture seule, aucune écriture. Toute la logique vit dans
// server/services/hotel/hotelStaffAssignmentAudit.js (testable indépendamment du CLI).
//
// Usage : node server/scripts/auditHotelStaffAssignments.js

require('dotenv').config();
const mongoose = require('mongoose');
const { runHotelStaffAssignmentAudit } = require('../services/hotel/hotelStaffAssignmentAudit');

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    const report = await runHotelStaffAssignmentAudit();
    console.log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => { console.error('[auditHotelStaffAssignments] Échec :', error.message); process.exit(1); });
}

module.exports = { main };
