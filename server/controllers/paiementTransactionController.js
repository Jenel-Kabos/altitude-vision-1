const axios               = require('axios');
const crypto              = require('crypto');
const Transaction         = require('../models/Transaction');
const PaiementTransaction = require('../models/PaiementTransaction');
const { upload, uploadToCloudinary } = require('../config/cloudinary');
const { notify, notifyStaff } = require('../services/notificationService');
const { logAction, buildAuteur } = require('../services/actionLogService');

const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY;
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID;
const CINETPAY_SECRET  = process.env.CINETPAY_SECRET;
const BACKEND_URL      = process.env.BACKEND_URL || 'https://altitude-vision.onrender.com';

const PROVIDER_LABEL = {
  mtn:    'MTN Mobile Money',
  airtel: 'Airtel Money',
  orange: 'Orange Money',
  carte:  'Carte bancaire',
};

// POST /api/transactions/:id/paiements/initier
exports.initierCinetpay = async (req, res) => {
  try {
    const { methode, provider } = req.body;

    if (!['cinetpay_mobile', 'cinetpay_carte'].includes(methode)) {
      return res.status(400).json({ status: 'fail', message: 'methode invalide pour CinetPay.' });
    }

    const tx = await Transaction.findById(req.params.id).populate('property', 'title');
    if (!tx) return res.status(404).json({ status: 'fail', message: 'Transaction introuvable.' });
    if (tx.status === 'Annulée') return res.status(400).json({ status: 'fail', message: 'Transaction annulée.' });
    if (tx.status === 'Réussie') return res.status(400).json({ status: 'fail', message: 'Transaction déjà finalisée.' });

    const existing = await PaiementTransaction.findOne({
      transaction: tx._id,
      statut:      'en_attente',
      methode:     { $in: ['cinetpay_mobile', 'cinetpay_carte'] },
    });
    if (existing) {
      return res.status(400).json({
        status: 'fail',
        message: 'Un paiement CinetPay est déjà en attente pour ce dossier.',
        data:    { paymentUrl: existing.paymentUrl },
      });
    }

    const paiement = await PaiementTransaction.create({
      transaction: tx._id,
      initiéPar:   req.user._id,
      montant:     tx.finalAmount,
      methode,
      provider:    PROVIDER_LABEL[provider] || provider || methode,
      statut:      'en_attente',
    });

    const cinetpayTxId = `AV-TX-${tx._id}-${paiement._id}`;

    const response = await axios.post('https://api-checkout.cinetpay.com/v2/payment', {
      apikey:         CINETPAY_API_KEY,
      site_id:        CINETPAY_SITE_ID,
      transaction_id: cinetpayTxId,
      amount:         tx.finalAmount,
      currency:       'XAF',
      description:    `${tx.transactionType === 'vente' ? 'Achat' : 'Location'} — ${tx.property?.title}`,
      return_url:     `altimmo://paiement/success?txId=${tx._id}`,
      cancel_url:     `altimmo://paiement/cancel?txId=${tx._id}`,
      notify_url:     `${BACKEND_URL}/api/transactions/webhook/cinetpay`,
      channels:       methode === 'cinetpay_carte' ? 'CREDIT_CARD' : 'MOBILE_MONEY',
      lang:           'fr',
      metadata:       JSON.stringify({
        transactionId:         tx._id.toString(),
        paiementTransactionId: paiement._id.toString(),
        userId:                req.user._id.toString(),
      }),
    });

    const paymentUrl = response.data?.data?.payment_url;
    if (!paymentUrl) throw new Error("CinetPay n'a pas retourné d'URL de paiement.");

    await PaiementTransaction.findByIdAndUpdate(paiement._id, { cinetpayTransactionId: cinetpayTxId, paymentUrl });
    await Transaction.findByIdAndUpdate(tx._id, {
      paymentStatus: 'en_attente',
      paymentMethod: methode,
      $push: { paiements: paiement._id },
    });

    res.json({ status: 'success', data: { paymentUrl, paiementId: paiement._id } });
  } catch (err) {
    console.error('❌ [PaiementTx] initierCinetpay:', err.response?.data || err.message);
    res.status(500).json({ status: 'error', message: "Erreur lors de l'initiation du paiement CinetPay." });
  }
};

