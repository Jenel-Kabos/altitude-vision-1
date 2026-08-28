const asyncHandler = require('express-async-handler');
const Signalement  = require('../models/Signalement');
const Property     = require('../models/Property');
const { uploadPrivateAsset, readPrivateAsset } = require('../services/storage/secureStorageService');
const { streamRemoteDocument } = require('../services/storage/documentStreamingService');
const { notifyStaff } = require('../services/notificationService');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');

// SECURITY-CLOSURE-P1-WAVE-1 (P1-C, finding RA-07) — même relation
// canonique que litigeController.js : `Signalement.property` -> Property ->
// owner -> OrgMembership. `tenantResourceAttributionService` supporte déjà
// nativement `resourceType: 'Signalement'`.
async function scopedPropertyIdsForTenant(req) {
  if (!req.platformTenant) return null;
  return Property.find({ owner: { $in: req.tenantScopeUserIds || [] } }).distinct('_id');
}

async function assertSignalementTenantAccess(req, res, signalement) {
  if (!req.platformTenant) return;
  try {
    await assertResourceTenantOrUnattributed({ resourceType: 'Signalement', resource: signalement, tenantId: req.platformTenant._id });
  } catch (error) {
    res.status(error.statusCode || 404);
    throw new Error('Signalement non trouvé.');
  }
}

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
      const asset = await uploadPrivateAsset(file.buffer, {
        purpose: 'administrative', ownerType: 'Property', ownerId: propertyId,
        filename: file.originalname, mimeType: file.mimetype,
      });
      preuves.push({ asset, nom: file.originalname, type: file.mimetype });
    }
  }

  const signalement = await Signalement.create({
    property:   propertyId,
    signalePar: req.user._id,
    raison,
    details: details?.slice(0, 500) || '',
    preuves,
  });

  notifyStaff({
    type:  'nouveau_signalement',
    title: '🚨 Nouveau signalement',
    body:  `Signalement reçu : ${raison}`,
    data:  { screen: 'Litiges' },
  }).catch(() => {});

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

  const scopedPropertyIds = await scopedPropertyIdsForTenant(req);
  const filter = {};
  if (req.query.statut) filter.statut = req.query.statut;
  if (req.query.propertyId) {
    // Une valeur explicite reste appliquée, mais seulement si elle est déjà
    // dans le périmètre tenant résolu — jamais un moyen de le contourner.
    filter.property = scopedPropertyIds && !scopedPropertyIds.some((id) => String(id) === String(req.query.propertyId))
      ? { $in: [] }
      : req.query.propertyId;
  } else if (scopedPropertyIds) {
    filter.property = { $in: scopedPropertyIds };
  }

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

  const existing = await Signalement.findById(req.params.id);
  if (!existing) {
    res.status(404);
    throw new Error('Signalement non trouvé.');
  }
  await assertSignalementTenantAccess(req, res, existing);

  const signalement = await Signalement.findByIdAndUpdate(
    req.params.id,
    { statut, traitePar: req.user._id, traiteAt: new Date() },
    { new: true }
  );

  res.json({ status: 'success', data: signalement });
});

exports.downloadProof = asyncHandler(async (req, res) => {
  const signalement = await Signalement.findById(req.params.id)
    .select('+preuves.asset.publicId +preuves.asset.resourceType +preuves.asset.deliveryType +preuves.asset.version +preuves.asset.format');
  if (!signalement) {
    res.status(404);
    throw new Error('Signalement non trouvé.');
  }
  await assertSignalementTenantAccess(req, res, signalement);
  const proof = signalement.preuves?.[Number(req.params.proofIndex)];
  if (!proof) {
    res.status(404);
    throw new Error('Preuve introuvable.');
  }
  if (!proof.asset && proof.url) {
    return streamRemoteDocument({ url: proof.url, name: proof.nom, res, context: { signalementId: signalement._id } });
  }
  if (!proof.asset) {
    res.status(404);
    throw new Error('Preuve introuvable.');
  }
  const buffer = await readPrivateAsset(proof.asset.toObject());
  const safeName = String(proof.nom || 'preuve').replace(/[\r\n"\\]/g, '_');
  res.set({
    'Content-Type': proof.asset.mimeType || proof.type || 'application/octet-stream',
    'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${safeName}"`,
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  }).send(buffer);
});
