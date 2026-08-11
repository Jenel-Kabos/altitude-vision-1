/* TENANT-ATTRIBUTION-1 — inventaire strictement read-only.
 * L'URI doit être fournie explicitement et l'utilisateur doit confirmer que
 * les identifiants MongoDB sont en lecture seule. Aucun mode d'application
 * ou de backfill n'existe dans ce script. */
const mongoose = require('mongoose');
const { resolveResourceTenant } = require('../services/platformTenant/tenantResourceAttributionService');

const args = process.argv.slice(2);
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
const uri = value('--uri');
const selected = value('--resource');
const limit = Math.max(0, Number(value('--limit') || 0));

const RESOURCES = {
  Document: require('../models/Document'),
  Conversation: require('../models/Conversation'),
  Message: require('../models/Message'),
  Hotel: require('../models/Hotel'),
  HotelReservation: require('../models/HotelReservation'),
  HotelStaffAssignment: require('../models/HotelStaffAssignment'),
  Room: require('../models/Room'),
  Accommodation: require('../models/Accommodation'),
  AccommodationReservation: require('../models/AccommodationReservation'),
  RentalManagement: require('../models/RentalManagement'),
  Contrat: require('../models/Contrat'),
  Paiement: require('../models/Paiement'),
  FinancialDocument: require('../models/FinancialDocument'),
  FinancialPayment: require('../models/FinancialPayment'),
  PaymentAllocation: require('../models/PaymentAllocation'),
};

if (!uri || !args.includes('--confirm-read-only') || args.includes('--apply') || (selected && !RESOURCES[selected])) {
  console.error(`Usage: node scripts/auditTenantAttribution.js --uri <mongodb-readonly-uri> --confirm-read-only [--resource ${Object.keys(RESOURCES).join('|')}] [--limit N]`);
  process.exit(2);
}

async function run() {
  await mongoose.connect(uri, { autoIndex: false });
  const names = selected ? [selected] : Object.keys(RESOURCES);
  const totals = { resolved: 0, ambiguous: 0, unresolved: 0, global: 0, scanned: 0, collections: {} };
  for (const resourceType of names) {
    const query = RESOURCES[resourceType].find({}).lean();
    if (limit) query.limit(limit);
    const resources = await query;
    totals.collections[resourceType] = { resolved: 0, ambiguous: 0, unresolved: 0, global: 0, scanned: 0 };
    for (const resource of resources) {
      const attribution = await resolveResourceTenant({ resourceType, resource });
      const currentTenant = resource.tenant || resource.platformTenant || null;
      const brokenRelation = attribution.status === 'unresolved' && attribution.proof.some((proof) => /→missing/.test(proof));
      const classification = currentTenant ? 'A'
        : attribution.status === 'ambiguous' ? 'D'
          : attribution.status === 'unresolved' ? (brokenRelation ? 'F' : 'E')
            : attribution.proof.length > 1 ? 'C' : 'B';
      totals.scanned += 1;
      totals[attribution.status] += 1;
      totals.collections[resourceType].scanned += 1;
      totals.collections[resourceType][attribution.status] += 1;
      console.log(JSON.stringify({ collection: RESOURCES[resourceType].collection.name, resourceType, documentId: String(resource._id), currentTenant: currentTenant ? String(currentTenant) : null, proposedTenant: attribution.tenantId, classification, ...attribution }));
    }
  }
  console.log(JSON.stringify({ summary: totals, mode: 'dry-run', writes: 0 }));
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
