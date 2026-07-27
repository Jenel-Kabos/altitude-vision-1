// Registre central des rôles locaux et capacités hôtelières (F2.6).
// Les capacités financières restent définies dans financialAuthorizationService.js
// (noms déjà établis F2.1-F2.5, ex: 'financial.document.view') — ce fichier ne les
// redéfinit pas, il les référence par leur valeur exacte dans la matrice ci-dessous
// pour éviter deux capacités concurrentes exprimant la même chose.

const HOTEL_ASSIGNMENT_ROLES = ['hotel_manager', 'reception', 'housekeeping', 'inspector', 'maintenance', 'finance', 'viewer'];
const HOTEL_ASSIGNMENT_STATUSES = ['active', 'suspended', 'revoked', 'expired'];

const HOTEL_OPERATIONAL_CAPABILITIES = Object.freeze({
  HOTEL_VIEW: 'hotel.view',
  HOTEL_MANAGE: 'hotel.manage',
  RESERVATION_VIEW: 'hotel.reservation.view',
  RESERVATION_CREATE: 'hotel.reservation.create',
  RESERVATION_UPDATE: 'hotel.reservation.update',
  RESERVATION_CANCEL: 'hotel.reservation.cancel',
  CHECKIN_EXECUTE: 'hotel.checkin.execute',
  CHECKOUT_EXECUTE: 'hotel.checkout.execute',
  CHECKOUT_FINANCIAL_OVERRIDE: 'hotel.checkout.financial_override',
  ROOM_VIEW: 'hotel.room.view',
  ROOM_MANAGE: 'hotel.room.manage',
  ROOM_ASSIGNMENT_VIEW: 'hotel.room_assignment.view',
  ROOM_ASSIGNMENT_MANAGE: 'hotel.room_assignment.manage',
  INVENTORY_VIEW: 'hotel.inventory.view',
  INVENTORY_MANAGE: 'hotel.inventory.manage',
  HOUSEKEEPING_VIEW: 'hotel.housekeeping.view',
  HOUSEKEEPING_MANAGE: 'hotel.housekeeping.manage',
  HOUSEKEEPING_COMPLETE: 'hotel.housekeeping.complete',
  INSPECTION_VIEW: 'hotel.inspection.view',
  INSPECTION_MANAGE: 'hotel.inspection.manage',
  INSPECTION_APPROVE: 'hotel.inspection.approve',
  INSPECTION_REJECT: 'hotel.inspection.reject',
  MAINTENANCE_VIEW: 'hotel.maintenance.view',
  MAINTENANCE_MANAGE: 'hotel.maintenance.manage',
  MAINTENANCE_CLOSE: 'hotel.maintenance.close',
  STAFF_ASSIGNMENT_VIEW: 'hotel.staff_assignment.view',
  STAFF_ASSIGNMENT_MANAGE: 'hotel.staff_assignment.manage',
});

// Capacités financières référencées par valeur exacte (financialAuthorizationService.CAPABILITIES) —
// pas de redéfinition, juste une liste plate utilisée pour la validation des capacités locales.
const HOTEL_FINANCIAL_CAPABILITY_VALUES = [
  'financial.document.view', 'financial.document.draft.create', 'financial.document.draft.edit', 'financial.document.issue',
  'financial.payment.view', 'financial.payment.create', 'financial.payment.confirm', 'financial.payment.allocate',
  'financial.allocation.reverse', 'financial.ledger.view', 'financial.reconciliation.view', 'financial.reconciliation.run',
  'hotel.checkout.financial.view', 'hotel.checkout.financial.override',
  'financial.document.pdf.generate', 'financial.document.pdf.download', 'financial.document.email.send', 'financial.document.delivery.view',
  'financial.hotel.dashboard.view', 'financial.hotel.dashboard.alerts.view', 'financial.hotel.dashboard.override_audit.view',
];

const ALL_HOTEL_CAPABILITY_VALUES = [...Object.values(HOTEL_OPERATIONAL_CAPABILITIES), ...HOTEL_FINANCIAL_CAPABILITY_VALUES];

