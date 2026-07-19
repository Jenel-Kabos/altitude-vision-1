// Construction et validation du payload de demande de visite mobile.
// Le backend (server/controllers/visiteController.js::createVisite) reste la
// source de vérité : ce module prépare uniquement un payload conforme à ce
// qu'il attend réellement — `datePreferee` (JJ/MM/AAAA, parsé côté serveur
// par buildRequestedStart) et `heurePreferee` (HH:MM), jamais `scheduledAt`.

import api from './api';

const pad = (n) => String(n).padStart(2, '0');

/** Formate une Date en "AAAA-MM-JJ" — format attendu par GET /visites/availability. */
export function formatDateISO(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Formate une Date en "JJ/MM/AAAA" — format attendu par le backend. */
export function formatDateFR(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Formate une Date en "HH:MM" local — format attendu par le backend. */
export function formatTimeHHmm(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Combine une date (jour) et une heure (Date) en un seul Date local cohérent. */
export function combineDateAndTime(date, time) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  if (!(time instanceof Date) || Number.isNaN(time.getTime())) return null;
  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined;
}

/** Le créneau choisi (date + heure) est-il strictement dans le futur ? */
export function isFutureDateTime(date, time) {
  const combined = combineDateAndTime(date, time);
  if (!combined) return false;
  return combined.getTime() > Date.now();
}

/**
 * Construit le payload exact attendu par POST /visites.
 * `selectedDate`/`selectedTime` sont des objets Date (issus des pickers
 * natifs) ; jamais de chaîne saisie librement.
 */
export function buildVisitPayload({
  propertyId, conversationId, selectedDate, selectedTime, telephone, message, clientContactConsent,
}) {
  const payload = {
    propertyId,
    datePreferee: formatDateFR(selectedDate),
    heurePreferee: formatTimeHHmm(selectedTime),
    telephone: telephone || '',
    message: message || '',
    clientContactConsent: !!clientContactConsent,
  };
  if (conversationId) payload.conversationId = conversationId;
  return payload;
}

/**
 * Récupère les créneaux disponibles d'un bien pour une date donnée.
 * Le backend recalcule toujours le conflit à la soumission — cet appel
 * n'est qu'une aide d'affichage, jamais une garantie de réservation.
 */
export async function fetchAvailability(propertyId, date) {
  const res = await api.get('/visites/availability', {
    params: { propertyId, date: formatDateISO(date) },
  });
  return res.data?.data || null;
}
