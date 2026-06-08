const Proprietaire = require('../models/Proprietaire');
const { uploadToCloudinary } = require('../config/cloudinary');

const uploadPiece = async (file) => {
  if (!file) return undefined;
  const result = await uploadToCloudinary(file.buffer, {
    folder: 'altitude-vision/pieces-identite',
    resource_type: 'auto',
  });
  return result.secure_url;
};

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
    if (req.file) data.pieceIdentite = await uploadPiece(req.file);
    const p = await Proprietaire.create(data);
    res.status(201).json({ status: 'success', data: { proprietaire: p } });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.pieceIdentite = await uploadPiece(req.file);
    const p = await Proprietaire.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
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
