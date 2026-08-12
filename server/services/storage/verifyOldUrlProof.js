// STORAGE-LEGACY-1 — "OLD URL PROOF", la preuve la plus importante du
// sprint (§22) : une référence Mongo modifiée ne prouve rien tant que
// l'ancienne URL Cloudinary répond encore 200. Ce module effectue une
// requête HTTP réelle (jamais simulée) et classe le résultat.
const axios = require('axios');

// Codes considérés comme "réellement inaccessible" après migration :
// 401/403 (Cloudinary authenticated sans signature), 404 (ressource
// déplacée/renommée — cas du `rename` avec `to_type`). Un timeout réseau
// n'est PAS une preuve d'inaccessibilité : il doit être rapporté comme
// `unknown`, jamais assimilé à un succès.
const INACCESSIBLE_STATUSES = new Set([401, 403, 404]);

async function probeUrl(url, { timeoutMs = 8000 } = {}) {
  try {
    const response = await axios.get(url, {
      timeout: timeoutMs,
      maxRedirects: 0,
      validateStatus: () => true,
      responseType: 'arraybuffer',
      maxContentLength: 1024, // on ne veut jamais rapatrier le fichier entier, juste le statut
    });
    return { status: response.status, outcome: response.status === 200 ? 'accessible' : (INACCESSIBLE_STATUSES.has(response.status) ? 'inaccessible' : 'unknown') };
  } catch (error) {
    // ECONNABORTED/ENOTFOUND etc. : on ne peut pas conclure côté serveur
    // distant — documenté honnêtement plutôt que déclaré "sécurisé".
    return { status: null, outcome: 'unknown', error: error.code || error.message };
  }
}

// Vérifie qu'une URL legacy publique est bien devenue inaccessible.
// Retourne `true` seulement si la preuve est positive (`inaccessible`),
// jamais sur `unknown` — un doute ne doit jamais compter comme une preuve.
async function verifyOldUrlInaccessible(oldUrl, opts) {
  if (!oldUrl) return true; // rien à prouver s'il n'y avait pas d'URL publique
  const probe = await probeUrl(oldUrl, opts);
  return probe.outcome === 'inaccessible';
}

// Preuve complète à quatre volets, utilisée par la matrice adversariale
// (§33/§22) : OLD URL avant migration → accessible ; OLD URL après →
// inaccessible ; NEW private direct sans signature → inaccessible ; accès
// backend autorisé → laissé aux tests HTTP applicatifs (hors de ce module,
// qui ne fait que sonder des URLs brutes).
async function proveMigrationUrlContract({ oldUrl, newUnsignedUrl }) {
  const [oldUrlProbe, newUrlProbe] = await Promise.all([
    oldUrl ? probeUrl(oldUrl) : Promise.resolve({ outcome: 'n/a' }),
    newUnsignedUrl ? probeUrl(newUnsignedUrl) : Promise.resolve({ outcome: 'n/a' }),
  ]);
  return {
    oldUrl: oldUrlProbe,
    newUnsignedUrl: newUrlProbe,
    proven: oldUrlProbe.outcome === 'inaccessible' && (newUrlProbe.outcome === 'inaccessible' || newUrlProbe.outcome === 'n/a'),
  };
}

module.exports = { probeUrl, verifyOldUrlInaccessible, proveMigrationUrlContract, INACCESSIBLE_STATUSES };
