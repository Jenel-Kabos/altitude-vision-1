const Transaction = require('../models/Transaction');
const Property = require('../models/Property');
const User = require('../models/User');
const { notify } = require('../services/notificationService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { ALL_STAFF } = require('../utils/roles');
const { finalizeRealEstateTransaction } = require('../services/finance/realEstateTransactionFinalizationService');
const RealEstateReservation = require('../models/RealEstateReservation');
const { releaseReservation } = require('../services/realEstateApplicationService');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');

// SECURITY-CLOSURE-P1-WAVE-1 (P1-I, finding RA-14) — `Transaction` n'a
// aucun champ tenant direct ; `tenantResourceAttributionService` supporte
// déjà nativement `resourceType: 'Transaction'` via `property` (jamais
// utilisé jusqu'ici). Réutilisé pour les listes (via `Property.owner` en
// scope, fail-closed via `requireTenantScopeForStaffOrPlatformOperator`
// route-level) et pour les accès/mutations unitaires (staff uniquement —
// jamais pour le client propriétaire de sa propre transaction).
//
// IMPORTANT (leçon P0-C/encaisserMultiple) — les accès/mutations UNITAIRES
// résolvent le tenant EUX-MÊMES via `resolveTenantForUser` (tolérant : un
// acteur sans AUCUN tenant reste autorisé sur une Transaction dont la
// Property est elle-même non attribuée/legacy, exactement comme
// `assertResourceTenantOrUnattributed` le permet déjà pour les routes `:id`
// de paiementRoutes.js/contratRoutes.js) plutôt que de dépendre d'un garde
// de route fail-closed (`requireTenantScopeForStaffOrPlatformOperator`),
// qui bloquerait à tort un staff sans tenant agissant sur une ressource
// legacy non attribuée — reproduit par
// `transactionCancellationReleasesReservation.mongo.integration.test.js`.
async function scopedPropertyIdsForTenant(req) {
  if (!req.platformTenant) return null;
  return Property.find({ owner: { $in: req.tenantScopeUserIds || [] } }).distinct('_id');
}

async function assertTransactionTenantAccessIfStaff(req, res, tx, isStaffGranted) {
  if (!isStaffGranted) return true;
  const explicitTenantId = req.get?.('X-Platform-Tenant-Id') || req.get?.('X-Tenant-Id') || null;
  const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
  try {
    await assertResourceTenantOrUnattributed({ resourceType: 'Transaction', resource: tx, tenantId: tenant?._id });
    return true;
  } catch (error) {
    res.status(error.statusCode || 404).json({ status: 'fail', message: 'Transaction introuvable.' });
    return false;
  }
}

const calcCommission = (finalAmount, tauxPercent = 10, hasSpecial = false) => {
  const total       = Math.round(finalAmount * (tauxPercent / 100));
  const ownerPayout = hasSpecial ? Math.round(total * 0.30) : 0;
  const agencyNet   = total - ownerPayout;
  return { taux: tauxPercent, total, ownerPayout, agencyNet };
};

// POST /api/transactions
exports.createTransaction = async (req, res) => {
  try {
    const { propertyId, clientId, reservationId, finalAmount, transactionType, tauxCommission = 10, notes } = req.body;

    if (!propertyId || !clientId || !reservationId || finalAmount === undefined || !transactionType) {
      return res.status(400).json({ status: 'fail', message: 'propertyId, clientId, reservationId, finalAmount et transactionType requis.' });
    }

    const amount = Number(finalAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !['vente', 'location'].includes(transactionType)) {
      return res.status(400).json({ status: 'fail', code: 'INVALID_TRANSACTION_INPUT', message: 'Type de transaction ou montant invalide.' });
    }

    const [property, client] = await Promise.all([
      Property.findById(propertyId).select('status statusAdmin availability owner price reservationLock'),
      User.findById(clientId).select('_id'),
    ]);
    if (!property) return res.status(404).json({ status: 'fail', code: 'PROPERTY_NOT_FOUND', message: 'Bien introuvable.' });
    if (!client) return res.status(404).json({ status: 'fail', code: 'CLIENT_NOT_FOUND', message: 'Client introuvable.' });
    if (property.status !== transactionType) {
      return res.status(409).json({ status: 'fail', code: 'TRANSACTION_TYPE_MISMATCH', message: 'Le type de transaction ne correspond pas au bien.' });
    }
    const reservation = await RealEstateReservation.findById(reservationId);
    if (!reservation || reservation.status !== 'active' || reservation.expiresAt <= new Date()
      || reservation.type !== 'sale' || String(reservation.property) !== String(propertyId)
      || String(reservation.client) !== String(clientId)) {
      return res.status(409).json({ status: 'fail', code: 'ACTIVE_RESERVATION_REQUIRED', message: 'Une réservation de vente active et cohérente est requise.' });
    }
    if (property.statusAdmin !== 'Validée' || property.availability !== 'Réservé' || String(property.reservationLock?.reservation) !== String(reservation._id)) {
      return res.status(409).json({ status: 'fail', code: 'PROPERTY_NOT_AVAILABLE', message: 'Ce bien ne peut plus faire l’objet d’une transaction.' });
    }
    if (String(property.owner) === String(clientId)) {
      return res.status(409).json({ status: 'fail', code: 'OWNER_CANNOT_BE_CLIENT', message: 'Le propriétaire ne peut pas être le client de sa propre transaction.' });
    }

    const commission = calcCommission(amount, tauxCommission);

    const transaction = await Transaction.create({
      property: propertyId,
      client:   clientId,
      agent:    req.user.id,
      reservation: reservation._id,
      finalAmount: amount,
      transactionType,
      commission,
      notes,
    });

    await RealEstateReservation.updateOne({ _id: reservation._id, status: 'active', transaction: null }, { $set: { transaction: transaction._id }, $push: { history: { from: 'active', to: 'active', action: 'transaction_created', actor: req.user._id } } });

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
    if (err?.code === 11000) {
      return res.status(409).json({ status: 'fail', code: 'PROPERTY_TRANSACTION_ALREADY_OPEN', message: 'Une transaction active ou finalisée existe déjà pour ce bien.' });
    }
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// GET /api/transactions
exports.getAllTransactions = async (req, res) => {
  try {
    const { status, transactionType } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const scopedPropertyIds = await scopedPropertyIdsForTenant(req);
    const filter = scopedPropertyIds ? { property: { $in: scopedPropertyIds } } : {};
    if (status)          filter.status          = status;
    if (transactionType) filter.transactionType = transactionType;

    const skip  = (page - 1) * limit;
    const total = await Transaction.countDocuments(filter);
    const transactions = await Transaction.find(filter)
      .populate('property', 'title images price address')
      .populate('client',   'name email phone')
      .populate('agent',    'name photo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      status: 'success',
      results: transactions.length,
      pagination: { total, page, pages: Math.ceil(total / limit) },
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
      .sort({ createdAt: -1 })
      .limit(200);

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
    if (!(await assertTransactionTenantAccessIfStaff(req, res, tx, isStaff && !isOwner))) return;

    res.json({ status: 'success', data: { transaction: tx } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// POST /api/transactions/:id/finalize
exports.finalizeTransaction = async (req, res) => {
  try {
    const existingTx = await Transaction.findById(req.params.id);
    if (!existingTx) return res.status(404).json({ status: 'fail', message: 'Transaction introuvable.' });
    if (!(await assertTransactionTenantAccessIfStaff(req, res, existingTx, true))) return;
    const result = await finalizeRealEstateTransaction({ transactionId: req.params.id, actorId: req.user.id || req.user._id, tauxCommission: req.body.tauxCommission, transactionMode: 'auto' });
    const tx = await Transaction.findById(result.transaction._id).populate('property');

    if (!result.idempotent) notify({ recipient: tx.client,
      type:  'transaction_finalized',
      title: 'Transaction finalisée 🎉',
      body:  `Félicitations ! Votre ${tx.transactionType} de "${tx.property.title}" est officiellement finalisée.`,
      data:  { screen: 'Transactions', transactionId: tx._id.toString() },
    }).catch(() => {});

    if (!result.idempotent) logAction({ action: 'Transaction finalisée', description: `${tx.transactionType} "${tx.property.title}"`, module: 'Altimmo', typeAction: 'VALIDATION', auteur: buildAuteur(req.user), cible: { id: String(tx._id), type: 'Transaction', nom: tx.property.title }, req });

    res.json({ status: 'success', data: { transaction: tx, invoice: result.invoice, idempotent: result.idempotent } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ status: 'error', code: err.code, message: err.message });
  }
};

// PATCH /api/transactions/:id/cancel
exports.cancelTransaction = async (req, res) => {
  try {
    const { raison } = req.body;
    const tx = await Transaction.findById(req.params.id).populate('property', 'title');
    if (!tx) return res.status(404).json({ status: 'fail', message: 'Transaction introuvable.' });
    if (!(await assertTransactionTenantAccessIfStaff(req, res, tx, true))) return;
    if (tx.status === 'Réussie') return res.status(400).json({ status: 'fail', message: "Impossible d'annuler une transaction finalisée." });
    if (tx.status === 'Annulée') return res.status(400).json({ status: 'fail', message: 'Déjà annulée.' });

    tx.status       = 'Annulée';
    tx.annulePar    = req.user._id;
    tx.annuleAt     = new Date();
    tx.annuleRaison = raison || '';
    await tx.save();

    // Sans cela, la réservation (unique par transaction — voir
    // Transaction.reservation) reste indéfiniment liée à une transaction
    // morte et le bien reste bloqué en "Réservé" : ni une nouvelle
    // transaction ne peut être créée pour cette réservation, ni le bien ne
    // redevient visible sur le marché, sans une seconde action distincte et
    // non découvrable (annuler la réservation séparément).
    const reservation = await RealEstateReservation.findById(tx.reservation);
    if (reservation) await releaseReservation(reservation, { status: 'cancelled', actorId: req.user._id, reason: raison || 'Transaction annulée' });

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
    const existingTx = await Transaction.findById(req.params.id);
    if (!existingTx) return res.status(404).json({ status: 'fail', message: 'Transaction introuvable.' });
    if (!(await assertTransactionTenantAccessIfStaff(req, res, existingTx, true))) return;
    const tx = await Transaction.findByIdAndUpdate(req.params.id, { notes: req.body.notes }, { new: true });
    res.json({ status: 'success', data: { transaction: tx } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /api/transactions/stats
exports.getStats = async (req, res) => {
  try {
    const scopedPropertyIds = await scopedPropertyIdsForTenant(req);
    const scopeMatch = scopedPropertyIds ? [{ $match: { property: { $in: scopedPropertyIds } } }] : [];
    const [byStatus, byType, totaux] = await Promise.all([
      Transaction.aggregate([...scopeMatch, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Transaction.aggregate([...scopeMatch, { $group: { _id: '$transactionType', count: { $sum: 1 } } }]),
      Transaction.aggregate([
        ...scopeMatch,
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
