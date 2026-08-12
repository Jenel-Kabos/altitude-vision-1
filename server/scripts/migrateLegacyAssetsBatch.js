#!/usr/bin/env node
// STORAGE-LEGACY-CERT-1 (Phase 15) — runner de batch borné pour une
// migration future contrôlée. Réutilise `auditPrivateCloudinaryAssets.js`
// pour l'inventaire et `legacyAssetMigrationService` pour l'exécution —
// AUCUN moteur ni taxonomie concurrent. Par défaut, sans `--apply`, ce
// script ne fait strictement rien d'écriture (dry-run) : il imprime
// uniquement le lot qui SERAIT traité.
//
// Bornage obligatoire — jamais "tout migrer" : au moins un de
// `--tenant`, `--collection`, `--ids` doit être fourni, et `--limit` (défaut
// 25, max 200) plafonne systématiquement le lot, y compris en dry-run.
//
// `--apply` reste soumis à TOUTES les conditions de
// `assertApplyAuthorized` (ALLOW_PRIVATE_ASSET_MIGRATION_APPLY=true,
// --mongo-uri explicite, --tenant explicite, classification B uniquement,
// --confirm exact) — ce script ne les assouplit ni ne les contourne.
const mongoose = require('mongoose');
require('dotenv').config();
const { MODELS, auditCollection } = require('./auditPrivateCloudinaryAssets');
const { planLegacyMigration, executeLegacyMigration } = require('../services/storage/legacyAssetMigrationService');

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 25;

function parseArgs(argv) {
  const args = { limit: DEFAULT_LIMIT, apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--apply') args.apply = true;
    else if (flag === '--tenant') args.tenant = argv[++i];
    else if (flag === '--collection') args.collection = argv[++i];
    else if (flag === '--ids') args.ids = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (flag === '--limit') args.limit = Math.min(MAX_LIMIT, Math.max(1, Number(argv[++i]) || DEFAULT_LIMIT));
    else if (flag === '--mongo-uri') args.mongoUri = argv[++i];
    else if (flag === '--confirm') args.confirm = argv[++i];
  }
  return args;
}

function assertBounded(args) {
  if (!args.tenant && !args.collection && !(args.ids && args.ids.length)) {
    throw new Error('BATCH_NOT_BOUNDED — fournir au moins --tenant, --collection ou --ids (jamais "tout migrer")');
  }
}

async function collectBatch(args) {
  const entries = args.collection ? MODELS.filter((m) => m[0] === args.collection) : MODELS;
  const findings = [];
  for (const entry of entries) {
    const collectionFindings = await auditCollection(entry);
    findings.push(...collectionFindings.filter((f) => {
      if (f.classification !== 'B') return false; // seule la classe B est jamais candidate
      if (args.tenant && f.tenantId && !f.tenantId.startsWith(args.tenant.slice(0, 10))) return false;
      if (args.ids && args.ids.length && !args.ids.includes(f.documentId)) return false;
      return true;
    }));
    if (findings.length >= args.limit) break;
  }
  return findings.slice(0, args.limit);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertBounded(args);

  const uri = args.mongoUri || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI_REQUIRED — fournir --mongo-uri explicitement ou définir MONGO_URI');
  await mongoose.connect(uri);

  const batch = await collectBatch(args);
  const report = { mode: args.apply ? 'apply' : 'dry-run', requested: args, batchSize: batch.length, results: [] };

  for (const finding of batch) {
    const plan = await planLegacyMigration({
      resourceType: finding.collection, resource: { _id: finding.documentId }, field: finding.field,
      url: null, publicId: finding.publicId, tenantResolution: finding.tenantResolution,
    });
    if (!args.apply) {
      report.results.push({ ...finding, decision: plan.decision, executed: false });
      continue;
    }
    try {
      const result = await executeLegacyMigration({
        resource: finding.collection, resourceId: finding.documentId, field: finding.field, tenant: args.tenant,
        oldPublicId: finding.publicId, resourceType: finding.collection, classification: finding.classification,
        apply: true, mongoUriExplicit: args.mongoUri, tenantIdExplicit: args.tenant, confirmToken: args.confirm,
        deps: {}, // volontairement incomplet : ce script ne fournit AUCUNE implémentation Cloudinary/DB réelle.
      });
      report.results.push({ ...finding, executed: true, status: result.status });
    } catch (error) {
      report.results.push({ ...finding, executed: true, status: 'failed', errorCode: error.code || error.message });
    }
  }

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error(JSON.stringify({ mode: 'batch', error: error.message }));
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
}

module.exports = { parseArgs, assertBounded, collectBatch, MAX_LIMIT, DEFAULT_LIMIT };
