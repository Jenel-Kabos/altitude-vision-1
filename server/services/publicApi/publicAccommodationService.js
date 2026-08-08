// API-PUBLIC-1 (Phase 5) — Hébergements indépendants exposés publiquement.
// Réutilise `services/accommodationReservationService.js` pour la logique
// métier (parseDate/nightsBetween/quote) — jamais réimplémentée. La requête
// de disponibilité elle-même (find sur AccommodationNightLock) est triviale
// et reprend exactement celle déjà utilisée par
// `accommodationReservationController.availability`.
//
// Titre/description/images vivent sur `Property` (le bien physique), pas
// sur `Accommodation` lui-même (voir commentaire d'en-tête de
// models/Accommodation.js) — d'où le `populate('property', ...)` ci-dessous,
// plutôt qu'une supposition de champs qui n'existent pas sur ce modèle.
// Aucun prix statique n'est exposé sur la fiche détail : le tarif dépend de
// la période (saisonnalité) — seul `getPublicAccommodationAvailability`
// (qui exige une période) renvoie un prix, via `quote()` déjà existant,
// jamais un chiffre inventé pour une "fiche" sans dates.
const Accommodation = require('../../models/Accommodation');
const NightLock = require('../../models/AccommodationNightLock');
const accommodationService = require('../accommodationReservationService');

const PUBLIC_ACCOMMODATION_FIELDS = 'accommodationType occupancyMode capacity beds checkInTime checkOutTime minimumStay maximumStay amenities rules houseRules includedServices property';
const PUBLIC_PROPERTY_SUBFIELDS = 'title description images address';

async function getPublicAccommodationById(id) {
  const accommodation = await Accommodation.findById(id).select(PUBLIC_ACCOMMODATION_FIELDS)
    .populate('property', PUBLIC_PROPERTY_SUBFIELDS).lean();
  if (!accommodation || accommodation.hotel) return null; // uniquement les hébergements indépendants (jamais un hôtel)
  return accommodation;
}

async function getPublicAccommodationAvailability(id, { from, to } = {}) {
  const accommodation = await Accommodation.findById(id);
  if (!accommodation || accommodation.hotel) return null;
  const fromDate = from ? accommodationService.parseDate(from) : accommodationService.parseDate(new Date());
  const toDate = to ? accommodationService.parseDate(to) : new Date(fromDate.getTime() + 90 * 86400000);
  const days = accommodationService.nightsBetween(fromDate, toDate);
  const locks = await NightLock.find({ accommodation: accommodation._id, date: { $gte: fromDate, $lt: toDate } })
    .select('date').sort({ date: 1 }).lean();
  const pricing = from && to ? await accommodationService.quote(accommodation, fromDate, toDate).catch(() => null) : null;
  return {
    accommodationId: accommodation._id, from: fromDate, to: toDate, days,
    available: locks.length === 0, pricing,
    // Le motif exact du blocage (`sourceType`) reste interne — le public ne
    // voit que la date indisponible, jamais pourquoi.
    unavailableDates: locks.map((lock) => ({ date: lock.date })),
  };
}

module.exports = { getPublicAccommodationById, getPublicAccommodationAvailability, PUBLIC_ACCOMMODATION_FIELDS };
