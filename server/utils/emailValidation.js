// server/utils/emailValidation.js — F2.6.3
//
// Remplace le regex historique de User.js (`/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/`),
// vulnérable à un ReDoS catastrophique (backtracking exponentiel sur des entrées comme
// `"a".repeat(30) + "-" + "<24 hex>" + "@example.test"`, reproduit et bloquant le process
// plusieurs minutes). Validation volontairement simple et bornée (pas de RFC 5322 exhaustive) :
// chaque test ci-dessous est en temps linéaire (un seul quantificateur sur une classe de
// caractères, jamais de groupes imbriqués ambigus).
//
// Changement fonctionnel assumé et documenté : l'ancien regex limitait le TLD à 2-3
// caractères (`\.\w{2,3}`), rejetant des TLD valides comme `.info`/`.dev`. Ce correctif
// n'impose plus cette limite arbitraire (accepte tout label de 2 caractères ou plus).

const EMAIL_MAX_LENGTH = 254;
const LOCAL_PART_PATTERN = /^[\w.+-]+$/;
const DOMAIN_LABEL_PATTERN = /^[a-zA-Z0-9-]+$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\x00-\x1F\x7F]/;

function isSimpleValidEmail(value) {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > EMAIL_MAX_LENGTH) return false;
  if (/\s/.test(value)) return false;
  if (CONTROL_CHAR_PATTERN.test(value)) return false;

  const atIndex = value.indexOf('@');
  if (atIndex <= 0) return false;
  if (value.indexOf('@', atIndex + 1) !== -1) return false; // un seul '@'

  const localPart = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);
  if (!localPart || !domain) return false;
  if (!LOCAL_PART_PATTERN.test(localPart)) return false;

  const labels = domain.split('.');
  if (labels.length < 2) return false;
  if (labels.some((label) => label.length === 0 || !DOMAIN_LABEL_PATTERN.test(label))) return false;
  if (labels[labels.length - 1].length < 2) return false; // TLD d'au moins 2 caractères

  return true;
}

module.exports = { isSimpleValidEmail, EMAIL_MAX_LENGTH };
