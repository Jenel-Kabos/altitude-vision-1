/* TENANT-HARDENING-1 — outil strictement read-only. Aucune URI issue de .env
 * n'est acceptée implicitement : l'opérateur doit fournir --uri et confirmer
 * le caractère lecture seule. Aucun mode --apply n'existe. */
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
const uri = value('--uri');
if (!uri || !args.includes('--confirm-read-only') || args.includes('--apply')) {
  console.error('Usage: node scripts/tenantDataReconciliation.js --uri <mongodb-readonly-uri> --confirm-read-only [--collection Model]');
  process.exit(2);
}

const MODELS = ['CrmCustomer', 'CrmOpportunity', 'CrmActivity', 'CrmConsolidation', 'CrmAutomationRule', 'CrmAutomationRun', 'MarketingTemplate', 'MarketingCampaign', 'MarketingSend', 'MarketingUnsubscribe', 'WebhookSubscription', 'ActionLog', 'Notification'];

async function run() {
  await mongoose.connect(uri, { autoIndex: false });
  const selected = value('--collection');
  const names = selected ? MODELS.filter((name) => name === selected) : MODELS;
  for (const name of names) {
    const Model = require(`../models/${name}`);
    const docs = await Model.find({}).select('_id tenant platformTenant createdBy owner manager').lean();
    for (const doc of docs) {
      const tenant = doc.tenant || doc.platformTenant || null;
      const proof = tenant ? 'tenant/platformTenant explicite' : doc.owner ? 'propriétaire à résoudre' : doc.manager ? 'gestionnaire à résoudre' : doc.createdBy ? 'créateur à résoudre' : 'aucune relation suffisante';
      const classification = tenant ? 'A' : doc.owner ? 'B' : doc.createdBy || doc.manager ? 'C' : 'E';
      console.log(JSON.stringify({ collection: name, documentId: String(doc._id), proposedTenant: tenant ? String(tenant) : null, proof, confidence: tenant ? 'high' : classification === 'E' ? 'none' : 'low', classification, anomaly: tenant ? null : 'tenant absent — aucune écriture effectuée' }));
    }
  }
  await mongoose.disconnect();
}

run().catch(async (error) => { console.error(error.message); await mongoose.disconnect().catch(() => {}); process.exit(1); });
