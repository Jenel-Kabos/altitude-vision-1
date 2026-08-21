// HOTFIX-MODERATION-PROPERTY-SUBMITTER-CONTACT-1 — normalisation d'un numéro
// de téléphone stocké en base (formats réels observés : "+242 06 123 4567",
// "+242061234567", "06 123 45 67", "242061234567"…) vers la forme attendue
// par wa.me (chiffres uniquement, code pays, sans +). Aucun helper équivalent
// n'existait déjà côté web (les liens wa.me existants — Footer, ChatWidget,
// PropertyDetailPage — pointent tous vers le numéro fixe de l'agence,
// jamais un numéro dynamique d'utilisateur).
//
// Convention Congo-Brazzaville confirmée par les données réelles du projet
// (fixtures + numéro agence "+242068002151") : le "0" initial du numéro
// local à 9 chiffres est CONSERVÉ après le préfixe 242 (jamais retiré),
// contrairement à une stricte notation E.164.
const COUNTRY_CODE_CONGO = '242';
const LOCAL_CONGO_LENGTH = 9; // ex: 061234567 (0 + 8 chiffres)

export function normalizePhoneForWhatsApp(phone) {
  if (typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  // Déjà préfixé 242 (avec ou sans le "0" local conservé) — ne jamais
  // dupliquer le préfixe pays.
  if (digits.startsWith(COUNTRY_CODE_CONGO) && (digits.length === 11 || digits.length === 12)) {
    return digits;
  }

  // Numéro local congolais (sans indicatif) — préfixe 242 sans retirer le 0.
  if (digits.startsWith('0') && digits.length === LOCAL_CONGO_LENGTH) {
    return COUNTRY_CODE_CONGO + digits;
  }

  // Numéro international plausible d'un autre pays — préservé tel quel,
  // jamais préfixé par 242 arbitrairement.
  if (digits.length >= 8 && digits.length <= 15) {
    return digits;
  }

  return null;
}

export function buildWhatsAppLink(phone, message) {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${normalized}${text}`;
}
