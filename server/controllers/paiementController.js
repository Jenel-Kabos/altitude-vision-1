const mongoose = require('mongoose');
const Paiement = require('../models/Paiement');
const Contrat  = require('../models/Contrat');
const Property = require('../models/Property');
const RentalPaymentReceipt = require('../models/RentalPaymentReceipt');
const { verifierPaiementsEnRetard } = require('../services/alerteService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { notifyContractTenant } = require('../services/rentalTenantNotificationService');
const { uploadPrivateAsset, deletePrivateAsset, readPrivateAsset } = require('../services/storage/secureStorageService');
const { runFinancialOperation } = require('../services/finance/financialTransactionService');
const logger = require('../utils/logger');
const { streamRemoteDocument } = require('../services/storage/documentStreamingService');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');

// SECURITY-CLOSURE-P0-WAVE-1 (P0-B, finding RA-02) — `Paiement` n'a aucun
// champ `tenant` direct. IMPORTANT : la frontière tenant canonique déjà
// utilisée par `tenantResourceAttributionService.resolveResourceTenant`
// (appelée par `assertResourceTenantOrUnattributed`, elle-même utilisée par
// le `router.param('id', …)` de ce même fichier) résout le tenant d'un
// Contrat via `Contrat.bien.owner` **et l'appartenance (OrgMembership) de ce
// propriétaire**, PAS via un éventuel champ `Property.tenant` — ce serait
// une frontière parallèle et potentiellement divergente si réinventée ici.
// Réutilise donc exactement la même primitive de scope que
// `rentalManagementController.js` (`resolveScope`/`req.tenantScopeUserIds`,
// peuplé par `requireTenantScopeForStaffOrPlatformOperator`) : l'ensemble
// des utilisateurs membres du tenant résolu, puis les Property dont
// `owner` appartient à cet ensemble.
async function scopedContratIdsForTenant(req) {
  if (!req.platformTenant) return null; // pas de restriction — tenant non résolu (mode plateforme) ou route non tenant-scopée.
  const propertyIds = await Property.find({ owner: { $in: req.tenantScopeUserIds || [] } }).distinct('_id');
  if (propertyIds.length === 0) return [];
  return Contrat.find({ bien: { $in: propertyIds } }).distinct('_id');
}

const safePaiement = (value) => {
  const data = value?.toObject ? value.toObject() : { ...value };
  const hasProof = Boolean(data.preuvePaiement?.asset || data.preuvePaiement?.url);
  delete data.preuvePaiement;
  if (hasProof) data.paymentProof = { canPreview: true, canDownload: true,
    previewEndpoint: `/api/paiements/${data._id}/proof`, downloadEndpoint: `/api/paiements/${data._id}/proof?download=1` };
  return data;
};
const safeReceipt = (value) => { const data = value?.toObject ? value.toObject() : { ...value }; delete data.preuvePaiement; return data; };

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    const scopedContratIds = await scopedContratIdsForTenant(req);
    if (scopedContratIds) filter.contrat = { $in: scopedContratIds };
    if (req.query.contrat) {
      // Une valeur explicite reste appliquée, mais seulement si elle est
      // déjà dans le périmètre tenant résolu ci-dessus — jamais un moyen de
      // le contourner via un paramètre de requête.
      filter.contrat = scopedContratIds && !scopedContratIds.some((id) => String(id) === String(req.query.contrat))
        ? { $in: [] }
        : req.query.contrat;
    }
    if (req.query.statut)  filter.statut  = req.query.statut;
    if (req.query.annee)   filter.annee   = parseInt(req.query.annee, 10);

    // Sprint GL-B2 — pagination optionnelle (comportement inchangé si
    // `page`/`limit` absents, pour ne casser aucun appelant existant).
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));

    let query = Paiement.find(filter)
      .populate({
        path: 'contrat',
        select: 'type adresseBien montantLoyer locataire',
        populate: { path: 'locataire', select: 'nom prenom' },
      })
      .sort({ annee: 1, mois: 1 });
    if (hasPagination) query = query.skip((page - 1) * limit).limit(limit);
    else query = query.limit(200);

    const [paiements, total] = await Promise.all([
      query,
      hasPagination ? Paiement.countDocuments(filter) : Promise.resolve(undefined),
    ]);

    res.json({
      status: 'success',
      data: hasPagination
        ? { paiements: paiements.map(safePaiement), total, page, totalPages: Math.ceil(total / limit) }
        : { paiements: paiements.map(safePaiement) },
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/paiements/stats — statistiques d'encaissement (mission GL-B2).
// Calculs entièrement côté serveur — jamais recalculés côté client.
// ─────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const { annee } = req.query;
    const filter = {};
    const scopedContratIds = await scopedContratIdsForTenant(req);
    if (scopedContratIds) filter.contrat = { $in: scopedContratIds };
    if (annee) filter.annee = parseInt(annee, 10);

    const [grouped] = await Paiement.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAttendu: { $sum: { $ifNull: ['$montantTotal', '$montant'] } },
          totalEncaisse: { $sum: { $cond: [{ $eq: ['$statut', 'payé'] }, { $ifNull: ['$montantRecu', '$montant'] }, { $ifNull: ['$montantRecu', 0] }] } },
          nbPayes: { $sum: { $cond: [{ $eq: ['$statut', 'payé'] }, 1, 0] } },
          nbPartiels: { $sum: { $cond: [{ $eq: ['$statut', 'partiel'] }, 1, 0] } },
          nbImpayes: { $sum: { $cond: [{ $in: ['$statut', ['impayé', 'en_retard']] }, 1, 0] } },
          nbTotal: { $sum: 1 },
        },
      },
    ]);
    const stats = grouped || { totalAttendu: 0, totalEncaisse: 0, nbPayes: 0, nbPartiels: 0, nbImpayes: 0, nbTotal: 0 };
    stats.totalImpaye = Math.max(0, (stats.totalAttendu || 0) - (stats.totalEncaisse || 0));
    stats.tauxEncaissement = stats.totalAttendu > 0 ? Math.round((stats.totalEncaisse / stats.totalAttendu) * 100) : 0;
    res.json({ status: 'success', data: { stats } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const p = await Paiement.findById(req.params.id).populate('contrat');
    if (!p) return res.status(404).json({ status: 'error', message: 'Paiement introuvable' });
    res.json({ status: 'success', data: { paiement: safePaiement(p) } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.downloadProof = async (req, res) => {
  try {
    const paiement = await Paiement.findById(req.params.id)
      .select('+preuvePaiement.asset.publicId +preuvePaiement.asset.resourceType +preuvePaiement.asset.deliveryType +preuvePaiement.asset.version +preuvePaiement.asset.format');
    if (!paiement) return res.status(404).json({ status: 'fail', message: 'Paiement introuvable.' });
    if (!paiement.preuvePaiement?.asset && paiement.preuvePaiement?.url) {
      return streamRemoteDocument({ url: paiement.preuvePaiement.url, name: 'payment-proof', res, context: { paymentId: paiement._id } });
    }
    if (!paiement.preuvePaiement?.asset) return res.status(404).json({ status: 'fail', message: 'Preuve introuvable.' });
    const buffer = await readPrivateAsset(paiement.preuvePaiement.asset.toObject());
    res.setHeader('Content-Type', paiement.preuvePaiement.asset.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="payment-proof"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(buffer);
  } catch (error) {
    logger.warn('rental_payment.proof_access_failed', { paymentId: req.params.id, actorId: req.user?.id, error: error.message });
    return res.status(502).json({ status: 'error', message: 'Impossible de récupérer la preuve.' });
  }
};

exports.update = async (req, res) => {
  try {
    const current = await Paiement.findById(req.params.id);
    if (!current) return res.status(404).json({ status: 'error', message: 'Paiement introuvable' });
    if (current.statut === 'payé' || Number(current.montantRecu) > 0 || current.datePaiement || current.reference) {
      return res.status(409).json({ status: 'fail', code: 'PAYMENT_HISTORY_IMMUTABLE', message: 'Un encaissement enregistré ne peut plus être modifié.' });
    }
    const allowed = ['notes', 'jourEcheance'];
    const updates = Object.fromEntries(allowed.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field)).map((field) => [field, req.body[field]]));
    if (!Object.keys(updates).length) {
      return res.status(422).json({ status: 'fail', message: 'Aucun champ modifiable fourni.' });
    }
    const p = await Paiement.findOneAndUpdate({ _id: current._id, statut: current.statut, montantRecu: current.montantRecu }, updates, {
      new: true, runValidators: true,
    });
    if (!p) return res.status(409).json({ status: 'fail', code: 'PAYMENT_CONCURRENT_UPDATE', message: 'Cette échéance vient d’être modifiée.' });
    res.json({ status: 'success', data: { paiement: safePaiement(p) } });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const current = await Paiement.findById(req.params.id);
    if (!current) return res.status(404).json({ status: 'error', message: 'Paiement introuvable' });
    if (current.statut === 'payé' || current.statut === 'partiel' || Number(current.montantRecu) > 0 || current.datePaiement || current.reference) {
      return res.status(409).json({ status: 'fail', code: 'PAYMENT_HISTORY_IMMUTABLE', message: 'Un encaissement historique ne peut pas être supprimé.' });
    }
    const p = await Paiement.findOneAndDelete({ _id: current._id, statut: { $in: ['impayé', 'en_retard'] }, montantRecu: { $in: [null, 0] } });
    if (!p) return res.status(404).json({ status: 'error', message: 'Paiement introuvable' });
    res.json({ status: 'success', message: 'Paiement supprimé' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ── Marquer comme payé (avec gestion pénalités) ────────────────
// GL-DEBT-1 (Phases 5-7-10) : chaque appel crée désormais aussi un
// RentalPaymentReceipt (encaissement individuel, montant = la part
// INCRÉMENTALE de ce versement, pas le cumul) — Paiement reste la vue
// agrégée "état courant de l'échéance", inchangée pour tous les
// consommateurs existants (Vue d'ensemble, portail locataire, quittances).
// L'écriture Paiement+Reçu est atomique (transaction Mongo réelle avec
// repli si la base ne supporte pas les transactions — même stratégie que le
// reste du codebase). L'upload de preuve, non transactionnel par nature
// (Cloudinary), est annulé explicitement si l'écriture finale échoue.
exports.marquerPaye = async (req, res) => {
  let preuvePaiement;
  try {
    const p = await Paiement.findById(req.params.id);
    if (!p) return res.status(404).json({ status: 'error', message: 'Paiement introuvable' });

    const { montantRecu, datePaiement, modePaiement, reference, notes, idempotencyKey } = req.body;
    const recu = Number(montantRecu);
    if (!Number.isFinite(recu) || recu <= 0) {
      return res.status(422).json({ status: 'fail', message: 'Le montant reçu doit être strictement positif.' });
    }
    if (p.statut === 'payé') {
      return res.status(409).json({ status: 'fail', code: 'PAYMENT_ALREADY_PAID', message: 'Cette échéance est déjà intégralement payée.' });
    }
    const totalDu = Number(p.montantTotal ?? p.montant ?? 0);
    if (totalDu <= 0 || recu > totalDu) {
      return res.status(422).json({ status: 'fail', message: 'Le montant reçu dépasse le montant dû.' });
    }
    const montantAvant = Number(p.montantRecu) || 0;
    if (montantAvant > 0 && recu < montantAvant) {
      return res.status(422).json({ status: 'fail', message: 'Le montant cumulé ne peut pas diminuer.' });
    }
    const montantIncrement = recu - montantAvant;

    let statut      = recu < totalDu ? 'partiel' : 'payé';
    let notesFinale = notes || '';

    if (p.penaliteAppliquee) {
      if (p.penaliteMontant > 0) {
        const mention = `Pénalité de retard incluse : ${p.penaliteMontant.toLocaleString('fr-FR')} FCFA`;
        notesFinale = notesFinale ? `${notesFinale}\n${mention}` : mention;
      }
    }

    // Preuve de paiement optionnelle (upload.single('preuve') sur la route —
    // req.file n'existe que pour une requête multipart réelle, aucun impact
    // sur les appels JSON existants sans pièce jointe).
    if (req.file) {
      const asset = await uploadPrivateAsset(req.file.buffer, {
        purpose: 'financial', ownerType: 'Contrat', ownerId: p.contrat,
        filename: req.file.originalname, mimeType: req.file.mimetype,
      });
      preuvePaiement = { asset };
    }

    let updated;
    let receipt;
    try {
      const result = await runFinancialOperation({ operationName: 'rental.payment.record', transactionMode: 'auto' }, async ({ session }) => {
        const withSession = (query) => (session ? query.session(session) : query);
        const claimed = await withSession(Paiement.findOneAndUpdate(
          { _id: p._id, statut: p.statut, montantRecu: p.montantRecu },
          {
            statut,
            montantRecu: recu,
            ...(datePaiement    && { datePaiement }),
            ...(modePaiement    && { modePaiement }),
            ...(reference       && { reference }),
            ...(notesFinale     && { notes: notesFinale }),
            ...(preuvePaiement  && { preuvePaiement }),
          },
          { new: true },
        ));
        if (!claimed) { const err = new Error('CONCURRENT'); err.code = 'CONCURRENT'; throw err; }
        const receiptData = {
          paiement: p._id, contrat: p.contrat, montant: montantIncrement, datePaiement: datePaiement || new Date(),
          modePaiement, reference, preuvePaiement, auteur: req.user.id, idempotencyKey: idempotencyKey || undefined,
        };
        const [createdReceipt] = session
          ? await RentalPaymentReceipt.create([receiptData], { session })
          : [await RentalPaymentReceipt.create(receiptData)];
        return { claimed, createdReceipt };
      });
      updated = result.claimed;
      receipt = result.createdReceipt;
    } catch (error) {
      // Rollback Cloudinary (Phase 10) : l'upload a réussi mais l'écriture
      // finale a échoué — ne jamais laisser un fichier orphelin, mais ne
      // jamais masquer l'erreur métier d'origine si le rollback lui-même échoue.
      if (preuvePaiement?.asset) {
        await deletePrivateAsset(preuvePaiement.asset).catch((rollbackError) => {
          logger.error('rental_payment.cloudinary_rollback_failed', { resourceType: 'Paiement', error: rollbackError.message });
        });
      }
      if (error.code === 'CONCURRENT' || String(error.message || '').includes('E11000')) {
        return res.status(409).json({ status: 'fail', code: 'PAYMENT_CONCURRENT_UPDATE', message: 'Un autre encaissement vient d’être enregistré sur cette échéance.' });
      }
      throw error;
    }

    await notifyContractTenant(p.contrat, {
      type: 'tenant_payment_recorded', title: 'Paiement locatif enregistré',
      body: `Votre paiement ${updated.mois || ''}/${updated.annee || ''} est ${statut}.`, entityType: 'Paiement', entityId: updated._id,
      dedupeKey: `tenant:payment:${updated._id}:${statut}`, metadata: { paymentId: String(updated._id), status: statut },
    }).catch(() => {});

    res.json({ status: 'success', data: { paiement: safePaiement(updated), receipt: safeReceipt(receipt) } });
    const moisLabel = updated.mois ? updated.mois + '/' + updated.annee : String(updated.annee || '');
    logAction({
      action: 'Paiement enregistré',
      description: `Loyer ${moisLabel} marqué comme ${statut}`,
      module: 'GestionLocative',
      typeAction: 'PAIEMENT',
      auteur: buildAuteur(req.user),
      cible: { id: String(updated._id), type: 'Paiement', nom: `Loyer ${moisLabel}` },
      req,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// POST /api/paiements/encaisser-multiple — GL-DEBT-1.1 : un seul encaissement
// réparti sur PLUSIEURS échéances du même contrat (ex. un locataire règle
// 2 mois de loyer en un seul virement). Tout-ou-rien : si une seule ligne
// échoue (CAS perdue, échéance déjà payée, montant invalide), aucune n'est
// appliquée. Idempotent : rejouer la même `idempotencyKey` renvoie le
// résultat déjà enregistré au lieu de recompter les montants.
exports.encaisserMultiple = async (req, res) => {
  let preuvePaiement;
  try {
    const { contrat, allocations, datePaiement, modePaiement, reference, notes, idempotencyKey } = req.body;
    if (!contrat || !mongoose.isValidObjectId(contrat)) {
      return res.status(422).json({ status: 'fail', message: 'Identifiant de contrat invalide.' });
    }
    // SECURITY-CLOSURE-P0-WAVE-1 (P0-C, finding RA-03) — `contrat` vient du
    // corps de la requête et contournait jusqu'ici le `router.param('id', …)`
    // (TENANT-CERT-2) qui protège les autres routes de ce fichier. Même
    // garde canonique, ici appliqué directement dans le contrôleur avec la
    // même tolérance « non attribué » que ce `router.param` (résolution du
    // tenant de l'ACTEUR via `resolveTenantForUser`, qui peut rester
    // `undefined` sans bloquer — seul un Contrat RÉELLEMENT résolu vers un
    // AUTRE tenant est refusé ; un Contrat legacy sans Property liée
    // (`adresseBien` en texte libre, cf.
    // rentalPaymentMultiEcheanceAllocation.mongo.integration.test.js) reste
    // accessible, exactement comme pour `GET/PUT/DELETE /api/paiements/:id`).
    // Appliqué AVANT toute mutation de `Paiement`/création de
    // `RentalPaymentReceipt` — aucun paiement hors autorité ne doit être
    // encaissé, y compris partiellement.
    const contratDoc = await Contrat.findById(contrat);
    if (!contratDoc) {
      return res.status(404).json({ status: 'fail', message: 'Contrat introuvable.' });
    }
    {
      const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
      const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
      try {
        await assertResourceTenantOrUnattributed({ resourceType: 'Contrat', resource: contratDoc, tenantId: tenant?._id });
      } catch (error) {
        return res.status(error.statusCode || 404).json({ status: 'fail', message: 'Contrat introuvable.' });
      }
    }
    const parsedAllocations = typeof allocations === 'string' ? JSON.parse(allocations) : allocations;
    if (!Array.isArray(parsedAllocations) || parsedAllocations.length === 0) {
      return res.status(422).json({ status: 'fail', message: 'Au moins une allocation échéance/montant est requise.' });
    }
    const cleanAllocations = parsedAllocations.map((a) => ({ paiementId: a.paiementId || a.paiement, montant: Number(a.montant) }));
    if (cleanAllocations.some((a) => !mongoose.isValidObjectId(a.paiementId) || !Number.isFinite(a.montant) || a.montant <= 0)) {
      return res.status(422).json({ status: 'fail', message: 'Chaque allocation doit référencer une échéance valide avec un montant strictement positif.' });
    }
    const paiementIds = cleanAllocations.map((a) => a.paiementId);
    if (new Set(paiementIds.map(String)).size !== paiementIds.length) {
      return res.status(422).json({ status: 'fail', message: 'Une même échéance ne peut apparaître qu\'une seule fois dans un encaissement.' });
    }

    // Idempotence : un rejeu réseau avec la même clé renvoie le résultat déjà
    // enregistré plutôt que de retraiter (et donc potentiellement doubler) l'encaissement.
    if (idempotencyKey) {
      const existing = await RentalPaymentReceipt.find({ paiement: { $in: paiementIds }, idempotencyKey })
        .populate('auteur', 'name');
      if (existing.length > 0) {
        return res.status(200).json({ status: 'success', idempotentReplay: true, data: { receipts: existing } });
      }
    }

    const paiements = await Paiement.find({ _id: { $in: paiementIds } });
    if (paiements.length !== paiementIds.length) {
      return res.status(404).json({ status: 'error', message: 'Une ou plusieurs échéances sont introuvables.' });
    }
    if (paiements.some((p) => String(p.contrat) !== String(contrat))) {
      return res.status(422).json({ status: 'fail', message: 'Toutes les échéances doivent appartenir au même contrat.' });
    }
    const byId = new Map(paiements.map((p) => [String(p._id), p]));
    for (const { paiementId, montant } of cleanAllocations) {
      const p = byId.get(String(paiementId));
      if (p.statut === 'payé') {
        return res.status(409).json({ status: 'fail', code: 'PAYMENT_ALREADY_PAID', message: `L'échéance ${paiementId} est déjà intégralement payée.` });
      }
      const totalDu = Number(p.montantTotal ?? p.montant ?? 0);
      const montantAvant = Number(p.montantRecu) || 0;
      if (totalDu <= 0 || montantAvant + montant > totalDu) {
        return res.status(422).json({ status: 'fail', message: `Le montant alloué à l'échéance ${paiementId} dépasse le solde restant dû.` });
      }
    }

    if (req.file) {
      const asset = await uploadPrivateAsset(req.file.buffer, {
        purpose: 'financial', ownerType: 'Contrat', ownerId: paiements[0]?.contrat,
        filename: req.file.originalname, mimeType: req.file.mimetype,
      });
      preuvePaiement = { asset };
    }

    const encaissementId = new mongoose.Types.ObjectId();
    let receipts;
    try {
      receipts = await runFinancialOperation({ operationName: 'rental.payment.record_multi', transactionMode: 'auto' }, async ({ session }) => {
        const withSession = (query) => (session ? query.session(session) : query);
        const created = [];
        for (const { paiementId, montant } of cleanAllocations) {
          const p = byId.get(String(paiementId));
          const montantAvant = Number(p.montantRecu) || 0;
          const totalDu = Number(p.montantTotal ?? p.montant ?? 0);
          const nouveauMontantRecu = montantAvant + montant;
          const nouveauStatut = nouveauMontantRecu < totalDu ? 'partiel' : 'payé';
          const claimed = await withSession(Paiement.findOneAndUpdate(
            { _id: p._id, statut: p.statut, montantRecu: p.montantRecu },
            {
              statut: nouveauStatut,
              montantRecu: nouveauMontantRecu,
              ...(datePaiement  && { datePaiement }),
              ...(modePaiement  && { modePaiement }),
              ...(reference     && { reference }),
              ...(notes         && { notes }),
              ...(preuvePaiement && { preuvePaiement }),
            },
            { new: true },
          ));
          if (!claimed) { const err = new Error('CONCURRENT'); err.code = 'CONCURRENT'; throw err; }
          const receiptData = {
            paiement: p._id, contrat, montant, datePaiement: datePaiement || new Date(),
            modePaiement, reference, preuvePaiement, auteur: req.user.id,
            idempotencyKey: idempotencyKey || undefined, encaissementId,
          };
          const [createdReceipt] = session
            ? await RentalPaymentReceipt.create([receiptData], { session })
            : [await RentalPaymentReceipt.create(receiptData)];
          created.push(createdReceipt);
        }
        return created;
      });
    } catch (error) {
      if (preuvePaiement?.asset) {
        await deletePrivateAsset(preuvePaiement.asset).catch((rollbackError) => {
          logger.error('rental_payment.cloudinary_rollback_failed', { resourceType: 'Paiement', error: rollbackError.message });
        });
      }
      if (error.code === 'CONCURRENT' || String(error.message || '').includes('E11000')) {
        return res.status(409).json({ status: 'fail', code: 'PAYMENT_CONCURRENT_UPDATE', message: 'Une des échéances vient d’être modifiée par un autre encaissement.' });
      }
      throw error;
    }

    res.json({ status: 'success', data: { receipts: receipts.map(safeReceipt) } });
    logAction({
      action: 'Encaissement multi-échéances enregistré',
      description: `${receipts.length} échéance(s) réglées en un encaissement`,
      module: 'GestionLocative',
      typeAction: 'PAIEMENT',
      auteur: buildAuteur(req.user),
      cible: { id: String(encaissementId), type: 'RentalPaymentReceipt', nom: 'Encaissement multi-échéances' },
      req,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /api/paiements/:id/receipts — historique détaillé des versements
// (Phase 6) : chaque encaissement individuel, confirmé ou annulé.
exports.listReceipts = async (req, res) => {
  try {
    const receipts = await RentalPaymentReceipt.find({ paiement: req.params.id })
      .populate('auteur', 'name').populate('cancelledBy', 'name')
      .sort({ createdAt: -1 });
    const safeReceipts = receipts.map(safeReceipt);
    res.json({ status: 'success', results: receipts.length, data: { receipts: safeReceipts } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// POST /api/paiements/:id/receipts/:receiptId/cancel — annulation contrôlée
// (Phase 8). Jamais une suppression : le reçu reste en base, marqué
// "cancelled", avec motif/auteur/date. Recalcule l'échéance depuis la somme
// des reçus encore confirmés et invalide la quittance si le solde redevient
// impayé (Phase 9). Réservé Admin/GestionnaireImmobilier — jamais
// propriétaire ou locataire (ROLES_PAIEMENTS, plus restrictif, gate déjà la
// route ; ce contrôleur re-vérifie explicitement le sous-ensemble autorisé).
const CANCEL_ROLES = ['Admin', 'GestionnaireImmobilier'];
exports.cancelReceipt = async (req, res) => {
  try {
    if (!CANCEL_ROLES.includes(req.user.role)) {
      return res.status(403).json({ status: 'fail', code: 'FORBIDDEN', message: 'Seul un administrateur ou un gestionnaire immobilier peut annuler un encaissement.' });
    }
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 5) {
      return res.status(422).json({ status: 'fail', code: 'CANCEL_REASON_REQUIRED', message: 'Un motif d’annulation d’au moins 5 caractères est requis.' });
    }
    const p = await Paiement.findById(req.params.id);
    if (!p) return res.status(404).json({ status: 'error', message: 'Paiement introuvable' });

    const cancelled = await RentalPaymentReceipt.findOneAndUpdate(
      { _id: req.params.receiptId, paiement: p._id, statut: 'confirmed' },
      { statut: 'cancelled', cancelledAt: new Date(), cancelledBy: req.user.id, cancelledReason: reason },
      { new: true },
    );
    if (!cancelled) {
      return res.status(409).json({ status: 'fail', code: 'RECEIPT_ALREADY_CANCELLED_OR_MISSING', message: 'Ce reçu est introuvable ou déjà annulé.' });
    }

    const confirmedReceipts = await RentalPaymentReceipt.find({ paiement: p._id, statut: 'confirmed' });
    const nouveauMontantRecu = confirmedReceipts.reduce((sum, r) => sum + r.montant, 0);
    const totalDu = Number(p.montantTotal ?? p.montant ?? 0);
    const nouveauStatut = nouveauMontantRecu <= 0 ? 'impayé' : nouveauMontantRecu < totalDu ? 'partiel' : 'payé';
    const wasFullyPaid = p.statut === 'payé';

    const updatedPaiement = await Paiement.findByIdAndUpdate(
      p._id,
      { montantRecu: nouveauMontantRecu, statut: nouveauStatut },
      { new: true },
    );

    let invalidatedCount = 0;
    if (wasFullyPaid && nouveauStatut !== 'payé') {
      const invalidation = await Contrat.updateOne(
        { _id: p.contrat, 'documents.sourcePaiement': p._id, 'documents.type': 'quittance' },
        { $set: { 'documents.$[elem].invalidated': true, 'documents.$[elem].invalidatedAt': new Date(), 'documents.$[elem].invalidatedReason': `Encaissement annulé : ${reason}` } },
        { arrayFilters: [{ 'elem.sourcePaiement': p._id, 'elem.type': 'quittance', 'elem.invalidated': { $ne: true } }] },
      );
      invalidatedCount = invalidation.modifiedCount;
    }

    res.json({ status: 'success', data: { receipt: cancelled, paiement: updatedPaiement, invalidatedQuittances: invalidatedCount } });

    await notifyContractTenant(p.contrat, {
      type: 'tenant_payment_recorded', title: 'Encaissement annulé',
      body: `Un encaissement pour votre loyer ${updatedPaiement.mois || ''}/${updatedPaiement.annee || ''} a été annulé. Statut actuel : ${nouveauStatut}.`,
      entityType: 'Paiement', entityId: updatedPaiement._id,
      dedupeKey: `tenant:payment:${updatedPaiement._id}:cancelled:${cancelled._id}`,
      metadata: { paymentId: String(updatedPaiement._id), receiptId: String(cancelled._id), status: nouveauStatut },
    }).catch(() => {});

    logAction({
      action: 'Encaissement annulé',
      description: `Reçu ${cancelled._id} annulé (${reason})`,
      module: 'GestionLocative',
      typeAction: 'PAIEMENT',
      auteur: buildAuteur(req.user),
      cible: { id: String(cancelled._id), type: 'RentalPaymentReceipt', nom: `Reçu ${cancelled._id}` },
      req,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ── Déclencher manuellement le calcul des pénalités ────────────
exports.calculerPenalites = async (req, res) => {
  try {
    const result = await verifierPaiementsEnRetard();
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ── Résumé alertes pour le dashboard ───────────────────────────
exports.getAlertes = async (req, res) => {
  try {
    const maintenant = new Date();
    const scopedContratIds = await scopedContratIdsForTenant(req);

    const paiementsRetard = await Paiement.find({
      statut: { $in: ['impayé', 'en_retard'] },
      ...(scopedContratIds ? { contrat: { $in: scopedContratIds } } : {}),
    }).select('retardJours penaliteAppliquee penaliteMontant');

    const nbImpayes     = paiementsRetard.filter(p => (p.retardJours || 0) >= 5).length;
    const nbPenalites   = paiementsRetard.filter(p => p.penaliteAppliquee).length;
    const totalPenalites = paiementsRetard
      .filter(p => p.penaliteAppliquee)
      .reduce((s, p) => s + (p.penaliteMontant || 0), 0);

    const dans30j = new Date(maintenant.getTime() + 30 * 24 * 60 * 60 * 1000);
    const bailsExpiration = await Contrat.countDocuments({
      statut: 'actif',
      type: 'location',
      dateFinBail: { $gte: maintenant, $lte: dans30j },
      ...(scopedContratIds ? { _id: { $in: scopedContratIds } } : {}),
    });

    res.json({ status: 'success', data: { nbImpayes, nbPenalites, totalPenalites, bailsExpiration } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
