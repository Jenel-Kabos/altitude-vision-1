const { computeVisitEnd } = require('../config/visiteScheduling');

const STATUS = Object.freeze({
  REQUESTED: 'demandee',
  AWAITING_CONFIRMATION: 'en_attente_confirmation',
  CONFIRMED: 'confirmee',
  RESCHEDULED: 'reprogrammee',
  IN_PROGRESS: 'en_cours',
  COMPLETED: 'terminee',
  CANCELLED_CLIENT: 'annulee_client',
  CANCELLED_OWNER: 'annulee_proprietaire',
  CANCELLED_STAFF: 'annulee_staff',
  REFUSED: 'refusee',
  CLIENT_ABSENT: 'client_absent',
  OWNER_ABSENT: 'proprietaire_absent',
  EXPIRED: 'expiree',
  OWNER_CANCELLATION_REQUESTED: 'demande_annulation_proprietaire',
});

const LABELS = Object.freeze({
  [STATUS.REQUESTED]: 'Demandée',
  [STATUS.AWAITING_CONFIRMATION]: 'À confirmer',
  [STATUS.CONFIRMED]: 'Confirmée',
  [STATUS.RESCHEDULED]: 'Reprogrammée',
  [STATUS.IN_PROGRESS]: 'En cours',
  [STATUS.COMPLETED]: 'Terminée',
  [STATUS.CANCELLED_CLIENT]: 'Annulée par le client',
  [STATUS.CANCELLED_OWNER]: 'Annulée par le propriétaire',
  [STATUS.CANCELLED_STAFF]: 'Annulée par l’agence',
  [STATUS.REFUSED]: 'Refusée',
  [STATUS.CLIENT_ABSENT]: 'Client absent',
  [STATUS.OWNER_ABSENT]: 'Propriétaire indisponible',
  [STATUS.EXPIRED]: 'Expirée',
  [STATUS.OWNER_CANCELLATION_REQUESTED]: 'Annulation demandée',
});

const LEGACY_TO_STATUS = Object.freeze({
  'En attente': STATUS.REQUESTED,
  'Confirmée': STATUS.CONFIRMED,
  'Replanifiée': STATUS.RESCHEDULED,
  'En cours': STATUS.IN_PROGRESS,
  'Terminée': STATUS.COMPLETED,
  'Annulée': STATUS.CANCELLED_STAFF,
  'Refusée': STATUS.REFUSED,
});

const STATUS_TO_LEGACY = Object.freeze({
  [STATUS.REQUESTED]: 'En attente',
  [STATUS.AWAITING_CONFIRMATION]: 'En attente',
  [STATUS.CONFIRMED]: 'Confirmée',
  [STATUS.RESCHEDULED]: 'Replanifiée',
  [STATUS.IN_PROGRESS]: 'En cours',
  [STATUS.COMPLETED]: 'Terminée',
  [STATUS.CANCELLED_CLIENT]: 'Annulée',
  [STATUS.CANCELLED_OWNER]: 'Annulée',
  [STATUS.CANCELLED_STAFF]: 'Annulée',
  [STATUS.REFUSED]: 'Refusée',
  [STATUS.CLIENT_ABSENT]: 'Terminée',
  [STATUS.OWNER_ABSENT]: 'Terminée',
  [STATUS.EXPIRED]: 'Annulée',
  [STATUS.OWNER_CANCELLATION_REQUESTED]: 'Confirmée',
});

const TRANSITIONS = Object.freeze({
  [STATUS.REQUESTED]: [STATUS.AWAITING_CONFIRMATION, STATUS.CONFIRMED, STATUS.RESCHEDULED, STATUS.REFUSED, STATUS.CANCELLED_CLIENT, STATUS.CANCELLED_STAFF],
  [STATUS.AWAITING_CONFIRMATION]: [STATUS.CONFIRMED, STATUS.RESCHEDULED, STATUS.REFUSED, STATUS.CANCELLED_CLIENT, STATUS.CANCELLED_STAFF, STATUS.EXPIRED],
  [STATUS.RESCHEDULED]: [STATUS.CONFIRMED, STATUS.RESCHEDULED, STATUS.CANCELLED_CLIENT, STATUS.CANCELLED_STAFF, STATUS.REFUSED],
  [STATUS.CONFIRMED]: [STATUS.RESCHEDULED, STATUS.IN_PROGRESS, STATUS.CLIENT_ABSENT, STATUS.OWNER_ABSENT, STATUS.CANCELLED_CLIENT, STATUS.CANCELLED_STAFF, STATUS.OWNER_CANCELLATION_REQUESTED],
  [STATUS.OWNER_CANCELLATION_REQUESTED]: [STATUS.CONFIRMED, STATUS.CANCELLED_OWNER, STATUS.CANCELLED_STAFF],
  [STATUS.IN_PROGRESS]: [STATUS.COMPLETED, STATUS.CLIENT_ABSENT, STATUS.OWNER_ABSENT, STATUS.CANCELLED_STAFF],
});

