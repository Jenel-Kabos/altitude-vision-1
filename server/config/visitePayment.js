// ALTIMMO-PAY-SAFETY-04A — suspension de l'initiation des paiements en ligne
// (Yabetoo) sur le parcours de visite, non certifié.
//
// Seule l'INITIATION d'un nouveau paiement est concernée : la vérification
// d'un paiement déjà engagé, le règlement manuel par le staff, les listes de
// paiements et les autres flux Yabetoo (PaiementTransaction) restent actifs.
//
// Bloqué par défaut : le flux ne se réactive que par une configuration
// explicite `VISIT_PAYMENT_INITIATION_ENABLED=true`, après certification et
// décision de la Direction.
const isVisitPaymentInitiationEnabled = () => process.env.VISIT_PAYMENT_INITIATION_ENABLED === 'true';

const VISIT_PAYMENT_SUSPENDED = Object.freeze({
  code: 'VISIT_PAYMENT_SUSPENDED',
  message: 'Le paiement en ligne des visites est temporairement indisponible. Contactez l’agence Altimmo pour toute question sur votre visite.',
});

module.exports = { isVisitPaymentInitiationEnabled, VISIT_PAYMENT_SUSPENDED };
