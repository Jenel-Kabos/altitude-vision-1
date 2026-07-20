// server/controllers/hotelController.js
//
// Périmètre minimal (Sprint Hôtel) : lister/consulter les établissements
// pour le sélecteur "Établissement hôtelier" du dashboard admin. Pas de
// dashboard de gestion hôtelière dédié, pas de suppression — voir
// server/docs/HEBERGEMENT.md.

const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');

const fail = (res, statusCode, message) =>
  res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message });

// GET /api/hotels — liste pour le sélecteur admin (staff uniquement)
exports.list = async (req, res) => {
  try {
    // Sélecteur admin (pas de pagination dédiée à ce stade, comme les
    // autres listes de référence de ce codebase) — plafond de sécurité pour
    // éviter une réponse non bornée si le nombre d'établissements grandit.
    const hotels = await Hotel.find({ status: 'actif' })
      .select('name starRating phone email')
      .sort({ name: 1 })
      .limit(200);
    res.json({ status: 'success', data: { hotels } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// GET /api/hotels/:id
exports.getOne = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return fail(res, 404, 'Hôtel introuvable.');
    res.json({ status: 'success', data: { hotel } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};
