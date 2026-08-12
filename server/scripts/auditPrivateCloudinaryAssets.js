#!/usr/bin/env node
// STORAGE-LEGACY-1 (amélioration de l'outil STORAGE-SECURITY-1, même
// fichier réutilisé — jamais un second script concurrent). Audit
// strictement read-only : aucune API Admin Cloudinary, aucune écriture
// Mongo, aucune suppression. Réutilise la taxonomie A–F unique
// (`legacyAssetClassification.js`) et le moteur d'attribution tenant
// unique (`tenantResourceAttributionService.js`) — voir §9/§10 du sprint
// STORAGE-LEGACY-1.
//
// Mode production (§13) : si `--mongo-uri` est fourni explicitement en
// ligne de commande, il est utilisé ; sinon `MONGO_URI` de l'environnement
// local est utilisé. Aucune écriture n'est jamais effectuée par ce script,
// quel que soit le mode.
const mongoose = require('mongoose');
require('dotenv').config();
const { resolveResourceTenant } = require('../services/platformTenant/tenantResourceAttributionService');
const { classifyLegacyAsset, cloudinaryUrl, publicIdFromUrl } = require('../services/storage/legacyAssetClassification');

// collection → { Model, fields (URL/asset), resourceType (attribution),
// relSelect (champs relationnels supplémentaires à charger pour
// l'attribution), publicMedia }
const MODELS = [
  ['Contrat', require('../models/Contrat'), ['documents', 'etatsDesLieux'], 'Contrat', 'bien'],
  ['Document', require('../models/Document'), ['content', 'privateAsset'], 'Document', 'createdBy client relatedProperty entityType entityId'],
  ['Locataire', require('../models/Locataire'), ['pieceIdentite', 'pieceIdentiteAsset'], 'Locataire', 'user'],
  ['Proprietaire', require('../models/Proprietaire'), ['pieceIdentite', 'pieceIdentiteAsset'], 'Proprietaire', 'user'],
  ['Message', require('../models/Message'), ['attachments'], 'Message', 'conversation sender receiver'],
  ['RentalMaintenanceTicket', require('../models/RentalMaintenanceTicket'), ['attachments'], 'RentalMaintenanceTicket', 'property'],
  ['Paiement', require('../models/Paiement'), ['preuvePaiement'], 'Paiement', 'contrat'],
  ['PaiementTransaction', require('../models/PaiementTransaction'), ['preuvePaiement'], 'PaiementTransaction', 'transaction'],
  ['RentalPaymentReceipt', require('../models/RentalPaymentReceipt'), ['preuvePaiement'], 'RentalPaymentReceipt', 'contrat'],
  ['Litige', require('../models/Litige'), ['preuves'], 'Litige', 'bienConcerné'],
  ['Signalement', require('../models/Signalement'), ['preuves'], 'Signalement', 'property'],
  ['InternalMail', require('../models/InternalMail'), ['attachments'], 'InternalMail', null],
  ['User', require('../models/User'), ['contratPdfUrl', 'contratPdfAsset'], 'User', null],
  ['FinancialDocumentArtifact', require('../models/FinancialDocumentArtifact'), ['storageKey'], 'FinancialDocumentArtifact', 'domain establishmentId'],
  ['RealEstateApplication', require('../models/RealEstateApplication'), ['attachments'], 'RealEstateApplication', 'property'],
  ['Property', require('../models/Property'), ['images'], null, null, true],
  ['Hotel', require('../models/Hotel'), ['images'], null, null, true],
  ['Accommodation', require('../models/Accommodation'), ['images'], null, null, true],
];

// Champs sensibles jamais imprimés intégralement (§27/§38) : on ne rapporte
// que la présence, jamais le contenu, pour les documents d'identité.
const IDENTITY_COLLECTIONS = new Set(['Locataire', 'Proprietaire']);
const truncateId = (value) => (value ? String(value).slice(0, 10) + '…' : null);

function collect(value, path, rows, publicMedia) {
  if (!value) return rows;
  if (Array.isArray(value)) { value.forEach((item, index) => collect(item, `${path}[${index}]`, rows, publicMedia)); return rows; }
  if (typeof value === 'string') {
    if (cloudinaryUrl(value)) rows.push({ field: path, url: value, publicId: publicIdFromUrl(value), alreadyAuthenticated: false });
    return rows;
  }
  if (typeof value !== 'object') return rows;
  const asset = value.asset || value.privateAsset || value.pieceIdentiteAsset || value.documentAsset || value.contratPdfAsset;
  const url = value.url || value.content || value.pieceIdentite || value.documentUrl || value.contratPdfUrl;
  if (asset || url) {
    rows.push({
      field: path,
      url: cloudinaryUrl(url) ? url : null,
      publicId: asset?.publicId || publicIdFromUrl(url),
      alreadyAuthenticated: asset?.deliveryType === 'authenticated',
    });
  }
  Object.entries(value).forEach(([key, child]) => {
    if (!['_id', 'asset', 'privateAsset', 'pieceIdentiteAsset', 'documentAsset', 'contratPdfAsset', 'url', 'content', 'pieceIdentite', 'documentUrl', 'contratPdfUrl'].includes(key)) {
      collect(child, path ? `${path}.${key}` : key, rows, publicMedia);
    }
  });
  return rows;
}

