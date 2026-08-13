#!/usr/bin/env node
// TENANT-DATA-REGULARIZATION-1 — audit READ-ONLY exhaustif des données
// historiques antérieures au provisioning du premier PlatformTenant réel.
//
// CE SCRIPT N'ÉCRIT JAMAIS RIEN. Il n'a aucun mode d'application : les flags
// --apply/--write/--force/--backfill sont explicitement refusés (voir
// `REFUSED_FLAGS` ci-dessous) pour qu'aucune évolution future accidentelle
// de ce fichier ne puisse le transformer en outil de mutation sans que
// quelqu'un remarque un changement structurel évident.
//
// Réutilise intégralement `tenantResourceAttributionService.js`
// (`resolveResourceTenant`/`mergeProofs`, TENANT-ATTRIBUTION-1, étendu
// additivement par ce sprint — voir le fichier lui-même) : AUCUN second
// moteur d'attribution n'est créé ici. Ce script ajoute uniquement :
//   1. une taxonomie A–F au sens de CE sprint (distincte de celle, plus
//      ancienne et différemment définie, de `auditTenantAttribution.js` —
//      volontairement un fichier séparé, jamais une modification du
//      comportement de ce script existant, pour ne jamais changer le sens
//      d'une classification déjà citée dans un rapport précédent) ;
//   2. une cartographie élargie des types de ressources (cluster GL, Hotel,
//      Accommodation, Conversation, Document, Finance, CRM, Marketing) ;
//   3. un manifeste de régularisation exploitable par un futur sprint
//      d'exécution (jamais exécuté ici).
//
// Taxonomie A–F (mission TENANT-DATA-REGULARIZATION-1, §6-7) :
//   A — attribution certaine : `resolveResourceTenant` renvoie `resolved`
//       (preuve déterministe non contradictoire — `mergeProofs` ne renvoie
//       jamais `resolved` s'il existe la moindre preuve concurrente).
//   B — probable / validation humaine : `unresolved`, mais la chaîne de
//       preuve atteint une entité RÉELLE et EXISTANTE qui n'a simplement pas
//       encore de rattachement tenant (marqueur de preuve `→no_tenant`) —
//       jamais une hypothèse, seulement un fait vérifié (l'entité existe).
//   C — contradiction : `resolveResourceTenant` renvoie `ambiguous` (2+
//       tenants distincts trouvés dans le graphe de preuves).
//   D — référence orpheline : au moins une preuve contient `→missing`
//       (un ID était présent mais le document référencé n'existe pas).
//   E — ressource globale légitime : classification STATIQUE, jamais
//       déduite de `tenant == null` seul (mission §6, interdiction
//       explicite) — réservée aux domaines architecturalement hors du
//       graphe SaaS Altimmo/GL (`domain` Altcom/Mila Events sur les
//       ressources financières, voir `GLOBAL_DOMAIN_EXCEPTIONS`).
//   F — non déterminable : `unresolved` sans qu'aucune preuve n'atteigne ni
//       une entité réelle sans tenant (B) ni une référence cassée (D) — soit
//       le champ relationnel primaire est totalement absent, soit le type de
//       ressource n'est pas (encore) couvert par le moteur canonique.
//
// Usage (lecture seule uniquement) :
//   node scripts/auditTenantLegacyData.js --confirm-database=altitudevision \
//     [--tenant=<PlatformTenant ObjectId>] [--output=./reports/audit.json] \
//     [--resource=Property] [--limit=5000]
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { resolveResourceTenant } = require('../services/platformTenant/tenantResourceAttributionService');
const PlatformTenant = require('../models/PlatformTenant');
const User = require('../models/User');

const REFUSED_FLAGS = ['--apply', '--write', '--force', '--backfill'];
const args = process.argv.slice(2);
const valueOf = (name) => args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);

const refused = REFUSED_FLAGS.filter((flag) => args.includes(flag) || args.some((a) => a.startsWith(`${flag}=`)));
if (require.main === module && refused.length) {
  process.stderr.write(`TENANT_LEGACY_AUDIT_WRITE_FLAG_REFUSED — ce script est strictement read-only ; indicateur(s) refusé(s) : ${refused.join(', ')}\n`);
  process.exit(2);
}