const normalizeStatus = (status, legacyStatus) =>
  LABELS[status] ? status : LEGACY_TO_STATUS[legacyStatus] || STATUS.REQUESTED;

const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);

const actionsFor = (status, role) => {
  if (role === 'owner') {
    if (status === STATUS.CONFIRMED) return ['start', 'client_absent', 'request_cancellation', 'report_incident'];
    if (status === STATUS.IN_PROGRESS) return ['complete', 'client_absent', 'report_incident'];
    return [];
  }
  if (role === 'client') {
    if ([STATUS.REQUESTED, STATUS.AWAITING_CONFIRMATION, STATUS.RESCHEDULED, STATUS.CONFIRMED].includes(status)) return ['cancel', 'request_reschedule'];
    return [];
  }
  if (role === 'staff') return TRANSITIONS[status] || [];
  return [];
};

const appendHistory = (visite, { to, action, actor, role, comment = '', source = 'web', metadata = {} }) => {
  const from = normalizeStatus(visite.status, visite.statut);
  visite.workflowHistory.push({ from, to, action, actor, role, comment, source, metadata, at: new Date() });
  visite.status = to;
  visite.statut = STATUS_TO_LEGACY[to];
};

const resetReminderStates = (visite) => {
  visite.reminderStates = {
    twentyFourHours: false,
    twoHours: false,
    thirtyMinutes: false,
    scheduleVersion: (visite.reminderStates?.scheduleVersion || 0) + 1,
  };
  return visite.reminderStates;
};

const maskPhone = (phone = '') => {
  const clean = String(phone);
  if (clean.length < 5) return '';
  return `${clean.slice(0, 3)}••••${clean.slice(-2)}`;
};

const serializeVisite = (doc, viewerRole) => {
  const raw = doc.toObject ? doc.toObject() : { ...doc };
  const status = normalizeStatus(raw.status, raw.statut);
  const confirmed = [STATUS.CONFIRMED, STATUS.IN_PROGRESS, STATUS.COMPLETED, STATUS.CLIENT_ABSENT, STATUS.OWNER_ABSENT].includes(status);
  const clientConsent = Boolean(raw.clientContactConsent && confirmed);
  const ownerConsent = Boolean(raw.ownerContactConsent && confirmed);
  if (viewerRole === 'owner') {
    raw.telephone = clientConsent ? raw.clientPhoneSnapshot || raw.telephone : maskPhone(raw.clientPhoneSnapshot || raw.telephone);
    raw.clientWhatsAppSnapshot = clientConsent ? raw.clientWhatsAppSnapshot : '';
    if (raw.client) raw.client = { _id: raw.client._id || raw.client, name: raw.clientNameSnapshot || raw.client.name || 'Client Altimmo' };
  }
  if (viewerRole === 'client') {
    delete raw.ownerPhoneSnapshot;
    if (!ownerConsent) delete raw.ownerContact;
    if (!confirmed) {
      raw.meetingAddressSnapshot = '';
      raw.coordinatesSnapshot = null;
    }
  }
  raw.status = status;
  raw.displayStatus = LABELS[status];
  raw.allowedActions = actionsFor(status, viewerRole);
  // Heure de fin calculée (durée fixe) — jamais stockée, pour affichage dashboard.
  raw.requestedEnd = raw.scheduledEndAt || (raw.requestedDate ? computeVisitEnd(new Date(raw.requestedDate)) : null);
  return raw;
};

module.exports = { STATUS, LABELS, LEGACY_TO_STATUS, STATUS_TO_LEGACY, TRANSITIONS, normalizeStatus, canTransition, actionsFor, appendHistory, resetReminderStates, serializeVisite, maskPhone };
