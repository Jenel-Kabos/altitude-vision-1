'use strict';
// Minimisation avant envoi au fournisseur externe : seules les informations utiles au dialogue partent.
// Téléphones, courriels, numéros d'identité, IBAN, cartes et mots de passe sont masqués.
const RULES = [
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[courriel masqué]'],
  [/(mot de passe|password|code secret|pin)\s*[:=]?\s*\S+/gi, '$1 [masqué]'],
  [/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}\b/g, '[IBAN masqué]'],
  [/\b(?:\d[ -]?){13,19}\b/g, '[numéro masqué]'],
  [/(\+|00)\s?\d{3}[\s.-]?\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g, '[téléphone masqué]'],
  [/\b0[0-9][\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g, '[téléphone masqué]'],
  [/\b(passeport|carte d'identit[ée]|cni|niu)\s*(n°|no|numéro)?\s*[:#]?\s*[A-Z0-9-]{5,}/gi, '$1 [masqué]'],
];
function redact(text) {
  let out = String(text ?? '');
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement);
  return out;
}

module.exports = { redact };