// TENANT-DATA-REGULARIZATION-1 §15 — les poles Altcom/Mila Events restent
// des outils internes non-SaaS, hors du graphe de tenant Altimmo/GL : leurs
// ressources financières sont légitimement globales, jamais parce que
// `tenant == null`, mais parce que l'architecture (constants/financialConstants.js
// `FINANCIAL_DOMAINS`) les place explicitement hors du domaine multi-tenant.
const GLOBAL_DOMAIN_EXCEPTIONS = new Set(['altcom', 'mila_events']);

// Registre des types de ressources auditées, organisé par cluster métier
// (mission §4/§8 — audit par graphe, jamais collection isolée). `hasDirectTenantField`
// documente si le schéma porte lui-même un champ `tenant`/`platformTenant`
// (utile pour distinguer "jamais eu de frontière" de "frontière posée mais
// non peuplée sur les documents historiques").
const REGISTRY = [
  { cluster: 'GL', resourceType: 'Property', Model: require('../models/Property'), hasDirectTenantField: false },
  { cluster: 'GL', resourceType: 'Proprietaire', Model: require('../models/Proprietaire'), hasDirectTenantField: false },
  { cluster: 'GL', resourceType: 'Locataire', Model: require('../models/Locataire'), hasDirectTenantField: false },
  { cluster: 'GL', resourceType: 'RentalManagement', Model: require('../models/RentalManagement'), hasDirectTenantField: false },
  { cluster: 'GL', resourceType: 'Contrat', Model: require('../models/Contrat'), hasDirectTenantField: false },
  { cluster: 'GL', resourceType: 'Paiement', Model: require('../models/Paiement'), hasDirectTenantField: false },
  { cluster: 'GL', resourceType: 'RentalMaintenanceTicket', Model: require('../models/RentalMaintenanceTicket'), hasDirectTenantField: false },
  { cluster: 'GL', resourceType: 'Litige', Model: require('../models/Litige'), hasDirectTenantField: false },
  { cluster: 'GL', resourceType: 'Signalement', Model: require('../models/Signalement'), hasDirectTenantField: false },
  { cluster: 'GL', resourceType: 'RealEstateApplication', Model: require('../models/RealEstateApplication'), hasDirectTenantField: false },
  { cluster: 'GL', resourceType: 'RentalPaymentReceipt', Model: require('../models/RentalPaymentReceipt'), hasDirectTenantField: false },
  { cluster: 'Sales', resourceType: 'Visite', Model: require('../models/Visite'), hasDirectTenantField: false },
  { cluster: 'Sales', resourceType: 'Transaction', Model: require('../models/Transaction'), hasDirectTenantField: false },
  { cluster: 'Sales', resourceType: 'PaiementTransaction', Model: require('../models/PaiementTransaction'), hasDirectTenantField: false },
  { cluster: 'Comms', resourceType: 'Conversation', Model: require('../models/Conversation'), hasDirectTenantField: true },
  { cluster: 'Comms', resourceType: 'Message', Model: require('../models/Message'), hasDirectTenantField: true },
  { cluster: 'Comms', resourceType: 'Notification', Model: require('../models/Notification'), hasDirectTenantField: true, tenantField: 'platformTenant' },
  { cluster: 'Documents', resourceType: 'Document', Model: require('../models/Document'), hasDirectTenantField: true },
  { cluster: 'Finance', resourceType: 'FinancialDocument', Model: require('../models/FinancialDocument'), hasDirectTenantField: true },
  { cluster: 'Finance', resourceType: 'FinancialDocumentLine', Model: require('../models/FinancialDocumentLine'), hasDirectTenantField: false },
  { cluster: 'Finance', resourceType: 'FinancialPayment', Model: require('../models/FinancialPayment'), hasDirectTenantField: true },
  { cluster: 'Finance', resourceType: 'PaymentAllocation', Model: require('../models/PaymentAllocation'), hasDirectTenantField: true },
  { cluster: 'Finance', resourceType: 'FinancialLedgerEntry', Model: require('../models/FinancialLedgerEntry'), hasDirectTenantField: false, domainField: null },
  { cluster: 'Hotel', resourceType: 'Hotel', Model: require('../models/Hotel'), hasDirectTenantField: true },
  { cluster: 'Hotel', resourceType: 'HotelReservation', Model: require('../models/HotelReservation'), hasDirectTenantField: true },
  { cluster: 'Hotel', resourceType: 'Room', Model: require('../models/Room'), hasDirectTenantField: false },
  { cluster: 'Hotel', resourceType: 'HotelStaffAssignment', Model: require('../models/HotelStaffAssignment'), hasDirectTenantField: false },
  { cluster: 'Accommodation', resourceType: 'Accommodation', Model: require('../models/Accommodation'), hasDirectTenantField: true },
  { cluster: 'Accommodation', resourceType: 'AccommodationReservation', Model: require('../models/AccommodationReservation'), hasDirectTenantField: true },
  { cluster: 'CRM', resourceType: 'CrmCustomer', Model: require('../models/CrmCustomer'), hasDirectTenantField: true },
  { cluster: 'CRM', resourceType: 'CrmOpportunity', Model: require('../models/CrmOpportunity'), hasDirectTenantField: true },
  { cluster: 'CRM', resourceType: 'CrmActivity', Model: require('../models/CrmActivity'), hasDirectTenantField: true },
  { cluster: 'CRM', resourceType: 'CrmAutomationRule', Model: require('../models/CrmAutomationRule'), hasDirectTenantField: true },
  { cluster: 'CRM', resourceType: 'CrmAutomationRun', Model: require('../models/CrmAutomationRun'), hasDirectTenantField: true },
  { cluster: 'Marketing', resourceType: 'MarketingCampaign', Model: require('../models/MarketingCampaign'), hasDirectTenantField: true },
  { cluster: 'Marketing', resourceType: 'MarketingSend', Model: require('../models/MarketingSend'), hasDirectTenantField: true },
  { cluster: 'Marketing', resourceType: 'MarketingTemplate', Model: require('../models/MarketingTemplate'), hasDirectTenantField: true },
];

