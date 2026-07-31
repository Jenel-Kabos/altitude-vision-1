const Proprietaire = require('../models/Proprietaire');
const Document     = require('../models/Document');
const { uploadToCloudinary, destroyFromCloudinary } = require('../config/cloudinary');
const { logAction, buildAuteur } = require('../services/actionLogService');
const logger = require('../utils/logger');

const rollbackUploads = async (urls, tag) => {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
  if (!list.length) return;
  await Promise.allSettled(list.map((url) => destroyFromCloudinary(url).catch((rollbackError) => {
    logger.error(`proprietaire.cloudinary_rollback_failed.${tag}`, { url, error: rollbackError.message });
  })));
};

const saveIdentiteDocument = async ({ url, nom, type, personneId, personneNom, createdBy }) => {
  try {
    await Document.create({
      type:      "Pièce d'identité",
      status:    'Accepté',
      refType:   'Proprietaire',
      refId:     personneId,
      refNom:    personneNom,
      createdBy: createdBy || undefined,
      content:   url,
      notes:     `Pièce d'identité — ${personneNom} — ${nom || type || ''}`,
      issueDate: new Date(),
    });
  } catch (e) {
    console.error('⚠️ Document pièce identité non créé:', e.message);
  }
};

// ── Upload helpers ─────────────────────────────────────────────

const uploadPiece = async (file) => {
  if (!file) return undefined;
  const result = await uploadToCloudinary(file.buffer, {
    folder:        'altitude-vision/proprietaires/pieces-identite',
    resource_type: 'auto',
    quality:       undefined, // ne pas compresser les documents PDF
    fetch_format:  undefined,
    width:         undefined,
    crop:          undefined,
  });
  const ext = (file.originalname || '').split('.').pop().toLowerCase();
  return {
    url:  result.secure_url,
    type: ext === 'pdf' ? 'pdf' : (['jpg','jpeg'].includes(ext) ? 'jpeg' : 'png'),
    nom:  file.originalname || '',
  };
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
    res.json({ status: 'success', data: { proprietaires } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const p = await Proprietaire.findById(req.params.id);
    if (!p) return res.status(404).json({ status: 'error', message: 'Propriétaire introuvable' });
    res.json({ status: 'success', data: { proprietaire: p } });
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
      data.pieceIdentite     = piece.url;
      data.pieceIdentiteType = piece.type;
      data.pieceIdentiteNom  = piece.nom;
    }
    const biens = parseBiens(data.biensPropres);
    if (biens) data.biensPropres = biens;
    const p = await Proprietaire.create(data);
    if (piece) {
      await saveIdentiteDocument({
        url: piece.url, nom: piece.nom, type: piece.type,
        personneId: p._id, personneNom: `${p.prenom || ''} ${p.nom || ''}`.trim(),
        createdBy: req.user?._id,
      });
    }
    res.status(201).json({ status: 'success', data: { proprietaire: p } });
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
    await rollbackUploads(piece?.url, 'create');
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.update = async (req, res) => {
  let piece = null;
  try {
    const data = { ...req.body };
    if (req.file) {
      piece = await uploadPiece(req.file);
      data.pieceIdentite     = piece.url;
      data.pieceIdentiteType = piece.type;
      data.pieceIdentiteNom  = piece.nom;
    }
    const biens = parseBiens(data.biensPropres);
    if (biens !== undefined) data.biensPropres = biens;
    const p = await Proprietaire.findByIdAndUpdate(req.params.id, data, {
      new: true, runValidators: true,
    });
    if (!p) {
      await rollbackUploads(piece?.url, 'update');
      return res.status(404).json({ status: 'error', message: 'Propriétaire introuvable' });
    }
    if (piece) {
      await saveIdentiteDocument({
        url: piece.url, nom: piece.nom, type: piece.type,
        personneId: p._id, personneNom: `${p.prenom || ''} ${p.nom || ''}`.trim(),
        createdBy: req.user?._id,
      });
    }
    res.json({ status: 'success', data: { proprietaire: p } });
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
    await rollbackUploads(piece?.url, 'update');
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
    res.json({ status: 'success', data: { proprietaire: p } });
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
