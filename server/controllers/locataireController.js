const mongoose = require('mongoose');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const RentalManagement = require('../models/RentalManagement');
const Document  = require('../models/Document');
const TenantLinkRequest = require('../models/TenantLinkRequest');
const { uploadPrivateAsset, deletePrivateAsset, readPrivateAsset, safePrivateDescriptor } = require('../services/storage/secureStorageService');
const logger = require('../utils/logger');
const { logAction, buildAuteur } = require('../services/actionLogService');
const tenantLinkService = require('../services/tenantLinkService');
const tenantPortalEmailService = require('../services/tenantPortalEmailService');
const User = require('../models/User');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { streamRemoteDocument } = require('./rentalDocumentController');

const uploadPiece = async (file) => {
  if (!file) return undefined;
  const asset = await uploadPrivateAsset(file.buffer, {
    purpose: 'identity', ownerType: 'Locataire', ownerId: new mongoose.Types.ObjectId(),
    filename: file.originalname, mimeType: file.mimetype,
  });
  const ext = (file.originalname || '').split('.').pop().toLowerCase();
  return {
    asset,
    type: ext === 'pdf' ? 'pdf' : 'image',
    nom:  file.originalname || '',
  };
};

// DOC-ARCH-2 — classement automatique : cet upload est déclenché par le
// workflow métier (fiche locataire), jamais une saisie manuelle dans le
// Centre documentaire — pole/service/categorie sont donc déduits ici,
// jamais demandés à l'utilisateur.
const saveIdentiteDocument = async ({ asset, nom, personneId, personneNom, createdBy, tenant }) => {
  try {
    await Document.create({
      type:      "Pièce d'identité",
      status:    'Accepté',
      refType:   'Locataire',
      refId:     personneId,
      refNom:    personneNom,
      createdBy: createdBy || undefined,
      tenant: tenant || null,
      privateAsset: asset,
      notes:     `Pièce d'identité — ${personneNom} — ${nom || ''}`,
      issueDate: new Date(),
      pole: 'Altimmo',
      service: 'gestion_locative',
      categorie: "Pièces d'identité",
      entityType: 'Locataire',
      entityId: personneId,
      visibility: 'tenant',
    });
  } catch (e) {
    console.error('⚠️ Document pièce identité non créé:', e.message);
  }
};

const serializeLocataire = (value) => {
  const data = value?.toObject ? value.toObject() : { ...value };
  const hasPrivate = Boolean(data.pieceIdentiteAsset);
  const hasDocument = Boolean(hasPrivate || data.pieceIdentite);
  delete data.pieceIdentite;
  delete data.pieceIdentiteAsset;
  return { ...data, identityDocument: hasDocument ? { ...safePrivateDescriptor(value.pieceIdentiteAsset || {}, {
    previewEndpoint: `/api/locataires/${value._id}/identity-document`,
    downloadEndpoint: `/api/locataires/${value._id}/identity-document?download=1`,
  }), legacy: !hasPrivate } : null };
};

