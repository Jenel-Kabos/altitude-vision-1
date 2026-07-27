// server/services/hotelAvailabilityService.js — Sprint C
//
// Service central de disponibilité/inventaire hôtelier. Les écritures
// acceptent une session MongoDB fournie par les workflows transactionnels ;
// les mises à jour conditionnelles restent sûres en fallback standalone.
//
//   1. Chaque NUIT est un document RoomInventory séparé (clé unique
//      {roomCategory, date}) — la MISE À JOUR ATOMIQUE d'un seul document
//      (findOneAndUpdate avec condition $expr sur le stock) est une garantie
//      native de MongoDB, sur toute topologie (standalone y compris).
//   2. La réservation couvre PLUSIEURS nuits : on réserve nuit par nuit,
//      dans l'ordre, en s'arrêtant à la première nuit indisponible ; si une
//      nuit échoue, on ANNULE (compense) les nuits déjà réservées avant de
//      renvoyer l'échec — jamais de réservation partielle exposée à
//      l'appelant (mission §5). Ce pattern de compensation est la même
//      convention déjà utilisée par accommodationService.js/
//      propertyTransactionService.js pour Property+satellites.
//
// Cette combinaison (atomicité par document + compensation applicative)
// élimine la fenêtre de course qu'une simple paire "lire puis écrire"
// laisserait ouverte entre deux requêtes concurrentes.

const RoomCategory = require('../models/RoomCategory');
const RoomInventory = require('../models/RoomInventory');
const Room = require('../models/Room');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────
// Dates — normalisation et découpage en nuits
// ─────────────────────────────────────────────

/** Toujours minuit UTC — élimine toute dérive de fuseau horaire côté appelant. */
function normalizeDate(input) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    const err = new Error('Date invalide.');
    err.statusCode = 422;
    throw err;
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Liste des nuits couvertes par [checkIn, checkOut) — la nuit de départ
 * n'est JAMAIS consommée (mission §4). Lève une erreur 422 si l'ordre des
 * dates est invalide.
 */
