// server/controllers/accommodationController.js
const mongoose = require('mongoose');
const Accommodation = require('../models/Accommodation');
const RatePlan = require('../models/RatePlan');
const Property = require('../models/Property');
const { evaluateReadiness, serializeAccommodation } = require('../services/accommodationService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { notify } = require('../services/notificationService');

const fail = (res, statusCode, message, extra = {}) =>
  res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message, ...extra });

// bedrooms/bathrooms/amenities sont volontairement absents : Property reste
// leur unique source de vérité (voir Accommodation.js et accommodationService.js).
const ALLOWED_FIELDS = [
  'accommodationType', 'furnished', 'capacity', 'beds',
  'checkInTime', 'checkOutTime', 'minimumStay', 'maximumStay',
  'houseRules', 'cancellationPolicy', 'securityDeposit', 'cleaningFee', 'currency',
];

async function getActiveRates(accommodationId) {
  return RatePlan.find({ accommodation: accommodationId, active: true }).sort({ mode: 1 });
}

// ─────────────────────────────────────────────
// POST /api/accommodations — propriétaire crée le profil hébergement
// ─────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.body.property)) {
      return fail(res, 422, 'Un Property valide est obligatoire.');
    }
    const property = await Property.findById(req.body.property);
    if (!property) return fail(res, 404, 'Bien introuvable.');
    if (property.owner.toString() !== req.user.id.toString() && req.user.role !== 'Admin') {
      return fail(res, 403, "Vous n'êtes pas propriétaire de ce bien.");
    }
    if (property.status !== 'hebergement') {
      return fail(res, 422, "Ce bien n'est pas de type hébergement.");
    }
    if (!req.body.accommodationType || !Accommodation.ACCOMMODATION_TYPES.includes(req.body.accommodationType)) {
      return fail(res, 422, "Type d'hébergement invalide ou manquant.");
    }

    const details = Object.fromEntries(
      ALLOWED_FIELDS.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]),
    );

    let accommodation;
    try {
      accommodation = await Accommodation.create({
        property: property._id,
        createdBy: req.user.id,
        ...details,
      });
    } catch (error) {
      if (error.code === 11000) return fail(res, 409, 'Ce bien possède déjà un profil hébergement.');
      throw error;
    }

    logAction({
      action: 'Hébergement créé',
      description: `Profil hébergement créé pour "${property.title}"`,
      module: 'Altimmo',
      typeAction: 'CREATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(accommodation._id), type: 'Accommodation', nom: property.title },
      req,
    });

    res.status(201).json({ status: 'success', data: { accommodation: serializeAccommodation(accommodation) } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// GET /api/accommodations/mine — les hébergements du propriétaire connecté
// ─────────────────────────────────────────────
exports.mine = async (req, res) => {
  try {
    const accommodations = await Accommodation.find({ createdBy: req.user.id })
      .populate('property', 'title images address status statusAdmin availability price bedrooms bathrooms')
      .sort({ updatedAt: -1 });
    res.json({ status: 'success', data: { accommodations: accommodations.map((a) => serializeAccommodation(a)) } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// GET /api/accommodations/:id
// ─────────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const accommodation = await Accommodation.findById(req.params.id).populate('property');
    if (!accommodation) return fail(res, 404, 'Hébergement introuvable.');
    const isOwner = accommodation.createdBy.toString() === req.user.id.toString();
    const isStaff = ['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'CommunityManager'].includes(req.user.role);
    if (!isOwner && !isStaff) return fail(res, 403, 'Accès refusé.');
    const rates = await getActiveRates(accommodation._id);
    res.json({ status: 'success', data: { accommodation: serializeAccommodation(accommodation, rates) } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/accommodations/:id — propriétaire modifie ses propres données
// ─────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const accommodation = await Accommodation.findById(req.params.id);
    if (!accommodation) return fail(res, 404, 'Hébergement introuvable.');
    if (accommodation.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'Admin') {
      return fail(res, 403, "Vous ne pouvez modifier que vos propres hébergements.");
    }
    ALLOWED_FIELDS.forEach((key) => { if (req.body[key] !== undefined) accommodation[key] = req.body[key]; });
    // Une modification après rejet repart en brouillon, jamais republiée
    // silencieusement — la republication doit repasser par /submit.
    if (accommodation.publicationStatus === 'rejete') {
      accommodation.publicationStatus = 'brouillon';
      accommodation.rejectionReason = '';
    }
    accommodation.updatedBy = req.user.id;
    await accommodation.save();
    res.json({ status: 'success', data: { accommodation: serializeAccommodation(accommodation) } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// POST /api/accommodations/:id/submit — propriétaire soumet à validation
// ─────────────────────────────────────────────
exports.submit = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const accommodation = await Accommodation.findById(req.params.id).populate('property', 'bedrooms bathrooms');
    if (!accommodation) return fail(res, 404, 'Hébergement introuvable.');
    if (accommodation.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'Admin') {
      return fail(res, 403, "Vous ne pouvez soumettre que vos propres hébergements.");
    }
    if (!['brouillon', 'rejete'].includes(accommodation.publicationStatus)) {
      return fail(res, 409, 'Cet hébergement a déjà été soumis.');
    }
    const readiness = evaluateReadiness(accommodation, accommodation.property);
    if (!readiness.ready) {
      return fail(res, 422, 'Informations incomplètes.', { readiness });
    }
    accommodation.publicationStatus = 'soumis';
    accommodation.submittedAt = new Date();
    accommodation.rejectionReason = '';
    await accommodation.save();

    logAction({
      action: 'Hébergement soumis',
      description: `Hébergement ${accommodation._id} soumis à validation`,
      module: 'Altimmo',
      typeAction: 'MODIFICATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(accommodation._id), type: 'Accommodation' },
      req,
    });

    res.json({ status: 'success', data: { accommodation: serializeAccommodation(accommodation) } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// GET /api/accommodations/status/pending — staff : hébergements soumis à validation
// (même convention que GET /api/properties/status/pending)
// ─────────────────────────────────────────────
exports.pending = async (req, res) => {
  try {
    const accommodations = await Accommodation.find({ publicationStatus: 'soumis' })
      .populate('property', 'title images address owner bedrooms bathrooms')
      .sort({ submittedAt: 1 });
    res.json({ status: 'success', data: { accommodations: accommodations.map((a) => serializeAccommodation(a)) } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/accommodations/:id/:action — staff valide|rejette (même
// convention que PATCH /api/properties/:id/:action)
// ─────────────────────────────────────────────
exports.reviewDecision = async (req, res) => {
  try {
    const { id, action } = req.params;
    if (!mongoose.isValidObjectId(id)) return fail(res, 400, 'Identifiant invalide.');
    let newStatus;
    if (action === 'validate') newStatus = 'publie';
    else if (action === 'reject') newStatus = 'rejete';
    else return fail(res, 400, 'Action invalide (validate ou reject attendu).');

    const accommodation = await Accommodation.findById(id).populate('property', 'title owner');
    if (!accommodation) return fail(res, 404, 'Hébergement introuvable.');
    if (accommodation.publicationStatus !== 'soumis') {
      return fail(res, 409, 'Seul un hébergement soumis peut être validé ou rejeté.');
    }
    if (newStatus === 'rejete' && !String(req.body.reason || '').trim()) {
      return fail(res, 422, 'Un motif de rejet est requis.');
    }

    accommodation.publicationStatus = newStatus;
    accommodation.reviewedBy = req.user.id;
    accommodation.rejectionReason = newStatus === 'rejete' ? String(req.body.reason).trim() : '';
    accommodation.publishedAt = newStatus === 'publie' ? new Date() : null;
    await accommodation.save();

    if (accommodation.property?.owner) {
      notify({
        recipient: accommodation.property.owner,
        type: newStatus === 'publie' ? 'bien_valide' : 'bien_rejete',
        title: newStatus === 'publie' ? '✅ Hébergement validé' : '❌ Hébergement non validé',
        body: newStatus === 'publie'
          ? `"${accommodation.property.title}" est maintenant visible sur la plateforme.`
          : `"${accommodation.property.title}" n'a pas été validé. ${accommodation.rejectionReason}`,
        data: { propertyId: accommodation.property._id.toString(), screen: 'Annonces' },
      }).catch(() => {});
    }

    logAction({
      action: newStatus === 'publie' ? 'Hébergement validé' : 'Hébergement rejeté',
      description: `Hébergement ${accommodation._id} ${newStatus} par l'admin`,
      module: 'Altimmo',
      typeAction: newStatus === 'publie' ? 'VALIDATION' : 'REJET',
      auteur: buildAuteur(req.user),
      cible: { id: String(id), type: 'Accommodation' },
      req,
    });

    res.json({ status: 'success', data: { accommodation: serializeAccommodation(accommodation) } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// Rate plans (nightly / weekly / monthly / yearly)
// ─────────────────────────────────────────────

exports.listRates = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const rates = await getActiveRates(req.params.id);
    res.json({ status: 'success', data: { rates } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// POST /api/accommodations/:id/rate-plans — upsert du tarif actif pour un mode
exports.upsertRate = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const accommodation = await Accommodation.findById(req.params.id);
    if (!accommodation) return fail(res, 404, 'Hébergement introuvable.');
    if (accommodation.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'Admin') {
      return fail(res, 403, "Vous ne pouvez modifier que vos propres hébergements.");
    }
    const { mode, amount, currency } = req.body;
    if (!RatePlan.RATE_MODES.includes(mode)) return fail(res, 422, 'Mode tarifaire invalide.');
    if (!(Number(amount) > 0)) return fail(res, 422, 'Un montant positif est requis.');

    // Un seul tarif actif par (accommodation, mode) : on désactive l'ancien
    // avant de créer le nouveau plutôt que de le muter — conserve l'historique.
    await RatePlan.updateMany(
      { accommodation: accommodation._id, mode, active: true },
      { $set: { active: false } },
    );
    const rate = await RatePlan.create({
      accommodation: accommodation._id,
      mode,
      amount,
      currency: currency || 'XAF',
      createdBy: req.user.id,
    });

    res.status(201).json({ status: 'success', data: { rate } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// DELETE /api/accommodations/:id/rate-plans/:rateId
exports.deactivateRate = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.rateId)) {
      return fail(res, 400, 'Identifiant invalide.');
    }
    const accommodation = await Accommodation.findById(req.params.id);
    if (!accommodation) return fail(res, 404, 'Hébergement introuvable.');
    if (accommodation.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'Admin') {
      return fail(res, 403, "Vous ne pouvez modifier que vos propres hébergements.");
    }
    const rate = await RatePlan.findOneAndUpdate(
      { _id: req.params.rateId, accommodation: accommodation._id },
      { $set: { active: false } },
      { new: true },
    );
    if (!rate) return fail(res, 404, 'Tarif introuvable.');
    res.json({ status: 'success', data: { rate } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};