exports.downloadIdentityDocument = async (req, res) => {
  try {
    const locataire = await Locataire.findById(req.params.id)
      .select('+pieceIdentiteAsset.publicId +pieceIdentiteAsset.resourceType +pieceIdentiteAsset.deliveryType +pieceIdentiteAsset.version +pieceIdentiteAsset.format');
    if (!locataire) return res.status(404).json({ status: 'fail', message: 'Locataire introuvable' });
    await assertResourceTenantOrUnattributed({ resourceType: 'Locataire', resource: locataire, tenantId: req.platformTenant?._id });
    if (!locataire.pieceIdentiteAsset && locataire.pieceIdentite) {
      return streamRemoteDocument({ url: locataire.pieceIdentite, name: 'identity-document', res, context: { locataireId: locataire._id } });
    }
    if (!locataire.pieceIdentiteAsset) return res.status(404).json({ status: 'fail', message: 'Pièce d’identité privée introuvable.' });
    const buffer = await readPrivateAsset(locataire.pieceIdentiteAsset.toObject());
    res.setHeader('Content-Type', locataire.pieceIdentiteAsset.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="identity-document"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(buffer);
  } catch (error) {
    logger.warn('locataire.identity_document_access_denied', { locataireId: req.params.id, actorId: req.user?.id, error: error.message });
    return res.status(error.statusCode || 403).json({ status: 'fail', message: 'Accès refusé.' });
  }
};

exports.getAll = async (req, res) => {
  try {
    const locataires = await Locataire.find().sort({ createdAt: -1 });
    res.json({ status: 'success', data: { locataires: locataires.map(serializeLocataire) } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const l = await Locataire.findById(req.params.id);
    if (!l) return res.status(404).json({ status: 'error', message: 'Locataire introuvable' });
    res.json({ status: 'success', data: { locataire: serializeLocataire(l) } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ─────────────────────────────────────────────
// Sprint GL-B2 — batch d'aide pour le join bail/paiements/préavis, réutilisé
// par listDossiers ET getDossier (jamais dupliqué).
// ─────────────────────────────────────────────
async function loadDossierData(locataireIds) {
  const contrats = await Contrat.find({ locataire: { $in: locataireIds }, type: 'location' })
    .sort({ createdAt: -1 })
    .populate('bien', 'title address')
    .select('locataire bien statut dateEntree dateFinBail montantLoyer dureePreavis createdAt');

  const contratsByTenant = new Map();
  contrats.forEach((c) => {
    const key = String(c.locataire);
    if (!contratsByTenant.has(key)) contratsByTenant.set(key, []);
    contratsByTenant.get(key).push(c);
  });
  // Bail actif préféré ; sinon le plus récent (contrats déjà triés desc).
  const leaseFor = (tenantId) => {
    const list = contratsByTenant.get(String(tenantId)) || [];
    return list.find((c) => c.statut === 'actif') || list[0] || null;
  };

  const leaseIds = contrats.map((c) => c._id);
  const [paymentRows, rentals] = await Promise.all([
    leaseIds.length ? Paiement.aggregate([
      { $match: { contrat: { $in: leaseIds } } },
      {
        $group: {
          _id: '$contrat',
          expected: { $sum: { $ifNull: ['$montantTotal', '$montant'] } },
          paid: { $sum: { $cond: [{ $eq: ['$statut', 'payé'] }, { $ifNull: ['$montantRecu', '$montant'] }, { $ifNull: ['$montantRecu', 0] }] } },
          overdueCount: { $sum: { $cond: [{ $in: ['$statut', ['impayé', 'en_retard']] }, 1, 0] } },
          nextDueAt: { $min: { $cond: [{ $ne: ['$statut', 'payé'] }, { $dateFromParts: { year: '$annee', month: '$mois', day: { $ifNull: ['$jourEcheance', 1] } } }, null] } },
        },
      },
    ]) : [],
    leaseIds.length ? RentalManagement.find({ activeLease: { $in: leaseIds } }).select('activeLease occupancyStatus plannedExitAt') : [],
  ]);
  const paymentMap = new Map(paymentRows.map((p) => [String(p._id), p]));
  const rentalByLease = new Map(rentals.map((r) => [String(r.activeLease), r]));

  return (tenantId) => {
    const lease = leaseFor(tenantId);
    if (!lease) return { lease: null, paymentSummary: null, activeNotice: null };
    const payment = paymentMap.get(String(lease._id));
    const rental = rentalByLease.get(String(lease._id));
    return {
      lease: {
        _id: lease._id, bien: lease.bien, statut: lease.statut,
        dateEntree: lease.dateEntree, dateFinBail: lease.dateFinBail,
        montantLoyer: lease.montantLoyer, dureePreavis: lease.dureePreavis,
      },
      paymentSummary: payment ? {
        expected: payment.expected || 0, paid: payment.paid || 0,
        remaining: Math.max(0, (payment.expected || 0) - (payment.paid || 0)),
        overdueCount: payment.overdueCount || 0, nextDueAt: payment.nextDueAt || null,
      } : null,
      activeNotice: rental && rental.occupancyStatus === 'sortie_programmee'
        ? { rentalManagementId: rental._id, plannedExitAt: rental.plannedExitAt }
        : null,
    };
  };
}

// ─────────────────────────────────────────────
// GET /api/locataires/dossiers — liste enrichie (mission GL-B2 : identité,
// bien loué, bail, dates, loyer, statut, paiements, solde, préavis actif).
// Recherche + pagination — jamais de duplication du modèle Locataire.
// ─────────────────────────────────────────────
exports.listDossiers = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

    const filter = {};
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ nom: re }, { prenom: re }, { email: re }, { telephone: re }];
    }

    const [locataires, total] = await Promise.all([
      Locataire.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
      Locataire.countDocuments(filter),
    ]);

    const getDossierFor = await loadDossierData(locataires.map((l) => l._id));
    const dossiers = locataires.map((l) => ({ ...serializeLocataire(l), ...getDossierFor(l._id) }));

    res.json({ status: 'success', data: { locataires: dossiers, total, page: pageNum, totalPages: Math.ceil(total / limitNum) } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/locataires/:id/dossier — fiche locataire complète.
// ─────────────────────────────────────────────
exports.getDossier = async (req, res) => {
  try {
    const l = await Locataire.findById(req.params.id);
    if (!l) return res.status(404).json({ status: 'error', message: 'Locataire introuvable' });
    const getDossierFor = await loadDossierData([l._id]);
    res.json({ status: 'success', data: { locataire: { ...serializeLocataire(l), ...getDossierFor(l._id) } } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.create = async (req, res) => {
  let piece = null;
  try {
    const data = { ...req.body };
    if (req.file) {
      piece = await uploadPiece(req.file);
      data.pieceIdentiteAsset = piece.asset;
    }
    const l = await Locataire.create(data);
    if (piece) {
      await saveIdentiteDocument({
        asset: piece.asset, nom: piece.nom,
        personneId: l._id, personneNom: `${l.prenom || ''} ${l.nom || ''}`.trim(),
        createdBy: req.user?._id, tenant: req.platformTenant?._id,
      });
    }
    res.status(201).json({ status: 'success', data: { locataire: serializeLocataire(l) } });
    logAction({
      action: 'Locataire ajouté',
      description: `Locataire ${l.prenom || ''} ${l.nom || ''} enregistré`,
      module: 'GestionLocative',
      typeAction: 'CRÉATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(l._id), type: 'Locataire', nom: `${l.prenom || ''} ${l.nom || ''}`.trim() },
      req,
    });
  } catch (err) {
    if (piece?.asset) {
      await deletePrivateAsset(piece.asset).catch((rollbackError) => {
        logger.error('locataire.cloudinary_rollback_failed', { resourceType: 'Locataire', error: rollbackError.message });
      });
    }
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.update = async (req, res) => {
  let piece = null;
  try {
    const data = { ...req.body };
    if (req.file) {
      piece = await uploadPiece(req.file);
      data.pieceIdentiteAsset = piece.asset;
    }
    const l = await Locataire.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!l) {
      if (piece?.asset) {
        await deletePrivateAsset(piece.asset).catch((rollbackError) => {
          logger.error('locataire.cloudinary_rollback_failed', { resourceType: 'Locataire', error: rollbackError.message });
        });
      }
      return res.status(404).json({ status: 'error', message: 'Locataire introuvable' });
    }
    if (piece) {
      await saveIdentiteDocument({
        asset: piece.asset, nom: piece.nom,
        personneId: l._id, personneNom: `${l.prenom || ''} ${l.nom || ''}`.trim(),
        createdBy: req.user?._id, tenant: req.platformTenant?._id,
      });
    }
    res.json({ status: 'success', data: { locataire: serializeLocataire(l) } });
    logAction({
      action: 'Locataire modifié',
      description: `Locataire ${l.prenom || ''} ${l.nom || ''} mis à jour`,
      module: 'GestionLocative',
      typeAction: 'MODIFICATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(l._id), type: 'Locataire', nom: `${l.prenom || ''} ${l.nom || ''}`.trim() },
      req,
    });
  } catch (err) {
    if (piece?.asset) {
      await deletePrivateAsset(piece.asset).catch((rollbackError) => {
        logger.error('locataire.cloudinary_rollback_failed', { resourceType: 'Locataire', error: rollbackError.message });
      });
    }
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const l = await Locataire.findByIdAndDelete(req.params.id);
    if (!l) return res.status(404).json({ status: 'error', message: 'Locataire introuvable' });
    res.json({ status: 'success', message: 'Locataire supprimé' });
    logAction({
      action: 'Locataire supprimé',
      description: `Locataire ${l.prenom || ''} ${l.nom || ''} supprimé`,
      module: 'GestionLocative',
      typeAction: 'SUPPRESSION',
      auteur: buildAuteur(req.user),
      cible: { id: String(l._id), type: 'Locataire', nom: `${l.prenom || ''} ${l.nom || ''}`.trim() },
      req,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ─────────────────────────────────────────────
// Dette technique GL-B2 — liaison User ↔ Locataire (Missions 1 & 3).
// Toute la logique de rattachement reste dans tenantLinkService.js —
// jamais dupliquée ici.
// ─────────────────────────────────────────────

// POST /api/locataires/:id/invite — le gestionnaire invite un locataire à activer son espace.
exports.invite = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const { request, rawToken, locataire } = await tenantLinkService.inviteTenant({ locataireId: req.params.id, actingUser: req.user });

    if (locataire.email) {
      const activationUrl = `${process.env.FRONTEND_URL || ''}/activer-espace-locataire?token=${rawToken}`;
      tenantPortalEmailService.sendInvitation({ to: locataire.email, name: locataire.prenom, activationUrl }).catch(() => {});
    }

    logAction({
      action: 'Invitation locataire envoyée', description: `Invitation envoyée à ${locataire.prenom || ''} ${locataire.nom || ''}`, module: 'GestionLocative',
      typeAction: 'CREATION', auteur: buildAuteur(req.user),
      cible: { id: String(locataire._id), type: 'Locataire', nom: `${locataire.prenom || ''} ${locataire.nom || ''}`.trim() }, req,
    });

    // Le jeton brut n'est JAMAIS journalisé ni renvoyé au-delà de cette
    // réponse (utile si l'email échoue et que le staff doit relayer le lien
    // manuellement) — voir limite documentée dans RENTAL_MANAGEMENT_V2.md.
    res.status(201).json({ status: 'success', data: { request: { _id: request._id, status: request.status, tokenExpiresAt: request.tokenExpiresAt }, activationToken: rawToken } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ status: (error.statusCode || 500) >= 500 ? 'error' : 'fail', message: error.message });
  }
};

// PATCH /api/locataires/invitations/:requestId/cancel
exports.cancelInvitation = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.requestId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const request = await tenantLinkService.cancelInvitation({ requestId: req.params.requestId, actingUser: req.user });
    res.json({ status: 'success', data: { request } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ status: (error.statusCode || 500) >= 500 ? 'error' : 'fail', message: error.message });
  }
};

// GET /api/locataires/link-requests — demandes de rattachement (self_request) en attente.
exports.listLinkRequests = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const match = {};
    if (req.query.type) match.type = req.query.type;
    if (req.query.status) match.status = req.query.status;
    if (String(req.query.search || '').trim()) {
      const search = String(req.query.search).trim().slice(0, 100);
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      const [tenantIds, userIds] = await Promise.all([
        Locataire.find({ $or: [{ nom: rx }, { prenom: rx }, { email: rx }, { telephone: rx }] }).distinct('_id'),
        User.find({ $or: [{ name: rx }, { email: rx }] }).distinct('_id'),
      ]);
      match.$or = [{ locataire: { $in: tenantIds } }, { user: { $in: userIds } }];
      if (mongoose.isValidObjectId(search)) match.$or.push({ _id: search });
    }
    const [requests, total] = await Promise.all([TenantLinkRequest.find(match)
      .populate('locataire', 'nom prenom email telephone')
      .populate('user', 'name email')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), TenantLinkRequest.countDocuments(match)]);
    res.json({ status: 'success', data: { requests, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// POST /api/locataires/invitations/:requestId/resend — relance avec un nouveau jeton.
exports.resendInvitation = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.requestId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const previous = await TenantLinkRequest.findById(req.params.requestId).populate('locataire');
    if (!previous || previous.type !== 'invitation') return res.status(404).json({ status: 'fail', message: 'Invitation introuvable.' });
    if (previous.status === 'pending') await tenantLinkService.cancelInvitation({ requestId: previous._id, actingUser: req.user });
    const { request, rawToken, locataire } = await tenantLinkService.inviteTenant({ locataireId: previous.locataire._id, actingUser: req.user });
    const activationUrl = `${process.env.FRONTEND_URL || ''}/activer-espace-locataire?token=${rawToken}`;
    await tenantPortalEmailService.sendInvitation({ to: locataire.email, name: locataire.prenom, activationUrl }).catch(() => {});
    res.status(201).json({ status: 'success', data: { request: { _id: request._id, status: request.status, tokenExpiresAt: request.tokenExpiresAt } } });
  } catch (error) { res.status(error.statusCode || 500).json({ status: (error.statusCode || 500) >= 500 ? 'error' : 'fail', message: error.message }); }
};

// PATCH /api/locataires/link-requests/:requestId/review — validation OBLIGATOIRE par un gestionnaire.
exports.reviewLinkRequest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.requestId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const { decision, comment } = req.body;
    const result = await tenantLinkService.reviewLinkRequest({ requestId: req.params.requestId, decision, actingUser: req.user, comment });
    try {
      const query = TenantLinkRequest.findById(req.params.requestId);
      if (query?.populate) {
        const populated = await query.populate('user', 'email name').populate('locataire', 'prenom nom email');
        tenantPortalEmailService.sendLinkDecision({ to: populated?.user?.email, name: populated?.locataire?.prenom || populated?.user?.name, approved: decision === 'approved', comment }).catch(() => {});
      }
    } catch { /* L'email ne bloque jamais la décision métier. */ }

    logAction({
      action: `Demande de rattachement ${decision === 'approved' ? 'approuvée' : 'rejetée'}`, description: `Demande ${req.params.requestId} traitée`, module: 'GestionLocative',
      typeAction: decision === 'approved' ? 'VALIDATION' : 'REJET', auteur: buildAuteur(req.user),
      cible: { id: req.params.requestId, type: 'TenantLinkRequest' }, req,
    });

    res.json({ status: 'success', data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ status: (error.statusCode || 500) >= 500 ? 'error' : 'fail', message: error.message });
  }
};
