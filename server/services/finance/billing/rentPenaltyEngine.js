// F-U2.11 — Sélection du moteur de pénalités locatives (un seul actif).
//
//   RENT_PENALTY_ENGINE=LEGACY     → ancien moteur (`alerteService`, modèle
//                                    `Paiement`) — valeur par défaut : un
//                                    déploiement de ce code ne change RIEN tant
//                                    que la bascule n'est pas décidée.
//   RENT_PENALTY_ENGINE=CANONICAL  → moteur F-U2.10 (noyau financier) ; l'ancien
//                                    moteur et ses alertes de retard sont neutralisés.
//   toute autre valeur             → DISABLED : aucun moteur ne calcule de
//                                    pénalité (fermeture sûre, jamais deux).
//
// Retour arrière : remettre LEGACY. Les pénalités déjà calculées par l'un ou
// l'autre moteur sont conservées et protégées par des gardes par échéance.

const ENGINES = Object.freeze({ LEGACY: 'LEGACY', CANONICAL: 'CANONICAL', DISABLED: 'DISABLED' });

function activePenaltyEngine(env = process.env) {
  const raw = env.RENT_PENALTY_ENGINE;
  if (raw == null || String(raw).trim() === '') return ENGINES.LEGACY;
  const value = String(raw).trim().toUpperCase();
  if (value === ENGINES.LEGACY || value === ENGINES.CANONICAL) return value;
  return ENGINES.DISABLED;
}

const isLegacyEngineActive = (env) => activePenaltyEngine(env) === ENGINES.LEGACY;
const isCanonicalEngineActive = (env) => activePenaltyEngine(env) === ENGINES.CANONICAL;

module.exports = { ENGINES, activePenaltyEngine, isLegacyEngineActive, isCanonicalEngineActive };
