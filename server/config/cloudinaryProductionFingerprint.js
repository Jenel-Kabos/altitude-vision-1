// CLOUDINARY-SANDBOX-PROVISION-1 — source unique de la "fingerprint"
// Cloudinary de production, utilisée par tous les guards anti-collision
// (aujourd'hui `cloudinarySandbox.js`, demain `certifyCloudinarySandbox.js`).
// Un seul endroit lit cette valeur : jamais recopiée en dur ailleurs.
//
// La fingerprint est le `cloud_name` réellement configuré pour la
// production dans CE dépôt (`CLOUDINARY_CLOUD_NAME`, `server/.env`) — au
// moment de l'audit CLOUDINARY-SANDBOX-CERT-1, sa valeur observée était
// `dop8vzm5z` (confirmée identique à `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
// côté Netlify production). Elle est lue dynamiquement plutôt que
// recopiée en constante figée : si l'environnement de déploiement change
// un jour de compte Cloudinary, ce fichier reste correct sans modification.
function getProductionCloudinaryFingerprint() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || null;
  return { cloudName };
}

module.exports = { getProductionCloudinaryFingerprint };
