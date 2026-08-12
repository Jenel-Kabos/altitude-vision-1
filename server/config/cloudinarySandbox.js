// CLOUDINARY-SANDBOX-PROVISION-1 — configuration Cloudinary sandbox
// strictement isolée de la configuration de production
// (`server/config/cloudinary.js`). Ce module ne l'importe JAMAIS : il crée
// sa propre instance `cloudinary.v2` configurée uniquement avec les
// identifiants `CLOUDINARY_SANDBOX_*`, pour qu'aucun appel effectué via
// cette instance ne puisse par erreur retomber sur le singleton configuré
// avec les identifiants de production.
//
// AUCUN appel réseau n'est jamais effectué par ce fichier ni par
// `validateSandboxConfig()` — uniquement de la lecture d'environnement et
// des comparaisons locales. Seule `createSandboxCloudinaryClient()`,
// appelée explicitement par un futur script de certification, instancie un
// client (ce qui n'effectue toujours aucun appel réseau : `cloudinary.v2`
// ne se connecte qu'au premier appel d'API explicite).
const { getProductionCloudinaryFingerprint } = require('./cloudinaryProductionFingerprint');

const ERROR_CODES = Object.freeze({
  NOT_CONFIGURED: 'CLOUDINARY_SANDBOX_NOT_CONFIGURED',
  INVALID_CONFIG: 'CLOUDINARY_SANDBOX_INVALID_CONFIG',
  CONFIRMATION_REQUIRED: 'CLOUDINARY_SANDBOX_CONFIRMATION_REQUIRED',
  PRODUCTION_COLLISION: 'CLOUDINARY_SANDBOX_PRODUCTION_COLLISION',
  PROCESS_ISOLATION_REQUIRED: 'CLOUDINARY_SANDBOX_PROCESS_ISOLATION_REQUIRED',
});

// Lecture pure de l'environnement — jamais de valeur par défaut, jamais de
// repli implicite vers les variables Cloudinary de production.
function readSandboxEnv() {
  return {
    cloudName: process.env.CLOUDINARY_SANDBOX_CLOUD_NAME || null,
    apiKey: process.env.CLOUDINARY_SANDBOX_API_KEY || null,
    apiSecret: process.env.CLOUDINARY_SANDBOX_API_SECRET || null,
    confirm: process.env.CLOUDINARY_SANDBOX_CONFIRM || null,
  };
}

// Validation fail-closed, en 4 étapes ordonnées, purement locale.
// Ordre volontaire : absence totale avant configuration partielle avant
// confirmation avant collision — chaque étape ne peut être atteinte que si
// la précédente est satisfaite, pour des messages d'erreur non ambigus.
function validateSandboxConfig() {
  const env = readSandboxEnv();
  const credentialsProvided = [env.cloudName, env.apiKey, env.apiSecret].filter(Boolean);

  if (credentialsProvided.length === 0) {
    return { status: 'INVALID', code: ERROR_CODES.NOT_CONFIGURED, message: 'Aucune variable CLOUDINARY_SANDBOX_* définie — les identifiants de production ne sont jamais utilisés en repli.' };
  }
  if (credentialsProvided.length < 3) {
    return { status: 'INVALID', code: ERROR_CODES.INVALID_CONFIG, message: 'Configuration sandbox incomplète : CLOUDINARY_SANDBOX_CLOUD_NAME/API_KEY/API_SECRET doivent être fournis ensemble.' };
  }
  if (env.confirm !== 'YES') {
    return { status: 'INVALID', code: ERROR_CODES.CONFIRMATION_REQUIRED, message: 'CLOUDINARY_SANDBOX_CONFIRM doit valoir exactement "YES" pour confirmer explicitement l\'usage d\'un environnement non-production.' };
  }
  const production = getProductionCloudinaryFingerprint();
  if (production.cloudName && env.cloudName === production.cloudName) {
    return { status: 'INVALID', code: ERROR_CODES.PRODUCTION_COLLISION, message: `CLOUDINARY_SANDBOX_CLOUD_NAME ("${env.cloudName}") correspond au cloud_name de production — refusé.` };
  }

  return {
    status: 'VALID',
    config: { cloudName: env.cloudName, apiKeyPresent: true, apiSecretPresent: true, confirmed: true },
  };
}

function assertSandboxConfigValid() {
  const result = validateSandboxConfig();
  if (result.status !== 'VALID') {
    const error = new Error(result.message);
    error.code = result.code;
    throw error;
  }
  return result.config;
}

// RISQUE RÉEL DÉCOUVERT PENDANT CE SPRINT (Phase 30 — audit du code
// storage) : le SDK `cloudinary` Node stocke sa configuration dans une
// variable `let cloudinary_config` au niveau du MODULE
// (`node_modules/cloudinary/lib/config.js`), partagée par tout appelant de
// `require('cloudinary')` dans le même process Node — `Object.create()` ou
// toute autre astuce d'instance NE crée PAS d'isolation réelle, car
// `.config()` referme sur cette même variable de module quel que soit
// l'objet sur lequel la méthode est appelée. Concrètement : si
// `server/config/cloudinary.js` (production) a déjà été chargé dans CE
// process (ce qui arrive dès qu'un contrôleur/route métier est importé, y
// compris transitivement pendant les tests Jest), appeler
// `cloudinary.config({...credentials sandbox...})` écraserait SILENCIEUSEMENT
// la configuration de production pour le reste du process — et tout code
// utilisant ensuite l'export `cloudinary` de `config/cloudinary.js`
// utiliserait alors, sans le savoir, les identifiants sandbox (ou
// inversement). Aucune "isolation d'instance" ne peut compenser cela avec ce
// SDK. La seule protection fiable est donc l'ISOLATION DE PROCESS : ce
// module refuse de créer un client sandbox si `config/cloudinary.js` a déjà
// été chargé dans le process courant — détecté via `require.cache`, qui
// révèle si CE process a jamais importé le module de production. Un futur
// `certifyCloudinarySandbox.js` doit donc s'exécuter comme un script Node
// autonome qui n'importe JAMAIS, même transitivement, `config/cloudinary.js`
// ni aucun contrôleur/route qui le charge.
function assertProcessIsolation() {
  let productionConfigPath;
  try {
    productionConfigPath = require.resolve('./cloudinary');
  } catch {
    return; // config/cloudinary.js introuvable dans ce contexte : rien à protéger
  }
  if (require.cache[productionConfigPath]) {
    const error = new Error("config/cloudinary.js (production) est déjà chargé dans ce process — le SDK Cloudinary partage sa configuration au niveau du module (voir commentaire ci-dessus) et un `.config()` sandbox écraserait silencieusement la configuration de production en mémoire. Exécuter la certification sandbox dans un process Node distinct.");
    error.code = ERROR_CODES.PROCESS_ISOLATION_REQUIRED;
    throw error;
  }
}

// N'effectue AUCUN appel réseau — `cloudinary.v2.config()` ne fait que
// stocker des valeurs en mémoire (globalement au module, voir ci-dessus).
// Le premier appel réseau reste entièrement à la charge de l'appelant
// (jamais de ce module).
function createSandboxCloudinaryClient() {
  assertSandboxConfigValid();
  assertProcessIsolation();
  const env = readSandboxEnv();
  const cloudinary = require('cloudinary').v2;
  cloudinary.config({ cloud_name: env.cloudName, api_key: env.apiKey, api_secret: env.apiSecret });
  return cloudinary;
}

module.exports = {
  ERROR_CODES, validateSandboxConfig, assertSandboxConfigValid, assertProcessIsolation, createSandboxCloudinaryClient,
};
