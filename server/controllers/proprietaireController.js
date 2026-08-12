const mongoose = require('mongoose');
const Proprietaire = require('../models/Proprietaire');
const Document     = require('../models/Document');
const { uploadToCloudinary, destroyFromCloudinary } = require('../config/cloudinary');
const { uploadPrivateAsset, deletePrivateAsset, readPrivateAsset, safePrivateDescriptor } = require('../services/storage/secureStorageService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const logger = require('../utils/logger');
const { importBienPropreVersGestion, ImportError } = require('../services/proprietaireGestionImportService');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { streamRemoteDocument } = require('./rentalDocumentController');

const rollbackUploads = async (urls, tag) => {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
  if (!list.length) return;
  await Promise.allSettled(list.map((url) => destroyFromCloudinary(url).catch((rollbackError) => {
    logger.error(`proprietaire.cloudinary_rollback_failed.${tag}`, { url, error: rollbackError.message });
  })));
};
const rollbackPrivate = async (asset, tag) => {
  if (!asset) return;
  await deletePrivateAsset(asset).catch((rollbackError) => {
    logger.error(`proprietaire.private_asset_rollback_failed.${tag}`, { resourceType: 'Proprietaire', error: rollbackError.message });
  });
};

// DOC-ARCH-2 — classement automatique : déclenché par le workflow métier
// (fiche propriétaire), jamais une saisie manuelle.
const saveIdentiteDocument = async ({ asset, nom, type, personneId, personneNom, createdBy, tenant }) => {
  try {
    await Document.create({
      type:      "Pièce d'identité",
      status:    'Accepté',
      refType:   'Proprietaire',
      refId:     personneId,
      refNom:    personneNom,
      createdBy: createdBy || undefined,
      tenant: tenant || null,
      privateAsset: asset,
      notes:     `Pièce d'identité — ${personneNom} — ${nom || type || ''}`,
      issueDate: new Date(),
      pole: 'Altimmo',
      service: 'gestion_locative',
      categorie: "Pièces d'identité",
      entityType: 'Proprietaire',
      entityId: personneId,
      visibility: 'owner',
    });
  } catch (e) {
    console.error('⚠️ Document pièce identité non créé:', e.message);
  }
};

// ── Upload helpers ─────────────────────────────────────────────

const uploadPiece = async (file) => {
  if (!file) return undefined;
  const asset = await uploadPrivateAsset(file.buffer, {
    purpose: 'identity', ownerType: 'Proprietaire', ownerId: new mongoose.Types.ObjectId(),
    filename: file.originalname, mimeType: file.mimetype,
  });
  const ext = (file.originalname || '').split('.').pop().toLowerCase();
  return {
    asset,
    type: ext === 'pdf' ? 'pdf' : (['jpg','jpeg'].includes(ext) ? 'jpeg' : 'png'),
    nom:  file.originalname || '',
  };
};

const serializeProprietaire = (value) => {
  const data = value?.toObject ? value.toObject() : { ...value };
  const hasPrivate = Boolean(data.pieceIdentiteAsset);
  const hasDocument = Boolean(hasPrivate || data.pieceIdentite);
  delete data.pieceIdentite;
  delete data.pieceIdentiteAsset;
  return { ...data, identityDocument: hasDocument ? { ...safePrivateDescriptor(value.pieceIdentiteAsset || {}, {
    previewEndpoint: `/api/proprietaires/${value._id}/identity-document`,
    downloadEndpoint: `/api/proprietaires/${value._id}/identity-document?download=1`,
  }), legacy: !hasPrivate } : null };
};

exports.downloadIdentityDocument = async (req, res) => {
  try {
    const proprietaire = await Proprietaire.findById(req.params.id)
      .select('+pieceIdentiteAsset.publicId +pieceIdentiteAsset.resourceType +pieceIdentiteAsset.deliveryType +pieceIdentiteAsset.version +pieceIdentiteAsset.format');
    if (!proprietaire) return res.status(404).json({ status: 'fail', message: 'Propriétaire introuvable' });
    await assertResourceTenantOrUnattributed({ resourceType: 'Proprietaire', resource: proprietaire, tenantId: req.platformTenant?._id });
    if (!proprietaire.pieceIdentiteAsset && proprietaire.pieceIdentite) {
      return streamRemoteDocument({ url: proprietaire.pieceIdentite, name: proprietaire.pieceIdentiteNom || 'identity-document', res, context: { proprietaireId: proprietaire._id } });
    }
    if (!proprietaire.pieceIdentiteAsset) return res.status(404).json({ status: 'fail', message: 'Pièce d’identité privée introuvable.' });
    const buffer = await readPrivateAsset(proprietaire.pieceIdentiteAsset.toObject());
    res.setHeader('Content-Type', proprietaire.pieceIdentiteAsset.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="identity-document"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(buffer);
  } catch (error) {
    logger.warn('proprietaire.identity_document_access_denied', { proprietaireId: req.params.id, actorId: req.user?.id, error: error.message });
    return res.status(error.statusCode || 403).json({ status: 'fail', message: 'Accès refusé.' });
  }
};

const uploadBienPhotos = async (files = [], proprietaireId, bienIndex) => {
  if (!files.length) return [];
  const uploads = await Promise.all(
    files.map(f =>
      uploadToCloudinary(f.buffer, {
        folder: `altitude-vision/proprietaires/${proprietaireId}/biens/${bienIndex}`,
        resource_type: 'image',
        quality:      'auto',
        fetch_format: 'auto',
        width:        1200,
        crop:         'limit',
      })
    )
  );
  return uploads.map(r => r.secure_url).filter(Boolean);
};

const parseBiens = (raw) => {
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return undefined; }
  }
  return raw;
};

