// server/services/hotel/hotelInventoryProfessionalService.js — PHASE-HX1
//
// Couche PROFESSIONNELLE au-dessus de RoomInventory : traduit un concept
// "stock vendable" (sellableUnits) — celui qu'un gérant raisonne
// naturellement — vers/depuis les champs canoniques existants
// (totalUnits/reservedUnits/blockedUnits/physicalBlockedUnits), SANS jamais
// stocker `sellableUnits` comme un champ persistant distinct (mission §16 :
// "Do NOT make 'available' a second stored inventory field"). Réutilise
// exactement RoomInventory/ensureInventoryExists — aucun second moteur
// d'inventaire.

const mongoose = require('mongoose');
const RoomCategory = require('../../models/RoomCategory');
const RoomInventory = require('../../models/RoomInventory');
const Room = require('../../models/Room');
const { normalizeDate, ensureInventoryExists } = require('../hotelAvailabilityService');

const MAX_DATES_PER_REQUEST = 62;

function fail(message, statusCode, code) {
  const err = new Error(message); err.statusCode = statusCode; if (code) err.code = code; throw err;
}

// PHASE-HX1 §17 — édition par date réelle : chaque entrée de `updates` peut
// porter une valeur DIFFÉRENTE (jamais une seule valeur appliquée à toute
// une plage, contrairement à updateRange). Traité comme un lot borné
// (≤ 62 dates, même contrainte que le calendrier existant), jamais un
// nombre illimité de dates en une requête.
async function applySellableInventoryUpdates({ hotelId, roomCategoryId, updates, updatedBy, reason = '' }) {
  if (!mongoose.isValidObjectId(roomCategoryId)) fail('Catégorie invalide.', 422, 'INVENTORY_INVALID_CATEGORY');
  if (!Array.isArray(updates) || updates.length === 0 || updates.length > MAX_DATES_PER_REQUEST) {
    fail(`La liste de mises à jour doit contenir entre 1 et ${MAX_DATES_PER_REQUEST} dates.`, 422, 'INVENTORY_INVALID_BATCH');
  }

  const category = await RoomCategory.findOne({ _id: roomCategoryId, hotel: hotelId });
  if (!category) fail('Catégorie introuvable pour cet hôtel.', 404, 'INVENTORY_CATEGORY_NOT_FOUND');

  const normalizedDates = updates.map((entry) => normalizeDate(new Date(entry.date)));
  if (normalizedDates.some((date) => Number.isNaN(date.getTime()))) {
    fail('Une date fournie est invalide.', 422, 'INVENTORY_INVALID_DATE');
  }
  await ensureInventoryExists(hotelId, roomCategoryId, normalizedDates, category);

  // PHASE-H4/H5 pattern reconduit : `physicalBlockedUnits` reflète les
  // chambres réellement hors service au moment de l'opération — jamais
  // recalculé indépendamment ici (même source que hotelInventoryController.calendar).
  const physicalBlockedUnits = await Room.countDocuments({ roomCategory: roomCategoryId, active: true, status: 'out_of_service' });

  const results = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const entry of updates) {
    const date = normalizeDate(new Date(entry.date));
    const sellableUnits = Number(entry.sellableUnits);
    if (!Number.isInteger(sellableUnits) || sellableUnits < 0) {
      results.push({ date: entry.date, ok: false, code: 'INVENTORY_INVALID_VALUE' });
      // eslint-disable-next-line no-continue
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const doc = await RoomInventory.findOne({ roomCategory: roomCategoryId, date });
    const maxSellable = Math.max(0, doc.totalUnits - physicalBlockedUnits);
    if (sellableUnits > maxSellable) {
      results.push({ date: entry.date, ok: false, code: 'INVENTORY_EXCEEDS_CAPACITY', maxSellable });
      // eslint-disable-next-line no-continue
      continue;
    }
    const blockedUnits = maxSellable - sellableUnits;
    // Garde ATOMIQUE (mission §16, "sellable < reserved" jamais autorisé,
    // même en cas de réservation concurrente entre la lecture et l'écriture
    // ci-dessus) : la condition `reservedUnits: { $lte: sellableUnits }`
    // fait échouer la mise à jour (0 document modifié) si une réservation
    // a fait grimper reservedUnits au-delà de la valeur demandée entre-temps.
    // eslint-disable-next-line no-await-in-loop
    const updated = await RoomInventory.findOneAndUpdate(
      { roomCategory: roomCategoryId, date, reservedUnits: { $lte: sellableUnits } },
      { $set: { blockedUnits, updatedBy, reason: String(reason || '') } },
      { new: true },
    );
    if (!updated) {
      results.push({ date: entry.date, ok: false, code: 'INVENTORY_BELOW_RESERVED', reservedUnits: doc.reservedUnits });
      // eslint-disable-next-line no-continue
      continue;
    }
    results.push({ date: entry.date, ok: true, sellableUnits, blockedUnits });
  }
  return results;
}

// PHASE-HX1 §12 — changer `RoomCategory.unitsAvailable` ne doit JAMAIS
// réécrire l'historique ni un jour où le nouveau total serait inférieur à
// ce qui est déjà réservé. Ne touche que les dates futures (>= aujourd'hui)
// dont la mise à jour resterait sûre ; les autres restent inchangées
// (jamais une capacité corrompue — mission §12, "must NOT corrupt existing
// historical RoomInventory or reservations").
async function syncFutureTotalUnits(roomCategoryId, newUnitsAvailable) {
  const today = normalizeDate(new Date());
  const result = await RoomInventory.updateMany(
    { roomCategory: roomCategoryId, date: { $gte: today }, reservedUnits: { $lte: newUnitsAvailable } },
    { $set: { totalUnits: newUnitsAvailable } },
  );
  return { modifiedCount: result.modifiedCount };
}

module.exports = { applySellableInventoryUpdates, syncFutureTotalUnits, MAX_DATES_PER_REQUEST };
