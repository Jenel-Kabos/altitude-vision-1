// Configuration centralisée de la planification des visites immobilières.
//
// ⚠️ AGENCY_OPENING_HOURS reflète les horaires réellement affichés au public
// sur le site (client/lib/components/AltimmoContact.jsx — section "Horaires
// d'ouverture"). Ils sont réutilisés ici pour appliquer automatiquement une
// règle jusque-là seulement informative. À CONFIRMER avec l'agence avant mise
// en production : rien ne garantit que ces horaires d'accueil correspondent
// exactement aux horaires pendant lesquels une visite de bien est possible.

const VISIT_DURATION_MINUTES = 120;

// Africa/Brazzaville = UTC+1 toute l'année (pas d'heure d'été).
const AGENCY_TIMEZONE_OFFSET_HOURS = 1;

const AGENCY_OPENING_HOURS = {
  monday:    { open: '08:00', close: '18:00' },
  tuesday:   { open: '08:00', close: '18:00' },
  wednesday: { open: '08:00', close: '18:00' },
  thursday:  { open: '08:00', close: '18:00' },
  friday:    { open: '08:00', close: '18:00' },
  saturday:  { open: '09:00', close: '14:00' },
  sunday:    null,
};

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Heure/jour locaux (Africa/Brazzaville) d'une Date, indépendamment du fuseau du serveur. */
function localParts(date) {
  const shifted = new Date(date.getTime() + AGENCY_TIMEZONE_OFFSET_HOURS * 3600000);
  return {
    dayKey:  DAY_KEYS[shifted.getUTCDay()],
    minutesOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function parseHHmmToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function formatMinutesToHHmm(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Calcule la fin d'une visite à partir de son début (durée fixe centralisée). */
function computeVisitEnd(start) {
  return new Date(start.getTime() + VISIT_DURATION_MINUTES * 60000);
}

/**
 * Fenêtre dans laquelle le DÉBUT d'une visite existante entre en conflit
 * avec une nouvelle visite commençant à `start` (bornes exclusives).
 * Équivaut à la règle standard existingStart < newEnd ET existingEnd > newStart,
 * sans avoir besoin de stocker de date de fin pour les visites existantes.
 */
function computeConflictWindow(start) {
  return {
    afterExclusive:  new Date(start.getTime() - VISIT_DURATION_MINUTES * 60000),
    beforeExclusive: computeVisitEnd(start),
  };
}

/** Une visite existante démarrant à `existingStart` chevauche-t-elle une nouvelle visite démarrant à `newStart` ? */
function slotsOverlap(existingStart, newStart) {
  const { afterExclusive, beforeExclusive } = computeConflictWindow(newStart);
  return existingStart.getTime() > afterExclusive.getTime() && existingStart.getTime() < beforeExclusive.getTime();
}

/**
 * Une visite [start, end) est-elle entièrement contenue dans les horaires
 * d'ouverture du jour de `start` ? La fin peut coïncider exactement avec la
 * fermeture (16:00-18:00 accepté si fermeture à 18:00 ; 17:00-19:00 refusé).
 */
function isWithinOpeningHours(start, end) {
  const { dayKey, minutesOfDay: startMinutes } = localParts(start);
  const hours = AGENCY_OPENING_HOURS[dayKey];
  if (!hours) return false; // jour fermé

  const { dayKey: endDayKey, minutesOfDay: endMinutes } = localParts(end);
  if (endDayKey !== dayKey) return false; // chevauche minuit — jamais autorisé

  const openMinutes  = parseHHmmToMinutes(hours.open);
  const closeMinutes = parseHHmmToMinutes(hours.close);
  return startMinutes >= openMinutes && endMinutes <= closeMinutes;
}

module.exports = {
  VISIT_DURATION_MINUTES,
  AGENCY_OPENING_HOURS,
  AGENCY_TIMEZONE_OFFSET_HOURS,
  localParts,
  parseHHmmToMinutes,
  formatMinutesToHHmm,
  computeVisitEnd,
  computeConflictWindow,
  slotsOverlap,
  isWithinOpeningHours,
};
