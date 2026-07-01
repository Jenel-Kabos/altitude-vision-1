const Locataire = require('../models/Locataire');
const Document  = require('../models/Document');
const { uploadToCloudinary } = require('../config/cloudinary');
const { logAction, buildAuteur } = require('../services/actionLogService');

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