// POST /api/transactions/webhook/cinetpay — pas d'auth JWT
exports.webhookCinetpay = async (req, res) => {
  res.status(200).json({ received: true });

  try {
    const { transaction_id, status, amount, metadata } = req.body;

    if (CINETPAY_SECRET) {
      const received = req.headers['x-cinetpay-signature'] || '';
      const payload  = JSON.stringify(req.body);
      const expected = crypto.createHmac('sha256', CINETPAY_SECRET).update(payload).digest('hex');
      if (received && received !== expected) {
        console.warn('⚠️ [Webhook CinetPay] Signature invalide — ignoré');
        return;
      }
    }

    let meta = {};
    try { meta = JSON.parse(metadata || '{}'); } catch {}
    const { transactionId, paiementTransactionId, userId } = meta;

    if (!transactionId || !paiementTransactionId) return;

    const isSuccess = status === 'ACCEPTED';
    const isFailure = status === 'REFUSED' || status === 'CANCELLED';

    await PaiementTransaction.findByIdAndUpdate(paiementTransactionId, {
      statut:      isSuccess ? 'confirmé' : isFailure ? 'échoué' : 'en_attente',
      cinetpayRaw: req.body,
      ...(isSuccess && { confirméAt: new Date() }),
    });

    const tx = await Transaction.findByIdAndUpdate(
      transactionId,
      {
        paymentStatus: isSuccess ? 'confirmé' : isFailure ? 'échoué' : 'en_attente',
        ...(isSuccess && { status: 'Paiement en attente' }),
      },
      { new: true }
    ).populate('property', 'title');

    if (!tx) return;

    if (isSuccess && userId) {
      notify(userId, {
        type:  'payment_success',
        title: 'Paiement reçu ✅',
        body:  `Votre paiement de ${Number(amount).toLocaleString('fr-FR')} FCFA pour "${tx.property?.title}" a été confirmé.`,
        data:  { screen: 'Transactions', transactionId },
      }).catch(() => {});

      notifyStaff({
        type:  'transaction_created',
        title: 'Paiement CinetPay confirmé 💰',
        body:  `Paiement reçu pour "${tx.property?.title}". Finalisation requise.`,
        data:  { screen: 'Transactions', transactionId },
      }).catch(() => {});
    }

    if (isFailure && userId) {
      notify(userId, {
        type:  'payment_failed',
        title: 'Paiement refusé ❌',
        body:  `Le paiement pour "${tx.property?.title}" a échoué. Veuillez réessayer.`,
        data:  { screen: 'Transactions', transactionId },
      }).catch(() => {});
    }
  } catch (err) {
    console.error('❌ [Webhook CinetPay] Erreur traitement:', err.message);
  }
};

