// F-U1.H — Initialisation CONTRÔLÉE des deux premiers gouverneurs
// d'habilitations financières sensibles d'un périmètre (TENANT ou PLATFORM).
//
// Hors API. Même discipline que bootstrapPlatformOperator.js :
//   - dry-run par défaut ; `--apply` n'écrit qu'avec
//     CONTRACTUAL_GRANT_BOOTSTRAP_ENABLED=true ET --confirm-database=<nom exact> ;
//   - autorisé par un opérateur actif `platform.operators.manage`, distinct des
//     gouverneurs (aucune auto-attribution) ;
//   - deux gouverneurs distincts minimum, éligibles (Admin actif du tenant /
//     opérateur `platform.operators.manage`) ;
//   - une seule exécution par périmètre (ContractualGrantBootstrap unique) ;
//   - n'accorde que `contractual.grants.govern`, à durée bornée.
//
//   node scripts/bootstrapContractualGrantGovernors.js --scope=TENANT --tenantId=<id> \
//     --governors=<userId1>,<userId2> --authorizedBy=<operatorUserId> \
//     --decision="Décision n° ..." --validUntil=2027-01-01T00:00:00Z \
//     [--confirm-database=<nom> --apply]
// F-U1.I — mode racine PLATFORM : `--scope=PLATFORM --input=<fichier.json>`
// (identités vérifiées physiquement : numéros lus depuis un fichier local,
// jamais passés en argument — historique shell — ni affichés). Le fichier :
//   { "authorizedBy": { "userId", "documentKind", "documentNumber", "evidenceRef" },
//     "governors": [ { ...même forme... }, { ... } ],
//     "decisionReference": "...", "validUntil": "ISO" }
// À détruire de façon sûre après exécution.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const fs = require('fs');
const { bootstrapGrantGovernors, bootstrapPlatformRoot } = require('../services/finance/contractual/contractualFinanceGrantService');

const args = new Set(process.argv.slice(2));
const valueOf = (name) => process.argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);

async function main() {
  const apply = args.has('--apply');
  const scopeType = valueOf('--scope');
  const input = scopeType === 'PLATFORM'
    ? { ...JSON.parse(fs.readFileSync(valueOf('--input'), 'utf8')) }
    : {
      scopeType,
      tenantId: valueOf('--tenantId') || null,
      governorUserIds: (valueOf('--governors') || '').split(',').map((id) => id.trim()).filter(Boolean),
      authorizedByUserId: valueOf('--authorizedBy'),
      decisionReference: valueOf('--decision'),
      validUntil: valueOf('--validUntil'),
    };
  // Résumé sans aucune donnée d'identité.
  const summary = scopeType === 'PLATFORM'
    ? { scopeType, authorizedBy: input.authorizedBy?.userId, governors: (input.governors || []).map((item) => item.userId), decisionReference: input.decisionReference, validUntil: input.validUntil }
    : input;
  await connectDB();
  const database = mongoose.connection.name;
  if (!apply) {
    process.stdout.write(`${JSON.stringify({ mode: 'dry-run', database, input: summary, result: 'DRY-RUN — aucune écriture. --apply, --confirm-database et CONTRACTUAL_GRANT_BOOTSTRAP_ENABLED=true requis.' }, null, 2)}\n`);
    return;
  }
  if (valueOf('--confirm-database') !== database) throw new Error(`GRANT_BOOTSTRAP_DATABASE_NOT_CONFIRMED — base connectée : "${database}".`);
  const { bootstrap, grants } = scopeType === 'PLATFORM' ? await bootstrapPlatformRoot(input) : await bootstrapGrantGovernors(input);
  process.stdout.write(`${JSON.stringify({ mode: 'apply', database, bootstrap: String(bootstrap._id), grants: grants.map((g) => String(g._id)) }, null, 2)}\n`);
}

main()
  .catch((error) => { process.stderr.write(`${error.code || ''} ${error.message}\n`); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
