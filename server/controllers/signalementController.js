const asyncHandler = require('express-async-handler');
const Signalement  = require('../models/Signalement');
const { uploadToCloudinary } = require('../config/cloudinary');

exports.creerSignalement = asyncHandler(async (req, res) => {
  const { propertyId, raison, details } = req.body;

  if (!propertyId || !raison) {
    res.status(400);
    throw new Error('propertyId et raison sont obligatoires.');
  }

  const existant = await Signalement.findOne({ property: propertyId, signalePar: req.user._id });
  if (existant) {
    res.status(409);
    throw new Error('Vous avez déjà signalé cette annonce.');
  }

  const preuves = [];
  if (req.files?.length) {
    for (const file of req.files) {
      const result = await uploadToCloudinary(file.buffer, {
        folder:        'altitude-vision/signalements',
        public_id:     `signalement-${propertyId}-${Date.now()}`,
        resource_type: file.mimetype.startsWith('image/') ? 'image' : 'raw',
      });
      preuves.push({ url: result.secure_url, nom: file.originalname, type: file.mimetype });
    }
  }

  const signalement = await Signalement.create({
    property:   propertyId,
    signalePar: req.user._id,
    raison,
    details: details?.slice(0, 500) || '',
    preuves,
  });

  res.status(201).json({
    status: 'success',
    message: "Signalement enregistré. Notre équipe va l'examiner.",
    data: { signalement },
  });
});

exports.getAllSignalements = asyncHandler(async (req, res) => {
  const page  = parseInt(req.query.page,  10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip  = (page - 1) * limit;

  const filter = {};
  if (req.query.statut)     filter.statut   = req.query.statut;
  if (req.query.propertyId) filter.property = req.query.propertyId;

  const [signalements, total] = await Promise.all([
    Signalement.find(filter)
      .populate('property',   'title images address price')
      .populate('signalePar', 'name email')
      .populate('traitePar',  'name')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Signalement.countDocuments(filter),
  ]);

  res.json({
    status: 'success',
    results: signalements.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: signalements,
  });
});

exports.traiterSignalement = asyncHandler(async (req, res) => {
  const { statut } = req.body;

  if (!['traite', 'rejete'].includes(statut)) {
    res.status(400);
    throw new Error('statut doit être "traite" ou "rejete".');
  }

  const signalement = await Signalement.findByIdAndUpdate(
    req.params.id,
    { statut, traitePar: req.user._id, traiteAt: new Date() },
    { new: true }
  );

  if (!signalement) {
    res.status(404);
    throw new Error('Signalement non trouvé.');
  }

  res.json({ status: 'success', data: signalement });
});