// POST /api/transactions/:id/paiements/virement
exports.soumettreVirement = async (req, res) => {
  try {
    const { referenceBancaire, notes } = req.body;
    if (!referenceBancaire) {
      return res.status(400).json({ status: 'fail', message: 'referenceBancaire est requise.' });
    }

    const tx = await Transaction.findById(req.params.id).populate('property', 'title');
    if (!tx) return res.status(404).json({ status: 'fail', message: 'Transaction introuvable.' });
    if (tx.status === 'Annulée') return res.status(400).json({ status: 'fail', message: 'Transaction annulée.' });

    let preuvePaiement = {};
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, {
        folder:        'altitude-vision/paiements/virements',
        resource_type: 'auto',
      });
      preuvePaiement = { url: result.secure_url, publicId: result.public_id };
    }

    const paiement = await PaiementTransaction.create({
      transaction:       tx._id,
      initiéPar:         req.user._id,
      montant:           tx.finalAmount,
      methode:           'virement',
      provider:          'Virement bancaire',
      statut:            'en_attente',
      referenceBancaire,
      preuvePaiement:    Object.keys(preuvePaiement).length ? preuvePaiement : undefined,
      notes,
    });

    await Transaction.findByIdAndUpdate(tx._id, {
      paymentStatus: 'en_attente',
      paymentMethod: 'virement',
      status:        'Paiement en attente',
      $push:         { paiements: paiement._id },
    });

    notifyStaff({
      type:  'transaction_created',
      title: 'Preuve de virement soumise 🏦',
      body:  `${req.user.name} a soumis un justificatif de virement pour "${tx.property?.title}". Vérification requise.`,
      data:  { screen: 'Transactions', transactionId: tx._id.toString() },
    }).catch(() => {});

    res.status(201).json({ status: 'success', data: { paiement } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// POST /api/transactions/:id/paiements/especes
exports.enregistrerEspecesCheque = async (req, res) => {
  try {
    const { methode, montant, referenceCheque, notes } = req.body;
    if (!['especes', 'cheque'].includes(methode)) {
      return res.status(400).json({ status: 'fail', message: 'methode doit être "especes" ou "cheque".' });
    }

    const tx = await Transaction.findById(req.params.id).populate('property', 'title');
    if (!tx) return res.status(404).json({ status: 'fail', message: 'Transaction introuvable.' });

    const paiement = await PaiementTransaction.create({
      transaction:       tx._id,
      initiéPar:         req.user._id,
      montant:           montant || tx.finalAmount,
      methode,
      provider:          methode === 'cheque' ? 'Chèque' : 'Espèces',
      statut:            'confirmé',
      referenceBancaire: referenceCheque || undefined,
      notes,
      confirméPar:       req.user._id,
      confirméAt:        new Date(),
    });

    await Transaction.findByIdAndUpdate(tx._id, {
      paymentStatus: 'confirmé',
      paymentMethod: methode,
      status:        'Paiement en attente',
      $push:         { paiements: paiement._id },
    });

    notify(tx.client, {
      type:  'payment_success',
      title: 'Paiement enregistré ✅',
      body:  `Votre paiement par ${methode === 'cheque' ? 'chèque' : 'espèces'} pour "${tx.property?.title}" a été enregistré.`,
      data:  { screen: 'Transactions', transactionId: tx._id.toString() },
    }).catch(() => {});

    logAction({ action: 'Paiement enregistré', description: `Paiement ${methode} pour transaction ${tx._id}`, module: 'Altimmo', typeAction: 'PAIEMENT', auteur: buildAuteur(req.user), cible: { id: String(paiement._id), type: 'PaiementTransaction', nom: tx.property?.title }, req });

    res.status(201).json({ status: 'success', data: { paiement } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// PATCH /api/transactions/:txId/paiements/:pId/valider
exports.validerVirement = async (req, res) => {
  try {
    const { action, notes } = req.body;
    if (!['valider', 'rejeter'].includes(action)) {
      return res.status(400).json({ status: 'fail', message: 'action doit être "valider" ou "rejeter".' });
    }

    const paiement = await PaiementTransaction.findById(req.params.pId);
    if (!paiement) return res.status(404).json({ status: 'fail', message: 'Paiement introuvable.' });
    if (paiement.methode !== 'virement') return res.status(400).json({ status: 'fail', message: 'Uniquement pour les virements.' });

    const isValid    = action === 'valider';
    paiement.statut      = isValid ? 'confirmé' : 'échoué';
    paiement.confirméPar = req.user._id;
    paiement.confirméAt  = new Date();
    if (notes) paiement.notes = notes;
    await paiement.save();

    const tx = await Transaction.findByIdAndUpdate(
      req.params.txId,
      {
        paymentStatus: isValid ? 'confirmé' : 'échoué',
        status:        isValid ? 'Paiement en attente' : 'En cours',
      },
      { new: true }
    ).populate('property', 'title');

    notify(tx.client, {
      type:  isValid ? 'payment_success' : 'payment_failed',
      title: isValid ? 'Virement validé ✅' : 'Virement refusé ❌',
      body:  isValid
        ? `Votre virement pour "${tx.property?.title}" a été validé.`
        : `Votre virement pour "${tx.property?.title}" n'a pas pu être validé. Contactez-nous.`,
      data: { screen: 'Transactions', transactionId: tx._id.toString() },
    }).catch(() => {});

    logAction({ action: isValid ? 'Virement validé' : 'Virement refusé', description: `Virement ${action}`, module: 'Altimmo', typeAction: 'VALIDATION', auteur: buildAuteur(req.user), cible: { id: String(paiement._id), type: 'PaiementTransaction', nom: tx.property?.title }, req });

    res.json({ status: 'success', data: { paiement, transaction: tx } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /api/transactions/:id/paiements
exports.getPaiements = async (req, res) => {
  try {
    const paiements = await PaiementTransaction.find({ transaction: req.params.id })
      .populate('initiéPar',   'name')
      .populate('confirméPar', 'name')
      .sort({ createdAt: -1 });

    res.json({ status: 'success', results: paiements.length, data: { paiements } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