const OP = HOTEL_OPERATIONAL_CAPABILITIES;
// Matrice §10 de la mission — capacités par défaut d'un rôle local, avant capacités
// explicites additionnelles éventuelles sur le rattachement. hotel_manager n'obtient
// JAMAIS CHECKOUT_FINANCIAL_OVERRIDE par défaut (réservé Admin, voir §11/§18).
const DEFAULT_CAPABILITIES_BY_ASSIGNMENT_ROLE = Object.freeze({
  hotel_manager: [
    OP.HOTEL_VIEW, OP.HOTEL_MANAGE, OP.RESERVATION_VIEW, OP.RESERVATION_CREATE, OP.RESERVATION_UPDATE, OP.RESERVATION_CANCEL,
    OP.CHECKIN_EXECUTE, OP.CHECKOUT_EXECUTE, OP.ROOM_VIEW, OP.ROOM_MANAGE,
    OP.ROOM_ASSIGNMENT_VIEW, OP.ROOM_ASSIGNMENT_MANAGE, OP.INVENTORY_VIEW, OP.INVENTORY_MANAGE,
    OP.HOUSEKEEPING_VIEW, OP.HOUSEKEEPING_MANAGE, OP.INSPECTION_VIEW, OP.MAINTENANCE_VIEW,
    'financial.document.view', 'financial.payment.view', 'financial.ledger.view', 'financial.reconciliation.view',
    'hotel.checkout.financial.view', 'financial.document.pdf.download', 'financial.document.delivery.view',
    'financial.hotel.dashboard.view', 'financial.hotel.dashboard.alerts.view',
    OP.STAFF_ASSIGNMENT_VIEW,
  ],
  reception: [OP.HOTEL_VIEW, OP.RESERVATION_VIEW, OP.RESERVATION_CREATE, OP.RESERVATION_UPDATE, OP.CHECKIN_EXECUTE, OP.CHECKOUT_EXECUTE, OP.ROOM_VIEW, OP.ROOM_ASSIGNMENT_VIEW, OP.ROOM_ASSIGNMENT_MANAGE, OP.INVENTORY_VIEW],
  housekeeping: [OP.HOTEL_VIEW, OP.HOUSEKEEPING_VIEW, OP.HOUSEKEEPING_MANAGE, OP.HOUSEKEEPING_COMPLETE, OP.ROOM_VIEW],
  inspector: [OP.HOTEL_VIEW, OP.INSPECTION_VIEW, OP.INSPECTION_MANAGE, OP.INSPECTION_APPROVE, OP.INSPECTION_REJECT, OP.ROOM_VIEW],
  maintenance: [OP.HOTEL_VIEW, OP.MAINTENANCE_VIEW, OP.MAINTENANCE_MANAGE, OP.MAINTENANCE_CLOSE, OP.ROOM_VIEW],
  finance: [
    OP.HOTEL_VIEW,
    'financial.document.view', 'financial.document.draft.create', 'financial.document.draft.edit', 'financial.document.issue',
    'financial.payment.view', 'financial.payment.create', 'financial.payment.confirm', 'financial.payment.allocate', 'financial.allocation.reverse',
    'financial.ledger.view', 'financial.reconciliation.view',
    'financial.document.pdf.generate', 'financial.document.pdf.download', 'financial.document.email.send', 'financial.document.delivery.view',
    'financial.hotel.dashboard.view', 'financial.hotel.dashboard.alerts.view',
  ],
  viewer: [OP.HOTEL_VIEW, OP.RESERVATION_VIEW, OP.ROOM_VIEW, OP.INVENTORY_VIEW, 'financial.hotel.dashboard.view'],
});

module.exports = {
  HOTEL_ASSIGNMENT_ROLES, HOTEL_ASSIGNMENT_STATUSES,
  HOTEL_OPERATIONAL_CAPABILITIES, HOTEL_FINANCIAL_CAPABILITY_VALUES, ALL_HOTEL_CAPABILITY_VALUES,
  DEFAULT_CAPABILITIES_BY_ASSIGNMENT_ROLE,
};