// Correction du même ordre que la fusion imbriquée ci-dessus : `fromUser`
// (tenantResourceAttributionService.js) ne vérifie JAMAIS que l'utilisateur
// référencé existe réellement — il vérifie uniquement l'existence d'un
// `OrgMembership` pour cet ID. Un `owner`/`user` pointant vers un compte
// SUPPRIMÉ produit donc exactement la même preuve (`→no_tenant`) qu'un
// compte réel sans rattachement tenant — les deux sont fondamentalement
// différents (l'un est une référence cassée à réparer, l'autre est une
// vraie entité en attente de décision humaine) mais indiscernables sans
// cette vérification supplémentaire. Jamais un contournement du moteur
// canonique : une vérification d'EXISTENCE en plus, en lecture seule,
// propre à cet audit, qui ne modifie ni le comportement d'autorisation en
// production ni le moteur partagé.
async function verifyNoTenantEntitiesExist(proofs) {
  const ids = [...new Set(proofs.flatMap((p) => [...p.matchAll(/:([0-9a-fA-F]{24})→no_tenant/g)].map((m) => m[1])))];
  if (!ids.length) return null;
  const existing = await User.find({ _id: { $in: ids } }).select('_id').lean();
  const existingIds = new Set(existing.map((u) => String(u._id)));
  return ids.some((id) => existingIds.has(id));
}

