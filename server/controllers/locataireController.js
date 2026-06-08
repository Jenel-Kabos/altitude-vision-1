const Locataire = require('../models/Locataire');
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
    if (req.file) data.pieceIdentite = await uploadPiece(req.file);
    const l = await Locataire.create(data);
    res.status(201).json({ status: 'success', data: { locataire: l } });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.pieceIdentite = await uploadPiece(req.file);
    const l = await Locataire.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!l) return res.status(404).json({ status: 'error', message: 'Locataire introuvable' });
    res.json({ status: 'success', data: { locataire: l } });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const l = await Locataire.findByIdAndDelete(req.params.id);
    if (!l) return res.status(404).json({ status: 'error', message: 'Locataire introuvable' });
    res.json({ status: 'success', message: 'Locataire supprimé' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
