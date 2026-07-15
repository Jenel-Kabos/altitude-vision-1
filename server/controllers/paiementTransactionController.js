const axios               = require('axios');
const crypto              = require('crypto');
const Transaction         = require('../models/Transaction');
const PaiementTransaction = require('../models/PaiementTransaction');
const yabetooService      = require('../services/yabetooService');
const { upload, uploadToCloudinary } = require('../config/cloudinary');
const { notify, notifyStaff } = require('../services/notificationService');
const { logAction, buildAuteur } = require('../services/actionLogService');

const CINETPAY_SECRET  = process.env.CINETPAY_SECRET;
const BACKEND_URL      = process.env.BACKEND_URL || 'https://altitude-vision.onrender.com';

const OPERATOR_LABEL = { AIRTEL: 'Airtel Money', MTN: 'MTN Mobile Money' };

// POST /api/transactions/:id/paiements/initier
exports.initierPaiement = async (req, res) => {
  try {
    const { phone, operator, firstName, lastName } = req.body;

    if (!phone || !operator) {
      return res.status(400).json({ status: 'fail', message: 'phone et operator sont requis.' });
    }
    if (!['AIRTEL', 'MTN'].includes(operator)) {
      return res.status(400).json({ status: 'fail', message: 'operator doit être AIRTEL ou MTN.' });
    }

    const tx = await Transaction.findById(req.params.id).populate('property', 'title');
    if (!tx) return res.status(404).json({ status: 'fail', message: 'Transaction introuvable.' });
    if (tx.status === 'Annulée') return res.status(400).json({ status: 'fail', message: 'Transaction annulée.' });
    if (tx.status === 'Réussie') return res.status(400).json({ status: 'fail', message: 'Transaction déjà finalisée.' });

    const existing = await PaiementTransaction.findOne({
      transaction: tx._id,
      statut:      'En attente',
      methode:     'yabetoo_momo',
    });
    if (existing) {
      return res.status(400).json({
        status: 'fail',
        message: 'Un paiement YabetooPay est déjà en attente pour ce dossier.',
        data:    { intentId: existing.yabetooIntentId },
      });
    }

    const paiement = await PaiementTransaction.create({
      transaction: tx._id,
      initiéPar:   req.user._id,
      montant:     tx.finalAmount,
      methode:     'yabetoo_momo',
      provider:    OPERATOR_LABEL[operator],
      operateur:   operator,
      telephone:   phone,
      statut:      'En attente',
    });

    const description = `${tx.transactionType === 'vente' ? 'Achat' : 'Location'} — ${tx.property?.title}`;

    const intent = await yabetooService.createIntent({
      amount:   tx.finalAmount,
      phone,
      operator,
      firstName,
      lastName,
      description,
      metadata: {
        transactionId:         tx._id.toString(),
        paiementTransactionId: paiement._id.toString(),
        userId:                req.user._id.toString(),
      },
    });

    const intentId = intent?.id || intent?.data?.id;
    if (!intentId) throw new Error("YabetooPay n'a pas retourné d'identifiant d'intention.");

    // Déclenche la notification push MoMo sur le téléphone du client
    await yabetooService.confirmIntent(intentId);

    await PaiementTransaction.findByIdAndUpdate(paiement._id, { yabetooIntentId: intentId });
    await Transaction.findByIdAndUpdate(tx._id, {
      paymentStatus: 'en_attente',
      paymentMethod: 'yabetoo_momo',
      $push: { paiements: paiement._id },
    });

    res.json({ status: 'success', data: { intentId, statut: 'En attente' } });
  } catch (err) {
    console.error('❌ [PaiementTx] initierPaiement (Yabetoo):', err.response?.data || err.message);
    res.status(500).json({ status: 'error', message: "Erreur lors de l'initiation du paiement." });
  }
};

// GET /api/transactions/:id/paiements/verifier/:intentId
exports.verifierPaiement = async (req, res) => {
  try {
    const { intentId } = req.params;

    const paiement = await PaiementTransaction.findOne({ yabetooIntentId: intentId });
    if (!paiement) return res.status(404).json({ status: 'fail', message: 'Paiement introuvable.' });

    const intent  = await yabetooService.getIntent(intentId);
    const yStatus = intent?.status || intent?.data?.status;

    let statut = paiement.statut;
    if (yStatus === 'succeeded') statut = 'Payé';
    else if (yStatus === 'failed') statut = 'Échoué';

    if (statut !== paiement.statut) {
      paiement.statut = statut;
      if (statut === 'Payé') paiement.confirméAt = new Date();
      await paiement.save();

      await Transaction.findByIdAndUpdate(paiement.transaction, {
        paymentStatus: statut === 'Payé' ? 'confirmé' : statut === 'Échoué' ? 'échoué' : 'en_attente',
        ...(statut === 'Payé' && { status: 'Paiement en attente' }),
      });
    }

    res.json({
      status: 'success',
      data: { statut, montant: paiement.montant, telephone: paiement.telephone, operateur: paiement.operateur },
    });
  } catch (err) {
    console.error('❌ [PaiementTx] verifierPaiement:', err.response?.data || err.message);
    res.status(500).json({ status: 'error', message: 'Erreur lors de la vérification du paiement.' });
  }
};

// POST /api/transactions/paiements/webhook — pas d'auth JWT (webhook public)
// Pas de vérification de signature en sandbox — à ajouter avant la mise en prod.
exports.webhookYabetoo = async (req, res) => {
  res.status(200).json({ received: true });

  try {
    const { type, data } = req.body;
    const intentId = data?.id;
    if (!intentId) return;

    const statut = type === 'payment_intent.succeeded' ? 'Payé'
                 : type === 'payment_intent.failed'    ? 'Échoué'
                 : null;
    if (!statut) return;

    const paiement = await PaiementTransaction.findOneAndUpdate(
      { yabetooIntentId: intentId },
      { statut, ...(statut === 'Payé' && { confirméAt: new Date() }) },
      { new: true },
    );
    if (!paiement) return;

    const tx = await Transaction.findByIdAndUpdate(
      paiement.transaction,
      {
        paymentStatus: statut === 'Payé' ? 'confirmé' : 'échoué',
        ...(statut === 'Payé' && { status: 'Paiement en attente' }),
      },
      { new: true },
    ).populate('property', 'title');
    if (!tx) return;

    if (statut === 'Payé') {
      notify({ recipient: tx.client,
        type:  'payment_success',
        title: 'Paiement reçu ✅',
        body:  `Votre paiement de ${Number(paiement.montant).toLocaleString('fr-FR')} FCFA pour "${tx.property?.title}" a été confirmé.`,
        data:  { screen: 'Transactions', transactionId: paiement.transaction.toString() },
      }).catch(() => {});

      notifyStaff({
        type:  'transaction_created',
        title: 'Paiement YabetooPay confirmé 💰',
        body:  `Paiement reçu pour "${tx.property?.title}". Finalisation requise.`,
        data:  { screen: 'Transactions', transactionId: paiement.transaction.toString() },
      }).catch(() => {});
    } else {
      notify({ recipient: tx.client,
        type:  'payment_failed',
        title: 'Paiement refusé ❌',
        body:  `Le paiement pour "${tx.property?.title}" a échoué. Veuillez réessayer.`,
        data:  { screen: 'Transactions', transactionId: paiement.transaction.toString() },
      }).catch(() => {});
    }
  } catch (err) {
    console.error('❌ [Webhook Yabetoo] Erreur traitement:', err.message);
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
      notify({ recipient: userId,
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
      notify({ recipient: userId,
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

    notify({ recipient: tx.client,
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

    notify({ recipient: tx.client,
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
