// F-U1.J — Analyse anti-malware des justificatifs KYC.
//
// Aucun analyseur n'est disponible aujourd'hui : `getScanner()` renvoie null
// et le stockage KYC reste fermé même si KYC_DOCUMENT_STORAGE_ENABLED=true.
// Un analyseur réel (antivirus / neutralisation de contenu) devra être
// intégré, validé et enregistré au démarrage avant toute ouverture.
// Contrat : `scan(buffer, { mimeType }) → { verdict: 'clean' | 'infected' | 'error', engine }`.

let scanner = null;

function registerKycDocumentScanner(implementation) {
  if (implementation && typeof implementation.scan !== 'function') throw new Error('KYC_SCANNER_INVALID');
  scanner = implementation || null;
}

const getScanner = () => scanner;

module.exports = { registerKycDocumentScanner, getScanner };