// Mongoose n'exige (et n'accepte) le préfixe `+champ` QUE pour un champ
// réellement `select: false` dans le schéma — l'appliquer à un champ déjà
// inclus par défaut fait basculer toute la projection en mode "inclusion
// stricte" sur un nom de champ inexistant (`+documents`) et ne retourne
// plus alors QUE `_id` (bug constaté et corrigé pendant ce sprint : le
// script précédent de STORAGE-SECURITY-1 préfixait `+` systématiquement,
// ce qui le rendait silencieusement aveugle sur tous les champs sans
// `select:false`, dont `Contrat.documents`/`etatsDesLieux`).
const needsPlusPrefix = (Model, field) => Model.schema.path(field)?.options?.select === false;
const selectFieldsFor = (Model, fields) => fields.map((f) => `${needsPlusPrefix(Model, f) ? '+' : ''}${f}`).join(' ');

async function auditCollection([collection, Model, fields, resourceType, relSelect, publicMedia = false]) {
  const select = [selectFieldsFor(Model, fields), relSelect || ''].join(' ').trim();
  const docs = await Model.find({}).select(select).lean();
  const findings = [];
  for (const doc of docs) {
    const rows = [];
    fields.forEach((f) => collect(doc[f], f, rows, publicMedia));
    if (!rows.length) continue;

    let attribution = { status: 'global', tenantId: null, proof: ['no_resourceType_mapping'] };
    if (resourceType) {
      try {
        attribution = await resolveResourceTenant({ resourceType, resource: doc });
      } catch (error) {
        attribution = { status: 'unresolved', tenantId: null, proof: [`error:${error.message}`] };
      }
    }

    for (const row of rows) {
      const result = classifyLegacyAsset({
        isPublicMedia: publicMedia,
        alreadyAuthenticated: row.alreadyAuthenticated,
        url: row.url,
        publicId: row.publicId,
        tenantResolution: attribution.status,
      });
      findings.push({
        classification: result.classification,
        collection,
        documentId: String(doc._id),
        field: row.field,
        assetClass: result.assetClass,
        tenantResolution: attribution.status,
        tenantId: attribution.tenantId ? truncateId(attribution.tenantId) : null,
        currentDeliveryType: row.alreadyAuthenticated ? 'authenticated' : (row.url || row.publicId ? 'upload' : 'unknown'),
        publicId: row.publicId,
        legacyUrlPresent: Boolean(row.url),
        proposedAction: result.proposedAction,
        confidence: result.confidence,
        sensitive: IDENTITY_COLLECTIONS.has(collection),
      });
    }
  }
  return findings;
}

function summarize(findings) {
  const byClassification = findings.reduce((acc, f) => { acc[f.classification] = (acc[f.classification] || 0) + 1; return acc; }, {});
  const byCollection = findings.reduce((acc, f) => { acc[f.collection] = (acc[f.collection] || 0) + 1; return acc; }, {});
  const migratableCount = findings.filter((f) => f.classification === 'B').length;
  return { total: findings.length, byClassification, byCollection, migratableCount };
}

async function main() {
  const args = process.argv.slice(2);
  const mongoUriFlagIndex = args.indexOf('--mongo-uri');
  const explicitUri = mongoUriFlagIndex >= 0 ? args[mongoUriFlagIndex + 1] : null;
  const uri = explicitUri || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI_REQUIRED — fournir --mongo-uri explicitement ou définir MONGO_URI');
  // §13 — jamais d'écriture, quel que soit l'environnement ciblé. Ce script
  // n'importe aucune API d'écriture Cloudinary/Mongo.
  await mongoose.connect(uri);
  const findings = [];
  for (const entry of MODELS) {
    findings.push(...await auditCollection(entry));
  }
  console.log(JSON.stringify({
    mode: 'dry-run',
    generatedAt: new Date().toISOString(),
    source: explicitUri ? 'explicit --mongo-uri' : 'MONGO_URI env',
    summary: summarize(findings),
    findings,
  }, null, 2));
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error(JSON.stringify({ mode: 'dry-run', error: error.message }));
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
}

module.exports = { auditCollection, summarize, MODELS };