function getNightDates(checkInDate, checkOutDate) {
  const start = normalizeDate(checkInDate);
  const end = normalizeDate(checkOutDate);
  if (end <= start) {
    const err = new Error("La date de départ doit être strictement postérieure à la date d'arrivée.");
    err.statusCode = 422;
    throw err;
  }
  const nights = [];
  let cursor = start;
  while (cursor < end) {
    nights.push(cursor);
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return nights;
}

function isPastDate(date) {
  const today = normalizeDate(new Date());
  return normalizeDate(date) < today;
}

/**
 * Rejette une création dont l'arrivée est dans le passé — sauf
 * `allowPast: true`, réservé aux appels admin explicitement justifiés
 * (mission §4 : "sauf privilège administratif explicitement justifié").
 * Jamais activé par défaut, jamais pour le public ou le propriétaire.
 */
function assertNotPast(checkInDate, { allowPast = false } = {}) {
  if (allowPast) return;
  if (isPastDate(checkInDate)) {
    const err = new Error("La date d'arrivée ne peut pas être dans le passé.");
    err.statusCode = 422;
    throw err;
  }
}

// ─────────────────────────────────────────────
// Disponibilité (lecture seule)
// ─────────────────────────────────────────────

/**
 * @returns {Promise<{available, nights: Array<{date, totalUnits, availableUnits, isClosed, stopSell, sufficient}>, unavailableDates: Date[]}>}
 */
async function getAvailability({ roomCategoryId, checkInDate, checkOutDate, roomsCount = 1 }) {
  const nightDates = getNightDates(checkInDate, checkOutDate);
  const category = await RoomCategory.findById(roomCategoryId);
  if (!category) {
    const err = new Error('Catégorie de chambres introuvable.');
    err.statusCode = 404;
    throw err;
  }

  const existing = await RoomInventory.find({
    roomCategory: roomCategoryId,
    date: { $in: nightDates },
  });
  const byDate = new Map(existing.map((doc) => [doc.date.getTime(), doc]));
  const currentPhysicalBlockedUnits = mongoose.connection.readyState
    ? await Room.countDocuments({ roomCategory: roomCategoryId, active: true, status: 'out_of_service' })
    : 0;

  const nights = nightDates.map((date) => {
    const doc = byDate.get(date.getTime());
    const totalUnits = doc ? doc.totalUnits : category.unitsAvailable;
    const blockedUnits = doc ? doc.blockedUnits : 0;
    const physicalBlockedUnits = doc ? doc.physicalBlockedUnits || 0 : currentPhysicalBlockedUnits;
    const reservedUnits = doc ? doc.reservedUnits : 0;
    const isClosed = doc ? doc.isClosed : false;
    const stopSell = doc ? doc.stopSell : false;
    const availableUnits = Math.max(0, totalUnits - blockedUnits - physicalBlockedUnits - reservedUnits);
    const sufficient = category.status === 'actif' && !isClosed && !stopSell && availableUnits >= roomsCount;
    return { date, totalUnits, availableUnits, isClosed, stopSell, sufficient };
  });

  const unavailableDates = nights.filter((n) => !n.sufficient).map((n) => n.date);
  return { available: unavailableDates.length === 0, nights, unavailableDates };
}

/** Lève une erreur 409 (avec `unavailableDates`, sans autre détail interne) si insuffisant. */
async function assertAvailability(params) {
  const result = await getAvailability(params);
  if (!result.available) {
    const err = new Error('Certaines dates ne sont plus disponibles pour cette catégorie.');
    err.statusCode = 409;
    err.unavailableDates = result.unavailableDates;
    throw err;
  }
  return result;
}

// ─────────────────────────────────────────────
// Écriture — réservation/libération atomique du stock
// ─────────────────────────────────────────────

/** Upsert atomique — jamais de course sur la CRÉATION du document grâce à l'index unique {roomCategory, date}. */
async function ensureInventoryExists(hotelId, roomCategoryId, dates, category, { session } = {}) {
  const categoryQuery = RoomCategory.findById(roomCategoryId);
  const cat = category || (await (session ? categoryQuery.session(session) : categoryQuery));
  if (!cat) {
    const err = new Error('Catégorie de chambres introuvable.');
    err.statusCode = 404;
    throw err;
  }
  // `hotel` dérivé de la catégorie si non fourni (ex: rebuildInventory, qui
  // n'a besoin de connaître que la catégorie) — jamais `null` en base, le
  // schéma RoomInventory l'exige.
  const resolvedHotelId = hotelId || cat.hotel;
  const physicalBlockedUnits = mongoose.connection.readyState
    ? await Room.countDocuments({ roomCategory: roomCategoryId, active: true, status: 'out_of_service' })
    : 0;
  await Promise.all(dates.map((date) =>
    RoomInventory.findOneAndUpdate(
      { roomCategory: roomCategoryId, date },
      {
        $setOnInsert: {
          hotel: resolvedHotelId, roomCategory: roomCategoryId, date,
          totalUnits: cat.unitsAvailable, blockedUnits: 0, physicalBlockedUnits, reservedUnits: 0,
          isClosed: false, stopSell: false,
        },
      },
      { upsert: true, new: true, session },
    ).catch((error) => {
      // E11000 possible si deux requêtes concurrentes créent le même
      // document en même temps (l'une gagne, l'autre échoue sur l'index
      // unique) — sans conséquence : le document existe de toute façon
      // après coup, la réservation elle-même se fera par la mise à jour
      // atomique conditionnelle ci-dessous.
      if (error.code !== 11000) throw error;
    })));
}

/**
 * Réserve atomiquement `roomsCount` unités sur chaque nuit de la période.
 * Garantit `reservedUnits + roomsCount <= totalUnits - blockedUnits` sur
 * CHAQUE nuit (mission §5) — si une seule nuit échoue, toutes les nuits déjà
 * réservées par cet appel sont libérées avant de renvoyer l'échec : jamais
 * de réservation partielle.
 *
 * @returns {Promise<{ok: true, nights: Date[]} | {ok: false, conflictDate: Date, unavailableDates: Date[]}>}
 */
async function reserveInventory({ hotelId, roomCategoryId, checkInDate, checkOutDate, roomsCount = 1, actingUserId = null, session = null }) {
  const nightDates = getNightDates(checkInDate, checkOutDate);
  const categoryQuery = RoomCategory.findById(roomCategoryId);
  const category = await (session ? categoryQuery.session(session) : categoryQuery);
  if (!category) {
    const err = new Error('Catégorie de chambres introuvable.');
    err.statusCode = 404;
    throw err;
  }
  await ensureInventoryExists(hotelId, roomCategoryId, nightDates, category, { session });

  const reservedSoFar = [];
  for (const date of nightDates) {
    // Mise à jour atomique conditionnelle — le cœur de la protection
    // anti-surbooking : MongoDB garantit qu'une seule requête concurrente
    // peut satisfaire la condition $expr à un instant donné pour ce document.
    // eslint-disable-next-line no-await-in-loop
    const updated = await RoomInventory.findOneAndUpdate(
      {
        roomCategory: roomCategoryId,
        date,
        isClosed: { $ne: true },
        stopSell: { $ne: true },
        $expr: {
          $lte: [
            { $add: ['$reservedUnits', roomsCount] },
            { $subtract: ['$totalUnits', { $add: ['$blockedUnits', { $ifNull: ['$physicalBlockedUnits', 0] }] }] },
          ],
        },
      },
      { $inc: { reservedUnits: roomsCount }, $set: { updatedBy: actingUserId } },
      { new: true, session },
    );

    if (!updated) {
      // Échec sur cette nuit : compensation des nuits déjà réservées par CET
      // appel (jamais celles d'autres réservations) avant de remonter l'échec.
      // eslint-disable-next-line no-await-in-loop
      await releaseInventoryDates(roomCategoryId, reservedSoFar, roomsCount, { session });
      const unavailable = await getAvailability({ roomCategoryId, checkInDate, checkOutDate, roomsCount });
      return { ok: false, conflictDate: date, unavailableDates: unavailable.unavailableDates };
    }
    reservedSoFar.push(date);
  }

  return { ok: true, nights: reservedSoFar };
}

/** Libère `roomsCount` unités sur une liste de dates déjà normalisées (usage interne : compensation). */
async function releaseInventoryDates(roomCategoryId, dates, roomsCount, { session } = {}) {
  await Promise.all(dates.map((date) =>
    RoomInventory.findOneAndUpdate(
      { roomCategory: roomCategoryId, date, reservedUnits: { $gte: roomsCount } },
      { $inc: { reservedUnits: -roomsCount } },
      { session },
    ).catch((error) => {
      logger.error(`Libération d'inventaire échouée (roomCategory=${roomCategoryId}, date=${date.toISOString()})`, error);
    })));
}

/** Libère le stock d'une réservation existante (annulation/rejet/expiration/modification). */
async function releaseInventory({ roomCategoryId, checkInDate, checkOutDate, roomsCount = 1, session = null }) {
  const nightDates = getNightDates(checkInDate, checkOutDate);
  await releaseInventoryDates(roomCategoryId, nightDates, roomsCount, { session });
}

/**
 * Provisionne (backfill) les documents RoomInventory manquants sur une
 * période, avec `totalUnits` synchronisé depuis RoomCategory.unitsAvailable
 * — n'écrase JAMAIS un document déjà existant (ne touche pas
 * reservedUnits/blockedUnits d'une nuit déjà en cours de vie).
 */
async function rebuildInventory({ roomCategoryId, from, to }) {
  const nightDates = getNightDates(from, to);
  await ensureInventoryExists(null, roomCategoryId, nightDates);
  return { nights: nightDates.length };
}

async function syncPhysicalInventoryBlock({ roomCategoryId, delta, from = new Date(), session = null }) {
  if (!mongoose.connection.readyState) return { modifiedCount: 0 };
  const date = normalizeDate(from);
  await RoomInventory.updateMany(
    { roomCategory: roomCategoryId, date: { $gte: date } },
    delta > 0 ? { $inc: { physicalBlockedUnits: delta } } : [{ $set: { physicalBlockedUnits: { $max: [0, { $add: [{ $ifNull: ['$physicalBlockedUnits', 0] }, delta] }] } } }],
    { session },
  );
}

module.exports = {
  normalizeDate, getNightDates, isPastDate, assertNotPast,
  getAvailability, assertAvailability,
  reserveInventory, releaseInventory, rebuildInventory,
  ensureInventoryExists,
  syncPhysicalInventoryBlock,
};
