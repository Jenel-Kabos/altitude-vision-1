// server/controllers/roomCategoryController.js — Sprint B2 (domaine Hôtellerie)
//
// CRUD des catégories de chambres (Standard/Deluxe/Suite…) — jamais de
// chambre physique individuelle (voir RoomCategory.js). Inclut la gestion
// des tarifs par catégorie (RatePlan.roomCategory, voir RatePlan.js) :
// public/entreprise/weekend/promotion/haute_saison, un seul actif par type,
// historique conservé — même convention que
// accommodationController.upsertRate (Sprint B1).

const mongoose = require('mongoose');
const RoomCategory = require('../models/RoomCategory');
const RatePlan = require('../models/RatePlan');
const { assertOperationalHotelAccess } = require('../services/hotel/hotelAccessScopeService');
const { HOTEL_OPERATIONAL_CAPABILITIES: CAP } = require('../constants/hotelAccessConstants');
const { syncFutureTotalUnits } = require('../services/hotel/hotelInventoryProfessionalService');
const { uploadFilesToCloudinary } = require('../services/propertyPublicationInputService');

const fail = (res, statusCode, message) =>
  res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message });

// F2.6.1 : les catégories de chambres sont hôtelières (RoomCategory.hotel) — même scope central
// que les chambres (pas de capacité dédiée, réutilise hotel.room.view/manage, mission §5/§10).
async function assertHotelAccess(req, hotelId, capability) {
  return assertOperationalHotelAccess({ actor: req.user, hotelId, capability });
}

