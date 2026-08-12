// STORAGE-LEGACY-1 — taxonomie A–F unique et partagée entre le script
// d'inventaire (`scripts/auditPrivateCloudinaryAssets.js`) et le moteur de
// migration (`legacyAssetMigrationService.js`). Reprend et étend la
// taxonomie deux-classes de STORAGE-SECURITY-1 (`PUBLIC_MEDIA`/
// `PRIVATE_DOCUMENT`) sans en créer de concurrente — voir
// `server/docs/STORAGE_SECURITY_1_AUDIT.md`.
const ASSET_CLASSES = Object.freeze({
  PUBLIC_MEDIA: 'PUBLIC_MEDIA',
  PRIVATE_DOCUMENT: 'PRIVATE_DOCUMENT',
  PRIVATE_ATTACHMENT: 'PRIVATE_ATTACHMENT',
  PRIVATE_OPERATIONAL_MEDIA: 'PRIVATE_OPERATIONAL_MEDIA',
  UNKNOWN: 'UNKNOWN',
});

const cloudinaryUrl = (value) => typeof value === 'string' && /res\.cloudinary\.com|cloudinary\.test/i.test(value);

const publicIdFromUrl = (url) => {
  const match = String(url || '').match(/\/(?:image|video|raw)\/upload\/(?:v\d+\/)?(.+?)(?:\.[^/.]+)?(?:\?.*)?$/i);
  return match?.[1] || null;
};

// STORAGE-LEGACY-CERT-1 (Phase 4) — les uploads legacy de ce dépôt utilisent
// systématiquement `resource_type: 'auto'` (voir `config/cloudinary.js`
// `CLOUDINARY_DEFAULTS`), jamais un type fixe. Cloudinary résout `auto` au
// moment de l'upload et encode le type RÉEL (`image`/`video`/`raw`) dans le
// segment d'URL — jamais `auto` lui-même, qui n'est d'ailleurs pas accepté
// par l'API `rename`/`destroy`. Le moteur de migration ne doit donc JAMAIS
// supposer un `resource_type` par défaut : il doit toujours le dériver de
// l'URL legacy réellement observée.
const resourceTypeFromUrl = (url) => {
  const match = String(url || '').match(/\/(image|video|raw)\/upload\//i);
  return match?.[1]?.toLowerCase() || null;
};

// Décision A–F : ne dépend QUE de preuves déjà établies par l'appelant
// (URL/publicId observés, statut d'attribution tenant déjà résolu via
// `tenantResourceAttributionService`). Cette fonction ne fait elle-même
// aucune requête Mongo/Cloudinary — elle reste pure et testable.
function classifyLegacyAsset({
  isPublicMedia = false,
  alreadyAuthenticated = false,
  url = null,
  publicId = null,
  tenantResolution = 'unresolved', // 'resolved' | 'ambiguous' | 'unresolved' | 'global'
} = {}) {
  if (isPublicMedia) {
    return { classification: 'E', proposedAction: 'keep_public', confidence: 'high', assetClass: ASSET_CLASSES.PUBLIC_MEDIA };
  }
  if (alreadyAuthenticated) {
    return { classification: 'A', proposedAction: 'already_private', confidence: 'high', assetClass: ASSET_CLASSES.PRIVATE_DOCUMENT };
  }
  const resolvedPublicId = publicId || (cloudinaryUrl(url) ? publicIdFromUrl(url) : null);
  const isLegacyPublicCloudinary = cloudinaryUrl(url) || Boolean(publicId);

  if (!isLegacyPublicCloudinary) {
    return { classification: 'F', proposedAction: 'verify_external_or_local_storage', confidence: 'low', assetClass: ASSET_CLASSES.UNKNOWN };
  }
  if (!resolvedPublicId) {
    return { classification: 'D', proposedAction: 'manual_investigation_publicid', confidence: 'low', assetClass: ASSET_CLASSES.UNKNOWN };
  }
  if (tenantResolution === 'resolved') {
    return { classification: 'B', proposedAction: 'migrate_rename_to_authenticated', confidence: 'high', assetClass: ASSET_CLASSES.PRIVATE_DOCUMENT };
  }
  if (tenantResolution === 'ambiguous' || tenantResolution === 'unresolved') {
    return { classification: 'C', proposedAction: 'confirm_tenant_before_migration', confidence: 'medium', assetClass: ASSET_CLASSES.PRIVATE_DOCUMENT };
  }
  // 'global' — ressource légitimement sans tenant (ex. donnée antérieure à
  // PlatformTenant sans aucune attribution possible) : jamais migrée
  // automatiquement, nécessite un examen explicite de son caractère global.
  return { classification: 'F', proposedAction: 'examine_global_status', confidence: 'low', assetClass: ASSET_CLASSES.UNKNOWN };
}

// Seules B (et, après confirmation manuelle documentée, C requalifié en B)
// sont potentiellement migrables. Jamais D/E/F.
const isMigratable = (classification) => classification === 'B';

// STORAGE-LEGACY-CERT-1 (Phase 2) — décision opérationnelle par classe,
// utilisée par le rapport de certification et par le futur runner de batch
// (`server/scripts/migrateLegacyAssetsBatch.js`). Ne remplace pas la
// taxonomie A–F, ne fait que la traduire en verbe d'action.
const MIGRATION_DECISION = Object.freeze({
  A: 'PUBLIC-NO-ACTION', // déjà privé/authenticated — rien à faire
  B: 'AUTO-MIGRABLE',    // legacy public, publicId fiable, tenant resolved
  C: 'MANUAL-REVIEW',    // publicId fiable mais tenant ambiguous/unresolved
  D: 'MANUAL-REVIEW',    // tenant potentiellement exploitable mais publicId insuffisant
  E: 'PUBLIC-NO-ACTION', // média public légitime — jamais migré
  F: 'BLOCKED',          // provenance non prouvable / global non attribuable
});
const migrationDecisionFor = (classification) => MIGRATION_DECISION[classification] || 'BLOCKED';

module.exports = {
  ASSET_CLASSES, cloudinaryUrl, publicIdFromUrl, resourceTypeFromUrl, classifyLegacyAsset, isMigratable,
  MIGRATION_DECISION, migrationDecisionFor,
};
