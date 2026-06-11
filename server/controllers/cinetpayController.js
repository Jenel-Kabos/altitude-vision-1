const axios = require('axios');
const Paiement = require('../models/Paiement');

exports.initierPaiement = async (req, res) => {
  try {
    const { montant, description, transactionId, channels = 'ALL', currency = 'XAF' } = req.body;

    if (!montant || !description || !transactionId) {
      return res.status(400).json({ status: 'fail', message: 'montant, description et transactionId requis.' });
    }

    const response = await axios.post('https://api-checkout.cinetpay.com/v2/payment', {
      apikey:         process.env.CINETPAY_API_KEY,
      site_id:        process.env.CINETPAY_SITE_ID,
      transaction_id: transactionId,
      amount:         montant,
      currency,
      description,
      return_url:     'altimmo://paiement/success',
      cancel_url:     'altimmo://paiement/cancel',
      notify_url:     `${process.env.BACKEND_URL}/api/paiements/webhook-cinetpay`,
      channels,
      lang:           'fr',
      metadata:       JSON.stringify({ userId: req.user?._id }),
    });

    res.status(200).json({
      status:        'success',
      paymentUrl:    response.data?.data?.payment_url,
      transactionId,
    });
  } catch (error) {
    console.error('❌ [CinetPay] initierPaiement:', error.response?.data || error.message);
    res.status(500).json({ status: 'error', message: 'Erreur lors de l\'initiation du paiement.' });
  }
};

exports.webhookCinetpay = async (req, res) => {
  try {
    const { transaction_id, status, amount, metadata } = req.body;

    console.log(`📩 [CinetPay] Webhook reçu — TX: ${transaction_id} — Status: ${status}`);

    if (status === 'ACCEPTED') {
      let userId = null;
      try { userId = JSON.parse(metadata || '{}').userId; } catch {}

      // Mettre à jour le paiement en DB si référence trouvée
      await Paiement.findOneAndUpdate(
        { reference: transaction_id },
        { statut: 'payé', datePaiement: new Date(), montantRecu: amount },
      ).catch(() => {});

      // TODO : envoyer notification push + email de confirmation
      console.log(`✅ [CinetPay] Paiement accepté — ${amount} XAF — user: ${userId}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ [CinetPay] webhook:', error.message);
    res.status(200).json({ received: true });
  }
};
