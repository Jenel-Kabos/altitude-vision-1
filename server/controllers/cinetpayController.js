// PAY-2 — CinetPay est déprécié par décision produit (Congo-Brazzaville :
// MTN/Airtel directs, manuel, Yabetoo selon corridors, futur PSP carte —
// jamais CinetPay). PAY-1 avait démontré que le webhook ci-dessous
// (`notify_url` de `initierPaiement`) n'appliquait aucune vérification de
// signature ni idempotence, permettant à quiconque devinant une référence de
// paiement de la faire marquer `payé` par un simple POST non authentifié
// (voir `server/docs/PAY1_ARCHITECTURE_REPORT.md` §9 — le comportement
// vulnérable exact reste consultable dans l'historique git de
// `server/__tests__/cinetpayWebhookCharacterization.test.js`, désormais
// réécrit pour prouver la fermeture du P0 plutôt que la vulnérabilité).
//
// Plutôt que de porter la vérification HMAC déjà existante ailleurs
// (`paiementTransactionController.verifyCinetPayWebhook`) sur ce flux, la
// décision produit est de ne plus développer CinetPay du tout : aucune
// nouvelle initiation n'est permise (§7 du mandat PAY-2), et le webhook ne
// peut plus muter aucune donnée (§8) — sans pour autant renvoyer une erreur
// serveur à CinetPay pour d'éventuels événements résiduels sur des paiements
// initiés avant cette dépréciation (ceux-ci, s'ils existent, doivent être
// complétés manuellement par le staff via `POST /api/paiements/:id/marquer-paye`,
// déjà existant — aucune perte de capacité, juste plus de confirmation
// automatique non vérifiable).
exports.initierPaiement = async (req, res) => {
  res.status(410).json({
    status: 'fail',
    code: 'PAYMENT_PROVIDER_DEPRECATED',
    provider: 'cinetpay',
    message: 'CinetPay n\'est plus disponible pour de nouveaux paiements. Utilisez un moyen de paiement actif (Mobile Money, virement, espèces, chèque).',
  });
};

exports.webhookCinetpay = async (req, res) => {
  const { transaction_id: transactionId, status } = req.body || {};
  console.log(`📩 [CinetPay] Webhook reçu sur un provider déprécié — TX: ${transactionId} — Status: ${status} — ignoré, aucune mutation.`);
  res.status(410).json({
    status: 'fail',
    code: 'PAYMENT_PROVIDER_DEPRECATED',
    provider: 'cinetpay',
    message: 'CinetPay est déprécié. Ce webhook n\'effectue plus aucune mutation. Complétez manuellement le paiement concerné si nécessaire.',
  });
};
