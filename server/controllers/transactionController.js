const Transaction = require('../models/Transaction');
const Property    = require('../models/Property');
const Document    = require('../models/Document');
const { notify, notifyStaff } = require('../services/notificationService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { ALL_STAFF } = require('../utils/roles');

const calcCommission = (finalAmount, tauxPercent = 10, hasSpecial = false) => {
  const total       = Math.round(finalAmount * (tauxPercent / 100));
  const ownerPayout = hasSpecial ? Math.round(total * 0.30) : 0;
  const agencyNet   = total - ownerPayout;
  return { taux: tauxPercent, total, ownerPayout, agencyNet };
};

// POST /api/transactions
exports.createTransaction = async (req, res) => {
  try {
    const { propertyId, clientId, finalAmount, transactionType, tauxCommission = 10, notes } = req.body;

    if (!propertyId || !clientId || !finalAmount || !transactionType) {
      return res.status(400).json({ status: 'fail', message: 'propertyId, clientId, finalAmount et transactionType requis.' });
    }

    const commission = calcCommission(finalAmount, tauxCommission);

    const transaction = await Transaction.create({
      property: propertyId,
      client:   clientId,
      agent:    req.user.id,
      finalAmount,
      transactionType,
      commission,
      notes,
    });

    await transaction.populate([
      { path: 'property', select: 'title images price' },
      { path: 'client',   select: 'name email' },
      { path: 'agent',    select: 'name' },
    ]);

    notify({ recipient: clientId,
      type:  'transaction_created',
      title: 'Dossier ouvert 📋',
      body:  `Un dossier de ${transactionType === 'vente' ? 'vente' : 'location'} a été ouvert pour "${transaction.property?.title}".`,
      data:  { screen: 'Transactions', transactionId: transaction._id.toString() },
    }).catch(() => {});

    logAction({ action: 'Transaction créée', description: `Dossier ${transactionType} — ${transaction.property?.title}`, module: 'Altimmo', typeAction: 'CRÉATION', auteur: buildAuteur(req.user), cible: { id: String(transaction._id), type: 'Transaction', nom: transaction.property?.title }, req });

    res.status(201).json({ status: 'success', data: { transaction } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// GET /api/transactions
exports.getAllTransactions = async (req, res) => {
  try {
    const { status, transactionType, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status)          filter.status          = status;
    if (transactionType) filter.transactionType = transactionType;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Transaction.countDocuments(filter);
    const transactions = await Transaction.find(filter)
      .populate('property', 'title images price address')
      .populate('client',   'name email phone')
      .populate('agent',    'name photo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      status: 'success',
      results: transactions.length,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
      data: { transactions },
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /api/transactions/my
exports.getMyTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ client: req.user._id })
      .populate('property', 'title images price type availability')
      .populate('agent',    'name photo')
      .populate({ path: 'paiements', select: 'methode statut montant createdAt provider' })
      .sort({ createdAt: -1 });

    res.json({ status: 'success', results: transactions.length, data: { transactions } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /api/transactions/:id
exports.getTransaction = async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
      .populate('property', 'title images price address type')
      .populate('client',   'name email phone')
      .populate('agent',    'name photo')
      .populate({ path: 'paiements', populate: { path: 'confirméPar', select: 'name' } });

    if (!tx) return res.status(404).json({ status: 'fail', message: 'Transaction introuvable.' });

    const isOwner = tx.client._id.toString() === req.user._id.toString();
    const isStaff = ALL_STAFF.includes(req.user.role);
    if (!isOwner && !isStaff) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });

    res.json({ status: 'success', data: { transaction: tx } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// POST /api/transactions/:id/finalize
exports.finalizeTransaction = async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id).populate('property');
    if (!tx) return res.status(404).json({ status: 'fail', message: 'Transaction introuvable.' });
    if (tx.status === 'Réussie') return res.status(400).json({ status: 'fail', message: 'Déjà finalisée.' });
    if (tx.status === 'Annulée') return res.status(400).json({ status: 'fail', message: 'Transaction annulée — impossible de finaliser.' });

    const { tauxCommission } = req.body;
    const commission = calcCommission(tx.finalAmount, tauxCommission || tx.commission?.taux || 10, tx.property?.hasSpecialCommission);

    await Property.findByIdAndUpdate(tx.property._id, {
      availability: tx.transactionType === 'vente' ? 'Vendu' : 'Loué',
      isPublished: false,
    });

    const invoice = await Document.create({
      type:            'Facture',
      status:          'Envoyé',
      client:          tx.client,
      createdBy:       req.user.id,
      relatedProperty: tx.property._id,
      items: [{
        description: `Commission agence — ${tx.transactionType} de "${tx.property.title}"`,
        quantity:    1,
        unitPrice:   commission.total,
        total:       commission.total,
      }],
      subTotal:    commission.total,
      totalAmount: commission.agencyNet,
      dueDate:     new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    tx.status        = 'Réussie';
    tx.commission    = commission;
    tx.paymentStatus = 'confirmé';
    tx.linkedInvoice = invoice._id;
    await tx.save();

    notify({ recipient: tx.client,
      type:  'transaction_finalized',
      title: 'Transaction finalisée 🎉',
      body:  `Félicitations ! Votre ${tx.transactionType} de "${tx.property.title}" est officiellement finalisée.`,
      data:  { screen: 'Transactions', transactionId: tx._id.toString() },
    }).catch(() => {});

    logAction({ action: 'Transaction finalisée', description: `${tx.transactionType} "${tx.property.title}"`, module: 'Altimmo', typeAction: 'VALIDATION', auteur: buildAuteur(req.user), cible: { id: String(tx._id), type: 'Transaction', nom: tx.property.title }, req });

    res.json({ status: 'success', data: { transaction: tx } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// PATCH /api/transactions/:id/cancel
exports.cancelTransaction = async (req, res) => {
  try {
    const { raison } = req.body;
    const tx = await Transaction.findById(req.params.id).populate('property', 'title');
    if (!tx) return res.status(404).json({ status: 'fail', message: 'Transaction introuvable.' });
    if (tx.status === 'Réussie') return res.status(400).json({ status: 'fail', message: "Impossible d'annuler une transaction finalisée." });
    if (tx.status === 'Annulée') return res.status(400).json({ status: 'fail', message: 'Déjà annulée.' });

    tx.status       = 'Annulée';
    tx.annulePar    = req.user._id;
    tx.annuleAt     = new Date();
    tx.annuleRaison = raison || '';
    await tx.save();

    notify({ recipient: tx.client,
      type:  'transaction_created',
      title: 'Dossier annulé',
      body:  `Votre dossier pour "${tx.property?.title}" a été annulé.${raison ? ` Raison : ${raison}` : ''}`,
      data:  { screen: 'Transactions', transactionId: tx._id.toString() },
    }).catch(() => {});

    res.json({ status: 'success', data: { transaction: tx } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// PATCH /api/transactions/:id/notes
exports.updateNotes = async (req, res) => {
  try {
    const tx = await Transaction.findByIdAndUpdate(req.params.id, { notes: req.body.notes }, { new: true });
    if (!tx) return res.status(404).json({ status: 'fail', message: 'Transaction introuvable.' });
    res.json({ status: 'success', data: { transaction: tx } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /api/transactions/stats
exports.getStats = async (req, res) => {
  try {
    const [byStatus, byType, totaux] = await Promise.all([
      Transaction.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Transaction.aggregate([{ $group: { _id: '$transactionType', count: { $sum: 1 } } }]),
      Transaction.aggregate([
        { $match: { status: 'Réussie' } },
        { $group: {
          _id: null,
          totalMontant:    { $sum: '$finalAmount' },
          totalCommission: { $sum: '$commission.total' },
          totalAgencyNet:  { $sum: '$commission.agencyNet' },
        }},
      ]),
    ]);
    const toMap = (arr) => arr.reduce((acc, v) => { acc[v._id] = v.count; return acc; }, {});
    res.json({ status: 'success', data: { byStatus: toMap(byStatus), byType: toMap(byType), totaux: totaux[0] || {} } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