// ─────────────────────────────────────────────
// GET /api/hotels/:hotelId/room-categories
// ─────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.hotelId)) return fail(res, 400, 'Identifiant invalide.');
    // Contrôle final (audit sécurité Sprint B2) — cette route (dashboard
    // admin/propriétaire) exposait les catégories ET leurs tarifs de
    // n'importe quel hôtel à tout utilisateur authentifié, y compris non
    // lié à cet établissement. La consultation publique d'un hôtel publié
    // passe par un endpoint dédié séparé (GET /api/hotels/public/:id),
    // jamais par celui-ci.
    const { error } = await assertHotelAccess(req, req.params.hotelId, CAP.ROOM_VIEW);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez consulter que vos propres hôtels.");
    const categories = await RoomCategory.find({ hotel: req.params.hotelId }).sort({ createdAt: 1 });
    // Contrôle final (audit performances Sprint B2) — un `RatePlan.find` par
    // catégorie (N+1) remplacé par une seule requête groupée par catégorie.
    const categoryIds = categories.map((c) => c._id);
    const allRates = categoryIds.length ? await RatePlan.find({ roomCategory: { $in: categoryIds }, active: true }) : [];
    const ratesByCategory = new Map();
    allRates.forEach((rate) => {
      const key = String(rate.roomCategory);
      if (!ratesByCategory.has(key)) ratesByCategory.set(key, []);
      ratesByCategory.get(key).push(rate);
    });
    const withRates = categories.map((cat) => ({
      ...cat.toObject(),
      rates: ratesByCategory.get(String(cat._id)) || [],
    }));
    res.json({ status: 'success', data: { categories: withRates } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// POST /api/hotels/:hotelId/room-categories
// ─────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.hotelId)) return fail(res, 400, 'Identifiant invalide.');
    const { error } = await assertHotelAccess(req, req.params.hotelId, CAP.ROOM_MANAGE);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez gérer que vos propres hôtels.");

    const { name, description, capacity, beds, surface, unitsAvailable, amenities } = req.body;
    if (!name || !String(name).trim()) return fail(res, 422, 'Le nom de la catégorie est requis.');

    const category = await RoomCategory.create({
      hotel: req.params.hotelId,
      name, description: description || '',
      capacity: capacity || undefined,
      beds: beds ?? 1,
      surface: surface ?? null,
      unitsAvailable: unitsAvailable ?? 1,
      amenities: amenities || undefined,
      createdBy: req.user.id,
    });
    res.status(201).json({ status: 'success', data: { category } });
  } catch (error) {
    if (error.name === 'ValidationError') return fail(res, 422, error.message);
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/hotels/room-categories/:id
// ─────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const category = await RoomCategory.findById(req.params.id);
    if (!category) return fail(res, 404, 'Catégorie introuvable.');
    const { error } = await assertHotelAccess(req, category.hotel, CAP.ROOM_MANAGE);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez gérer que vos propres hôtels.");

    const previousUnitsAvailable = category.unitsAvailable;
    const ALLOWED = ['name', 'description', 'capacity', 'beds', 'surface', 'unitsAvailable', 'amenities', 'gallery', 'status'];
    ALLOWED.forEach((key) => { if (req.body[key] !== undefined) category[key] = req.body[key]; });
    category.updatedBy = req.user.id;
    await category.save();
    // PHASE-HX1 §12 — synchronise les dates FUTURES et sûres uniquement
    // (jamais l'historique, jamais un jour où le nouveau total tomberait
    // sous le déjà-réservé) ; best-effort, ne bloque jamais la réponse.
    if (req.body.unitsAvailable !== undefined && Number(req.body.unitsAvailable) !== previousUnitsAvailable) {
      await syncFutureTotalUnits(category._id, Number(req.body.unitsAvailable)).catch(() => {});
    }
    res.json({ status: 'success', data: { category } });
  } catch (error) {
    if (error.name === 'ValidationError') return fail(res, 422, error.message);
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PHASE-HX1 §10 — POST /api/hotels/room-categories/:id/gallery
// Réutilise EXACTEMENT le mécanisme Cloudinary déjà en place pour la
// galerie Hotel (uploadFilesToCloudinary, même dossier logique, même
// absence de rollback explicite que le flux Hotel existant — convention
// déjà établie, pas une nouvelle divergence). Renvoie les URLs ajoutées ;
// le client les fusionne dans `gallery` et les persiste via PATCH
// (mission §9/§10 : jamais un second champ ni une seconde route d'écriture
// pour la galerie elle-même).
// ─────────────────────────────────────────────
exports.uploadGallery = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const category = await RoomCategory.findById(req.params.id);
    if (!category) return fail(res, 404, 'Catégorie introuvable.');
    const { error } = await assertHotelAccess(req, category.hotel, CAP.ROOM_MANAGE);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez gérer que vos propres hôtels.");
    if (!req.files || req.files.length === 0) return fail(res, 422, 'Aucune photo fournie.');
    const urls = await uploadFilesToCloudinary(req.files, 'altitude-vision/room-categories');
    res.status(201).json({ status: 'success', data: { urls } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// DELETE /api/hotels/room-categories/:id
// ─────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const category = await RoomCategory.findById(req.params.id);
    if (!category) return fail(res, 404, 'Catégorie introuvable.');
    const { error } = await assertHotelAccess(req, category.hotel, CAP.ROOM_MANAGE);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez gérer que vos propres hôtels.");

    await RatePlan.deleteMany({ roomCategory: category._id });
    await RoomCategory.findByIdAndDelete(category._id);
    res.json({ status: 'success', data: {} });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// POST /api/hotels/room-categories/:id/duplicate
// ─────────────────────────────────────────────
exports.duplicate = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const category = await RoomCategory.findById(req.params.id);
    if (!category) return fail(res, 404, 'Catégorie introuvable.');
    const { error } = await assertHotelAccess(req, category.hotel, CAP.ROOM_MANAGE);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez gérer que vos propres hôtels.");

    const clone = await RoomCategory.create({
      hotel: category.hotel,
      name: `${category.name} (copie)`,
      description: category.description,
      capacity: category.capacity,
      beds: category.beds,
      surface: category.surface,
      unitsAvailable: category.unitsAvailable,
      amenities: category.amenities,
      gallery: category.gallery,
      createdBy: req.user.id,
    });
    res.status(201).json({ status: 'success', data: { category: clone } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/hotels/room-categories/:id/deactivate | /activate
// ─────────────────────────────────────────────
exports.deactivate = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const category = await RoomCategory.findById(req.params.id);
    if (!category) return fail(res, 404, 'Catégorie introuvable.');
    const { error } = await assertHotelAccess(req, category.hotel, CAP.ROOM_MANAGE);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez gérer que vos propres hôtels.");
    category.status = 'inactif';
    await category.save();
    res.json({ status: 'success', data: { category } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

exports.activate = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const category = await RoomCategory.findById(req.params.id);
    if (!category) return fail(res, 404, 'Catégorie introuvable.');
    const { error } = await assertHotelAccess(req, category.hotel, CAP.ROOM_MANAGE);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez gérer que vos propres hôtels.");
    category.status = 'actif';
    await category.save();
    res.json({ status: 'success', data: { category } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// Tarifs par catégorie (public/entreprise/weekend/promotion/haute_saison)
// ─────────────────────────────────────────────

// GET /api/hotels/room-categories/:id/rate-plans?includeInactive=1
exports.listRates = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    // Contrôle final (audit sécurité Sprint B2) — même correctif que
    // exports.list ci-dessus : les tarifs (y compris l'historique via
    // ?includeInactive=1) ne doivent être lisibles que par le propriétaire
    // de l'hôtel ou le staff, jamais par un utilisateur tiers authentifié.
    const category = await RoomCategory.findById(req.params.id);
    if (!category) return fail(res, 404, 'Catégorie introuvable.');
    const { error } = await assertHotelAccess(req, category.hotel, CAP.ROOM_VIEW);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez consulter que vos propres hôtels.");
    const query = { roomCategory: req.params.id };
    if (!req.query.includeInactive) query.active = true;
    const rates = await RatePlan.find(query).sort({ rateType: 1, createdAt: -1 });
    res.json({ status: 'success', data: { rates } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// POST /api/hotels/room-categories/:id/rate-plans — upsert (désactive l'ancien actif du même type)
exports.upsertRate = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const category = await RoomCategory.findById(req.params.id);
    if (!category) return fail(res, 404, 'Catégorie introuvable.');
    const { error } = await assertHotelAccess(req, category.hotel, CAP.ROOM_MANAGE);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez gérer que vos propres hôtels.");

    const { rateType, amount, currency, seasonalPeriods = [], mealPlan = null, cancellation = null } = req.body;
    if (!RatePlan.RATE_TYPES.includes(rateType)) return fail(res, 422, 'Type de tarif invalide.');
    if (!(Number(amount) > 0)) return fail(res, 422, 'Un montant positif est requis.');
    if (!Array.isArray(seasonalPeriods) || seasonalPeriods.length > 50) return fail(res, 422, 'Périodes tarifaires invalides.');
    // PHASE-H5 — conditions commerciales additives, `null` accepté (legacy/
    // inconnu, jamais un défaut fabriqué). Validation de forme minimale ici ;
    // la cohérence (non_refundable sans délai/pénalité, pénalité > 100%...)
    // est appliquée par RatePlan.cancellationPolicySchema.pre('validate').
    if (mealPlan != null && !RatePlan.MEAL_PLANS.includes(mealPlan)) return fail(res, 422, 'Formule de repas invalide.');
    if (cancellation != null && !RatePlan.CANCELLATION_TYPES.includes(cancellation.type)) return fail(res, 422, 'Type de politique d’annulation invalide.');

    await RatePlan.updateMany(
      { roomCategory: category._id, rateType, active: true },
      { $set: { active: false } },
    );
    const rate = await RatePlan.create({
      roomCategory: category._id,
      rateType,
      amount,
      currency: currency || 'XAF',
      mealPlan,
      cancellation,
      seasonalPeriods: seasonalPeriods.map((period) => ({
        label: period.label, startDate: period.startDate, endDate: period.endDate,
        amount: Number(period.amount), priority: Number(period.priority || 0),
      })),
      createdBy: req.user.id,
    });
    res.status(201).json({ status: 'success', data: { rate } });
  } catch (error) {
    if (error.name === 'ValidationError') return fail(res, 422, error.message);
    fail(res, 500, error.message);
  }
};

// DELETE /api/hotels/room-categories/:id/rate-plans/:rateId — archive (désactive)
exports.archiveRate = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.rateId)) {
      return fail(res, 400, 'Identifiant invalide.');
    }
    const category = await RoomCategory.findById(req.params.id);
    if (!category) return fail(res, 404, 'Catégorie introuvable.');
    const { error } = await assertHotelAccess(req, category.hotel, CAP.ROOM_MANAGE);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez gérer que vos propres hôtels.");

    const rate = await RatePlan.findOneAndUpdate(
      { _id: req.params.rateId, roomCategory: category._id },
      { $set: { active: false } },
      { new: true },
    );
    if (!rate) return fail(res, 404, 'Tarif introuvable.');
    res.json({ status: 'success', data: { rate } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};