function classify(attribution) {
  const proofs = attribution.proof || [];
  if (attribution.status === 'resolved') return 'A';
  if (attribution.status === 'ambiguous') return 'C';
  // Limite connue du primitif canonique `mergeProofs` (tenantResourceAttributionService.js) :
  // une ambiguïté détectée DANS une branche imbriquée (ex. un Locataire relié
  // à plusieurs Contrat pointant vers des Property de tenants différents,
  // via `fromContractsReferencing`) ne remonte PAS comme `ambiguous` au
  // niveau supérieur — `mergeProofs` ne compte que les preuves `resolved`
  // directement dans le tableau qu'on lui passe ; un enfant déjà `ambiguous`
  // est exclu de ce comptage et le résultat final redescend à `unresolved`.
  // Cela ne crée AUCUNE faille d'autorisation (`assertResourceTenant*`
  // refuse `unresolved` exactement comme un autre cas non attribué — jamais
  // un accès cross-tenant), mais dégraderait la PRÉCISION de cet audit (C
  // deviendrait silencieusement F) si on ne compensait pas ici. Les chaînes
  // de preuve individuelles restent toutes présentes dans le tableau `proof`
  // aplati (`mergeProofs` conserve `proof: proofs.flatMap(...)` quel que
  // soit le statut) : on peut donc détecter la contradiction nichée en
  // relisant les identifiants de tenant réellement mentionnés dans les
  // preuves `→membership→<id>`, jamais en devinant.
  const membershipTenantIds = new Set(proofs.flatMap((p) => [...p.matchAll(/→membership→([0-9a-fA-F]{24})/g)].map((m) => m[1])));
  if (membershipTenantIds.size > 1) return 'C';
  // `label:null→missing` (produit par ex. par `fromProperty(null)` quand un
  // champ optionnel comme `document.relatedProperty` n'a simplement jamais
  // été renseigné) n'est PAS une référence cassée — il n'y a jamais eu de
  // référence du tout. Seul `label:<ObjectId réel de 24 caractères>→missing`
  // signale qu'un ID était présent mais ne résout vers rien : c'est la seule
  // preuve valable d'une orpheline (D). Ne pas distinguer les deux ferait
  // basculer en D des ressources dont une AUTRE branche de preuve (ex.
  // `createdBy` pointant vers un utilisateur réel sans tenant, B) est en
  // réalité exploitable — observé réellement sur `Document.relatedProperty`.
  const hasOrphan = proofs.some((p) => /:[0-9a-fA-F]{24}→missing/.test(p));
  if (hasOrphan) return 'D';
  // `→no_tenant` signifie précisément « une entité RÉELLE et NOMMÉE existe
  // (un User a été trouvé), elle n'a simplement aucun rattachement tenant
  // actif » — c'est exactement la sémantique B de la mission (une décision
  // humaine porterait sur CETTE entité connue). `→no_contract`/`→no_property`
  // signifient l'inverse : aucune entité suivante n'a même pu être
  // identifiée (ex. un Locataire sans aucun Contrat le référençant, ou un
  // Contrat historique dont `bien` est `null` — cas réel documenté par
  // GL-RECON-UX-1 pour les 17 contrats historiques). Il n'y a alors rien de
  // concret sur quoi faire porter une décision humaine ciblée : c'est F
  // (non déterminable), jamais B — les confondre aurait fait apparaître des
  // dossiers "prêts pour décision" qui n'ont en réalité aucune piste.
  const hasRealEntityWithoutTenant = proofs.some((p) => /→no_tenant/.test(p));
  if (hasRealEntityWithoutTenant) return 'B';
  return 'F';
}

