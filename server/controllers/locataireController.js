const mongoose = require('mongoose');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const RentalManagement = require('../models/RentalManagement');
const Document  = require('../models/Document');
const TenantLinkRequest = require('../models/TenantLinkRequest');
const { uploadToCloudinary } = require('../config/cloudinary');
const { logAction, buildAuteur } = require('../services/actionLogService');
const tenantLinkService = require('../services/tenantLinkService');
const { sendEmailViaZoho } = require('../services/emailService');

const uploadPiece = async (file) => {
  if (!file) return undefined;
  const result = await uploadToCloudinary(file.buffer, {
    folder: 'altitude-vision/locataires/pieces-identite',
    resource_type: 'auto',
  });
  const ext = (file.originalname || '').split('.').pop().toLowerCase();
  return {
    url:  result.secure_url,
    type: ext === 'pdf' ? 'pdf' : 'image',
    nom:  file.originalname || '',
  };
};

const saveIdentiteDocument = async ({ url, nom, personneId, personneNom, createdBy }) => {
  try {
    await Document.create({
      type:      "Pièce d'identité",
      status:    'Accepté',
      refType:   'Locataire',
      refId:     personneId,
      refNom:    personneNom,
      createdBy: createdBy || undefined,
      content:   url,
      notes:     `Pièce d'identité — ${personneNom} — ${nom || ''}`,
      issueDate: new Date(),
    });
  } catch (e) {
    console.error('⚠️ Document pièce identité non créé:', e.message);
  }
};

exports.getAll = async (req, res) => {
  try {
    const locataires = await Locataire.find().sort({ createdAt: -1 });
    res.json({ status: 'success', data: { locataires } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const l = await Locataire.findById(req.params.id);
    if (!l) return res.status(404).json({ status: 'error', message: 'Locataire introuvable' });
    res.json({ status: 'success', data: { locataire: l } });
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
    const dossiers = locataires.map((l) => ({ ...l.toObject(), ...getDossierFor(l._id) }));

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
    res.json({ status: 'success', data: { locataire: { ...l.toObject(), ...getDossierFor(l._id) } } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const data = { ...req.body };
    let piece = null;
    if (req.file) {
      piece = await uploadPiece(req.file);
      data.pieceIdentite = piece.url;
    }
    const l = await Locataire.create(data);
    if (piece) {
      await saveIdentiteDocument({
        url: piece.url, nom: piece.nom,
        personneId: l._id, personneNom: `${l.prenom || ''} ${l.nom || ''}`.trim(),
        createdBy: req.user?._id,
      });
    }
    res.status(201).json({ status: 'success', data: { locataire: l } });
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
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const data = { ...req.body };
    let piece = null;
    if (req.file) {
      piece = await uploadPiece(req.file);
      data.pieceIdentite = piece.url;
    }
    const l = await Locataire.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!l) return res.status(404).json({ status: 'error', message: 'Locataire introuvable' });
    if (piece) {
      await saveIdentiteDocument({
        url: piece.url, nom: piece.nom,
        personneId: l._id, personneNom: `${l.prenom || ''} ${l.nom || ''}`.trim(),
        createdBy: req.user?._id,
      });
    }
    res.json({ status: 'success', data: { locataire: l } });
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
      sendEmailViaZoho(
        process.env.ZOHO_FROM_EMAIL,
        locataire.email,
        'Activez votre espace locataire — Altitude Vision',
        `Bonjour ${locataire.prenom || ''},<br/><br/>Vous êtes invité(e) à activer votre espace locataire : <a href="${activationUrl}">${activationUrl}</a><br/>Ce lien expire dans 7 jours.`,
      ).catch(() => {});
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
    const requests = await TenantLinkRequest.find({ type: 'self_request', status: 'pending' })
      .populate('locataire', 'nom prenom email telephone')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.json({ status: 'success', data: { requests } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// PATCH /api/locataires/link-requests/:requestId/review — validation OBLIGATOIRE par un gestionnaire.
exports.reviewLinkRequest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.requestId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const { decision, comment } = req.body;
    const result = await tenantLinkService.reviewLinkRequest({ requestId: req.params.requestId, decision, actingUser: req.user, comment });

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
