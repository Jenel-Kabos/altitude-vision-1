const crypto              = require('crypto');
const Transaction         = require('../models/Transaction');
const PaiementTransaction = require('../models/PaiementTransaction');
const yabetooService      = require('../services/yabetooService');
const { uploadToCloudinary } = require('../config/cloudinary');
const { notify, notifyStaff } = require('../services/notificationService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { ALL_STAFF } = require('../utils/roles');
const { registerProviderEvent, claimProviderEvent, completeProviderEvent, failProviderEvent } = require('../services/finance/financialIdempotencyService');

const OPERATOR_LABEL = { AIRTEL: 'Airtel Money', MTN: 'MTN Mobile Money' };
const YABETOO_WEBHOOK_TOLERANCE_SECONDS = 300;

const canAccessTransaction = (transaction, user) => {
  const clientId = transaction?.client?._id || transaction?.client;
  return Boolean(clientId && String(clientId) === String(user?._id || user?.id)) || ALL_STAFF.includes(user?.role);
};

const denyTransactionAccess = (res) => res.status(403).json({ status: 'fail', message: 'Accès refusé à cette transaction.' });

function verifyYabetooWebhook(req, nowSeconds = Math.floor(Date.now() / 1000)) {
  const secret = process.env.YABETOO_WEBHOOK_SECRET;
  if (!secret) return { ok: false, statusCode: 503, message: 'Webhook Yabetoo non configuré.' };
  const timestamp = String(req.headers['x-yabetoo-webhook-timestamp'] || '');
  const signatureHeader = String(req.headers['x-yabetoo-webhook-signature'] || '');
  const timestampNumber = Number(timestamp);
  if (!timestamp || !Number.isFinite(timestampNumber) || Math.abs(nowSeconds - timestampNumber) > YABETOO_WEBHOOK_TOLERANCE_SECONDS) {
    return { ok: false, statusCode: 401, message: 'Horodatage webhook invalide.' };
  }
  const signature = signatureHeader.split(',').map((part) => part.trim()).find((part) => part.startsWith('v1='))?.slice(3)
    || (signatureHeader.startsWith('v1=') ? signatureHeader.slice(3) : signatureHeader);
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return { ok: false, statusCode: 401, message: 'Signature webhook invalide.' };
  const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : '';
  if (!rawBody) return { ok: false, statusCode: 400, message: 'Corps brut webhook indisponible.' };
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const valid = crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  return valid ? { ok: true } : { ok: false, statusCode: 401, message: 'Signature webhook invalide.' };
}

function verifyCinetPayWebhook(req) {
  const secret = process.env.CINETPAY_SECRET;
  if (!secret) return { ok: false, statusCode: 503, message: 'Webhook CinetPay non configuré.' };
  const received = String(req.headers['x-token'] || '');
  if (!/^[a-f0-9]{64}$/i.test(received)) return { ok: false, statusCode: 401, message: 'Signature webhook invalide.' };
  const fields = [
    'cpm_site_id', 'cpm_trans_id', 'cpm_trans_date', 'cpm_amount', 'cpm_currency', 'signature',
    'payment_method', 'cel_phone_num', 'cpm_phone_prefixe', 'cpm_language', 'cpm_version',
    'cpm_payment_config', 'cpm_page_action', 'cpm_custom', 'cpm_designation', 'cpm_error_message',
  ];
  const payload = fields.map((field) => String(req.body?.[field] ?? '')).join('');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'))
    ? { ok: true }
    : { ok: false, statusCode: 401, message: 'Signature webhook invalide.' };
}

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
    if (!canAccessTransaction(tx, req.user)) return denyTransactionAccess(res);
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
    if (String(paiement.transaction) !== String(req.params.id)) return res.status(404).json({ status: 'fail', message: 'Paiement introuvable.' });
    const transaction = await Transaction.findById(paiement.transaction).select('client');
    if (!transaction) return res.status(404).json({ status: 'fail', message: 'Transaction introuvable.' });
    if (!canAccessTransaction(transaction, req.user)) return denyTransactionAccess(res);

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
exports.webhookYabetoo = async (req, res) => {
  const verification = verifyYabetooWebhook(req);
  if (!verification.ok) return res.status(verification.statusCode).json({ received: false, message: verification.message });
  let providerEvent;
  try {
    const { type, data } = req.body;
    const intentId = data?.id;
    if (!intentId || !type) return res.status(422).json({ received: false, message: 'Événement Yabetoo incomplet.' });
    const providerEventId = String(req.body.id || `${intentId}:${type}`);
    const registered = await registerProviderEvent({ provider: 'yabetoo', providerEventId, providerPaymentId: intentId, providerTransactionId: intentId, eventType: type, payload: req.body, signatureVerified: true, businessOperationKey: `webhook:yabetoo:${providerEventId}` });
    providerEvent = registered.event;
    if (registered.duplicate && providerEvent?.status === 'processed') return res.status(200).json({ received: true, duplicate: true });
    const claimed = await claimProviderEvent(providerEvent._id);
    if (!claimed) return res.status(200).json({ received: true, duplicate: true });

    const statut = type === 'payment_intent.succeeded' ? 'Payé'
                 : type === 'payment_intent.failed'    ? 'Échoué'
                 : null;
    if (!statut) {
      await completeProviderEvent(providerEvent._id, { ignored: true, reason: 'event_type_not_actionable' });
      return res.status(200).json({ received: true, ignored: true });
    }

    const allowedCurrentStatuses = statut === 'Payé'
      ? { $ne: 'Payé' }
      : { $nin: ['Payé', 'Échoué'] };
    const paiement = await PaiementTransaction.findOneAndUpdate(
      { yabetooIntentId: intentId, statut: allowedCurrentStatuses },
      { statut, ...(statut === 'Payé' && { confirméAt: new Date() }) },
      { new: true },
    );
    // Livraison répétée : l'état a déjà été appliqué. Ne pas renvoyer les
    // notifications ni réécrire la transaction.
    if (!paiement) {
      await completeProviderEvent(providerEvent._id, { duplicateTransition: true, paymentStatus: statut });
      return res.status(200).json({ received: true, duplicate: true });
    }

    const tx = await Transaction.findByIdAndUpdate(
      paiement.transaction,
      {
        paymentStatus: statut === 'Payé' ? 'confirmé' : 'échoué',
        ...(statut === 'Payé' && { status: 'Paiement en attente' }),
      },
      { new: true },
    ).populate('property', 'title');
    if (!tx) throw new Error('Transaction liée au paiement introuvable.');

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
    await completeProviderEvent(providerEvent._id, { paymentId: paiement._id, transactionId: tx._id, paymentStatus: statut });
    return res.status(200).json({ received: true });
  } catch (err) {
    if (providerEvent?._id) await failProviderEvent(providerEvent._id, err).catch(() => {});
    console.error('❌ [Webhook Yabetoo] Erreur traitement:', err.message);
    return res.status(err.statusCode || 500).json({ received: false, code: err.code, message: 'Traitement du webhook impossible.' });
  }
};

exports.verifyYabetooWebhook = verifyYabetooWebhook;
exports.verifyCinetPayWebhook = verifyCinetPayWebhook;

// POST /api/transactions/webhook/cinetpay — pas d'auth JWT
exports.webhookCinetpay = async (req, res) => {
  const verification = verifyCinetPayWebhook(req);
  if (!verification.ok) return res.status(verification.statusCode).json({ received: false, message: verification.message });
  let providerEvent;
  try {
    const { status, amount, metadata } = req.body;

    let meta = {};
    try { meta = JSON.parse(metadata || '{}'); } catch {}
    const { transactionId, paiementTransactionId, userId } = meta;

    if (!transactionId || !paiementTransactionId) return res.status(422).json({ received: false, message: 'Métadonnées CinetPay incomplètes.' });
    const providerTransactionId = String(req.body.cpm_trans_id || paiementTransactionId);
    const providerEventId = String(req.body.cpm_event_id || `${providerTransactionId}:${status || req.body.cpm_result || 'unknown'}`);
    const registered = await registerProviderEvent({ provider: 'cinetpay', providerEventId, providerPaymentId: providerTransactionId, providerTransactionId, eventType: status || 'unknown', payload: req.body, signatureVerified: true, businessOperationKey: `webhook:cinetpay:${providerEventId}` });
    providerEvent = registered.event;
    if (registered.duplicate && providerEvent?.status === 'processed') return res.status(200).json({ received: true, duplicate: true });
    const claimed = await claimProviderEvent(providerEvent._id);
    if (!claimed) return res.status(200).json({ received: true, duplicate: true });

    const isSuccess = status === 'ACCEPTED';
    const isFailure = status === 'REFUSED' || status === 'CANCELLED';

    const nextPaymentStatus = isSuccess ? 'confirmé' : isFailure ? 'échoué' : 'en_attente';
    const allowedCurrentStatuses = isSuccess
      ? { $ne: 'confirmé' }
      : isFailure ? { $nin: ['confirmé', 'échoué'] } : { $in: ['en_attente'] };
    const paymentTransition = await PaiementTransaction.findOneAndUpdate({ _id: paiementTransactionId, statut: allowedCurrentStatuses }, {
      statut:      nextPaymentStatus,
      cinetpayRaw: req.body,
      ...(isSuccess && { confirméAt: new Date() }),
    }, { new: true });
    if (!paymentTransition) {
      await completeProviderEvent(providerEvent._id, { duplicateTransition: true, paymentStatus: nextPaymentStatus });
      return res.status(200).json({ received: true, duplicate: true });
    }

    const tx = await Transaction.findByIdAndUpdate(
      transactionId,
      {
        paymentStatus: isSuccess ? 'confirmé' : isFailure ? 'échoué' : 'en_attente',
        ...(isSuccess && { status: 'Paiement en attente' }),
      },
      { new: true }
    ).populate('property', 'title');

    if (!tx) throw new Error('Transaction liée au paiement introuvable.');

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
    await completeProviderEvent(providerEvent._id, { paymentId: paymentTransition._id, transactionId: tx._id, paymentStatus: nextPaymentStatus });
    return res.status(200).json({ received: true });
  } catch (err) {
    if (providerEvent?._id) await failProviderEvent(providerEvent._id, err).catch(() => {});
    console.error('❌ [Webhook CinetPay] Erreur traitement:', err.message);
    return res.status(err.statusCode || 500).json({ received: false, code: err.code, message: 'Traitement du webhook impossible.' });
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
    if (!canAccessTransaction(tx, req.user)) return denyTransactionAccess(res);
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
    if (String(paiement.transaction) !== String(req.params.txId)) return res.status(409).json({ status: 'fail', message: 'Ce paiement n’appartient pas à cette transaction.' });
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
    const transaction = await Transaction.findById(req.params.id).select('client');
    if (!transaction) return res.status(404).json({ status: 'fail', message: 'Transaction introuvable.' });
    if (!canAccessTransaction(transaction, req.user)) return denyTransactionAccess(res);
    const paiements = await PaiementTransaction.find({ transaction: req.params.id })
      .populate('initiéPar',   'name')
      .populate('confirméPar', 'name')
      .sort({ createdAt: -1 });

    res.json({ status: 'success', results: paiements.length, data: { paiements } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
