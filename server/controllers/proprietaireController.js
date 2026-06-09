const Proprietaire = require('../models/Proprietaire');
const { uploadToCloudinary, destroyFromCloudinary } = require('../config/cloudinary');

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
  try {
    const data = { ...req.body };
    if (req.file) {
      const piece = await uploadPiece(req.file);
      data.pieceIdentite     = piece.url;
      data.pieceIdentiteType = piece.type;
      data.pieceIdentiteNom  = piece.nom;
    }
    const biens = parseBiens(data.biensPropres);
    if (biens) data.biensPropres = biens;
    const p = await Proprietaire.create(data);
    res.status(201).json({ status: 'success', data: { proprietaire: p } });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      const piece = await uploadPiece(req.file);
      data.pieceIdentite     = piece.url;
      data.pieceIdentiteType = piece.type;
      data.pieceIdentiteNom  = piece.nom;
    }
    const biens = parseBiens(data.biensPropres);
    if (biens !== undefined) data.biensPropres = biens;
    const p = await Proprietaire.findByIdAndUpdate(req.params.id, data, {
      new: true, runValidators: true,
    });
    if (!p) return res.status(404).json({ status: 'error', message: 'Propriétaire introuvable' });
    res.json({ status: 'success', data: { proprietaire: p } });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const p = await Proprietaire.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ status: 'error', message: 'Propriétaire introuvable' });
    res.json({ status: 'success', message: 'Propriétaire supprimé' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ── Gestion des biens ─────────────────────────────────────────

exports.addBien = async (req, res) => {
  try {
    const p = await Proprietaire.findById(req.params.id);
    if (!p) return res.status(404).json({ status: 'error', message: 'Propriétaire introuvable' });

    const bienData = { ...req.body, photos: [] };
    p.biensPropres.push(bienData);

    // Upload photos si envoyées
    if (req.files?.length) {
      const idx = p.biensPropres.length - 1;
      const urls = await uploadBienPhotos(req.files, p._id, idx);
      p.biensPropres[idx].photos = urls;
    }

    await p.save();
    res.status(201).json({ status: 'success', data: { proprietaire: p } });
  } catch (err) {
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
  try {
    const p = await Proprietaire.findById(req.params.id);
    if (!p) return res.status(404).json({ status: 'error', message: 'Propriétaire introuvable' });

    const idx = parseInt(req.params.bienIndex, 10);
    if (!p.biensPropres[idx]) return res.status(404).json({ status: 'error', message: 'Bien introuvable' });

    if (!req.files?.length) return res.status(400).json({ status: 'error', message: 'Aucun fichier envoyé' });

    const urls = await uploadBienPhotos(req.files, p._id, idx);
    p.biensPropres[idx].photos.push(...urls);
    await p.save();

    res.json({ status: 'success', data: { urls, bien: p.biensPropres[idx] } });
  } catch (err) {
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
