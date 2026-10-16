// F-U1.I / F-U1.J — Stockage des justificatifs KYC.
//
// Abstraction au-dessus de secureStorageService (Cloudinary, type
// `authenticated` ; lecture serveur via URL de téléchargement signée de 60 s
// qui ne quitte JAMAIS le serveur : le client reçoit un flux, pas une URL).
//
// FERMÉ PAR DÉFAUT. Ouverture seulement si TOUTES les conditions sont réunies :
//   1. KYC_DOCUMENT_STORAGE_ENABLED=true (décision de validation du stockage) ;
//   2. configuration Cloudinary complète ;
//   3. HUMAN_IDENTITY_FINGERPRINT_KEY présente (≥ 32 caractères) ;
//   4. un analyseur anti-malware enregistré (kycDocumentScanner) — aucun
//      n'existe aujourd'hui.
// Les raisons d'indisponibilité sont des codes, jamais des valeurs.
//
// Erreurs prestataire : jamais renvoyées ni journalisées telles quelles (un
// message Cloudinary peut contenir le public_id ou la chaîne signée).

const crypto = require('crypto');
const secureStorage = require('./secureStorageService');
const logger = require('../../utils/logger');
const { inspectKycDocument } = require('./kycDocumentInspection');
const { getScanner } = require('./kycDocumentScanner');
const { KYC_DOCUMENT_ALLOWED_MIME_TYPES, KYC_DOCUMENT_MAX_BYTES } = require('../../constants/financialKycConstants');

const kycError = (code, message, statusCode) => Object.assign(new Error(message), { name: 'FinancialError', code, statusCode });

function configurationStatus() {
  const reasons = [];
  if (process.env.KYC_DOCUMENT_STORAGE_ENABLED !== 'true') reasons.push('STORAGE_NOT_APPROVED');
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) reasons.push('PROVIDER_CONFIGURATION_INCOMPLETE');
  if ((process.env.HUMAN_IDENTITY_FINGERPRINT_KEY || '').length < 32) reasons.push('IDENTITY_FINGERPRINT_KEY_MISSING');
  if (!getScanner()) reasons.push('MALWARE_SCANNER_UNAVAILABLE');
  return { enabled: reasons.length === 0, reasons };
}

const isEnabled = () => configurationStatus().enabled;

function assertEnabled() {
  const status = configurationStatus();
  if (!status.enabled) {
    throw Object.assign(kycError('KYC_DOCUMENT_STORAGE_NOT_APPROVED', 'Le dépôt de pièces d’identité n’est pas ouvert : stockage en cours de validation.', 503), { reasons: status.reasons });
  }
}

function signatureMatches(buffer, mimeType) {
  if (mimeType === 'application/pdf') return buffer.subarray(0, 5).toString('latin1') === '%PDF-';
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return false;
}

function validateKycFile(file) {
  if (!file?.buffer?.length) throw kycError('KYC_DOCUMENT_REQUIRED', 'Justificatif requis.', 422);
  if (file.buffer.length > KYC_DOCUMENT_MAX_BYTES) throw kycError('KYC_DOCUMENT_TOO_LARGE', 'Justificatif trop volumineux.', 413);
  if (!KYC_DOCUMENT_ALLOWED_MIME_TYPES.includes(file.mimetype) || !signatureMatches(file.buffer, file.mimetype)) {
    throw kycError('KYC_DOCUMENT_CONTENT_INVALID', 'Le contenu du justificatif ne correspond pas à un PDF, JPEG ou PNG valide.', 415);
  }
  inspectKycDocument(file.buffer, file.mimetype);
  return { mimeType: file.mimetype, size: file.buffer.length, sha256: crypto.createHash('sha256').update(file.buffer).digest('hex') };
}

async function scan(buffer, mimeType) {
  const scanner = getScanner();
  if (!scanner) throw kycError('KYC_DOCUMENT_STORAGE_NOT_APPROVED', 'Analyse des justificatifs indisponible.', 503);
  let result;
  try { result = await scanner.scan(buffer, { mimeType }); } catch { result = { verdict: 'error' }; }
  if (result?.verdict === 'infected') throw kycError('KYC_DOCUMENT_REJECTED_BY_SCAN', 'Justificatif refusé par l’analyse de sécurité.', 422);
  if (result?.verdict !== 'clean') throw kycError('KYC_DOCUMENT_SCAN_UNAVAILABLE', 'Analyse de sécurité indisponible, réessayez plus tard.', 503);
  return result;
}

// Erreur prestataire → erreur stable, sans détail sensible. Journal : code
// HTTP du prestataire uniquement.
function providerFailure(operation, error) {
  logger.error('kyc.storage.provider_error', { operation, provider: 'cloudinary', providerStatus: error?.http_code || error?.response?.status || null });
  return kycError('KYC_DOCUMENT_STORAGE_UNAVAILABLE', 'Stockage des justificatifs momentanément indisponible.', 502);
}

async function upload({ caseId, docId, slot, file }) {
  assertEnabled();
  const metadata = validateKycFile(file);
  await scan(file.buffer, metadata.mimeType);
  let asset;
  try {
    asset = await secureStorage.uploadPrivateAsset(file.buffer, {
      purpose: 'identity', ownerType: 'FinancialIdentityKycCase', ownerId: caseId,
      filename: `${slot}`, mimeType: metadata.mimeType, folder: 'altitude-vision/private/kyc',
      publicId: `altitude-vision/private/kyc/${caseId}/${docId}-${crypto.randomUUID()}`,
    });
  } catch (error) {
    throw providerFailure('upload', error);
  }
  return { asset: { ...asset, originalFilename: slot }, ...metadata };
}

async function read(asset) {
  try {
    const buffer = await secureStorage.readPrivateAsset(asset);
    if (!buffer?.length) throw new Error('EMPTY');
    return buffer;
  } catch (error) {
    throw providerFailure('read', error);
  }
}

// Suppression avec preuve : `result` Cloudinary ('ok' = supprimé, 'not found'
// = déjà absent). Le destroy invalide le CDN (invalidate: true). Les copies de
// SAUVEGARDE éventuelles du compte ne sont pas couvertes (voir F-U1.J §F).
async function remove(asset) {
  try {
    const response = await secureStorage.deletePrivateAsset(asset);
    const result = response?.result || null;
    return { deleted: ['ok', 'not found'].includes(result), providerResult: result, at: new Date() };
  } catch (error) {
    throw providerFailure('delete', error);
  }
}

// F-U1.J — les champs `select: false` IMBRIQUÉS de privateAssetSchema
// (publicId, resourceType…) ne sont PAS chargés par `+<chemin>.asset` seul :
// toute lecture ou réécriture d'une référence doit utiliser cette sélection
// complète, sous peine de lecture impossible ou d'effacement silencieux.
const ASSET_FIELDS = ['publicId', 'resourceType', 'deliveryType', 'version', 'format'];
const fullAssetSelect = (assetPath) => [`+${assetPath}`, ...ASSET_FIELDS.map((field) => `+${assetPath}.${field}`)].join(' ');

module.exports = { fullAssetSelect, configurationStatus, isEnabled, assertEnabled, validateKycFile, upload, read, remove };