async function main() {
  const confirmDatabase = valueOf('--confirm-database');
  if (!confirmDatabase) {
    throw new Error('TENANT_LEGACY_AUDIT_DATABASE_NOT_CONFIRMED — --confirm-database=<nom> est requis, même pour un audit read-only (aucune opération contre une base non explicitement confirmée).');
  }
  const targetTenant = valueOf('--tenant');
  const outputPath = valueOf('--output');
  const onlyResource = valueOf('--resource');
  const limit = Math.max(0, Number(valueOf('--limit') || 0));

  await connectDB();
  const resolvedDatabase = mongoose.connection.name;
  if (confirmDatabase !== resolvedDatabase) {
    throw new Error(`TENANT_LEGACY_AUDIT_DATABASE_MISMATCH — connecté à "${resolvedDatabase}", --confirm-database="${confirmDatabase}" ne correspond pas. Aucune lecture effectuée.`);
  }

  const realTenantIds = new Set((await PlatformTenant.find({}).select('_id').lean()).map((t) => String(t._id)));

  const entries = onlyResource ? REGISTRY.filter((r) => r.resourceType === onlyResource) : REGISTRY;
  const manifest = [];
  const perCollection = {};
  const totals = { totalResources: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, orphanReferences: 0, contradictions: 0, alreadyScoped: 0, tenantInexistant: 0 };

  for (const { cluster, resourceType, Model, tenantField = 'tenant' } of entries) {
    const query = Model.find({}).sort({ _id: 1 }).lean();
    if (limit) query.limit(limit);
    const docs = await query;
    const stats = { cluster, total: 0, alreadyScoped: 0, sansTenant: 0, tenantInvalide: 0, tenantInexistant: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };

    for (const doc of docs) {
      const rawTenant = doc[tenantField] || doc.platformTenant || null;
      const isGlobalDomainException = doc.domain && GLOBAL_DOMAIN_EXCEPTIONS.has(doc.domain);
      let classification;
      let attribution;
      if (isGlobalDomainException) {
        classification = 'E';
        attribution = { status: 'global_by_architecture', tenantId: null, proof: [`${resourceType}.domain=${doc.domain}→hors_graphe_saas_altimmo`], confidence: 1 };
      } else {
        attribution = await resolveResourceTenant({ resourceType, resource: doc });
        classification = classify(attribution);
        if (classification === 'B') {
          const anyReferencedUserExists = await verifyNoTenantEntitiesExist(attribution.proof || []);
          if (anyReferencedUserExists === false) classification = 'D';
        }
      }

      stats.total += 1;
      stats[classification] += 1;
      totals.totalResources += 1;
      totals[classification] += 1;
      if (classification === 'C') totals.contradictions += 1;
      if (classification === 'D') totals.orphanReferences += 1;
      if (rawTenant) {
        stats.alreadyScoped += 1;
        totals.alreadyScoped += 1;
        if (!realTenantIds.has(String(rawTenant))) {
          stats.tenantInexistant += 1;
          totals.tenantInexistant += 1;
        }
      } else {
        stats.sansTenant += 1;
      }

      manifest.push({
        resourceType,
        cluster,
        resourceId: String(doc._id),
        classification,
        currentTenant: rawTenant ? String(rawTenant) : null,
        currentTenantExists: rawTenant ? realTenantIds.has(String(rawTenant)) : null,
        targetTenant: classification === 'A' ? attribution.tenantId : null,
        matchesRequestedTenant: targetTenant && classification === 'A' ? String(attribution.tenantId) === String(targetTenant) : null,
        proofs: attribution.proof || [],
        confidence: attribution.confidence ?? null,
        recommendedAction: classification === 'A' ? 'READY_FOR_FUTURE_CONTROLLED_ATTRIBUTION'
          : classification === 'B' ? 'HUMAN_REVIEW_REQUIRED_ENTITY_WITHOUT_TENANT'
            : classification === 'C' ? 'HUMAN_REVIEW_REQUIRED_CONTRADICTION_FAIL_CLOSED'
              : classification === 'D' ? 'HUMAN_REVIEW_REQUIRED_ORPHAN_REFERENCE'
                : classification === 'E' ? 'NO_ACTION_GLOBAL_BY_ARCHITECTURE'
                  : 'HUMAN_REVIEW_REQUIRED_NON_DETERMINABLE',
      });
    }
    perCollection[resourceType] = stats;
  }

  const humanReviewQueue = manifest.filter((m) => ['B', 'C', 'D', 'F'].includes(m.classification));
  const report = {
    mode: 'read-only-audit', writes: 0, database: resolvedDatabase,
    generatedAt: new Date().toISOString(),
    requestedTenant: targetTenant || null,
    totals, perCollection,
    manifestCount: manifest.length,
    humanReviewQueueCount: humanReviewQueue.length,
  };

  const fullOutput = { report, manifest, humanReviewQueue };
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(fullOutput, null, 2));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\nÉcrit : ${outputPath} (manifest complet + file de revue humaine)\n`);
  } else {
    process.stdout.write(`${JSON.stringify(fullOutput, null, 2)}\n`);
  }
}

if (require.main === module) {
  main()
    .catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
}

module.exports = { REGISTRY, classify, verifyNoTenantEntitiesExist };
