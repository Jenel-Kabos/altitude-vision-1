#!/usr/bin/env node
// CLOUDINARY-SANDBOX-PROVISION-1 — preflight de configuration sandbox.
// N'UPLOAD JAMAIS RIEN, ne se connecte à aucun réseau Cloudinary : cette
// commande valide uniquement des variables d'environnement locales et une
// comparaison de chaîne de caractères. Volontairement exécutable seul
// (`node server/scripts/checkCloudinarySandbox.js`), jamais importé par le
// reste de l'application, pour rester isolé du process de production (voir
// commentaire `assertProcessIsolation` dans `cloudinarySandbox.js`).
require('dotenv').config();
const { validateSandboxConfig, assertProcessIsolation } = require('../config/cloudinarySandbox');
const { getProductionCloudinaryFingerprint } = require('../config/cloudinaryProductionFingerprint');

function maskCloudName(cloudName) {
  if (!cloudName) return null;
  if (cloudName.length <= 4) return '****';
  return `${cloudName.slice(0, 2)}***${cloudName.slice(-2)}`;
}

function main() {
  const production = getProductionCloudinaryFingerprint();
  const result = validateSandboxConfig();

  let isolationOk = true;
  let isolationError = null;
  try {
    assertProcessIsolation();
  } catch (error) {
    isolationOk = false;
    isolationError = error.code;
  }

  // Jamais de secret dans la sortie : ni API_SECRET, ni API_KEY, ni
  // CLOUDINARY_URL. Le cloud_name (seul champ potentiellement affiché) est
  // en plus masqué par prudence, bien qu'il ne soit pas lui-même un secret
  // (il apparaît déjà en clair dans toute URL Cloudinary publique).
  const rawSandboxCloudName = process.env.CLOUDINARY_SANDBOX_CLOUD_NAME || null;
  const credentialsPresent = Boolean(
    process.env.CLOUDINARY_SANDBOX_CLOUD_NAME && process.env.CLOUDINARY_SANDBOX_API_KEY && process.env.CLOUDINARY_SANDBOX_API_SECRET,
  );

  const report = {
    environment: 'local-preflight',
    productionCloudNameKnown: Boolean(production.cloudName),
    sandboxCloudNameMasked: maskCloudName(rawSandboxCloudName),
    credentialsPresent,
    confirmationProvided: process.env.CLOUDINARY_SANDBOX_CONFIRM === 'YES',
    productionCollision: result.code === 'CLOUDINARY_SANDBOX_PRODUCTION_COLLISION',
    processIsolationOk: isolationOk,
    processIsolationError: isolationError,
    status: result.status,
    code: result.code || null,
    verdict: result.status === 'VALID' && isolationOk ? 'SANDBOX CONFIGURATION VALID' : 'SANDBOX CONFIGURATION INVALID',
  };

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.verdict === 'SANDBOX CONFIGURATION VALID' ? 0 : 1;
}

if (require.main === module) main();

module.exports = { maskCloudName };