// ── CRUD Proprietaire ─────────────────────────────────────────

exports.getAll = async (req, res) => {
  try {
    const proprietaires = await Proprietaire.find().sort({ createdAt: -1 });
    res.json({ status: 'success', data: { proprietaires: proprietaires.map(serializeProprietaire) } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const p = await Proprietaire.findById(req.params.id);
    if (!p) return res.status(404).json({ status: 'error', message: 'Propriétaire introuvable' });
    res.json({ status: 'success', data: { proprietaire: serializeProprietaire(p) } });
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
      data.pieceIdentiteType = piece.type;
      data.pieceIdentiteNom  = piece.nom;
    }
    const biens = parseBiens(data.biensPropres);
    if (biens) data.biensPropres = biens;
    const p = await Proprietaire.create(data);
    if (piece) {
      await saveIdentiteDocument({
        asset: piece.asset, nom: piece.nom, type: piece.type,
        personneId: p._id, personneNom: `${p.prenom || ''} ${p.nom || ''}`.trim(),
        createdBy: req.user?._id, tenant: req.platformTenant?._id,
      });
    }
    res.status(201).json({ status: 'success', data: { proprietaire: serializeProprietaire(p) } });
    logAction({
      action: 'Propriétaire ajouté',
      description: `Propriétaire ${p.prenom || ''} ${p.nom || ''} enregistré`,
      module: 'GestionLocative',
      typeAction: 'CRÉATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(p._id), type: 'Proprietaire', nom: `${p.prenom || ''} ${p.nom || ''}`.trim() },
      req,
    });
  } catch (err) {
    await rollbackPrivate(piece?.asset, 'create');
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
      data.pieceIdentiteType = piece.type;
      data.pieceIdentiteNom  = piece.nom;
    }
    const biens = parseBiens(data.biensPropres);
    if (biens !== undefined) data.biensPropres = biens;
    const p = await Proprietaire.findByIdAndUpdate(req.params.id, data, {
      new: true, runValidators: true,
    });
    if (!p) {
      await rollbackPrivate(piece?.asset, 'update');
      return res.status(404).json({ status: 'error', message: 'Propriétaire introuvable' });
    }
    if (piece) {
      await saveIdentiteDocument({
        asset: piece.asset, nom: piece.nom, type: piece.type,
        personneId: p._id, personneNom: `${p.prenom || ''} ${p.nom || ''}`.trim(),
        createdBy: req.user?._id, tenant: req.platformTenant?._id,
      });
    }
    res.json({ status: 'success', data: { proprietaire: serializeProprietaire(p) } });
    logAction({
      action: 'Propriétaire modifié',
      description: `Propriétaire ${p.prenom || ''} ${p.nom || ''} mis à jour`,
      module: 'GestionLocative',
      typeAction: 'MODIFICATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(p._id), type: 'Proprietaire', nom: `${p.prenom || ''} ${p.nom || ''}`.trim() },
      req,
    });
  } catch (err) {
    await rollbackPrivate(piece?.asset, 'update');
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const p = await Proprietaire.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ status: 'error', message: 'Propriétaire introuvable' });
    res.json({ status: 'success', message: 'Propriétaire supprimé' });
    logAction({
      action: 'Propriétaire supprimé',
      description: `Propriétaire ${p.prenom || ''} ${p.nom || ''} supprimé`,
      module: 'GestionLocative',
      typeAction: 'SUPPRESSION',
      auteur: buildAuteur(req.user),
      cible: { id: String(p._id), type: 'Proprietaire', nom: `${p.prenom || ''} ${p.nom || ''}`.trim() },
      req,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ── Gestion des biens ─────────────────────────────────────────

exports.addBien = async (req, res) => {
  let uploadedUrls = [];
  try {
    const p = await Proprietaire.findById(req.params.id);
    if (!p) return res.status(404).json({ status: 'error', message: 'Propriétaire introuvable' });

    const bienData = { ...req.body, photos: [] };
    p.biensPropres.push(bienData);

    // Upload photos si envoyées
    if (req.files?.length) {
      const idx = p.biensPropres.length - 1;
      uploadedUrls = await uploadBienPhotos(req.files, p._id, idx);
      p.biensPropres[idx].photos = uploadedUrls;
    }

    await p.save();
    res.status(201).json({ status: 'success', data: { proprietaire: p } });
  } catch (err) {
    await rollbackUploads(uploadedUrls, 'addBien');
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.updateBien = async (req, res) => {
  try {
    const p = await Proprietaire.findById(req.params.id);
    if (!p) return res.status(404).json({ status: 'error', message: 'Propriétaire introuvable' });

    const idx = parseInt(req.params.bienIndex, 10);
    if (!p.biensPropres[idx]) return res.status(404).json({ status: 'error', message: 'Bien introuvable' });

    Object.assign(p.biensPropres[idx], req.body);
    await p.save();
    res.json({ status: 'success', data: { bien: p.biensPropres[idx] } });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.deleteBien = async (req, res) => {
  try {
    const p = await Proprietaire.findById(req.params.id);
    if (!p) return res.status(404).json({ status: 'error', message: 'Propriétaire introuvable' });

    const idx = parseInt(req.params.bienIndex, 10);
    if (!p.biensPropres[idx]) return res.status(404).json({ status: 'error', message: 'Bien introuvable' });

    // Supprimer les photos Cloudinary
    const photos = p.biensPropres[idx].photos || [];
    await Promise.allSettled(photos.map(url => destroyFromCloudinary(url)));

    p.biensPropres.splice(idx, 1);
    await p.save();
    res.json({ status: 'success', data: { proprietaire: serializeProprietaire(p) } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.addBienPhotos = async (req, res) => {
  let uploadedUrls = [];
  try {
    const p = await Proprietaire.findById(req.params.id);
    if (!p) return res.status(404).json({ status: 'error', message: 'Propriétaire introuvable' });

    const idx = parseInt(req.params.bienIndex, 10);
    if (!p.biensPropres[idx]) return res.status(404).json({ status: 'error', message: 'Bien introuvable' });

    if (!req.files?.length) return res.status(400).json({ status: 'error', message: 'Aucun fichier envoyé' });

    uploadedUrls = await uploadBienPhotos(req.files, p._id, idx);
    p.biensPropres[idx].photos.push(...uploadedUrls);
    await p.save();

    res.json({ status: 'success', data: { urls: uploadedUrls, bien: p.biensPropres[idx] } });
  } catch (err) {
    await rollbackUploads(uploadedUrls, 'addBienPhotos');
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.deleteBienPhoto = async (req, res) => {
  try {
    const p = await Proprietaire.findById(req.params.id);
    if (!p) return res.status(404).json({ status: 'error', message: 'Propriétaire introuvable' });

    const bienIdx  = parseInt(req.params.bienIndex, 10);
    const photoIdx = parseInt(req.params.photoIndex, 10);
    if (!p.biensPropres[bienIdx]) return res.status(404).json({ status: 'error', message: 'Bien introuvable' });

    const url = p.biensPropres[bienIdx].photos[photoIdx];
    if (url) await destroyFromCloudinary(url).catch(() => {});

    p.biensPropres[bienIdx].photos.splice(photoIdx, 1);
    await p.save();
    res.json({ status: 'success', data: { bien: p.biensPropres[bienIdx] } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * GL-ARCH-1.1 — Intègre un Proprietaire.biensPropres[] réel dans la Gestion
 * locative : crée un Property + un RentalManagement actif. Réservé au staff
 * (Admin/GestionnaireImmobilier, voir routes). Voir
 * proprietaireGestionImportService.js pour la règle métier complète
 * (résolution du owner, dédoublonnage, complétion des champs manquants).
 */
exports.importBienIntoGestionLocative = async (req, res) => {
  try {
    const result = await importBienPropreVersGestion({
      proprietaireId: req.params.id,
      bienIndex: req.params.bienIndex,
      overrides: req.body || {},
      actor: req.user,
    });
    res.status(result.alreadyImported ? 200 : 201).json({
      status: 'success',
      data: {
        property: result.property,
        rentalManagement: result.rentalManagement,
        alreadyImported: !!result.alreadyImported,
      },
    });
  } catch (err) {
    if (err instanceof ImportError) {
      return res.status(err.statusCode).json({ status: 'fail', code: err.code, message: err.message, ...(err.missingFields && { missingFields: err.missingFields }) });
    }
    res.status(500).json({ status: 'error', message: err.message });
  }
};
